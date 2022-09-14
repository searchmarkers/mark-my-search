if (/*isBrowserChromium()*/ !this.browser) {
	// Firefox accepts a list of event page scripts, whereas Chromium only accepts service workers
	this["importScripts"](
		"/dist/manage-storage.js",
		"/dist/stem-pattern-find.js",
		"/dist/shared-content.js",
	);
}
chrome.scripting = isBrowserChromium() ? chrome.scripting : browser["scripting"];
chrome.tabs.query = isBrowserChromium() ? chrome.tabs.query : browser.tabs.query as typeof chrome.tabs.query;
chrome.tabs.sendMessage = isBrowserChromium()
	? chrome.tabs.sendMessage
	: browser.tabs.sendMessage as typeof chrome.tabs.sendMessage;
chrome.tabs.get = isBrowserChromium() ? chrome.tabs.get : browser.tabs.get as typeof chrome.tabs.get;
chrome.search["query"] = isBrowserChromium()
	? (options: { query: string, tabId: number }) => chrome.search["query"](options, () => undefined)
	: browser.search.search;
chrome.commands.getAll = isBrowserChromium() ? chrome.commands.getAll : browser.commands.getAll;

/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Array<string>, url: string, engine?: Engine }
	terms?: MatchTerms
	autoOverwritable: boolean
}): Promise<ResearchInstance> => {
	const sync = await getStorageSync([ StorageSync.SHOW_HIGHLIGHTS ]);
	const local = await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ]);
	if (args.url) {
		const phraseGroups = args.url.engine ? [] : (await getSearchQuery(args.url.url)).split("\"");
		const termsRaw = args.url.engine
			? args.url.engine.extract(args.url.url ?? "")
			: phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		const terms = Array.from(new Set(termsRaw))
			.filter(phrase => args.url ? !args.url.stoplist.includes(phrase) : false)
			.map(phrase => new MatchTerm(phrase));
		return {
			phrases: terms.map(term => term.phrase),
			terms,
			highlightsShown: sync.showHighlights.default,
			autoOverwritable: args.autoOverwritable,
			persistent: local.persistResearchInstances,
			enabled: true,
		};
	}
	args.terms ??= [];
	return {
		phrases: args.terms.map(term => term.phrase),
		terms: args.terms,
		highlightsShown: sync.showHighlights.default,
		autoOverwritable: args.autoOverwritable,
		persistent: local.persistResearchInstances,
		enabled: true,
	};
};

/**
 * Gets the query string of a potential search.
 * @param url A URL to be tested.
 * @returns The URL segment determined to be the search query, or the empty string if none is found.
 */
const getSearchQuery = async (url: string): Promise<string> => {
	const sync = await getStorageSync([ StorageSync.AUTO_FIND_OPTIONS ]);
	return new URL(url).searchParams.get(
		sync.autoFindOptions.searchParams.find(param => new URL(url).searchParams.has(param)) ?? ""
	) ?? "";
};

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

// TODO document
const isUrlFilteredIn = (() => {
	const sanitize = (urlComponent: string) =>
		sanitizeForRegex(urlComponent).replace("\\*", ".*")
	;

	return (url: URL, urlFilter: URLFilter): boolean =>
		!!urlFilter.find(({ hostname, pathname }) =>
			(new RegExp(sanitize(hostname) + "\\b")).test(url.hostname)
			&& (new RegExp("\\b" + sanitize(pathname.slice(1)))).test(url.pathname.slice(1))
		)
	;
})();

// TODO document
const isUrlPageModifyAllowed = (urlString: string, urlFilters: StorageSyncValues[StorageSync.URL_FILTERS]) =>
	!isUrlFilteredIn(new URL(urlString), urlFilters.noPageModify)
;

/**
 * Creates a message for sending to an injected highlighting script in order for it to store and highlight an array of terms.
 * This is an intermediary interface which parametises common components of such a message.
 * Not all contingencies are covered, but additional arguments may be applied to the resulting message.
 * @param researchInstance An object representing an instance of highlighting.
 * @param overrideHighlightsShown A flag which, if specified, indicates the visiblity of highlights to be __on__ if `true`
 * or the appropriate flag in the highlighting instance is `true`, __off__ otherwise. If unspecified, highlight visibility is not changed.
 * @param barControlsShown An object of flags indicating the visibility of each toolbar option module.
 * @param barLook An object of details about the style and layout of the toolbar.
 * @param highlightLook 
 * @param enablePageModify 
 * @returns A research message which, when sent to a highlighting script, will produce the desired effect within that page.
 */
// TODO document
const createResearchMessage = (
	researchInstance: ResearchInstance,
	overrideHighlightsShown: boolean | undefined,
	barControlsShown: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN],
	barLook: StorageSyncValues[StorageSync.BAR_LOOK],
	highlightLook: StorageSyncValues[StorageSync.HIGHLIGHT_LOOK],
	matchMode: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS],
	enablePageModify: boolean,
) => ({
	terms: researchInstance.terms,
	toggleHighlightsOn: overrideHighlightsShown === undefined
		? undefined
		: researchInstance.highlightsShown || overrideHighlightsShown,
	barControlsShown,
	barLook,
	highlightLook,
	matchMode,
	enablePageModify,
} as HighlightMessage);

/**
 * Continuously caches objects, representing search engine URLs and how to extract contained search queries, to session storage.
 * These objects are inferred from heuristics such as details of dynamic bookmarks stored by the user.
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
		if (isBrowserChromium() || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(async nodes => {
			const session = await getStorageSession([ StorageSession.ENGINES ]);
			nodes.forEach(node =>
				setEngines(session.engines, node => {
					if (node.url) {
						updateEngine(session.engines, node.id, node.url);
					}
				}, node)
			);
			setStorageSession(session);
		});

		browser.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
			const session = await getStorageSession([ StorageSession.ENGINES ]);
			setEngines(session.engines, node => {
				delete session.engines[node.id];
			}, removeInfo.node);
			setStorageSession(session);
		});

		browser.bookmarks.onCreated.addListener(async (id, createInfo) => {
			if (createInfo.url) {
				const session = await getStorageSession([ StorageSession.ENGINES ]);
				updateEngine(session.engines, id, createInfo.url);
				setStorageSession(session);
			}
		});

		browser.bookmarks.onChanged.addListener(async (id, changeInfo) => {
			if (changeInfo.url) {
				const session = await getStorageSession([ StorageSession.ENGINES ]);
				updateEngine(session.engines, id, changeInfo.url);
				setStorageSession(session);
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
		? getStorageLocal([ StorageLocal.ENABLED ]).then(local => updateActionIcon(local.enabled))
		: chrome.action.setIcon({ path: isBrowserChromium()
			? enabled ? "/icons/mms-32.png" : "/icons/mms-off-32.png" // Chromium still has patchy SVG support
			: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg"
		})
;

(() => {
	/**
	 * Registers items to selectively appear in context menus. These items serve as shortcuts for managing the extension.
	 */
	const createContextMenuItems = () => {
		chrome.contextMenus.onClicked.addListener((info, tab) => {
			if (tab && tab.id !== undefined) {
				activateResearchInTab(tab.id);
			}
		});
	
		return (() => {
			chrome.contextMenus.removeAll();
			chrome.contextMenus.create({
				title: "&Highlight Selection",
				id: "activate-research-tab",
				contexts: [ "selection", "page" ],
			});
		})();
	};

	/**
	 * Prepares non-volatile extension components on install.
	 */
	const setUp = () => {
		if (isBrowserChromium()) {
			// TODO instruct user how to assign the appropriate shortcuts
		} else {
			browser.commands.update({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			browser.commands.update({ name: "toggle-bar", shortcut: "Ctrl+Shift+F" });
			browser.commands.update({ name: "toggle-research-global", shortcut: "Alt+Shift+J" });
			browser.commands.update({ name: "focus-term-append", shortcut: "Alt+Period" });
			for (let i = 0; i < 10; i++) {
				browser.commands.update({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				browser.commands.update({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		}
	};

	/**
	 * Prepares volatile extension components in a new browser session.
	 */
	const initialize = () => {
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		initializeStorage();
		updateActionIcon();
	};

	chrome.runtime.onInstalled.addListener(details => {
		if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
			setUp();
		}
		repairOptions();
		initialize();
	});

	chrome.runtime.onStartup.addListener(initialize);
})();

(() => {
	/**
	 * Compares an updated tab with its associated storage in order to identify necessary storage and highlighting changes,
	 * then carries out these changes.
	 * @param urlString The current URL of the tab, used to infer desired highlighting.
	 * @param tabId The ID of a tab to check and interact with.
	 */
	const pageModifyRemote = async (urlString: string, tabId: number) => {
		const sync = await getStorageSync([
			StorageSync.AUTO_FIND_OPTIONS,
			StorageSync.SHOW_HIGHLIGHTS,
			StorageSync.BAR_CONTROLS_SHOWN,
			StorageSync.BAR_LOOK,
			StorageSync.HIGHLIGHT_LOOK,
			StorageSync.MATCH_MODE_DEFAULTS,
			StorageSync.URL_FILTERS,
		]);
		const local = await getStorageLocal([ StorageLocal.ENABLED ]);
		const session = await getStorageSession([
			StorageSession.RESEARCH_INSTANCES,
			StorageSession.ENGINES,
		]);
		const searchDetails: { isSearch: boolean, engine?: Engine } = local.enabled
			? await isTabSearchPage(session.engines, urlString)
			: { isSearch: false };
		const isResearchPage = isTabResearchPage(session.researchInstances, tabId);
		const overrideHighlightsShown = (searchDetails.isSearch && sync.showHighlights.overrideSearchPages)
			|| (isResearchPage && sync.showHighlights.overrideResearchPages);
		if (searchDetails.isSearch && (isResearchPage ? session.researchInstances[tabId].autoOverwritable : true)) {
			const researchInstance = await createResearchInstance({
				url: {
					stoplist: sync.autoFindOptions.stoplist,
					url: urlString,
					engine: searchDetails.engine,
				},
				autoOverwritable: true,
			});
			if (!isResearchPage || !itemsMatch(session.researchInstances[tabId].phrases, researchInstance.phrases)) {
				session.researchInstances[tabId] = researchInstance;
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
				activateHighlightingInTab(tabId, createResearchMessage(
					session.researchInstances[tabId],
					overrideHighlightsShown,
					sync.barControlsShown,
					sync.barLook,
					sync.highlightLook,
					sync.matchModeDefaults,
					isUrlPageModifyAllowed(urlString, sync.urlFilters),
				));
			}
		}
		if (isResearchPage) {
			activateHighlightingInTab(tabId, createResearchMessage(
				session.researchInstances[tabId],
				overrideHighlightsShown,
				sync.barControlsShown,
				sync.barLook,
				sync.highlightLook,
				sync.matchModeDefaults,
				isUrlPageModifyAllowed(urlString, sync.urlFilters),
			));
		}
	};
	
	chrome.tabs.onCreated.addListener(async tab => {
		const local = await getStorageLocal([ StorageLocal.FOLLOW_LINKS ]);
		if (!local.followLinks
			|| tab.id === undefined || tab.openerTabId === undefined || /\b\w+:(\/\/)?newtab\//.test(tab.pendingUrl ?? tab.url ?? "")) {
			return;
		}
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, tab.openerTabId)) {
			const sync = await getStorageSync([ StorageSync.LINK_RESEARCH_TABS ]);
			session.researchInstances[tab.id] = sync.linkResearchTabs
				? session.researchInstances[tab.openerTabId]
				: { ...session.researchInstances[tab.openerTabId] };
			setStorageSession(session);
		}
	});

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
		if (changeInfo.url) {
			pageModifyRemote(changeInfo.url, tabId);
		}
	});

	if (isBrowserChromium()) {
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
const activateHighlightingInTab = async (targetTabId: number, highlightMessageToReceive?: HighlightMessage) =>
	chrome.scripting.executeScript({
		func: (tabId, highlightMessage) => {
			const executionDeniedIdentifier = "executionUnnecessary";
			chrome.runtime.sendMessage({
				executeInTab: !window[executionDeniedIdentifier],
				tabId,
				highlightMessage,
			} as BackgroundMessage);
			window[executionDeniedIdentifier] = true;
		},
		args: [ targetTabId, Object.assign(
			{ extensionCommands: await chrome.commands.getAll() } as HighlightMessage,
			highlightMessageToReceive,
		) ],
		target: { tabId: targetTabId },
	})
;

/**
 * Activates highlighting within a tab using the current user selection, storing appropriate highlighting information.
 * @param tabId The ID of a tab to be linked and within which to highlight.
 */
const activateResearchInTab = async (tabId: number) => {
	const sync = await getStorageSync([
		StorageSync.BAR_CONTROLS_SHOWN,
		StorageSync.BAR_LOOK,
		StorageSync.HIGHLIGHT_LOOK,
		StorageSync.MATCH_MODE_DEFAULTS,
		StorageSync.URL_FILTERS,
	]);
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	const researchInstance = await (async () => {
		const researchInstance = session.researchInstances[tabId];
		if (researchInstance
			&& researchInstance.persistent
			&& await (chrome.tabs.sendMessage as typeof browser.tabs.sendMessage)(tabId, { getDetails: { termsFromSelection: true } } as HighlightMessage)
				.then((response: HighlightDetails) => (response.terms ?? []).length === 0)) {
			researchInstance.enabled = true;
			return researchInstance;
		}
		return await createResearchInstance({
			terms: [],
			autoOverwritable: false,
		});
	})();
	researchInstance.highlightsShown = true;
	if (researchInstance.terms.length) {
		handleMessage({
			terms: researchInstance.terms,
			makeUnique: true,
			toggleHighlightsOn: true,
			highlightCommand: { type: CommandType.FOCUS_TERM_INPUT },
		} as BackgroundMessage, tabId);
	} else {
		session.researchInstances[tabId] = researchInstance;
		await setStorageSession(session);
		activateHighlightingInTab(
			tabId, //
			Object.assign(
				{
					termsFromSelection: true,
					command: { type: CommandType.FOCUS_TERM_INPUT },
				} as HighlightMessage,
				createResearchMessage(
					researchInstance,
					false,
					sync.barControlsShown,
					sync.barLook,
					sync.highlightLook,
					sync.matchModeDefaults,
					isUrlPageModifyAllowed((await chrome.tabs.get(tabId)).url ?? "", sync.urlFilters),
				),
			), //
		);
	}
};

/**
 * Disables the highlighting information about a tab.
 * @param tabId The ID of a tab to be forgotten.
 */
const disableResearchInstanceInTab = async (tabId: number) => {
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	const researchInstance = session.researchInstances[tabId];
	if (researchInstance) {
		if (researchInstance.persistent) {
			researchInstance.enabled = false;
		} else {
			delete session.researchInstances[tabId];
		}
		setStorageSession(session);
	}
};

/**
 * Removes highlighting within a tab, disabling the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = (tabId: number) => {
	disableResearchInstanceInTab(tabId);
	chrome.tabs.sendMessage(tabId, { deactivate: true } as HighlightMessage);
};

/**
 * Toggles highlighting visibility within a tab.
 * @param tabId The ID of a tab to change the highlighting visibility of.
 * @param toggleHighlightsOn If specified, indicates target visibility. If unspecified, inverse of current visibility is used.
 */
const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	const sync = await getStorageSync([ StorageSync.BAR_CONTROLS_SHOWN ]);
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	if (isTabResearchPage(session.researchInstances, tabId)) {
		const researchInstance = session.researchInstances[tabId];
		researchInstance.highlightsShown = toggleHighlightsOn ?? !researchInstance.highlightsShown;
		chrome.tabs.sendMessage(tabId, {
			toggleHighlightsOn: researchInstance.highlightsShown,
			barControlsShown: sync.barControlsShown,
		} as HighlightMessage);
		setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
	}
};

/**
 * Injects a highlighting script, composed of the highlighting code preceded by its dependencies, into a tab.
 * @param tabId The ID of a tab to execute the script in.
 */
const executeScriptsInTab = (tabId: number) =>
	chrome.scripting.executeScript({
		files: [ "/dist/stem-pattern-find.js", "/dist/shared-content.js", "/dist/term-highlight.js" ],
		target: { tabId },
	})
;

chrome.commands.onCommand.addListener(async commandString => {
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); // `tab.id` always defined for this case
	const commandInfo = parseCommand(commandString);
	switch (commandInfo.type) {
	case CommandType.TOGGLE_ENABLED: {
		getStorageLocal([ StorageLocal.ENABLED ]).then(local => {
			setStorageLocal({ enabled: !local.enabled } as StorageLocalValues);
			updateActionIcon(!local.enabled);
		});
		return;
	} case CommandType.TOGGLE_IN_TAB: {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (isTabResearchPage(session.researchInstances, tab.id as number)) {
			deactivateResearchInTab(tab.id as number);
		} else {
			activateResearchInTab(tab.id as number);
		}
		return;
	} case CommandType.TOGGLE_HIGHLIGHTS: {
		toggleHighlightsInTab(tab.id as number);
		return;
	}}
	chrome.tabs.sendMessage(tab.id as number, { command: commandInfo } as HighlightMessage);
});

/**
 * Decodes a message involving backend extension management.
 * @param message A message intended for the background script.
 * @param senderTabId The ID of a tab assumed to be the message sender.
 */
const handleMessage = async (message: BackgroundMessage, senderTabId: number) => {
	if (message.highlightMessage !== undefined) {
		if (message.executeInTab) {
			await executeScriptsInTab(message.tabId as number);
		}
		chrome.tabs.sendMessage(message.tabId as number, message.highlightMessage);
	} else if (message.toggleResearchOn !== undefined) {
		setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues)
			.then(() => updateActionIcon(message.toggleResearchOn));
	} else if (message.disableTabResearch) {
		deactivateResearchInTab(senderTabId);
	} else if (message.performSearch) {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		(chrome.search["query"] as typeof browser.search.search)({
			query: session.researchInstances[senderTabId].terms.map(term => term.phrase).join(" "),
			tabId: senderTabId,
		});
	} else {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (message.makeUnique || !isTabResearchPage(session.researchInstances, senderTabId)) {
			const researchInstance = await createResearchInstance({
				terms: message.terms,
				autoOverwritable: false,
			});
			session.researchInstances[senderTabId] = researchInstance;
			setStorageSession(session);
		}
		if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
			const researchInstance = session.researchInstances[senderTabId]; // From previous `if` statement
			const sync = await getStorageSync([
				StorageSync.BAR_CONTROLS_SHOWN,
				StorageSync.BAR_LOOK,
				StorageSync.HIGHLIGHT_LOOK,
				StorageSync.MATCH_MODE_DEFAULTS,
				StorageSync.URL_FILTERS,
			]);
			if (message.toggleHighlightsOn !== undefined) {
				researchInstance.highlightsShown = message.toggleHighlightsOn;
			}
			activateHighlightingInTab(senderTabId, Object.assign(
				{ command: message.highlightCommand },
				createResearchMessage(
					researchInstance,
					false,
					sync.barControlsShown,
					sync.barLook,
					sync.highlightLook,
					sync.matchModeDefaults,
					isUrlPageModifyAllowed((await chrome.tabs.get(senderTabId)).url ?? "", sync.urlFilters),
				),
			));
		} else if (message.terms !== undefined) {
			session.researchInstances[senderTabId].terms = message.terms;
			setStorageSession(session);
			const highlightMessage: HighlightMessage = { terms: message.terms };
			highlightMessage.termUpdate = message.termChanged;
			highlightMessage.termToUpdateIdx = message.termChangedIdx;
			Object.keys(session.researchInstances).forEach(tabId => {
				if (session.researchInstances[tabId] === session.researchInstances[senderTabId]) {
					chrome.tabs.sendMessage(Number(tabId), highlightMessage);
				}
			});
		}
	}
};

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
	if (sender.tab && sender.tab.id !== undefined) {
		handleMessage(message, sender.tab.id);
	} else {
		chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
			handleMessage(message, tab.id as number)
		);
	}
	sendResponse(); // Mitigates manifest V3 bug which otherwise logs an error message
});

chrome.action.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
