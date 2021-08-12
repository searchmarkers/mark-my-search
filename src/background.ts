namespace background {
	const enginePrefixes = [
		"www.bing.com/search",
		"duckduckgo.com/",
		"www.ecosia.org/search",
		"www.google.com/search",
	];
	const searchPagePrefixes = ["file:///home/dominic/Documents/firemod/",];
	const cleanHistoryFilter = {url: [{urlPrefix: "file:///home/dominic/Documents/firemod/"}]};
	const resultsTabIds = {};
	const resultsPages = {};

	for (const prefix of enginePrefixes) {
		cleanHistoryFilter.url.push({urlPrefix: "https://" + prefix});
		searchPagePrefixes.push("https://" + prefix);
	}

	browser.webNavigation.onHistoryStateUpdated.addListener((details) => {
		const host = (new URL(details.url)).hostname;
		const query = {text: host, startTime: details.timeStamp - 9999, maxResults: 1};
		browser.history.search(query).then((historyItems) => {
			if (historyItems.length > 0) browser.history.deleteUrl({url: historyItems[0].url});
		});
	}, cleanHistoryFilter);

	browser.webNavigation.onCompleted.addListener(async function(details) {
		browser.tabs.executeScript(details.tabId, {file: "/dist/search-highlight/common.js"});
		for (const prefix of searchPagePrefixes) {
			if (details.url.startsWith(prefix)) {
				//let tab = browser.tabs.get(details.tabId);
				console.log(0);
				browser.tabs.executeScript(details.tabId, {file: "/dist/search-highlight/page-special.js"});
				return;
			}
		}
		browser.tabs.executeScript(details.tabId, {file: "/dist/search-highlight/page-general.js"});
	});

	browser.tabs.onCreated.addListener((details) => {
		browser.tabs.get(details.id).then((tab) => {
			const openerId = tab.openerTabId;
			if (openerId in resultsTabIds) resultsTabIds[openerId].push(tab.id);
		});
	});
}
