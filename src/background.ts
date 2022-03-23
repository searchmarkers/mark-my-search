const stoplist = [
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
const enginePrefixes = [
	"www.bing.com/search",
	"duckduckgo.com/",
	"www.ecosia.org/search",
	"www.google.com/search",
];
//const cleanHistoryFilter = {url: enginePrefixes.map(prefix => ({urlPrefix: `https://${prefix}`}))};
const searchPagePrefixes = enginePrefixes.map(prefix => `https://${prefix}`); // TODO: allow user modification
const researchIds = {}; // Research IDs accessed by tab ID
const researchAddresses = {}; // Research address arrays accessed by research ID

const getSearchDetails = (url: URL, tabId: number) => {
	const searchDetails = {engineName: "", terms: []};
	const host = url.hostname.substring(0, url.hostname.lastIndexOf("."));
	const engineName = host.substring(host.lastIndexOf(".") + 1);
	if (tabId in researchIds) { // This tab is already being used for research.
		const details = researchIds[tabId].split(":");
		searchDetails.engineName = details[0];
		searchDetails.terms = details[1].split(",");
		console.log(searchDetails);
	} else if (searchPagePrefixes.find(prefix => url.href.startsWith(prefix))) { // This tab is not yet being used for research.
		searchDetails.terms = Array.from(new Set(url.searchParams.get("q").split(" "))).filter(term => stoplist.indexOf(term) === -1).map(
			term => JSON.stringify(term.toLowerCase()).replace(/\W/g , "")
		);
		const researchAddress = url.host + url.hostname + url.search;
		const researchArea = engineName + ":" + searchDetails.terms.join(",");
		researchIds[tabId] = researchArea;
		if (!(researchArea in researchAddresses)) {
			researchAddresses[researchArea] = [researchAddress];
		} else if (researchAddresses[researchArea].indexOf(researchAddress) === -1) {
			researchAddresses[researchArea].push(researchAddress);
		}
	}
	return searchDetails;
};

browser.webNavigation.onCompleted.addListener(async function(details) {
	await browser.tabs.executeScript(details.tabId, {file: "/dist/search-highlight/common.js"});
	await browser.tabs.sendMessage(details.tabId, getSearchDetails(new URL(details.url), details.tabId));
	browser.tabs.executeScript(details.tabId, {file: `/dist/search-highlight/${
		searchPagePrefixes.find(prefix => details.url.startsWith(prefix)) === undefined ? "page-general" : "page-special"}.js`});
});

browser.tabs.onCreated.addListener(tab => {
	if (tab.openerTabId in researchIds) researchIds[tab.id] = researchIds[tab.openerTabId];
});


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
