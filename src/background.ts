type ResearchIds = Record<number, ResearchId>;
type Stoplist = Array<string>;
type SearchPrefixes = Array<string>;

class ResearchId {
	engine: string;
	terms: Array<string>;

	constructor(stoplist: Array<string>, url: URL) {
		this.engine = url.hostname;
		this.terms = Array.from(new Set(url.searchParams.get("q").split(" ")))
			.filter(term => stoplist.indexOf(term) === -1)
			.map(term => JSON.stringify(term.toLowerCase()).replace(/\W/g , ""))
		;
	}
}

const isTabSearchPage = (searchPrefixes: SearchPrefixes, url: string, tabId: number) =>
	searchPrefixes.find(prefix => url.startsWith(`https://${prefix}`))
;

const isTabResearchPage = (researchIds: ResearchIds, tabId: number) =>
	tabId in researchIds
;

const getSearchDetailsNew = (stoplist: Stoplist, researchIds: ResearchIds, url: URL, tabId: number) => {
	researchIds[tabId] = new ResearchId(stoplist, url);
	return researchIds[tabId];
};

const getSearchDetailsCached = (researchIds: ResearchIds, tabId: number) =>
	researchIds[tabId]
;

const injectScriptOnNavigation = (stoplist: Stoplist, searchPrefixes: SearchPrefixes, researchIds: ResearchIds, script: string) =>
	browser.webNavigation.onDOMContentLoaded.addListener(details =>
		isTabSearchPage(searchPrefixes, details.url, details.tabId) || isTabResearchPage(researchIds, details.tabId)
		? browser.tabs.get(details.tabId).then(tab =>
			new URL(details.url).hostname === new URL(tab.url).hostname && !details.url.includes(".html") // TODO: Exclude better.
			? browser.tabs.executeScript(tab.id, {file: script}).then(() =>
				browser.tabs.sendMessage(tab.id, isTabSearchPage(searchPrefixes, tab.url, tab.id)
					? getSearchDetailsNew(stoplist, researchIds, new URL(tab.url), tab.id)
					: getSearchDetailsCached(researchIds, tab.id)
				)
			) : undefined
		) : undefined
	)
;

const extendResearchOnTabCreated = (researchIds: ResearchIds) =>
	browser.tabs.onCreated.addListener(tab => tab.openerTabId in researchIds
		? researchIds[tab.id] = researchIds[tab.openerTabId]
		: undefined
	)
;

{
	const researchIds: ResearchIds = {};
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
	];
	//const cleanHistoryFilter = {url: searchPrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
	injectScriptOnNavigation(stoplist, searchPrefixes, researchIds, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds);
}

// HISTORY CLEANING //
/*browser.webNavigation.onHistoryStateUpdated.addListener(details => {
	browser.history.search({
		text: (new URL(details.url)).hostname,
		startTime: details.timeStamp - 9999,
		maxResults: 1,
	}).then(historyItems => {
		if (historyItems.length > 0) browser.history.deleteUrl({url: historyItems[0].url});
	});
}, cleanHistoryFilter);*/
