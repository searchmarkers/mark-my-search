type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;

class ResearchID {
	terms: MatchTerms;
	urls: Set<string>;

	constructor(stoplist: Array<string>, url: string, engine?: Engine) {
		const rawTerms = engine
			? engine.extract(url)
			: new URL(url).searchParams.get(SEARCH_PARAM).split(" ");
		this.terms = Array.from(new Set(rawTerms))
			.filter(term => stoplist.indexOf(term) === -1)
			.map(term => new MatchTerm(JSON.stringify(stem()(term.toLocaleLowerCase())).replace(/\W/g , "")));
		this.urls = new Set; // TODO: address code duplication [term processing]
	}
}

class Engine {
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

const getMenuSwitchId = (activate: boolean) =>
	(activate ? "" : "de") + "activate-research-mode"
;

const isTabSearchPage = (engines: Engines, url: string): [boolean, Engine] => {
	if (new URL(url).searchParams.has(SEARCH_PARAM)) {
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
	if (tabId in researchIds) {
		researchIds[tabId].urls[activate ? "add" : "delete"](url);
	}
	const urlsActive = Object.values(researchIds).flatMap(researchId => Array.from(researchId.urls));
	browser.contextMenus.update(getMenuSwitchId(false), {documentUrlPatterns: urlsActive});
};

const storeNewResearchDetails = (stoplist: Stoplist, researchIds: ResearchIDs, url: string, tabId: number, engine?: Engine) => {
	researchIds[tabId] = new ResearchID(stoplist, url, engine);
	updateUrlActive(true, researchIds, url, tabId);
	return new Message({ terms: researchIds[tabId].terms });
};

const getCachedResearchDetails = (researchIds: ResearchIDs, url: string, tabId: number) => {
	updateUrlActive(true, researchIds, url, tabId);
	return new Message({ terms: researchIds[tabId].terms });
};

const updateCachedResearchDetails = (researchIds: ResearchIDs, terms: MatchTerms, tabId: number) => {
	researchIds[tabId].terms = terms;
	return new Message({ terms });
};

const injectScriptOnNavigation = (stoplist: Stoplist, engines: Engines, researchIds: ResearchIDs, script: string) =>
	browser.webNavigation.onCommitted.addListener(details => {
		if (details.frameId !== 0) return;
		const [isSearchPage, engine] = isTabSearchPage(engines, details.url);
		if (isSearchPage || isTabResearchPage(researchIds, details.tabId)) {
			browser.tabs.get(details.tabId).then(tab => browser.tabs.executeScript(tab.id, { file: "/dist/stemmer.js" }).then(() =>
				browser.tabs.get(details.tabId).then(tab => browser.tabs.executeScript(tab.id, { file: "/dist/shared-content.js" }).then(() =>
					browser.tabs.executeScript(tab.id, { file: script }).then(() => browser.tabs.sendMessage(tab.id, isSearchPage
						? storeNewResearchDetails(stoplist, researchIds, tab.url, tab.id, engine)
						: getCachedResearchDetails(researchIds, tab.url, tab.id))
					)
				))
			));
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

const createMenuSwitches = (stoplist: Stoplist, researchIds: ResearchIDs) => {
	const createMenuSwitch = (activate: boolean, title: string, contexts: Array<browser.contextMenus.ContextType>,
		documentUrlPatterns: Array<string>, action: (tab: browser.tabs.Tab) => void) =>
		browser.contextMenus.create({ title, id: getMenuSwitchId(activate), contexts, documentUrlPatterns,
			onclick: (event, tab) => {
				browser.tabs.sendMessage(tab.id, new Message({ terms: [], enabled: activate }));
				browser.tabs.get(tab.id).then(tab => {
					action(tab);
					updateUrlActive(activate, researchIds, tab.url, tab.id);
				});
			}
		});
	createMenuSwitch(false, "Deactivate Re&search Mode", ["page"], [],
		tab => delete researchIds[tab.id]);
	createMenuSwitch(true, "Activate Re&search Mode", ["selection"], undefined,
		tab => researchIds[tab.id] = new ResearchID(stoplist, tab.url));
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

const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
	node: browser.bookmarks.BookmarkTreeNode) =>
	node.type === "bookmark"
		? setEngine(node)
		: node.type === "folder"
			? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
;

const addEngineOnBookmarkChanged = (engines: Engines) => {
	browser.bookmarks.getTree().then(nodes =>
		nodes.forEach(node => setEngines(engines, node =>
			addEngine(engines, node.id, node.url), node)));
	browser.bookmarks.onRemoved.addListener((id, removeInfo) =>
		setEngines(engines, node =>
			delete engines[node.id], removeInfo.node));
	browser.bookmarks.onCreated.addListener((id, createInfo) =>
		addEngine(engines, id, createInfo.url));
	browser.bookmarks.onChanged.addListener((id, changeInfo) =>
		addEngine(engines, id, changeInfo.url));
};

const sendMessageOnCommand = () => browser.commands.onCommand.addListener(command =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		browser.tabs.sendMessage(tabs[0].id, new Message({ command }))
	)
);

const sendUpdateMessagesOnMessage = (researchIds: ResearchIDs) =>
	browser.runtime.onMessage.addListener((terms: MatchTerms, sender) => {
		const message = updateCachedResearchDetails(researchIds, terms, sender.tab.id);
		researchIds[sender.tab.id].urls.forEach(url =>
			browser.tabs.query({ url }).then(tabs => tabs.forEach(tab => browser.tabs.sendMessage(tab.id, message)))
		);
	})
;

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
	const researchIds: ResearchIDs = {};
	const engines: Engines = {};
	//const cleanHistoryFilter = {url: searchPrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
	createMenuSwitches(stoplist, researchIds);
	injectScriptOnNavigation(stoplist, engines, researchIds, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds);
	addEngineOnBookmarkChanged(engines);
	sendMessageOnCommand();
	sendUpdateMessagesOnMessage(researchIds);
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
