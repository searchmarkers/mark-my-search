type ResearchIds = Record<number, ResearchId>;
type Stoplist = Array<string>;
type SearchPrefixes = Array<string>;
type Pages = Array<string>;

class ResearchId {
	engine: string;
	terms: Array<string>;

	constructor(stoplist: Array<string>, url: string) {
		this.engine = new URL(url).hostname;
		this.terms = Array.from(new Set(new URL(url).searchParams.get("q").split(" ")))
			.filter(term => stoplist.indexOf(term) === -1)
			.map(term => JSON.stringify(term.toLowerCase()).replace(/\W/g , ""))
		;
	}
}

const isTabSearchPage = (searchPrefixes: SearchPrefixes, url: string) =>
	searchPrefixes.find(prefix => url.startsWith(`https://${prefix}`))
;

const isTabResearchPage = (researchIds: ResearchIds, tabId: number) =>
	tabId in researchIds
;

const updateUrlActive = (activate: boolean, pagesActive: Pages, pagesInactive: Pages, url: string) => {
	/*const [pagesFrom, pagesTo] = activate ? [pagesInactive, pagesActive] : [pagesActive, pagesInactive];
	pagesFrom.splice(pagesFrom.indexOf(url), 1);
	pagesTo.push(url);
	browser.contextMenus.update("deactivate-research-mode", {documentUrlPatterns: pagesActive});
	browser.contextMenus.update("activate-research-mode", {documentUrlPatterns: pagesInactive});*/
};

const storeNewSearchDetails = (stoplist: Stoplist, researchIds: ResearchIds,
	pagesActive: Pages, pagesInactive: Pages, url: string, tabId: number) => {
	researchIds[tabId] = new ResearchId(stoplist, url);
	updateUrlActive(true, pagesActive, pagesInactive, url);
	return researchIds[tabId];
};

const getCachedSearchDetails = (researchIds: ResearchIds,
	pagesActive: Pages, pagesInactive: Pages, url: string, tabId: number) => {
	updateUrlActive(true, pagesActive, pagesInactive, url);
	return researchIds[tabId];
};

const injectScriptOnNavigation = (stoplist: Stoplist, searchPrefixes: SearchPrefixes, researchIds: ResearchIds,
	pagesActive: Pages, pagesInactive: Pages, script: string) =>
	browser.webNavigation.onDOMContentLoaded.addListener(details =>
		isTabSearchPage(searchPrefixes, details.url) || isTabResearchPage(researchIds, details.tabId)
			? browser.tabs.get(details.tabId).then(tab =>
				details.frameId === 0
					? browser.tabs.executeScript(tab.id, {file: script}).then(() =>
						browser.tabs.sendMessage(tab.id, isTabSearchPage(searchPrefixes, tab.url)
							? storeNewSearchDetails(stoplist, researchIds, pagesActive, pagesInactive, tab.url, tab.id)
							: getCachedSearchDetails(researchIds, pagesActive, pagesInactive,tab.url, tab.id)
						)
					) : undefined
			) : undefined
	)
;

const extendResearchOnTabCreated = (researchIds: ResearchIds, pagesActive: Pages, pagesInactive: Pages) =>
	browser.tabs.onCreated.addListener(tab => {
		if (tab.openerTabId in researchIds) {
			researchIds[tab.id] = researchIds[tab.openerTabId];
			updateUrlActive(true, pagesActive, pagesInactive, tab.url);
		}
	})
;

const createContextSwitch = (stoplist: Stoplist, researchIds: ResearchIds, pagesActive: Pages, pagesInactive: Pages) => {
	browser.contextMenus.create({title: "Deactivate Re&search Mode", id: "deactivate-research-mode", documentUrlPatterns: pagesActive, onclick: (event, tab) => {
		browser.tabs.sendMessage(tab.id, {engine: "", terms: []});
		browser.tabs.get(tab.id).then(tab => {
			delete researchIds[tab.id];
			updateUrlActive(false, pagesActive, pagesInactive, tab.url);
		});
	}});
	browser.contextMenus.create({title: "Activate Re&search Mode", id: "activate-research-mode", documentUrlPatterns: pagesInactive, onclick: (event, tab) => {
		browser.tabs.sendMessage(tab.id, {engine: "duckduckgo.com", terms: []});
		browser.tabs.get(tab.id).then(tab => {
			researchIds[tab.id] = new ResearchId(stoplist, tab.url);
			updateUrlActive(true, pagesActive, pagesInactive, tab.url);
		});
	}});
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
	const researchIds: ResearchIds = {};
	const pagesActive: Array<string> = [];
	const pagesInactive: Array<string> = [];
	//const cleanHistoryFilter = {url: searchPrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
	createContextSwitch(stoplist, researchIds, pagesActive, pagesInactive);
	injectScriptOnNavigation(stoplist, searchPrefixes, researchIds, pagesActive, pagesInactive, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds, pagesActive, pagesInactive);
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
