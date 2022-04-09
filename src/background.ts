type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Array<string>;
type SearchPrefixes = Array<string>;
type Engines = Record<string, Engine>;

class ResearchDetail {
	terms: Array<string>;
	enabled: boolean;

	constructor(terms: Array<string>, enabled = true) {
		this.terms = terms;
		this.enabled = enabled;
	}
}

class ResearchID {
	engine: string;
	terms: Array<string>;
	urls: Set<string>;

	constructor(stoplist: Array<string>, url: string, engine?: Engine) {
		this.engine = new URL(url).hostname;
		const rawTerms = engine
			? engine.extract(url)
			: new URL(url).searchParams.get(SEARCH_PARAM).split(" ");
		this.terms = Array.from(new Set(rawTerms))
			.filter(term => stoplist.indexOf(term) === -1)
			.map(term => JSON.stringify(term.toLowerCase()).replace(/\W/g , ""));
		this.urls = new Set;
	}
}

class Engine {
	// TODO: check and finish
	#hostname: string;
	#pathname: [string, string];
	#param: string;

	constructor(pattern: string) {
		// TODO: error checking?
		const urlPattern = new URL(pattern);
		this.#hostname = urlPattern.hostname;
		if (urlPattern.pathname.includes(ENGINE_RFIELD)) {
			const parts = urlPattern.pathname.split(ENGINE_RFIELD);
			this.#pathname = [parts[0], parts[1].slice(0, parts[1].endsWith("/") ? parts[1].length : undefined)];
		} else {
			this.#param = Array.from(urlPattern.searchParams).find(param => param[1].includes(ENGINE_RFIELD))[0];
		}
	}

	extract(urlString: string, matchOnly = false) {
		const url = new URL(urlString);
		return url.hostname !== this.#hostname ? null : this.#pathname
			? url.pathname.startsWith(this.#pathname[0]) && url.pathname.slice(this.#pathname[0].length).includes(this.#pathname[1])
				? matchOnly ? [] : url.pathname.slice(
					url.pathname.indexOf(this.#pathname[0]) + this.#pathname[0].length,
					url.pathname.lastIndexOf(this.#pathname[1])).split("+")
				: null
			: url.searchParams.has(this.#param)
				? matchOnly ? [] : url.searchParams.get(this.#param).split(" ")
				: null;
	}

	match(urlString: string) {
		return !!this.extract(urlString, true);
	}

	equals(engine: Engine) {
		return engine.#hostname === this.#hostname
			&& engine.#param === this.#param
			&& engine.#pathname === this.#pathname;
	}
}

const ENGINE_RFIELD = "%s";
const SEARCH_PARAM = "q";

const isTabSearchPage = (searchPrefixes: SearchPrefixes, engines: Engines, url: string): [boolean, Engine] => {
	if (new URL(url).searchParams.has(SEARCH_PARAM) || searchPrefixes.find(prefix => url.startsWith(`https://${prefix}`))) {
		return [true, undefined];
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return [!!engine, engine];
	}
};

const isTabResearchPage = (researchIds: ResearchIDs, tabId: number) =>
	tabId in researchIds
;

const updateUrlActive = (activate: boolean, researchIds: ResearchIDs, url: string, tabId: number) => {
	if (!(tabId in researchIds)) return;
	// TODO: Fix
	if (activate) {
		researchIds[tabId].urls.add(url);
	} else {
		researchIds[tabId].urls.delete(url);
	}
	const urlsActive = Object.values(researchIds).flatMap(researchId => Array.from(researchId.urls));
	const urlsInactive = [];
	browser.tabs.query({}).then(tabs => tabs.forEach(tab =>
		urlsActive.includes(tab.url) ? undefined : urlsInactive.push(tab.url)
	));
	browser.contextMenus.update("deactivate-research-mode", {documentUrlPatterns: urlsActive});
	browser.contextMenus.update("activate-research-mode", {documentUrlPatterns: urlsInactive});
};

const storeNewResearchDetails = (stoplist: Stoplist, researchIds: ResearchIDs, url: string, tabId: number, engine?: Engine) => {
	researchIds[tabId] = new ResearchID(stoplist, url, engine);
	updateUrlActive(true, researchIds, url, tabId);
	return new ResearchDetail(researchIds[tabId].terms);
};

const getCachedResearchDetails = (researchIds: ResearchIDs, url: string, tabId: number) => {
	updateUrlActive(true, researchIds, url, tabId);
	return new ResearchDetail(researchIds[tabId].terms);
};

const injectScriptOnNavigation = (stoplist: Stoplist, searchPrefixes: SearchPrefixes,
	engines: Engines, researchIds: ResearchIDs, script: string) =>
	browser.webNavigation.onCommitted.addListener(details => { // TODO: Inject before DOM load?
		const [isSearchPage, engine] = isTabSearchPage(searchPrefixes, engines, details.url);
		console.log(isSearchPage);
		if (isSearchPage || isTabResearchPage(researchIds, details.tabId)) {
			browser.tabs.get(details.tabId).then(tab => details.frameId === 0
				? browser.tabs.executeScript(tab.id, {file: script})
					.then(() => browser.tabs.sendMessage(tab.id, isSearchPage
						? storeNewResearchDetails(stoplist, researchIds, tab.url, tab.id, engine)
						: getCachedResearchDetails(researchIds, tab.url, tab.id)))
				: undefined
			);
		}
	})
;

const extendResearchOnTabCreated = (researchIds: ResearchIDs) =>
	browser.tabs.onCreated.addListener(tab => {
		if (tab.openerTabId in researchIds) {
			researchIds[tab.id] = researchIds[tab.openerTabId];
		}
	})
;

const getMenuSwitchId = (activate: boolean) =>
	(activate ? "" : "de") + "activate-research-mode"
;

const createMenuSwitches = (stoplist: Stoplist, researchIds: ResearchIDs) => {
	const createMenuSwitch = (activate: boolean, title: string, action: CallableFunction) =>
		browser.contextMenus.create({title, id: getMenuSwitchId(activate), documentUrlPatterns: [], onclick: (event, tab) => {
			browser.tabs.sendMessage(tab.id, new ResearchDetail([], activate));
			browser.tabs.get(tab.id).then(tab => {
				action();
				updateUrlActive(activate, researchIds, tab.url, tab.id);
			});
		}});
	createMenuSwitch(false, "Deactivate Re&search Mode",
		(tab: browser.tabs.Tab) => delete researchIds[tab.id]);
	createMenuSwitch(true, "Activate Re&search Mode", // TODO: fix
		(tab: browser.tabs.Tab) => researchIds[tab.id] = new ResearchID(stoplist, tab.url));
};

const addEngine = (engines: Engines, id: string, pattern: string) => {
	if (!pattern) return;
	if (!pattern.includes(ENGINE_RFIELD)) {
		delete engines[id];
		return;
	}
	const engine = new Engine(pattern);
	if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
	engines[id] = engine;
};

const setEngines = (engines: Engines, setEngine: CallableFunction, node: browser.bookmarks.BookmarkTreeNode) =>
	node.type === "bookmark"
		? setEngine(engines, node)
		: node.type === "folder"
			? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
;

const addEngineOnBookmarkChanged = (engines: Engines) => {
	browser.bookmarks.getTree().then(nodes =>
		nodes.forEach(node => setEngines(engines, (engines: Engines, node: browser.bookmarks.BookmarkTreeNode) =>
			addEngine(engines, node.id, node.url), node)));
	browser.bookmarks.onRemoved.addListener((id, removeInfo) =>
		setEngines(engines, (engines: Engines, node: browser.bookmarks.BookmarkTreeNode) =>
			delete engines[node.id], removeInfo.node));
	browser.bookmarks.onCreated.addListener((id, createInfo) =>
		addEngine(engines, id, createInfo.url));
	browser.bookmarks.onChanged.addListener((id, changeInfo) =>
		addEngine(engines, id, changeInfo.url));
};

const initialize = () => {
	const stoplist: Stoplist = [
		"a",
		"about",
		"above",
		"after",
		"again",
		"against",
		"all",
		"am",
		"an",
		"and",
		"any",
		"are",
		"aren't",
		"as",
		"at",
		"be",
		"because",
		"been",
		"before",
		"being",
		"below",
		"between",
		"both",
		"but",
		"by",
		"can't",
		"cannot",
		"could",
		"couldn't",
		"did",
		"didn't",
		"do",
		"does",
		"doesn't",
		"doing",
		"don't",
		"down",
		"during",
		"each",
		"few",
		"for",
		"from",
		"further",
		"had",
		"hadn't",
		"has",
		"hasn't",
		"have",
		"haven't",
		"having",
		"he",
		"he'd",
		"he'll",
		"he's",
		"her",
		"here",
		"here's",
		"hers",
		"herself",
		"him",
		"himself",
		"his",
		"how",
		"how's",
		"i",
		"i'd",
		"i'll",
		"i'm",
		"i've",
		"if",
		"in",
		"into",
		"is",
		"isn't",
		"it",
		"it's",
		"its",
		"itself",
		"let's",
		"me",
		"more",
		"most",
		"mustn't",
		"my",
		"myself",
		"no",
		"nor",
		"not",
		"of",
		"off",
		"on",
		"once",
		"only",
		"or",
		"other",
		"ought",
		"our",
		"ours",
		"ourselves",
		"out",
		"over",
		"own",
		"same",
		"shan't",
		"she",
		"she'd",
		"she'll",
		"she's",
		"should",
		"shouldn't",
		"so",
		"some",
		"such",
		"than",
		"that",
		"that's",
		"the",
		"their",
		"theirs",
		"them",
		"themselves",
		"then",
		"there",
		"there's",
		"these",
		"they",
		"they'd",
		"they'll",
		"they're",
		"they've",
		"this",
		"those",
		"through",
		"to",
		"too",
		"under",
		"until",
		"up",
		"very",
		"was",
		"wasn't",
		"we",
		"we'd",
		"we'll",
		"we're",
		"we've",
		"were",
		"weren't",
		"what",
		"what's",
		"when",
		"when's",
		"where",
		"where's",
		"which",
		"while",
		"who",
		"who's",
		"whom",
		"why",
		"why's",
		"with",
		"won't",
		"would",
		"wouldn't",
		"you",
		"you'd",
		"you'll",
		"you're",
		"you've",
		"your",
		"yours",
		"yourself",
		"yourselves",
	];
	const searchPrefixes: SearchPrefixes = [
		"www.bing.com/search",
		"duckduckgo.com/",
		"www.ecosia.org/search",
		"www.google.com/search",
		"scholar.google.co.uk/scholar",
	];
	const researchIds: ResearchIDs = {};
	const engines: Engines = {};
	//const cleanHistoryFilter = {url: searchPrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
	createMenuSwitches(stoplist, researchIds);
	injectScriptOnNavigation(stoplist, searchPrefixes, engines, researchIds, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds);
	addEngineOnBookmarkChanged(engines);
};

initialize();

/*browser.webNavigation.onHistoryStateUpdated.addListener(details => {
	browser.history.search({
		text: (new URL(details.url)).hostname,
		startTime: details.timeStamp - 9999,
		maxResults: 1,
	}).then(historyItems => {
		if (historyItems.length > 0) browser.history.deleteUrl({url: historyItems[0].url});
	});
}, cleanHistoryFilter);*/
