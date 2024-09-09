/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import "/dist/modules/namespace/normalize.mjs";
import type { ConfigURLFilters, ResearchInstance, SearchSites, URLFilter } from "/dist/modules/storage.mjs";
import { Bank, Config, configInitialize } from "/dist/modules/storage.mjs";
import { parseCommand } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.d.mjs";
import { sendTabMessage } from "/dist/modules/messaging/tab.mjs";
import { MatchTerm } from "/dist/modules/match-term.mjs";
import { SearchSite } from "/dist/modules/search-site.mjs";
import * as Tabs from "/dist/modules/privileged/tabs.mjs";
import { log, assert, compatibility, sanitizeForRegex } from "/dist/modules/common.mjs";

// DEPRECATE
/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Array<string>, url: string, engine?: SearchSite }
	terms?: ReadonlyArray<MatchTerm>
}): Promise<ResearchInstance> => {
	const config = await Config.get({ showHighlights: { default: true }, barCollapse: { fromSearch: true } });
	if (args.url) {
		const phraseGroups = args.url.engine ? [] : (await getSearchQuery(args.url.url)).split("\"");
		const termsRaw = args.url.engine
			? args.url.engine.extract(args.url.url ?? "")
			: phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		return {
			terms: Array.from(new Set(termsRaw))
				.filter(phrase => args.url ? !args.url.stoplist.includes(phrase) : false)
				.map(phrase => new MatchTerm(phrase)),
			highlightsShown: config.showHighlights.default,
			barCollapsed: config.barCollapse.fromSearch,
			enabled: true,
		};
	}
	args.terms ??= [];
	return {
		terms: args.terms,
		highlightsShown: config.showHighlights.default,
		barCollapsed: false,
		enabled: true,
	};
};

/**
 * Gets the query string of a potential search.
 * @param url A URL to be tested.
 * @returns The URL segment determined to be the search query, or the empty string if none is found.
 */
const getSearchQuery = async (url: string): Promise<string> =>
	Config.get({ autoFindOptions: { searchParams: true } }).then(config =>
		new URL(url).searchParams.get(
			config.autoFindOptions.searchParams.getList().find(param => new URL(url).searchParams.has(param)) ?? ""
		) ?? ""
	).catch(() => {
		log("search query extraction fail", "", { url });
		return "";
	})
;

/**
 * Gets heuristically whether or not a URL specifies a search on an arbitrary search engine.
 * @param engines An array of objects representing search engine URLs and how to extract contained search queries.
 * @param url A URL to be tested.
 * @returns An object containing a flag for whether or not the URL specifies a search,
 * and the first object which matched the URL (if any).
 */
const isTabSearchPage = async (engines: SearchSites, url: string): Promise<{ isSearch: boolean, engine?: SearchSite }> => {
	if (await getSearchQuery(url)) {
		return { isSearch: true };
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return { isSearch: !!engine, engine };
	}
};

/**
 * Determines whether a URL is filtered in by a given URL filter.
 * @param url A URL object.
 * @param urlFilter A URL filter array, the component strings of which may contain wildcards.
 * @returns `true` if the URL is filtered in, `false` otherwise.
 */
const isUrlFilteredIn = (() => {
	const sanitize = (urlComponent: string) =>
		sanitizeForRegex(urlComponent).replace("\\*", ".*")
	;

	return (url: URL, urlFilter: URLFilter): boolean =>
		!!urlFilter.find(({ hostname, pathname }) => (
			(new RegExp(sanitize(hostname) + "\\b")).test(url.hostname)
			&& (pathname === ""
				|| pathname === "/"
				|| (new RegExp("\\b" + sanitize(pathname.slice(1)))).test(url.pathname.slice(1))
			)
		))
	;
})();

/**
 * Determines whether the user has permitted pages with the given URL to be deeply modified during highlighting,
 * which is powerful but may be destructive.
 * @param urlString The valid URL string corresponding to a page to be potentially highlighted.
 * @param urlFilters URL filter preferences.
 * @returns `true` if the corresponding page may be modified, `false` otherwise.
 */
const isUrlPageModifyAllowed = (urlString: string, urlFilters: ConfigURLFilters) => {
	try {
		return !isUrlFilteredIn(new URL(urlString), urlFilters.noPageModify);
	} catch {
		return true;
	}
};

/**
 * Determines whether the user has permitted pages with the given URL to treated as a search page,
 * from which keywords may be collected.
 * @param urlString The valid URL string corresponding to a page to be potentially auto-highlighted.
 * @param urlFilters An object of details about URL filtering.
 * @returns `true` if the corresponding page may be treated as a search page, `false` otherwise.
 */
const isUrlSearchHighlightAllowed = (urlString: string, urlFilters: ConfigURLFilters) =>
	!isUrlFilteredIn(new URL(urlString), urlFilters.nonSearch)
;

/**
 * Determines whether the highlight-showing should be toggled on, off, or left unchanged.
 * @param highlightsShown Whether or not highlights are shown currently.
 * @param overrideHighlightsShown Whether or not to force highlights to be shown,
 * or not change highlight-showing if `undefined`
 * @returns `true` to toggle on, `false` to toggle off, `undefined` to not change.
 */
const determineToggleHighlightsOn = (highlightsShown: boolean, overrideHighlightsShown?: boolean) =>
	overrideHighlightsShown === undefined
		? undefined
		: highlightsShown || overrideHighlightsShown
;

/**
 * Caches objects, representing search engine URLs and how to extract their search queries, to session storage.
 * These objects are generated from information such as dynamic bookmarks stored by the user,
 * and caching is triggered on information update.
 */
const manageEnginesCacheOnBookmarkUpdate = (() => {
	/**
	 * Updates an array of user search engines with respect to a particular engine ID, based on a potentially dynamic URL.
	 * @param engines An array of user search engines.
	 * @param id The unique ID of a potential or existing engine.
	 * @param urlDynamicString The string of a URL which may be dynamic (contains `%s` as in a dynamic bookmark).
	 */
	const updateEngine = (engines: SearchSites, id: string, urlDynamicString: string) => {
		if (!urlDynamicString) {
			return;
		}
		if (!urlDynamicString.includes("%s")) {
			delete engines[id];
			return;
		}
		const engine = new SearchSite({ urlDynamicString });
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) {
			return;
		}
		engines[id] = engine;
	};

	/**
	 * Uses a function accepting a single bookmark tree node to modify user search engines in storage.
	 * Accepts all such nodes under a root node.
	 * @param engines An array of user search engine objects.
	 * @param setEngine A function to modify user search engines in storage based on a bookmark tree node.
	 * @param node A root node under which to accept descendant nodes (inclusive).
	 */
	const setEngines = (engines: SearchSites, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) => {
		if (node.type === "bookmark") {
			setEngine(node);
		}
		(node.children ?? []).forEach(child => setEngines(engines, setEngine, child));
	};

	return () => {
		if (compatibility.browser === "chromium" || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(async nodes => {
			const bank = await Bank.get([ "engines" ]);
			nodes.forEach(node =>
				setEngines(bank.engines, node => {
					if (node.url) {
						updateEngine(bank.engines, node.id, node.url);
					}
				}, node)
			);
			Bank.set(bank);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const bank = await Bank.get([ "engines" ]);
			setEngines(bank.engines, node => {
				delete bank.engines[node.id];
			}, removeInfo.node);
			Bank.set(bank);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const bank = await Bank.get([ "engines" ]);
				updateEngine(bank.engines, id, createInfo.url);
				Bank.set(bank);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const bank = await Bank.get([ "engines" ]);
				updateEngine(bank.engines, id, changeInfo.url);
				Bank.set(bank);
			}
		});
	};
})();

const injectIntoTabs = () => new Promise<void>(resolve => {
	let pendingCount = 0;
	chrome.tabs.query({}).then(tabs => tabs.forEach(async tab => {
		if (tab.id === undefined) {
			return;
		}
		pendingCount++;
		await chrome.scripting.executeScript({
			target: { tabId: tab.id as number },
			files: [ "/dist/content-entry.js" ],
		}).catch(() => chrome.runtime.lastError); // Read `lastError` to suppress injection errors.
		pendingCount--;
		if (pendingCount === 0) resolve();
	}));
});

///**
// * Set the action icon to reflect the extension's enabled/disabled status.
// * @param enabled If specified, overrides the extension's enabled/disabled status.
// */
//const setActionIconEnabled = async (enabled: boolean) => {
//	await chrome.action.setIcon({ path: compatibility.browser === "chromium"
//		? (enabled ? "/icons/dist/mms-32.png" : "/icons/dist/mms-off-32.png") // Chromium lacks SVG support for the icon.
//		: (enabled ? "/icons/mms.svg" : "/icons/mms-off.svg")
//	});
//};

///**
// * Updates the action icon to reflect the extension's current enabled/disabled status.
// */
//const updateActionIcon = async () => {
//	const config = await Config.get({ autoFindOptions: [ "enabled" ] });
//	await setActionIconEnabled(config.autoFindOptions.enabled);
//};

(() => {
	const contextMenuListener = async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
		if (tab && tab.id !== undefined) {
			log("research-activation request", "context menu item activated", { tabId: tab.id });
			activateResearchInTab(tab.id, await getTermsSelectedInTab(tab.id));
		} else {
			assert(false, "research-activation (from context menu) void request",
				"no valid tab", { tab });
		}
	};

	/**
	 * Registers items to selectively appear in context menus, if not present, to serve as shortcuts for managing the extension.
	 */
	const createContextMenuItems = () => {
		if (compatibility.browser === "chromium" && chrome.contextMenus.onClicked["hasListeners"]()) {
			return;
		}
		chrome.contextMenus.removeAll();
		chrome.contextMenus.create({
			title: "&Highlight Selection",
			id: "activate-research-tab",
			contexts: [ "selection", "page" ],
		});
		if (!chrome.contextMenus.onClicked.hasListener(contextMenuListener)) {
			chrome.contextMenus.onClicked.addListener(contextMenuListener);
		}
	};

	/**
	 * Prepares volatile extension components in a new browser session.
	 */
	const initialize = () => {
		chrome.runtime.setUninstallURL("https://markmysearch.ator.systems/pages/sendoff/");
		configInitialize();
		try {
			manageEnginesCacheOnBookmarkUpdate();
		} catch (error) {
			console.warn("TODO fix bookmark search engines check", error);
		}
		createContextMenuItems();
		//updateActionIcon();
	};

	const startOnInstall = (isExtensionInstall: boolean, allowOnboarding = true) => {
		if (isExtensionInstall) {
			if (allowOnboarding) {
				chrome.tabs.create({ url: chrome.runtime.getURL("/pages/startpage.html") });
			}
		}
		initialize();
	};

	chrome.runtime.onInstalled.addListener(async details => {
		startOnInstall(details.reason === chrome.runtime.OnInstalledReason.INSTALL);
		injectIntoTabs();
	});

	chrome.runtime.onStartup.addListener(initialize);

	// Ensures context menu items will be recreated on enabling the extension (after disablement).
	createContextMenuItems();
})();

// AUDITED ABOVE

(() => {
	const pageChangeRespond = async (urlString: string, tabId: number) => {
		const logMetadata = { timeStart: Date.now(), tabId, url: urlString };
		log("tab-communicate fulfillment start", "", logMetadata);
		const config = await Config.get({
			autoFindOptions: { enabled: true, stoplist: true },
			showHighlights: { overrideSearchPages: true, overrideResearchPages: true },
			barCollapse: { fromTermListAuto: true },
			urlFilters: true,
			termListOptions: { termLists: true },
		});
		const bank = await Bank.get([ "researchInstances", "engines" ]);
		const searchDetails = config.autoFindOptions.enabled
			? await isTabSearchPage(bank.engines, urlString)
			: { isSearch: false };
		searchDetails.isSearch = searchDetails.isSearch && isUrlSearchHighlightAllowed(urlString, config.urlFilters);
		const termsFromLists = config.termListOptions.termLists
			.filter(termList => isUrlFilteredIn(new URL(urlString), termList.urlFilter))
			.flatMap(termList => termList.terms);
		const getTermsAdditionalDistinct = (
			terms: ReadonlyArray<MatchTerm>,
			termsExtra: ReadonlyArray<MatchTerm>,
		) => termsExtra.filter(termExtra => !terms.find(term => term.phrase === termExtra.phrase));
		const isResearchPage = await Tabs.isTabResearchPage(tabId);
		const overrideHighlightsShown =
			(searchDetails.isSearch && config.showHighlights.overrideSearchPages) ||
			(isResearchPage && config.showHighlights.overrideResearchPages);
		// BELOW CONTENTS NOT AUDITED
		// If tab contains a search AND has no research or none: create research based on search (incl. term lists).
		if (searchDetails.isSearch) {
			const researchInstance = await createResearchInstance({ url: {
				stoplist: config.autoFindOptions.stoplist.getList(),
				url: urlString,
				engine: searchDetails.engine,
			} });
			// Apply terms from term lists.
			researchInstance.terms = termsFromLists.concat(getTermsAdditionalDistinct(termsFromLists, researchInstance.terms));
			if (isResearchPage) {
				sendTabMessage(tabId, {
					termsOnHold: researchInstance.terms,
				});
			} else {
				bank.researchInstances[tabId] = researchInstance;
				log("tab-communicate research enable (not storing yet)", "search detected in tab", logMetadata);
			}
		}
		let highlightActivation: Promise<unknown> = (async () => undefined)();
		// If tab *now* has research OR has applicable term lists: activate highlighting in tab.
		if ((await Tabs.isTabResearchPage(tabId)) || termsFromLists.length) {
			const highlightActivationReason = termsFromLists.length
				? (await Tabs.isTabResearchPage(tabId))
					? "tab is a research page which term lists apply to"
					: "tab is a page which terms lists apply to"
				: "tab is a research page";
			log("tab-communicate highlight activation request", highlightActivationReason, logMetadata);
			const researchInstance = bank.researchInstances[tabId] ?? await createResearchInstance({});
			researchInstance.terms = researchInstance.enabled
				? researchInstance.terms.concat(getTermsAdditionalDistinct(researchInstance.terms, termsFromLists))
				: termsFromLists;
			if (!await Tabs.isTabResearchPage(tabId)) {
				researchInstance.barCollapsed = config.barCollapse.fromTermListAuto;
			}
			researchInstance.enabled = true;
			highlightActivation = sendTabMessage(tabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, overrideHighlightsShown),
			});
			bank.researchInstances[tabId] = researchInstance;
		}
		Bank.set({ researchInstances: bank.researchInstances });
		await highlightActivation;
		log("tab-communicate fulfillment finish", "", logMetadata);
	};

	chrome.tabs.onCreated.addListener(async tab => {
		let openerTabId: number | undefined = tab.openerTabId;
		if (tab.id === undefined || /\b\w+:(\/\/)?newtab\//.test(tab.pendingUrl ?? tab.url ?? "")) {
			return;
		}
		if (openerTabId === undefined) {
			// Must check `openerTabId` manually for Chromium, which may not define it on creation.
			if (compatibility.browser === "chromium") {
				openerTabId = (await chrome.tabs.get(tab.id)).openerTabId;
			}
			if (openerTabId === undefined) {
				return;
			}
		}
		log("tab-communicate obligation check", "tab created", { tabId: tab.id });
		const bank = await Bank.get([ "researchInstances" ]);
		if (await Tabs.isTabResearchPage(openerTabId)) {
			bank.researchInstances[tab.id] = { ...bank.researchInstances[openerTabId] };
			Bank.set(bank);
			pageChangeRespond(tab.url ?? "", tab.id); // New tabs may fail to trigger web navigation, due to loading from cache.
		}
	});

	const pageEventListener = async (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
		// Note: emitted events differ between Firefox and Chromium.
		if (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete") {
			pageChangeRespond(changeInfo.url ?? (await chrome.tabs.get(tabId)).url ?? "", tabId);
		}
	};

	// Note: emitted events differ between Firefox and Chromium.
	if (compatibility.browser === "chromium") {
		chrome.tabs.onUpdated.addListener(pageEventListener);
	} else {
		browser.tabs.onUpdated.addListener(pageEventListener, { properties: [ "url", "status" ] });
	}

	chrome.tabs.onRemoved.addListener(async tabId => {
		const bank = await Bank.get([ "researchInstances" ]);
		if (bank.researchInstances[tabId]) {
			delete bank.researchInstances[tabId];
			Bank.set(bank);
		}
	});
})();

/**
 * Attempts to retrieve terms extracted from the current user selection, in a given tab.
 * @param tabId The ID of a tab from which to take selected terms.
 * @returns The terms extracted if successful, `undefined` otherwise.
 */
const getTermsSelectedInTab = async (tabId: number): Promise<ReadonlyArray<MatchTerm> | undefined> => {
	log("selection-terms-retrieval start", "");
	return sendTabMessage(tabId, { getDetails: { termsFromSelection: true } }).then(response => {
		log("selection-terms-retrieval finish",
			"", { tabId, phrases: (response.terms ?? []).map(term => term.phrase) });
		return response.terms ?? [];
	}).catch(() => {
		log("selection-terms-retrieval fail",
			"selection terms not received in response, perhaps no script is injected", { tabId });
		return undefined;
	});
};

/**
 * Activates highlighting within a tab using the current user selection, storing appropriate highlighting information.
 * @param tabId The ID of a tab to be linked and within which to highlight.
 */
const activateResearchInTab = async (tabId: number, terms: ReadonlyArray<MatchTerm> = []) => {
	log("research-activation start", "", { tabId });
	const config = await Config.get({ researchInstanceOptions: { restoreLastInTab: true } });
	const bank = await Bank.get([ "researchInstances" ]);
	const researchInstance = (bank.researchInstances[tabId]
		&& config.researchInstanceOptions.restoreLastInTab
		&& !terms.length
	)
		? bank.researchInstances[tabId]
		: await createResearchInstance({ terms });
	researchInstance.enabled = true;
	bank.researchInstances[tabId] = researchInstance;
	Bank.set(bank);
	await handleMessage({
		tabId,
		terms: researchInstance.terms,
		termsSend: true,
		toggle: {
			highlightsShownOn: true,
		},
		highlightCommands: [ { type: "focusTermInput" } ],
	});
	log("research-activation finish", "", { tabId });
};

/**
 * Removes highlighting within a tab, disabling the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = async (tabId: number) => {
	log("research-deactivation start", "", { tabId });
	const bank = await Bank.get([ "researchInstances" ]);
	const researchInstance = bank.researchInstances[tabId];
	if (researchInstance) {
		if (researchInstance.terms.length) {
			researchInstance.enabled = false;
		} else {
			delete bank.researchInstances[tabId];
		}
		Bank.set(bank);
	}
	await sendTabMessage(tabId, { deactivate: true });
	log("research-deactivation finish", "", { tabId });
};

/**
 * Toggles highlighting visibility within a tab.
 * @param tabId The ID of a tab to change the highlighting visibility of.
 * @param toggleHighlightsOn If specified, indicates target visibility. If unspecified, inverse of current visibility is used.
 */
const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	if (!await Tabs.isTabResearchPage(tabId)) {
		return;
	}
	const config = await Config.get({ barControlsShown: true });
	const bank = await Bank.get([ "researchInstances" ]);
	const researchInstance = bank.researchInstances[tabId];
	researchInstance.highlightsShown = toggleHighlightsOn
		?? !await sendTabMessage(tabId, { getDetails: { highlightsShown: true } }).then(response =>
			response.highlightsShown
		).catch(() =>
			researchInstance.highlightsShown
		);
	sendTabMessage(tabId, {
		toggleHighlightsOn: researchInstance.highlightsShown,
		barControlsShown: config.barControlsShown,
	});
	Bank.set(bank);
};

chrome.commands.onCommand.addListener(async commandString => {
	if (commandString === "open-popup") {
		(chrome.action["openPopup"] ?? (() => undefined))();
	}
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const tabId = tab.id!; // `tab.id` is always defined for this case.
	const commandInfo = parseCommand(commandString);
	switch (commandInfo.type) {
	case "openPopup": {
		return;
	} case "openOptions": {
		chrome.runtime.openOptionsPage();
		return;
	} case "toggleEnabled": {
		Config.get({ autoFindOptions: { enabled: true } }).then(config => {
			config.autoFindOptions.enabled = !config.autoFindOptions.enabled;
			Config.set(config);
			//updateActionIcon(config.autoFindOptions.enabled);
		});
		return;
	} case "toggleInTab": {
		if (await Tabs.isTabResearchPage(tabId)) {
			deactivateResearchInTab(tabId);
		} else {
			activateResearchInTab(tabId, await getTermsSelectedInTab(tabId));
		}
		return;
	} case "toggleHighlights": {
		toggleHighlightsInTab(tabId);
		return;
	} case "toggleBar": {
		const bank = await Bank.get([ "researchInstances" ]);
		const researchInstance = bank.researchInstances[tabId];
		if (!researchInstance) {
			return;
		}
		researchInstance.barCollapsed = !researchInstance.barCollapsed;
		sendTabMessage(tabId, {
			toggleBarCollapsedOn: researchInstance.barCollapsed,
		});
		Bank.set(bank);
		return;
	}}
	sendTabMessage(tabId, { commands: [ commandInfo ] });
});

// AUDITED BELOW

/**
 * Decodes a message involving backend extension management.
 * @param message A message intended for the background script.
 */
const handleMessage = async (message: Message.Background<true>): Promise<Message.BackgroundResponse> => {
	const tabId = message.tabId;
	if (message.terms) {
		const logMetadata = { tabId, terms: message.terms };
		log("terms-assign start", "", logMetadata);
		const bank = await Bank.get([ "researchInstances" ]);
		const researchInstance = bank.researchInstances[tabId];
		if (researchInstance) {
			researchInstance.terms = message.terms;
			await Bank.set(bank);
			log("terms-assign finish", "research instance created with terms", logMetadata);
		} else {
			const researchInstance = await createResearchInstance({ terms: message.terms });
			bank.researchInstances[tabId] = researchInstance;
			await Bank.set(bank);
			log("terms-assign finish", "terms assigned to existing research instance", logMetadata);
		}
	}
	const tabMessage: Message.Tab = {
		terms: message.termsSend
			? (message.terms
				?? (await Bank.get([ "researchInstances" ])).researchInstances[tabId]?.terms)
			: undefined,
		commands: message.highlightCommands,
	};
	if (Object.values(tabMessage).some(value => value !== undefined)) {
		const logMetadata = { tabId, message: tabMessage };
		log("message-send start", "", logMetadata);
		await sendTabMessage(tabId, tabMessage);
		log("message-send finish", "", logMetadata);
	}
	if (message.toggle) {
		const toggle = message.toggle;
		const logMetadata = { tabId, toggle };
		log("flags-toggle start", "", logMetadata);
		if (toggle.highlightsShownOn !== undefined) {
			await toggleHighlightsInTab(tabId, toggle.highlightsShownOn);
		}
		if (toggle.barCollapsedOn !== undefined) {
			const bank = await Bank.get([ "researchInstances" ]);
			if (await Tabs.isTabResearchPage(tabId)) {
				bank.researchInstances[tabId].barCollapsed = toggle.barCollapsedOn;
				await Bank.set(bank);
			}
		}
		log("flags-toggle finish", "", logMetadata);
	}
	if (message.deactivateTabResearch) {
		deactivateResearchInTab(tabId);
	}
	if (message.performSearch) {
		const bank = await Bank.get([ "researchInstances" ]);
		(chrome.search as typeof browser.search).search({
			query: bank.researchInstances[tabId].terms.map(term => term.phrase).join(" "),
			tabId,
		});
	}
	if (message.initializationGet) {
		log("initialization-return start", "", { tabId });
		const config = (await Config.get({
			barControlsShown: true,
			barLook: true,
			highlightLook: true,
			highlighter: true,
			matchModeDefaults: true,
			urlFilters: true,
		}));
		const bank = await Bank.get([ "researchInstances" ]);
		const researchInstance = bank.researchInstances[tabId];
		if (researchInstance) {
			log("initialization-return finish", "", { tabId });
			return {
				terms: researchInstance.terms,
				toggleHighlightsOn: researchInstance.highlightsShown,
				toggleBarCollapsedOn: researchInstance.barCollapsed,
				barControlsShown: config.barControlsShown,
				barLook: config.barLook,
				highlightLook: config.highlightLook,
				highlighter: config.highlighter,
				matchMode: config.matchModeDefaults,
				enablePageModify: isUrlPageModifyAllowed((await chrome.tabs.get(tabId)).url ?? "", config.urlFilters),
			};
		} else {
			log("initialization-return fail", "no corresponding research instance exists", { tabId });
		}
	}
	return null;
};

chrome.runtime.onMessage.addListener((message: Message.Background, sender, sendResponse) => {
	(async () => {
		const messageWithTabId: Message.Background<true> = ("tabId" in message
			? message
			: {
				...message,
				tabId: sender.tab?.id ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id ?? NaN,
			}
		);
		handleMessage(messageWithTabId).then(sendResponse);
	})();
	return true;
});

chrome.permissions.onAdded.addListener(permissions => {
	if (permissions?.permissions?.includes("bookmarks")) {
		manageEnginesCacheOnBookmarkUpdate();
	} else {
		console.log(permissions);
		injectIntoTabs();
	}
});
