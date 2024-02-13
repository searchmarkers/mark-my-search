import "/dist/modules/namespace/normalize.mjs";
import {
	type ResearchInstance, type SearchSites, type URLFilter,
	type StorageSessionValues, type StorageLocalValues, type StorageSyncValues,
	storageGet, storageSet,
	storageInitialize, optionsRepair,
} from "/dist/modules/privileged/storage.mjs";
import { parseCommand } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.mjs";
import { sendTabMessage } from "/dist/modules/messaging/tab.mjs";
import { MatchTerm, sanitizeForRegex } from "/dist/modules/match-term.mjs";
import { SearchSite } from "/dist/modules/search-site.mjs";
import * as Tabs from "/dist/modules/privileged/tabs.mjs";
import { log, assert, compatibility } from "/dist/modules/common.mjs";

// DEPRECATE
/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Array<string>, url: string, engine?: SearchSite }
	terms?: Array<MatchTerm>
}): Promise<ResearchInstance> => {
	const sync = await storageGet("sync", [
		"showHighlights",
		"barCollapse",
	]);
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
			highlightsShown: sync.showHighlights.default,
			barCollapsed: sync.barCollapse.fromSearch,
			enabled: true,
		};
	}
	args.terms ??= [];
	return {
		terms: args.terms,
		highlightsShown: sync.showHighlights.default,
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
	storageGet("sync", [ "autoFindOptions" ]).then(sync =>
		new URL(url).searchParams.get(
			sync.autoFindOptions.searchParams.find(param => new URL(url).searchParams.has(param)) ?? ""
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
		!!urlFilter.find(({ hostname, pathname }) =>
			(new RegExp(sanitize(hostname) + "\\b")).test(url.hostname)
			&& (pathname === "" || pathname === "/" || (new RegExp("\\b" + sanitize(pathname.slice(1)))).test(url.pathname.slice(1)))
		)
	;
})();

/**
 * Determines whether the user has permitted pages with the given URL to be deeply modified during highlighting,
 * which is powerful but may be destructive.
 * @param urlString The valid URL string corresponding to a page to be potentially highlighted.
 * @param urlFilters URL filter preferences.
 * @returns `true` if the corresponding page may be modified, `false` otherwise.
 */
const isUrlPageModifyAllowed = (urlString: string, urlFilters: StorageSyncValues["urlFilters"]) => {
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
const isUrlSearchHighlightAllowed = (urlString: string, urlFilters: StorageSyncValues["urlFilters"]) =>
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
			const session = await storageGet("session", [ "engines" ]);
			nodes.forEach(node =>
				setEngines(session.engines, node => {
					if (node.url) { // TODO should be able to make the assumption that engines is always an array
						updateEngine(session.engines ?? [], node.id, node.url);
					}
				}, node)
			);
			storageSet("session", session);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const session = await storageGet("session", [ "engines" ]);
			setEngines(session.engines, node => {
				delete session.engines[node.id];
			}, removeInfo.node);
			storageSet("session", session);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const session = await storageGet("session", [ "engines" ]);
				updateEngine(session.engines ?? [], id, createInfo.url);
				storageSet("session", session);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const session = await storageGet("session", [ "engines" ]);
				updateEngine(session.engines ?? [], id, changeInfo.url);
				storageSet("session", session);
			}
		});
	};
})();

const injectIntoTabs = async () => {
	(await chrome.tabs.query({})).filter(tab => tab.id !== undefined).forEach(tab => {
		chrome.scripting.executeScript({
			target: { tabId: tab.id as number },
			files: [
				"/dist/include/utility.js",
				"/dist/include/pattern-stem.js",
				"/dist/include/pattern-diacritic.js",
				"/dist/content.js",
			],
		}).catch(() => chrome.runtime.lastError); // Read `lastError` to suppress injection errors.
	});
};

/**
 * Updates the action icon to reflect the extension's enabled/disabled status.
 * @param enabled If specified, overrides the extension's enabled/disabled status.
 */
const updateActionIcon = (enabled?: boolean) =>
	enabled === undefined
		? storageGet("local", [ "enabled" ]).then(local => updateActionIcon(local.enabled))
		: chrome.action.setIcon({ path: compatibility.browser === "chromium"
			? (enabled ? "/icons/dist/mms-32.png" : "/icons/dist/mms-off-32.png") // Chromium lacks SVG support for the icon.
			: (enabled ? "/icons/mms.svg" : "/icons/mms-off.svg")
		})
;

(() => {
	const contextMenuListener = async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
		if (tab && tab.id !== undefined) {
			log("research-activation request", "context menu item activated", { tabId: tab.id });
			activateResearchInTab(tab.id, await getTermsSelectedInTab(tab.id));
		} else {
			assert(false, "research-activation (from context menu) void request", "no valid tab", { tab });
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
		chrome.runtime.setUninstallURL("https://searchmarkers.github.io/pages/sendoff/");
		try {
			manageEnginesCacheOnBookmarkUpdate();
		} catch (error) {
			console.warn("TODO fix bookmark search engines check", error);
		}
		createContextMenuItems();
		optionsRepair();
		storageInitialize();
		updateActionIcon();
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

	createContextMenuItems(); // Ensures context menu items will be recreated on enabling the extension (after disablement).
	storageGet("session", [ "researchInstances" ]).then(session => { // TODO better workaround?
		if (session.researchInstances === undefined) {
			assert(false, "storage reinitialize", "storage read returned `undefined` when testing on wake");
			storageInitialize();
		}
	});
})();

// AUDITED ABOVE

(() => {
	const pageChangeRespond = async (urlString: string, tabId: number) => {
		const logMetadata = { timeStart: Date.now(), tabId, url: urlString };
		log("tab-communicate fulfillment start", "", logMetadata);
		const sync = await storageGet("sync", [
			"autoFindOptions",
			"showHighlights",
			"barCollapse",
			"urlFilters",
			"termLists",
		]);
		const local = await storageGet("local", [ "enabled" ]);
		const session = await storageGet("session", [
			"researchInstances",
			"engines",
		]);
		const searchDetails = local.enabled
			? await isTabSearchPage(session.engines, urlString)
			: { isSearch: false };
		searchDetails.isSearch = searchDetails.isSearch && isUrlSearchHighlightAllowed(urlString, sync.urlFilters);
		const termsFromLists = sync.termLists
			.filter(termList => isUrlFilteredIn(new URL(urlString), termList.urlFilter))
			.flatMap(termList => termList.terms);
		const getTermsAdditionalDistinct = (terms: Array<MatchTerm>, termsExtra: Array<MatchTerm>) => termsExtra
			.filter(termExtra => !terms.find(term => term.phrase === termExtra.phrase));
		const isResearchPage = await Tabs.isTabResearchPage(tabId);
		const overrideHighlightsShown =
			(searchDetails.isSearch && sync.showHighlights.overrideSearchPages) ||
			(isResearchPage && sync.showHighlights.overrideResearchPages);
		// BELOW CONTENTS NOT AUDITED
		// If tab contains a search AND has no research or none: create research based on search (incl. term lists).
		if (searchDetails.isSearch) {
			const researchInstance = await createResearchInstance({ url: {
				stoplist: sync.autoFindOptions.stoplist,
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
				session.researchInstances[tabId] = researchInstance;
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
			const researchInstance = session.researchInstances[tabId] ?? await createResearchInstance({});
			researchInstance.terms = researchInstance.enabled
				? researchInstance.terms.concat(getTermsAdditionalDistinct(researchInstance.terms, termsFromLists))
				: termsFromLists;
			if (!await Tabs.isTabResearchPage(tabId)) {
				researchInstance.barCollapsed = sync.barCollapse.fromTermListAuto;
			}
			researchInstance.enabled = true;
			highlightActivation = sendTabMessage(tabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, overrideHighlightsShown),
			});
			session.researchInstances[tabId] = researchInstance;
		}
		storageSet("session", { researchInstances: session.researchInstances } as StorageSessionValues);
		await highlightActivation;
		log("tab-communicate fulfillment finish", "", logMetadata);
	};

	chrome.tabs.onCreated.addListener(async tab => {
		let openerTabId: number | undefined = tab.openerTabId;
		if (tab.id === undefined || /\b\w+:(\/\/)?newtab\//.test(tab.pendingUrl ?? tab.url ?? "")) {
			return;
		}
		if (openerTabId === undefined) {
			if (compatibility.browser !== "chromium") {
				return;
			}
			// Must check `openerTabId` manually for Chromium, which may not define it on creation.
			openerTabId = (await chrome.tabs.get(tab.id)).openerTabId;
			if (openerTabId === undefined) {
				return;
			}
		}
		log("tab-communicate obligation check", "tab created", { tabId: tab.id });
		const session = await storageGet("session", [ "researchInstances" ]);
		if (await Tabs.isTabResearchPage(openerTabId)) {
			session.researchInstances[tab.id] = { ...session.researchInstances[openerTabId] };
			storageSet("session", session);
			pageChangeRespond(tab.url ?? "", tab.id); // New tabs may fail to trigger web navigation, due to loading from cache.
		}
	});

	const pageEventListener = async (tabId: number, changeInfo: browser.tabs._OnUpdatedChangeInfo) => {
		// Note: emitted events differ between Firefox and Chromium.
		if (changeInfo.url || changeInfo.status === "loading" || changeInfo.status === "complete") {
			pageChangeRespond(changeInfo.url ?? (await chrome.tabs.get(tabId)).url ?? "", tabId);
		}
	};

	// Note: emitted events differ between Firefox and Chromium.
	if (compatibility.browser === "firefox") {
		browser.tabs.onUpdated.addListener(pageEventListener, { properties: [ "url", "status" ] });
	} else {
		chrome.tabs.onUpdated.addListener(pageEventListener);
	}

	chrome.tabs.onRemoved.addListener(async tabId => {
		const session = await storageGet("session", [ "researchInstances" ]);
		if (session.researchInstances[tabId]) {
			delete session.researchInstances[tabId];
			storageSet("session", session);
		}
	});
})();

/**
 * Attempts to retrieve terms extracted from the current user selection, in a given tab.
 * @param tabId The ID of a tab from which to take selected terms.
 * @returns The terms extracted if successful, `undefined` otherwise.
 */
const getTermsSelectedInTab = async (tabId: number): Promise<Array<MatchTerm> | undefined> => {
	log("selection-terms-retrieval start", "");
	return sendTabMessage(tabId, { getDetails: { termsFromSelection: true } }).then(response => {
		log("selection-terms-retrieval finish", "", { tabId, phrases: (response.terms ?? []).map(term => term.phrase) });
		return response.terms ?? [];
	}).catch(() => {
		log("selection-terms-retrieval fail", "selection terms not received in response, perhaps no script is injected", { tabId });
		return undefined;
	});
};

/**
 * Activates highlighting within a tab using the current user selection, storing appropriate highlighting information.
 * @param tabId The ID of a tab to be linked and within which to highlight.
 */
const activateResearchInTab = async (tabId: number, terms: Array<MatchTerm> = []) => {
	log("research-activation start", "", { tabId });
	const local = await storageGet("local", [ "persistResearchInstances" ]);
	const session = await storageGet("session", [ "researchInstances" ]);
	const researchInstance = session.researchInstances[tabId] && local.persistResearchInstances && !terms.length
		? session.researchInstances[tabId]
		: await createResearchInstance({ terms });
	researchInstance.enabled = true;
	session.researchInstances[tabId] = researchInstance;
	storageSet("session", session);
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
	const session = await storageGet("session", [ "researchInstances" ]);
	const researchInstance = session.researchInstances[tabId];
	if (researchInstance) {
		if (researchInstance.terms.length) {
			researchInstance.enabled = false;
		} else {
			delete session.researchInstances[tabId];
		}
		storageSet("session", session);
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
	const sync = await storageGet("sync", [ "barControlsShown" ]);
	const session = await storageGet("session", [ "researchInstances" ]);
	const researchInstance = session.researchInstances[tabId];
	researchInstance.highlightsShown = toggleHighlightsOn
		?? !await sendTabMessage(tabId, { getDetails: { highlightsShown: true } }).then(response =>
			response.highlightsShown
		).catch(() =>
			researchInstance.highlightsShown
		);
	sendTabMessage(tabId, {
		toggleHighlightsOn: researchInstance.highlightsShown,
		barControlsShown: sync.barControlsShown,
	});
	storageSet("session", { researchInstances: session.researchInstances } as StorageSessionValues);
};

chrome.commands.onCommand.addListener(async commandString => {
	if (commandString === "open-popup") {
		(chrome.action["openPopup"] ?? (() => undefined))();
	}
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const tabId = tab.id as number; // `tab.id` is always defined for this case.
	const commandInfo = parseCommand(commandString);
	switch (commandInfo.type) {
	case "openPopup": {
		return;
	} case "openOptions": {
		chrome.runtime.openOptionsPage();
		return;
	} case "toggleEnabled": {
		storageGet("local", [ "enabled" ]).then(local => {
			storageSet("local", { enabled: !local.enabled } as StorageLocalValues);
			updateActionIcon(!local.enabled);
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
		const session = await storageGet("session", [ "researchInstances" ]);
		const researchInstance = session.researchInstances[tabId];
		if (!researchInstance) {
			return;
		}
		researchInstance.barCollapsed = !researchInstance.barCollapsed;
		sendTabMessage(tabId, {
			toggleBarCollapsedOn: researchInstance.barCollapsed,
		});
		storageSet("session", session);
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
		const session = await storageGet("session", [ "researchInstances" ]);
		const researchInstance = session.researchInstances[tabId];
		if (researchInstance) {
			researchInstance.terms = message.terms;
			await storageSet("session", session);
			log("terms-assign finish", "research instance created with terms", logMetadata);
		} else {
			const researchInstance = await createResearchInstance({ terms: message.terms });
			session.researchInstances[tabId] = researchInstance;
			await storageSet("session", session);
			log("terms-assign finish", "terms assigned to existing research instance", logMetadata);
		}
	}
	const tabMessage: Message.Tab = {
		terms: message.termsSend
			? (message.terms
				?? (await storageGet("session", [ "researchInstances" ])).researchInstances[tabId]?.terms)
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
			const session = await storageGet("session");
			if (await Tabs.isTabResearchPage(tabId)) {
				session.researchInstances[tabId].barCollapsed = toggle.barCollapsedOn;
				await storageSet("session", session);
			}
		}
		log("flags-toggle finish", "", logMetadata);
	}
	if (message.deactivateTabResearch) {
		deactivateResearchInTab(tabId);
	}
	if (message.performSearch) {
		const session = await storageGet("session", [ "researchInstances" ]);
		(chrome.search["search"] as typeof browser.search.search)({
			query: session.researchInstances[tabId].terms.map(term => term.phrase).join(" "),
			tabId,
		});
	}
	if (message.initializationGet) {
		log("initialization-return start", "", { tabId });
		const sync = (await storageGet("sync", [
			"barControlsShown",
			"barLook",
			"highlightMethod",
			"matchModeDefaults",
		]));
		const session = await storageGet("session", [ "researchInstances" ]);
		const researchInstance = session.researchInstances[tabId];
		if (researchInstance) {
			log("initialization-return finish", "", { tabId });
			return {
				terms: researchInstance.terms,
				toggleHighlightsOn: researchInstance.highlightsShown,
				toggleBarCollapsedOn: researchInstance.barCollapsed,
				barControlsShown: sync.barControlsShown,
				barLook: sync.barLook,
				highlightMethod: sync.highlightMethod,
				matchMode: sync.matchModeDefaults,
				// eslint-disable-next-line no-constant-condition
				setHighlighter: true // Set to `true` to test HIGHLIGHT engine, or `false` for regular behaviour.
					? {
						engine: "highlight",
					}
					: (
						sync.highlightMethod.paintReplaceByElement ? {
							engine: "element",
						} : {
							engine: "paint",
							paintEngineMethod: globalThis.browser ? "element" : "paint", //compatibility.highlight.paintEngine.paintMethod ? "paint" : "element",
						}
					),
				enablePageModify: isUrlPageModifyAllowed((await chrome.tabs.get(tabId)).url ?? "", sync.urlFilters),
			};
		} else {
			log("initialization-return fail", "no corresponding research instance exists", { tabId });
		}
	}
	return null;
};

chrome.runtime.onMessage.addListener((message: Message.Background, sender, sendResponse) => {
	(async () => {
		message.tabId ??= sender.tab?.id ?? (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id;
		handleMessage(message as Message.Background<true>).then(sendResponse);
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
