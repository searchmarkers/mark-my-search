type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Array<string>;
type SearchPrefixes = Array<string>;

class ResearchDetail {
	terms: Array<string>;
	enabled: boolean;

	constructor(terms: Array<string>, enabled = true) {
		[this.terms, this.enabled] = [terms, enabled];
	}
}

class ResearchID {
	engine: string;
	terms: Array<string>;
	urls: Set<string>;

	constructor(stoplist: Array<string>, url: string) {
		this.engine = new URL(url).hostname;
		this.terms = Array.from(new Set(new URL(url).searchParams.get("q").split(" ")))
			.filter(term => stoplist.indexOf(term) === -1)
			.map(term => JSON.stringify(term.toLowerCase()).replace(/\W/g , ""))
		;
		this.urls = new Set;
	}
}

const isTabSearchPage = (searchPrefixes: SearchPrefixes, url: string) =>
	(new URL(url)).searchParams.has("q") || searchPrefixes.find(prefix => url.startsWith(`https://${prefix}`))
;

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
	console.log(urlsActive);
	console.log(urlsInactive);
	browser.contextMenus.update("deactivate-research-mode", {documentUrlPatterns: urlsActive});
	browser.contextMenus.update("activate-research-mode", {documentUrlPatterns: urlsInactive});
};

const storeNewResearchDetails = (stoplist: Stoplist, researchIds: ResearchIDs, url: string, tabId: number) => {
	researchIds[tabId] = new ResearchID(stoplist, url);
	updateUrlActive(true, researchIds, url, tabId);
	return new ResearchDetail(researchIds[tabId].terms);
};

const getCachedResearchDetails = (researchIds: ResearchIDs, url: string, tabId: number) => {
	updateUrlActive(true, researchIds, url, tabId);
	return new ResearchDetail(researchIds[tabId].terms);
};

const injectScriptOnNavigation = (stoplist: Stoplist, searchPrefixes: SearchPrefixes, researchIds: ResearchIDs, script: string) =>
	browser.webNavigation.onCommitted.addListener(details => // TODO: Inject before DOM load?
		isTabSearchPage(searchPrefixes, details.url) || isTabResearchPage(researchIds, details.tabId)
			? browser.tabs.get(details.tabId).then(tab =>
				details.frameId === 0
					? browser.tabs.executeScript(tab.id, {file: script}).then(() =>
						browser.tabs.sendMessage(tab.id, isTabSearchPage(searchPrefixes, tab.url)
							? storeNewResearchDetails(stoplist, researchIds, tab.url, tab.id)
							: getCachedResearchDetails(researchIds, tab.url, tab.id)
						)
					) : undefined
			) : undefined
	)
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
	createMenuSwitch(true, "Activate Re&search Mode",
		(tab: browser.tabs.Tab) => researchIds[tab.id] = new ResearchID(stoplist, tab.url));
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
	//const cleanHistoryFilter = {url: searchPrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
	createMenuSwitches(stoplist, researchIds);
	injectScriptOnNavigation(stoplist, searchPrefixes, researchIds, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds);
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
