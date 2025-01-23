/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import "/dist/modules/namespace/normalize.mjs";
import { Bank, Config, configInitialize, type BankValues } from "/dist/modules/storage.mjs";
import { parseUserCommand } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.d.mjs";
import { sendTabMessage } from "/dist/modules/messaging/tab.mjs";
import { MatchTerm } from "/dist/modules/match-term.mjs";
import { isUrlFilteredIn } from "/dist/modules/url-handling/url-filters.mjs";
import { isUrlAutoFindAllowed } from "/dist/modules/url-handling/url-tests.mjs";
import type { SearchSite } from "/dist/modules/search-sites.mjs";
import * as SearchSites from "/dist/modules/search-sites.mjs";
import type { ResearchRecord } from "/dist/modules/research.mjs";
import * as Tabs from "/dist/modules/tabs.mjs";
import { log, assert, compatibility } from "/dist/modules/common.mjs";
import { getTermsFromSelectedText } from "/dist/modules/term-extraction.mjs";

// DEPRECATE
/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchRecord = async (args: {
	url?: { stoplist: Array<string>, url: string, searchSite?: SearchSite }
	terms?: ReadonlyArray<MatchTerm>
}): Promise<ResearchRecord> => {
	const config = await Config.get({ showHighlights: { default: true }, barCollapse: { fromSearch: true } });
	if (args.url) {
		const phraseGroups = args.url.searchSite ? [] : (await getSearchQuery(args.url.url)).split("\"");
		const termsRaw = args.url.searchSite
			? SearchSites.extractSearchPhrases(args.url.url, args.url.searchSite)
			: phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		return {
			terms: Array.from(new Set(termsRaw))
				.filter(phrase => args.url ? !args.url.stoplist.includes(phrase) : false)
				.map(phrase => new MatchTerm(phrase)),
			highlightsShown: config.showHighlights.default,
			barCollapsed: config.barCollapse.fromSearch,
			active: true,
		};
	}
	args.terms ??= [];
	return {
		terms: args.terms,
		highlightsShown: config.showHighlights.default,
		barCollapsed: false,
		active: true,
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
 * Gets heuristically whether or not a URL specifies a search on an arbitrary search site.
 * @param searchSites An array of objects representing search site URLs and how to extract contained search queries.
 * @param url A URL to be tested.
 * @returns An object containing a flag for whether or not the URL specifies a search,
 * and the first object which matched the URL (if any).
 */
const isTabSearchPage = async (
	searchSites: BankValues["searchSites"],
	url: string,
): Promise<{ isSearch: boolean, searchSite?: SearchSite }> => {
	if (await getSearchQuery(url)) {
		return { isSearch: true };
	} else {
		const searchSite = Object.values(searchSites).find(searchSite => SearchSites.matches(url, searchSite));
		return { isSearch: !!searchSite, searchSite: searchSite };
	}
};

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
 * Caches objects, representing search site URLs and how to extract their search queries, to session storage.
 * These objects are generated from information such as dynamic bookmarks stored by the user,
 * and caching is triggered on information update.
 */
const syncSearchSitesWithBookmarks = (() => {
	/**
	 * Updates an array of user search sites with respect to a particular search site ID, based on a potentially dynamic URL.
	 * @param sites An array of user search sites.
	 * @param id The unique ID of a potential or existing search site.
	 * @param dynamicUrl The string of a URL which may be dynamic (contains `%s` as in a dynamic bookmark).
	 */
	const updateSearchSite = (sites: Record<string, SearchSite>, id: string, dynamicUrl: string) => {
		if (!dynamicUrl) {
			return;
		}
		if (!dynamicUrl.includes("%s")) {
			delete sites[id];
			return;
		}
		const site = SearchSites.createSearchSite({ dynamicUrl });
		if (Object.values(sites).find(thisSite => SearchSites.searchSiteEquals(thisSite, site))) {
			return;
		}
		sites[id] = site;
	};

	/**
	 * Uses a function accepting a single bookmark tree node to modify user search sites in storage.
	 * Accepts all such nodes under a root node.
	 * @param sites An array of user search site objects.
	 * @param setSearchSite A function to modify user search sites in storage based on a bookmark tree node.
	 * @param node A root node under which to accept descendant nodes (inclusive).
	 */
	const setSearchSites = (
		sites: Record<string, SearchSite>,
		setSearchSite: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode,
	) => {
		if (node.type === "bookmark") {
			setSearchSite(node);
		}
		(node.children ?? []).forEach(child => setSearchSites(sites, setSearchSite, child));
	};

	return () => {
		if (compatibility.browser === "chromium" || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(async nodes => {
			const bank = await Bank.get([ "searchSites" ]);
			nodes.forEach(node =>
				setSearchSites(bank.searchSites, node => {
					if (node.url) {
						updateSearchSite(bank.searchSites, node.id, node.url);
					}
				}, node)
			);
			Bank.set(bank);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const bank = await Bank.get([ "searchSites" ]);
			setSearchSites(bank.searchSites, node => {
				delete bank.searchSites[node.id];
			}, removeInfo.node);
			Bank.set(bank);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const bank = await Bank.get([ "searchSites" ]);
				updateSearchSite(bank.searchSites, id, createInfo.url);
				Bank.set(bank);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const bank = await Bank.get([ "searchSites" ]);
				updateSearchSite(bank.searchSites, id, changeInfo.url);
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
			files: [ "/dist/entrypoints/content.js" ],
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
			activateResearchInTab(tab.id, getTermsFromSelectedText(await getTextSelectedInTab(tab.id) ?? ""));
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
			syncSearchSitesWithBookmarks();
		} catch (error) {
			console.warn("TODO fix bookmark search sites check", error);
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
		const bank = await Bank.get([ "researchRecords", "searchSites" ]);
		const searchDetails = config.autoFindOptions.enabled
			? await isTabSearchPage(bank.searchSites, urlString)
			: { isSearch: false };
		searchDetails.isSearch = searchDetails.isSearch && isUrlAutoFindAllowed(urlString, config.urlFilters.nonSearch);
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
			const researchRecord = await createResearchRecord({ url: {
				stoplist: config.autoFindOptions.stoplist.getList(),
				url: urlString,
				searchSite: searchDetails.searchSite,
			} });
			// Apply terms from term lists.
			researchRecord.terms = termsFromLists.concat(getTermsAdditionalDistinct(termsFromLists, researchRecord.terms));
			if (isResearchPage) {
				sendTabMessage(tabId, {
					type: "commands",
					commands: [ {
						type: "useTerms",
						terms: researchRecord.terms,
						replaceExisting: false,
					}, {
						type: "activate",
					} ],
				});
			} else {
				bank.researchRecords[tabId] = researchRecord;
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
			const researchRecord = bank.researchRecords[tabId] ?? await createResearchRecord({});
			researchRecord.terms = researchRecord.active
				? researchRecord.terms.concat(getTermsAdditionalDistinct(researchRecord.terms, termsFromLists))
				: termsFromLists;
			if (!await Tabs.isTabResearchPage(tabId)) {
				researchRecord.barCollapsed = config.barCollapse.fromTermListAuto;
			}
			researchRecord.active = true;
			const tabCommands: Array<Message.TabCommand> = [ {
				type: "useTerms",
				terms: researchRecord.terms,
				replaceExisting: true,
			}, {
				type: "activate",
			} ];
			const toggleHighlightsOn = determineToggleHighlightsOn(researchRecord.highlightsShown, overrideHighlightsShown);
			if (toggleHighlightsOn !== undefined) {
				tabCommands.push({
					type: "toggleHighlightsShown",
					enable: toggleHighlightsOn,
				});
			}
			highlightActivation = sendTabMessage(tabId, {
				type: "commands",
				commands: tabCommands,
			});
			bank.researchRecords[tabId] = researchRecord;
		}
		Bank.set({ researchRecords: bank.researchRecords });
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
		const bank = await Bank.get([ "researchRecords" ]);
		if (await Tabs.isTabResearchPage(openerTabId)) {
			bank.researchRecords[tab.id] = { ...bank.researchRecords[openerTabId] };
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
		const bank = await Bank.get([ "researchRecords" ]);
		if (bank.researchRecords[tabId]) {
			delete bank.researchRecords[tabId];
			Bank.set(bank);
		}
	});
})();

/**
 * Attempts to retrieve terms extracted from the current user selection, in a given tab.
 * @param tabId The ID of a tab from which to take selected terms.
 * @returns The terms extracted if successful, `undefined` otherwise.
 */
const getTextSelectedInTab = async (tabId: number): Promise<string | undefined> => {
	log("selection-terms-retrieval start", "");
	return sendTabMessage(tabId, {
		type: "request",
		requestType: "selectedText",
	}).then(response => {
		log("selection-terms-retrieval finish",
			"", { tabId, response });
		return response.type === "selectedText" ? response.selectedText : "";
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
	const config = await Config.get({ researchRecordOptions: { restoreLastInTab: true } });
	const bank = await Bank.get([ "researchRecords" ]);
	const researchRecord = (bank.researchRecords[tabId]
		&& config.researchRecordOptions.restoreLastInTab
		&& terms.length === 0
	)
		? bank.researchRecords[tabId]
		: await createResearchRecord({ terms });
	researchRecord.active = true;
	bank.researchRecords[tabId] = researchRecord;
	Bank.set(bank);
	const commands: ReadonlyArray<Message.BackgroundCommand> = [ {
		type: "sendTabCommands",
		commands: [ {
			type: "useTerms",
			terms: researchRecord.terms,
			replaceExisting: true,
		}, {
			type: "activate",
		}, {
			type: "focusTermInput",
			termIndex: null,
		} ],
	}, {
		type: "toggleInTab",
		highlightsShownOn: true,
	} ];
	for (const command of commands) {
		await handleCommand(command, tabId);
	}
	log("research-activation finish", "", { tabId });
};

/**
 * Removes highlighting within a tab, disabling the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = async (tabId: number) => {
	log("research-deactivation start", "", { tabId });
	const bank = await Bank.get([ "researchRecords" ]);
	const researchRecord = bank.researchRecords[tabId];
	if (researchRecord) {
		if (researchRecord.terms.length > 0) {
			researchRecord.active = false;
		} else {
			delete bank.researchRecords[tabId];
		}
		Bank.set(bank);
	}
	await sendTabMessage(tabId, {
		type: "commands",
		commands: [ {
			type: "deactivate",
		} ],
	});
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
	const bank = await Bank.get([ "researchRecords" ]);
	const researchRecord = bank.researchRecords[tabId];
	researchRecord.highlightsShown = toggleHighlightsOn
		?? !await sendTabMessage(tabId, { type: "request", requestType: "highlightsShown" }).then(response =>
			response.type === "highlightsShown" ? response.highlightsShown : researchRecord.highlightsShown
		).catch(() =>
			researchRecord.highlightsShown
		);
	sendTabMessage(tabId, {
		type: "commands",
		commands: [ {
			type: "toggleHighlightsShown",
			enable: researchRecord.highlightsShown,
		} ],
	});
	Bank.set(bank);
};

chrome.commands.onCommand.addListener(async commandString => {
	if (commandString === "open-popup") {
		(chrome.action["openPopup"] ?? (() => undefined))();
	}
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const tabId = tab.id!; // `tab.id` is always defined for this case.
	const userCommand = parseUserCommand(commandString);
	if (!userCommand) {
		return;
	}
	switch (userCommand.type) {
	case "openPopup": {
		return;
	}
	case "openOptions": {
		chrome.runtime.openOptionsPage();
		return;
	}
	case "toggleAutoFind": {
		Config.get({ autoFindOptions: { enabled: true } }).then(config => {
			config.autoFindOptions.enabled = !config.autoFindOptions.enabled;
			Config.set(config);
			//updateActionIcon(config.autoFindOptions.enabled);
		});
		return;
	}
	case "tab_toggleResearch": {
		if (await Tabs.isTabResearchPage(tabId)) {
			deactivateResearchInTab(tabId);
		} else {
			activateResearchInTab(tabId);
		}
		return;
	}
	case "tab_toggleHighlightsShown": {
		toggleHighlightsInTab(tabId);
		return;
	}
	case "tab_toggleBarCollapsed": {
		const bank = await Bank.get([ "researchRecords" ]);
		const researchRecord = bank.researchRecords[tabId];
		if (!researchRecord) {
			return;
		}
		researchRecord.barCollapsed = !researchRecord.barCollapsed;
		sendTabMessage(tabId, {
			type: "commands",
			commands: [ {
				type: "toggleBarCollapsed",
				enable: researchRecord.barCollapsed,
			} ],
		});
		Bank.set(bank);
		return;
	}
	case "tab_toggleSelectMode": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "toggleSelectMode",
		} ] });
		return;
	}
	case "tab_replaceTerms": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "replaceTerms",
		} ] });
		return;
	}
	case "tab_stepGlobal": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "stepGlobal",
			forwards: userCommand.forwards,
		} ] });
		return;
	}
	case "tab_jumpGlobal": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "jumpGlobal",
			forwards: userCommand.forwards,
		} ] });
		return;
	}
	case "tab_selectTerm": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "selectTerm",
			forwards: userCommand.forwards,
			termIndex: userCommand.termIndex,
		} ] });
		return;
	}
	case "tab_focusTermInput": {
		sendTabMessage(tabId, { type: "commands", commands: [ {
			type: "focusTermInput",
			termIndex: userCommand.termIndex,
		} ] });
		return;
	}}
});

// AUDITED BELOW

const handleRequestMessage = (
	message: Message.BackgroundRequest,
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: Message.BackgroundResponse) => void,
): true | undefined => {
	switch (message.requestType) {
	case "tabId": {
		sendResponse({
			type: "tabId",
			tabId: sender.tab?.id ?? NaN,
		});
		return;
	} case "tabResearchRecord": {
		(async () => {
			sendResponse({
				type: "tabResearchRecord",
				researchRecord: (await Bank.get([ "researchRecords" ])).researchRecords[sender.tab?.id ?? NaN],
			});
		})();
		return true;
	}}
};

/**
 * Decodes a command involving backend extension management.
 * @param command A message intended for the background script.
 */
const handleCommand = async (command: Message.BackgroundCommand, tabId: number) => {
	switch (command.type) {
	case "assignTabTerms": {
		const logMetadata = { tabId, terms: command.terms };
		log("terms-assign start", "", logMetadata);
		const bank = await Bank.get([ "researchRecords" ]);
		const researchRecord = bank.researchRecords[tabId];
		if (researchRecord) {
			researchRecord.terms = command.terms;
			await Bank.set(bank);
			log("terms-assign finish", "research instance created with terms", logMetadata);
		} else {
			const researchRecord = await createResearchRecord({ terms: command.terms });
			bank.researchRecords[tabId] = researchRecord;
			await Bank.set(bank);
			log("terms-assign finish", "terms assigned to existing research instance", logMetadata);
		}
		return;
	}
	case "sendTabCommands": {
		const tabMessage: Message.Tab = {
			type: "commands",
			commands: command.commands,
		};
		const logMetadata = { tabId, message: tabMessage };
		log("message-send start", "", logMetadata);
		await sendTabMessage(tabId, tabMessage);
		log("message-send finish", "", logMetadata);
		return;
	}
	case "toggleInTab": {
		const logMetadata = { tabId, command };
		log("flags-toggle start", "", logMetadata);
		if (command.highlightsShownOn !== undefined) {
			await toggleHighlightsInTab(tabId, command.highlightsShownOn);
		}
		if (command.barCollapsedOn !== undefined) {
			const bank = await Bank.get([ "researchRecords" ]);
			if (await Tabs.isTabResearchPage(tabId)) {
				bank.researchRecords[tabId].barCollapsed = command.barCollapsedOn;
				await Bank.set(bank);
			}
		}
		log("flags-toggle finish", "", logMetadata);
		return;
	}
	case "deactivateTabResearch": {
		deactivateResearchInTab(tabId);
		return;
	}
	case "performTabSearch": {
		const bank = await Bank.get([ "researchRecords" ]);
		(chrome.search as typeof browser.search).search({
			query: bank.researchRecords[tabId].terms.map(term => term.phrase).join(" "),
			tabId,
		});
	}}
};

chrome.runtime.onMessage.addListener((message: Message.Background, sender, sendResponse) => {
	switch (message.type) {
	case "request": {
		if (handleRequestMessage(message, sender, sendResponse)) {
			return true;
		}
		return;
	} case "commands": {
		(async () => {
			const tabId = sender.tab?.id ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id ?? NaN;
			for (const command of message.commands) {
				await handleCommand(command, tabId);
			}
		})();
		return;
	}}
});

chrome.permissions.onAdded.addListener(permissions => {
	if (permissions?.permissions?.includes("bookmarks")) {
		syncSearchSitesWithBookmarks();
	} else {
		console.log(permissions);
		injectIntoTabs();
	}
});
