enum ScriptInclude { // Include scripts, which perform no action but provide utilities such as functions, classes, and enums.
	STORAGE = "/dist/include/storage.js",
	STEMMING = "/dist/include/pattern-stem.js",
	DIACRITICS = "/dist/include/pattern-diacritic.js",
	COMMON = "/dist/include/shared.js",
}

enum Script { // Handler scripts.
	BACKGROUND = "/dist/background.js",
	CONTENT = "/dist/content.js",
	POPUP = "/dist/pages/popup-build.js",
	OPTIONS = "/dist/pages/options.js",
}

if (/*isBrowserChromium()*/ !this.browser) {
	// Firefox accepts a list of event page scripts, whereas Chromium only accepts service workers.
	this["importScripts"](
		ScriptInclude.STORAGE,
		ScriptInclude.STEMMING,
		ScriptInclude.DIACRITICS,
		ScriptInclude.COMMON,
	);
}

chrome.scripting = useChromeAPI() ? chrome.scripting : browser["scripting"];
chrome.tabs.query = useChromeAPI() ? chrome.tabs.query : browser.tabs.query as typeof chrome.tabs.query;
chrome.tabs.sendMessage = useChromeAPI()
	? chrome.tabs.sendMessage
	: browser.tabs.sendMessage as typeof chrome.tabs.sendMessage;
chrome.tabs.get = useChromeAPI() ? chrome.tabs.get : browser.tabs.get as typeof chrome.tabs.get;
chrome.search["search"] = useChromeAPI()
	? (options: { query: string, tabId: number }) =>
		chrome.search["query"]({ text: options.query, tabId: options.tabId }, () => undefined)
	: browser.search.search;
chrome.commands.getAll = useChromeAPI() ? chrome.commands.getAll : browser.commands.getAll;

/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Array<string>, url: string, engine?: Engine }
	terms?: MatchTerms
}): Promise<ResearchInstance> => {
	const sync = await configGet([
		ConfigKey.SHOW_HIGHLIGHTS,
		ConfigKey.BAR_COLLAPSE,
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
	configGet([ ConfigKey.AUTO_FIND_OPTIONS ]).then(sync =>
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
const isTabSearchPage = async (engines: Engines, url: string): Promise<{ isSearch: boolean, engine?: Engine }> => {
	if (await getSearchQuery(url)) {
		return { isSearch: true };
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return { isSearch: !!engine, engine };
	}
};

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
	const updateEngine = (engines: Engines, id: string, urlDynamicString: string) => {
		if (!urlDynamicString) {
			return;
		}
		if (!urlDynamicString.includes("%s")) {
			delete engines[id];
			return;
		}
		const engine = new Engine({ urlDynamicString });
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
	const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) => {
		if (node.type === "bookmark") {
			setEngine(node);
		}
		(node.children ?? []).forEach(child => setEngines(engines, setEngine, child));
	};

	return () => {
		if (useChromeAPI() || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(async nodes => {
			const session = await bankGet([ BankKey.ENGINES ]);
			nodes.forEach(node =>
				setEngines(session.engines, node => {
					if (node.url) {
						updateEngine(session.engines, node.id, node.url);
					}
				}, node)
			);
			bankSet(session);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const session = await bankGet([ BankKey.ENGINES ]);
			setEngines(session.engines, node => {
				delete session.engines[node.id];
			}, removeInfo.node);
			bankSet(session);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const session = await bankGet([ BankKey.ENGINES ]);
				updateEngine(session.engines, id, createInfo.url);
				bankSet(session);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const session = await bankGet([ BankKey.ENGINES ]);
				updateEngine(session.engines, id, changeInfo.url);
				bankSet(session);
			}
		});
	};
})();

/**
 * Updates the action icon to reflect the extension's enabled/disabled status.
 * @param enabled If specified, overrides the extension's enabled/disabled status.
 */
const updateActionIcon = (enabled?: boolean) =>
	enabled === undefined
		? configGet([ ConfigKey.AUTO_FIND_OPTIONS ]).then(config =>
			updateActionIcon(config.autoFindOptions.enabled ?? false) // Prevent infinite recursion in case of storage failure.
		) : chrome.action.setIcon({ path: useChromeAPI()
			? enabled ? "/icons/dist/mms-32.png" : "/icons/dist/mms-off-32.png" // Chromium lacks SVG support for the icon.
			: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg"
		})
;

(() => {
	/**
	 * Registers items to selectively appear in context menus, if not present, to serve as shortcuts for managing the extension.
	 */
	const createContextMenuItems = () => {
		if (useChromeAPI() && chrome.contextMenus.onClicked["hasListeners"]()) {
			return;
		}
		chrome.contextMenus.removeAll();
		chrome.contextMenus.create({
			title: "&Highlight Selection",
			id: "activate-research-tab",
			contexts: [ "selection", "page" ],
		});
		chrome.contextMenus.onClicked.addListener((info, tab) => {
			if (tab && tab.id !== undefined) {
				log("research activation request", "context menu item activated", { tabId: tab.id });
				activateResearchInTab(tab.id);
			} else {
				assert(false, "research activation [from context menu] no request", "", { tab });
			}
		});
	};

	/**
	 * Prepares non-volatile extension components on install.
	 */
	const setUp = () => {
		if (useChromeAPI()) {
			// TODO instruct user how to assign the appropriate shortcuts
		}
	};

	/**
	 * Prepares volatile extension components in a new browser session.
	 */
	const initialize = () => {
		chrome.runtime.setUninstallURL("https://searchmarkers.github.io/pages/sendoff/");
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		updateActionIcon();
	};

	const startOnInstall = (isExtensionInstall: boolean, allowOnboarding = true) => {
		if (isExtensionInstall) {
			setUp();
			if (allowOnboarding) {
				chrome.tabs.create({ url: chrome.runtime.getURL("/pages/startpage.html") });
			}
		}
		optionsRepair();
		initialize();
	};

	chrome.runtime.onInstalled.addListener(details =>
		startOnInstall(details.reason === chrome.runtime.OnInstalledReason.INSTALL)
	);

	chrome.runtime.onStartup.addListener(initialize);

	createContextMenuItems(); // Ensures context menu items will be recreated on enabling the extension (after disablement).
	bankGet([ BankKey.RESEARCH_INSTANCES ]).then(session => { // TODO better workaround?
		if (session.researchInstances === undefined) {
			assert(false, "storage reinitialize", "storage read returned `undefined` when testing on wake");
		}
	});
})();

(() => {
	/**
	 * Compares an updated tab with its associated storage in order to identify necessary storage and highlighting changes,
	 * then carries out these changes.
	 * @param urlString The current URL of the tab, used to infer desired highlighting.
	 * @param tabId The ID of a tab to check and interact with.
	 */
	const pageModifyRemote = async (urlString: string, tabId: number) => {
		const logMetadata = { timeStart: Date.now(), tabId, url: urlString };
		log("tab-communicate fulfillment start", "", logMetadata);
		const sync = await configGet([
			ConfigKey.AUTO_FIND_OPTIONS,
			ConfigKey.SHOW_HIGHLIGHTS,
			ConfigKey.BAR_COLLAPSE,
			ConfigKey.BAR_CONTROLS_SHOWN,
			ConfigKey.BAR_LOOK,
			ConfigKey.HIGHLIGHT_METHOD,
			ConfigKey.MATCH_MODE_DEFAULTS,
			ConfigKey.URL_FILTERS,
			ConfigKey.TERM_LISTS,
		]);
		const local = await configGet([ ConfigKey.AUTO_FIND_OPTIONS ]);
		const bank = await bankGet([
			BankKey.RESEARCH_INSTANCES,
			BankKey.ENGINES,
		]);
		const searchDetails: { isSearch: boolean, engine?: Engine } = local.autoFindOptions.enabled
			? await isTabSearchPage(bank.engines, urlString)
			: { isSearch: false };
		searchDetails.isSearch = searchDetails.isSearch && isUrlSearchHighlightAllowed(urlString, sync.urlFilters);
		const termsFromLists = sync.termLists.filter(termList => isUrlFilteredIn(new URL(urlString), termList.urlFilter))
			.flatMap(termList => termList.terms);
		const getTermsAdditionalDistinct = (terms: MatchTerms, termsExtra: MatchTerms) =>
			termsExtra.filter(termExtra => !terms.find(term => term.phrase === termExtra.phrase));
		const isResearchPage = isTabResearchPage(bank.researchInstances, tabId);
		const overrideHighlightsShown = (searchDetails.isSearch && sync.showHighlights.overrideSearchPages)
			|| (isResearchPage && sync.showHighlights.overrideResearchPages);
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
				await executeScriptsInTabUnsafe(tabId).then(() =>
					messageSendHighlight(tabId, {
						termsOnHold: researchInstance.terms,
					})
				);
			} else {
				bank.researchInstances[tabId] = researchInstance;
				log("tab-communicate research enable (not storing yet)", "search detected in tab", logMetadata);
			}
		}
		let highlightActivation: Promise<void> = (async () => undefined)();
		// If tab *now* has research OR has applicable term lists: activate highlighting in tab.
		if (isTabResearchPage(bank.researchInstances, tabId) || termsFromLists.length) {
			const highlightActivationReason = termsFromLists.length
				? isTabResearchPage(bank.researchInstances, tabId)
					? "tab is a research page which term lists apply to"
					: "tab is a page which terms lists apply to"
				: "tab is a research page";
			log("tab-communicate highlight activation request", highlightActivationReason, logMetadata);
			const researchInstance = bank.researchInstances[tabId] ?? await createResearchInstance({});
			researchInstance.terms = researchInstance.enabled
				? researchInstance.terms.concat(getTermsAdditionalDistinct(researchInstance.terms, termsFromLists))
				: termsFromLists;
			if (!isTabResearchPage(bank.researchInstances, tabId)) {
				researchInstance.barCollapsed = sync.barCollapse.fromTermListAuto;
			}
			researchInstance.enabled = true;
			highlightActivation = activateHighlightingInTab(tabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, overrideHighlightsShown),
				toggleBarCollapsedOn: researchInstance.barCollapsed,
				barControlsShown: sync.barControlsShown,
				barLook: sync.barLook,
				highlightMethod: sync.highlightMethod,
				matchMode: sync.matchModeDefaults,
				useClassicHighlighting: sync.highlightMethod.paintReplaceByClassic,
				enablePageModify: isUrlPageModifyAllowed(urlString, sync.urlFilters),
			});
			bank.researchInstances[tabId] = researchInstance;
		}
		bankSet({ researchInstances: bank.researchInstances });
		await highlightActivation;
		log("tab-communicate fulfillment finish", "", logMetadata);
	};

	chrome.tabs.onCreated.addListener(async tab => {
		let openerTabId: number | undefined = tab.openerTabId;
		if (tab.id === undefined || /\b\w+:(\/\/)?newtab\//.test(tab.pendingUrl ?? tab.url ?? "")) {
			return;
		}
		if (openerTabId === undefined) {
			if (!useChromeAPI()) { // Must check `openerTabId` manually for Chromium, which may not define it on creation.
				return;
			}
			openerTabId = (await chrome.tabs.get(tab.id)).openerTabId;
			if (openerTabId === undefined) {
				return;
			}
		}
		log("tab-communicate obligation check", "tab created", { tabId: tab.id });
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, openerTabId)) {
			session.researchInstances[tab.id] = { ...session.researchInstances[openerTabId] };
			bankSet(session);
			pageModifyRemote(tab.url ?? "", tab.id); // New tabs may fail to trigger web navigation, due to loading from cache.
		}
	});

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.url) {
			pageModifyRemote(changeInfo.url, tabId);
		}
	});

	chrome.tabs.onRemoved.addListener(async tabId => {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		if (session.researchInstances[tabId]) {
			delete session.researchInstances[tabId];
			bankSet(session);
		}
	});

	if (useChromeAPI()) {
		// Chromium emits no `tabs` event for tab reload
		chrome.webNavigation.onCommitted.addListener(details => {
			if (details.url !== "" && details.transitionType === "reload") {
				pageModifyRemote(details.url, details.tabId);
			}
		});
	}
})();

/**
 * Activates highlighting within a tab.
 * @param targetTabId The ID of a tab to highlight within.
 * @param highlightMessageToReceive A message to be received by the tab's highlighting script.
 * This script will first be injected if not already present.
 */
const activateHighlightingInTab = async (targetTabId: number, highlightMessageToReceive?: HighlightMessage) => {
	const logMetadata = { tabId: targetTabId };
	log("pilot function injection start", "", logMetadata);
	await chrome.scripting.executeScript({
		func: (flagLoaded: string, tabId: number, highlightMessage: HighlightMessage,
			windowObjects: Record<string, Record<string, unknown>>) => {
			Object.entries(windowObjects).forEach(([ key, options ]) => {
				window[key] = options;
			});
			chrome.runtime.sendMessage({
				executeInTabNoPilot: !window[flagLoaded],
				tabId,
				highlightMessage,
			} as BackgroundMessage);
		},
		args: [ WindowVariable.SCRIPTS_LOADED, targetTabId, Object.assign(
			{ extensionCommands: await chrome.commands.getAll() },
			highlightMessageToReceive,
		), { [WindowVariable.CONFIG_HARD]: {
			paintUseExperimental: (await configGet([ ConfigKey.HIGHLIGHT_METHOD ])).highlightMethod.paintUseExperimental,
		} } ],
		target: { tabId: targetTabId },
		injectImmediately: true,
	}).then(value => {
		log("pilot function injection finish", "", logMetadata);
		return value;
	}).catch(() => {
		log("pilot function injection fail", "injection not permitted in this tab", logMetadata);
	});
};

/**
 * Attempts to retrieve terms extracted from the current user selection, in a given tab.
 * @param tabId The ID of a tab from which to take selected terms.
 * @param retriesRemaining The number of retries (after attempting to inject scripts) permitted, if any.
 * @returns The terms extracted if successful, `undefined` otherwise.
 */
const getTermsSelectedInTab = async (tabId: number, retriesRemaining = 0): Promise<MatchTerms | undefined> => {
	log("selection terms retrieval start", "");
	return messageSendHighlight(tabId, { getDetails: { termsFromSelection: true } }).then(response => {
		log("selection terms retrieval finish", "", { tabId, phrases: (response.terms ?? []).map(term => term.phrase) });
		return response.terms ?? [];
	}).catch(async () => {
		log("selection terms retrieval fail", "selection terms not received in response, perhaps no script is injected", { tabId });
		if (!assert(retriesRemaining !== 0, "selection terms retrieval cancel", "no retries remain")) {
			return undefined;
		}
		await executeScriptsInTabUnsafe(tabId);
		return getTermsSelectedInTab(tabId, retriesRemaining - 1);
	});
};

/**
 * Activates highlighting within a tab using the current user selection, storing appropriate highlighting information.
 * @param tabId The ID of a tab to be linked and within which to highlight.
 */
const activateResearchInTab = async (tabId: number) => {
	log("research activation start", "", { tabId });
	const local = await configGet([ ConfigKey.RESEARCH_INSTANCE_OPTIONS ]);
	const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
	const termsSelected = await getTermsSelectedInTab(tabId, 1);
	if (termsSelected === undefined) {
		log("research activation fail", "terms were not received in response, perhaps no script is injected");
		return;
	}
	const researchInstance = session.researchInstances[tabId]
		&& local.researchInstanceOptions.restoreLastInTab && !termsSelected.length
		? session.researchInstances[tabId]
		: await createResearchInstance({ terms: termsSelected });
	researchInstance.enabled = true;
	session.researchInstances[tabId] = researchInstance;
	bankSet(session);
	await messageHandleBackground({
		terms: researchInstance.terms,
		makeUnique: true,
		makeUniqueNoCreate: true,
		toggleHighlightsOn: true,
		highlightCommand: { type: CommandType.FOCUS_TERM_INPUT },
	} as BackgroundMessage, tabId);
	log("research activation finish", "", { tabId });
};

/**
 * Disables the highlighting information about a tab.
 * @param tabId The ID of a tab to be disconnected.
 */
const disableResearchInTab = async (tabId: number) => {
	const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
	const researchInstance = session.researchInstances[tabId];
	if (researchInstance) {
		if (researchInstance.terms.length) {
			researchInstance.enabled = false;
		} else {
			delete session.researchInstances[tabId];
		}
		bankSet(session);
	}
};

/**
 * Removes highlighting within a tab, disabling the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = (tabId: number) => {
	disableResearchInTab(tabId);
	messageSendHighlight(tabId, { deactivate: true });
};

/**
 * Toggles highlighting visibility within a tab.
 * @param tabId The ID of a tab to change the highlighting visibility of.
 * @param toggleHighlightsOn If specified, indicates target visibility. If unspecified, inverse of current visibility is used.
 */
const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	const sync = await configGet([ ConfigKey.BAR_CONTROLS_SHOWN ]);
	const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
	if (isTabResearchPage(session.researchInstances, tabId)) {
		const researchInstance = session.researchInstances[tabId];
		researchInstance.highlightsShown = toggleHighlightsOn
			?? !await messageSendHighlight(tabId, { getDetails: { highlightsShown: true } }).then(response =>
				response.highlightsShown
			).catch(() =>
				researchInstance.highlightsShown
			);
		messageSendHighlight(tabId, {
			toggleHighlightsOn: researchInstance.highlightsShown,
			barControlsShown: sync.barControlsShown,
		});
		bankSet({ researchInstances: session.researchInstances } as BankValues);
	}
};

// TODO update documentation, check that each use is appropriate (unsafe since there is no pilot)
/**
 * Injects a highlighting script, composed of the highlighting code preceded by its dependencies, into a tab.
 * @param tabId The ID of a tab to execute the script in.
 */
const executeScriptsInTabUnsafe = async (tabId: number) => {
	const logMetadata = { tabId };
	log("script injection start", "", logMetadata);
	await chrome.scripting.executeScript({
		func: (tabId: number, windowObjects: Record<string, Record<string, unknown>>) => {
			Object.entries(windowObjects).forEach(([ key, options ]) => {
				window[key] = options;
			});
		},
		args: [ tabId, { [WindowVariable.CONFIG_HARD]: {
			paintUseExperimental: (await configGet([ ConfigKey.HIGHLIGHT_METHOD ])).highlightMethod.paintUseExperimental,
		} } ],
		target: { tabId },
		injectImmediately: true,
	});
	await chrome.scripting.executeScript({
		files: [
			ScriptInclude.STEMMING,
			ScriptInclude.DIACRITICS,
			ScriptInclude.COMMON,
			Script.CONTENT,
		],
		target: { tabId },
	}).then(value => {
		log("script injection finish (silent failure possible)", "", logMetadata);
		return value;
	}).catch(() => {
		log("script injection fail", "injection not permitted in this tab", logMetadata);
	});
};

chrome.commands.onCommand.addListener(async commandString => {
	if (commandString === "open-popup") {
		(chrome.action["openPopup"] ?? (() => undefined))();
	}
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const tabId = tab.id as number; // `tab.id` always defined for this case.
	const commandInfo = parseCommand(commandString);
	switch (commandInfo.type) {
	case CommandType.OPEN_POPUP: {
		return;
	} case CommandType.OPEN_OPTIONS: {
		chrome.runtime.openOptionsPage();
		return;
	} case CommandType.TOGGLE_ENABLED: {
		configGet([ ConfigKey.AUTO_FIND_OPTIONS ]).then(local => {
			local.autoFindOptions.enabled = !local.autoFindOptions.enabled;
			configSet(local);
			updateActionIcon(local.autoFindOptions.enabled);
		});
		return;
	} case CommandType.TOGGLE_IN_TAB: {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, tabId)) {
			deactivateResearchInTab(tabId);
		} else {
			activateResearchInTab(tabId);
		}
		return;
	} case CommandType.TOGGLE_HIGHLIGHTS: {
		toggleHighlightsInTab(tabId);
		return;
	} case CommandType.TOGGLE_BAR: {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		const researchInstance = session.researchInstances[tabId];
		if (!researchInstance) {
			return;
		}
		researchInstance.barCollapsed = !researchInstance.barCollapsed;
		messageSendHighlight(tabId, {
			toggleBarCollapsedOn: researchInstance.barCollapsed,
		});
		bankSet(session);
		return;
	}}
	messageSendHighlight(tabId, { command: commandInfo });
});

/**
 * Decodes a message involving backend extension management.
 * @param message A message intended for the background script.
 * @param senderTabId The ID of a tab assumed to be the message sender.
 */
const messageHandleBackground = async (message: BackgroundMessage, senderTabId: number) => {
	if (message.highlightMessage !== undefined) {
		if (message.executeInTabNoPilot) {
			await executeScriptsInTabUnsafe(message.tabId as number);
		}
		// FIXME generates errors even when wrapped in try...catch
		messageSendHighlight(message.tabId as number, message.highlightMessage);
	} else if (message.toggleResearchOn !== undefined) {
		const toggleResearchOn = message.toggleResearchOn;
		configGet([ ConfigKey.AUTO_FIND_OPTIONS ]).then(local => {
			local.autoFindOptions.enabled = toggleResearchOn;
			configSet(local);
			updateActionIcon(toggleResearchOn);
		});
	} else if (message.toggleHighlightsOn !== undefined && !message.makeUnique) {
		toggleHighlightsInTab(senderTabId, message.toggleHighlightsOn);
	} else if (message.toggleBarCollapsedOn !== undefined) {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		if (!isTabResearchPage(session.researchInstances, senderTabId)) {
			return;
		}
		session.researchInstances[senderTabId].barCollapsed = message.toggleBarCollapsedOn;
		bankSet(session);
	} else if (message.disableTabResearch) {
		deactivateResearchInTab(senderTabId);
	} else if (message.performSearch) {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		(chrome.search["search"] as typeof browser.search.search)({
			query: session.researchInstances[senderTabId].terms.map(term => term.phrase).join(" "),
			tabId: senderTabId,
		});
	} else {
		const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
		if ((message.makeUnique && !message.makeUniqueNoCreate) || !isTabResearchPage(session.researchInstances, senderTabId)) {
			const researchInstance = await createResearchInstance({ terms: message.terms });
			session.researchInstances[senderTabId] = researchInstance;
		}
		if (message.makeUnique) {
			const researchInstance = session.researchInstances[senderTabId]; // From previous `if` statement.
			const sync = await configGet([
				ConfigKey.BAR_CONTROLS_SHOWN,
				ConfigKey.BAR_LOOK,
				ConfigKey.HIGHLIGHT_METHOD,
				ConfigKey.MATCH_MODE_DEFAULTS,
				ConfigKey.URL_FILTERS,
			]);
			researchInstance.highlightsShown = message.toggleHighlightsOn ?? researchInstance.highlightsShown;
			bankSet(session);
			await activateHighlightingInTab(senderTabId, {
				terms: researchInstance.terms,
				toggleHighlightsOn: determineToggleHighlightsOn(researchInstance.highlightsShown, false),
				toggleBarCollapsedOn: researchInstance.barCollapsed,
				barControlsShown: sync.barControlsShown,
				barLook: sync.barLook,
				highlightMethod: sync.highlightMethod,
				matchMode: sync.matchModeDefaults,
				useClassicHighlighting: sync.highlightMethod.paintReplaceByClassic,
				enablePageModify: isUrlPageModifyAllowed((await chrome.tabs.get(senderTabId)).url ?? "", sync.urlFilters),
				command: message.highlightCommand,
			});
		} else if (message.terms !== undefined) {
			const researchInstance = session.researchInstances[senderTabId];
			researchInstance.terms = message.terms;
			researchInstance.highlightsShown = message.toggleHighlightsOn ?? researchInstance.highlightsShown;
			bankSet(session);
			const highlightMessage: HighlightMessage = { terms: message.terms };
			highlightMessage.termUpdate = message.termChanged;
			highlightMessage.termToUpdateIdx = message.termChangedIdx;
			messageSendHighlight(senderTabId, highlightMessage);
		} else {
			bankSet(session);
		}
	}
};

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
	if (sender.tab && sender.tab.id !== undefined) {
		messageHandleBackground(message, sender.tab.id);
	} else {
		chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
			messageHandleBackground(message, tab.id as number)
		);
	}
	sendResponse(); // Mitigates manifest V3 bug which otherwise logs an error message.
});

chrome.action.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
