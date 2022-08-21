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
chrome.search.query = isBrowserChromium()
	? (options: { query: string, tabId: number }) => chrome.search.query(options, () => undefined)
	: browser.search.search;
chrome.commands.getAll = isBrowserChromium() ? chrome.commands.getAll : browser.commands.getAll;

/**
 * Creates an object storing highlighting information about a tab, for application to pages within that tab.
 * @param args Arguments for building the initial research instance. Variables in storage may also be used.
 * @returns The resulting research instance.
 */
const createResearchInstance = async (args: {
	url?: { stoplist: Stoplist, url: string, engine?: Engine }
	terms?: MatchTerms
}): Promise<ResearchInstance> => {
	const sync = await getStorageSync([ StorageSync.SHOW_HIGHLIGHTS ]);
	if (args.url) {
		const phraseGroups = args.url.engine ? [] : getSearchQuery(args.url.url).split("\"");
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
		};
	}
	args.terms = args.terms ?? [];
	return {
		phrases: args.terms.map(term => term.phrase),
		terms: args.terms,
		highlightsShown: sync.showHighlights.default,
	};
};

/**
 * Gets the query string of a potential search.
 * @param url A URL to be tested.
 * @returns The URL segment determined to be the search query, or the empty string if none is found.
 */
const getSearchQuery = (url: string): string  =>
	new URL(url).searchParams
		.get([ "q", "query", "search" ].find(param => new URL(url).searchParams.has(param)) ?? "") ?? ""
;

/**
 * Gets heuristically whether or not a URL specifies a search on an arbitrary search engine.
 * @param engines An array of objects representing search engine URLs and how to extract contained search queries.
 * @param url A URL to be tested.
 * @returns An object containing a flag for whether or not the URL specifies a search,
 * and the first object which matched the URL (if any).
 */
const isTabSearchPage = (engines: Engines, url: string): { isSearch: boolean, engine?: Engine } => {
	if (getSearchQuery(url)) {
		return { isSearch: true };
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return { isSearch: !!engine, engine };
	}
};

/**
 * Gets whether or not a tab has active highlighting information stored, so is considered highlighted.
 * @param researchInstances An array of objects each representing an instance of highlighting.
 * @param tabId The ID of a tab.
 * @returns `true` if the tab is considered highlighted, `false` otherwise.
 */
const isTabResearchPage = (researchInstances: ResearchInstances, tabId: number): boolean =>
	tabId in researchInstances
;

/**
 * Creates a message for sending to an injected highlighting script in order for it to store and highlight an array of terms.
 * This is an intermediary interface which parametises common components of such a message, not all contingencies are covered.
 * @param researchInstance An object representing an instance of highlighting.
 * @param overrideHighlightsShown A flag which, if specified, indicates the visiblity of highlights to be on if `true`
 * or the appropriate flag in `researchInstance` is `true`, off otherwise. If unspecified, highlight visibility is not changed.
 * @param barControlsShown An object of flags indicating the visibility of each toolbar option module.
 * @param barLook An object of details about the style and layout of the toolbar.
 * @returns A research message which, when sent to a highlighting script, will produce the desired effect within that page.
 */
const createResearchMessage = (
	researchInstance: ResearchInstance,
	overrideHighlightsShown?: boolean,
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN],
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK],
) => ({
	terms: researchInstance.terms,
	toggleHighlightsOn: overrideHighlightsShown === undefined
		? undefined
		: researchInstance.highlightsShown || overrideHighlightsShown,
	barControlsShown,
	barLook,
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
	 * @param url The current URL of the tab, used to infer desired highlighting.
	 * @param tabId The ID of a tab to check and interact with.
	 */
	const pageModifyRemote = async (url: string, tabId: number) => {
		const sync = await getStorageSync([
			StorageSync.STOPLIST,
			StorageSync.SHOW_HIGHLIGHTS,
			StorageSync.BAR_CONTROLS_SHOWN,
			StorageSync.BAR_LOOK,
		]);
		const local = await getStorageLocal([ StorageLocal.ENABLED ]);
		const session = await getStorageSession([
			StorageSession.RESEARCH_INSTANCES,
			StorageSession.ENGINES,
		]);
		const searchDetails: ReturnType<typeof isTabSearchPage> = local.enabled
			? isTabSearchPage(session.engines, url)
			: { isSearch: false };
		const isResearchPage = isTabResearchPage(session.researchInstances, tabId);
		const overrideHighlightsShown = (searchDetails.isSearch && sync.showHighlights.overrideSearchPages)
			|| (isResearchPage && sync.showHighlights.overrideResearchPages);
		if (searchDetails.isSearch) {
			const researchInstance = await createResearchInstance({ url: {
				stoplist: sync.stoplist,
				url,
				engine: searchDetails.engine
			} });
			if (!isResearchPage || !itemsMatch(session.researchInstances[tabId].phrases, researchInstance.phrases)) {
				session.researchInstances[tabId] = researchInstance;
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
				activateHighlightingInTab(tabId, createResearchMessage(
					session.researchInstances[tabId],
					overrideHighlightsShown,
					sync.barControlsShown,
					sync.barLook,
				));
			}
		}
		if (isResearchPage) {
			activateHighlightingInTab(tabId, createResearchMessage(
				session.researchInstances[tabId],
				overrideHighlightsShown,
				sync.barControlsShown,
				sync.barLook,
			));
		}
	};
	
	chrome.tabs.onCreated.addListener(tab => getStorageSync([ StorageSync.LINK_RESEARCH_TABS ]).then(async sync => {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (tab && tab.id !== undefined && tab.openerTabId !== undefined
			&& (!tab.pendingUrl || !/\b\w+:\/\/newtab\//.test(tab.pendingUrl))
			&& isTabResearchPage(session.researchInstances, tab.openerTabId)) {
			session.researchInstances[tab.id] = sync.linkResearchTabs
				? session.researchInstances[tab.openerTabId]
				: { ...session.researchInstances[tab.openerTabId] };
			setStorageSession(session);
		}
	}));

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => !changeInfo.url ? undefined :
		pageModifyRemote(changeInfo.url, tabId)
	);

	if (isBrowserChromium()) {
		// Chromium emits no `tabs` event for tab reload
		chrome.webNavigation.onCommitted.addListener(details =>
			details.url === "" || details.transitionType !== "reload" ? undefined :
				pageModifyRemote(details.url, details.tabId)
		);
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
	const sync = await getStorageSync([ StorageSync.BAR_CONTROLS_SHOWN ]);
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	const researchInstance = await createResearchInstance({ terms: [] });
	researchInstance.highlightsShown = true;
	session.researchInstances[tabId] = researchInstance;
	setStorageSession(session);
	await activateHighlightingInTab(
		tabId,
		Object.assign(
			{ termsFromSelection: true, command: { type: CommandType.FOCUS_TERM_INPUT } } as HighlightMessage,
			createResearchMessage(researchInstance, false, sync.barControlsShown, sync.barLook),
		),
	);
};

/**
 * Removes highlighting within a tab, deleting the associated highlighting information.
 * @param tabId The ID of a tab to be forgotten and within which to deactivate highlighting.
 */
const deactivateResearchInTab = async (tabId: number) => {
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	delete session.researchInstances[tabId];
	chrome.tabs.sendMessage(tabId, { disable: true } as HighlightMessage);
	setStorageSession(session);
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

(() => {
	/**
	 * Decodes a message involving backend extension management.
	 * @param message A message intended for the background script.
	 * @param senderTabId The ID of a tab assumed to be the message sender.
	 */
	const handleMessage = async (message: BackgroundMessage, senderTabId: number) => {
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		if (message.highlightMessage !== undefined) {
			if (message.executeInTab) {
				await executeScriptsInTab(message.tabId as number);
			}
			chrome.tabs.sendMessage(message.tabId as number, message.highlightMessage);
		} else if (message.toggleResearchOn !== undefined) {
			setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues)
				.then(() => updateActionIcon(message.toggleResearchOn));
		} else if (message.disableTabResearch) {
			delete session.researchInstances[senderTabId];
			chrome.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
		} else if (message.performSearch) {
			(chrome.search.query as typeof browser.search.search)({
				query: session.researchInstances[senderTabId].terms.map(term => term.phrase).join(" "),
				tabId: senderTabId,
			});
		} else {
			if (!isTabResearchPage(session.researchInstances, senderTabId)) {
				const researchInstance = await createResearchInstance({ terms: message.terms });
				session.researchInstances[senderTabId] = researchInstance;
			}
			if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
				const sync = await getStorageSync([ StorageSync.BAR_CONTROLS_SHOWN ]);
				const researchInstance = await createResearchInstance({ terms: message.terms });
				if (message.toggleHighlightsOn !== undefined) {
					researchInstance.highlightsShown = message.toggleHighlightsOn;
				}
				session.researchInstances[senderTabId] = researchInstance;
				activateHighlightingInTab(senderTabId, createResearchMessage(researchInstance, false, sync.barControlsShown));
			} else if (message.terms !== undefined) {
				session.researchInstances[senderTabId].terms = message.terms;
				const highlightMessage: HighlightMessage = { terms: message.terms };
				highlightMessage.termUpdate = message.termChanged;
				highlightMessage.termToUpdateIdx = message.termChangedIdx;
				Object.keys(session.researchInstances).forEach(tabId =>
					session.researchInstances[tabId] === session.researchInstances[senderTabId]
						? chrome.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
				);
			}
		}
		setStorageSession(session);
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
})();

chrome.action.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
