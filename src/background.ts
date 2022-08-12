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

const createResearchInstance = (args: {
	url?: { stoplist: Stoplist, url: string, engine?: Engine }
	terms?: MatchTerms
}): Promise<ResearchInstance> => getStorageSync(StorageSync.SHOW_HIGHLIGHTS).then(sync => {
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
});

const getSearchQuery = (url: string) =>
	new URL(url).searchParams
		.get([ "q", "query" ].find(param => new URL(url).searchParams.has(param)) ?? "") ?? ""
;

const isTabSearchPage = (engines: Engines, url: string): [ boolean, Engine? ] => {
	if (getSearchQuery(url)) {
		return [ true, undefined ];
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return [ !!engine, engine ];
	}
};

const isTabResearchPage = (researchInstances: ResearchInstances, tabId: number) =>
	tabId in researchInstances
;

const createResearchMessage = (researchInstance: ResearchInstance, overrideHighlightsShown?: boolean,
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN],
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]) => ({
	terms: researchInstance.terms,
	toggleHighlightsOn: overrideHighlightsShown === undefined ? undefined :
		researchInstance.highlightsShown || overrideHighlightsShown,
	barControlsShown,
	barLook,
} as HighlightMessage);

const updateCachedResearchDetails = (researchInstances: ResearchInstances, terms: MatchTerms, tabId: number) => {
	researchInstances[tabId].terms = terms;
	return { terms } as HighlightMessage;
};

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
		args: [ targetTabId, Object.assign({ extensionCommands: await chrome.commands.getAll() } as HighlightMessage, highlightMessageToReceive) ],
		target: { tabId: targetTabId },
	})
;

const manageEnginesCacheOnBookmarkUpdate = (() => {
	const updateEngine = (engines: Engines, id: string, urlPatternString: string) => {
		if (!urlPatternString) return;
		if (!urlPatternString.includes("%s")) {
			delete engines[id];
			return;
		}
		const engine = new Engine({ urlPatternString });
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
		engines[id] = engine;
		setStorageSession({ engines } as StorageSessionValues);
	};

	const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) =>
		node.type === "bookmark"
			? setEngine(node)
			: node.type === "folder"
				? (node.children ?? []).forEach(child => setEngines(engines, setEngine, child)): undefined
	;

	return () => {
		if (isBrowserChromium() || !chrome.bookmarks) {
			return;
		}
		browser.bookmarks.getTree().then(nodes => getStorageSession(StorageSession.ENGINES).then(session => {
			nodes.forEach(node => setEngines(
				session.engines, node => node.url ? updateEngine(session.engines, node.id, node.url) : undefined, node
			));
			setStorageSession(session);
		}));

		browser.bookmarks.onRemoved.addListener((id, removeInfo) =>
			getStorageSession(StorageSession.ENGINES).then(session => {
				setEngines(
					session.engines, node => delete session.engines[node.id], removeInfo.node
				);
				setStorageSession(session);
			})
		);

		browser.bookmarks.onCreated.addListener((id, createInfo) => createInfo.url ?
			getStorageSession(StorageSession.ENGINES).then(session => {
				updateEngine(session.engines, id, createInfo.url ?? "");
				setStorageSession(session);
			}) : undefined
		);

		browser.bookmarks.onChanged.addListener((id, changeInfo) => changeInfo.url ?
			getStorageSession(StorageSession.ENGINES).then(session => {
				updateEngine(session.engines, id, changeInfo.url ?? "");
				setStorageSession(session);
			}) : undefined
		);
	};
})();

const updateActionIcon = (enabled?: boolean) =>
	enabled === undefined
		? getStorageLocal(StorageLocal.ENABLED).then(local => updateActionIcon(local.enabled))
		: chrome.action.setIcon({ path: isBrowserChromium()
			? enabled ? "/icons/mms-32.png" : "/icons/mms-off-32.png" // Chromium still has patchy SVG support
			: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg"
		})
;

(() => {
	const createContextMenuItems = () => {
		const getMenuSwitchId = () =>
			"activate-research-mode"
		;
	
		chrome.contextMenus.onClicked.addListener((info, tab) => !tab || tab.id === undefined ? undefined :
			activateHighlightingInTab(tab.id, { termsFromSelection: true } as HighlightMessage)
		);
	
		return (() => {
			chrome.contextMenus.removeAll();
			chrome.contextMenus.create({
				title: "&Highlight Selection",
				id: getMenuSwitchId(),
				contexts: [ "selection", "page" ],
			});
		})();
	};

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

	const initialize = () => {
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		initStorage();
		updateActionIcon();
	};

	chrome.runtime.onInstalled.addListener(() => {
		getStorageSync(StorageSync.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
		repairOptions();
		initialize();
	});

	chrome.runtime.onStartup.addListener(initialize);
})();

(() => {
	const pageModifyRemote = async (url: string, tabId: number) => {
		const sync = await getStorageSync([
			StorageSync.STOPLIST,
			StorageSync.SHOW_HIGHLIGHTS,
			StorageSync.BAR_CONTROLS_SHOWN,
			StorageSync.BAR_LOOK,
		]);
		const local = await getStorageLocal(StorageLocal.ENABLED);
		const session = await getStorageSession([
			StorageSession.RESEARCH_INSTANCES,
			StorageSession.ENGINES,
		]);
		const [ isSearchPage, engine ] = local.enabled ? isTabSearchPage(session.engines, url) : [ false, undefined ];
		const isResearchPage = isTabResearchPage(session.researchInstances, tabId);
		const overrideHighlightsShown = (isSearchPage && sync.showHighlights.overrideSearchPages)
			|| (isResearchPage && sync.showHighlights.overrideResearchPages);
		if (isSearchPage) {
			const researchInstance = await createResearchInstance({ url: { stoplist: sync.stoplist, url, engine } });
			if (!isResearchPage || !itemsMatchLoosely(session.researchInstances[tabId].phrases, researchInstance.phrases)) {
				session.researchInstances[tabId] = researchInstance;
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
				activateHighlightingInTab(tabId,
					createResearchMessage(session.researchInstances[tabId], overrideHighlightsShown,
						sync.barControlsShown, sync.barLook));
			}
		}
		if (isResearchPage) {
			activateHighlightingInTab(tabId,
				createResearchMessage(session.researchInstances[tabId], overrideHighlightsShown,
					sync.barControlsShown, sync.barLook));
		}
	};
	
	chrome.tabs.onCreated.addListener(tab => getStorageSync(StorageSync.LINK_RESEARCH_TABS).then(async sync => {
		const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
		if (tab && tab.id !== undefined && tab.openerTabId !== undefined
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

const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	const sync = await getStorageSync(StorageSync.BAR_CONTROLS_SHOWN);
	const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
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

const disableResearchInTab = async (tabId: number) => {
	const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
	delete session.researchInstances[tabId];
	chrome.tabs.sendMessage(tabId, { disable: true } as HighlightMessage);
	setStorageSession(session);
};

chrome.commands.onCommand.addListener(commandString =>
	chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([ tab ]) => {
		const commandInfo = parseCommand(commandString);
		switch (commandInfo.type) {
		case CommandType.TOGGLE_ENABLED: {
			getStorageLocal(StorageLocal.ENABLED).then(local => {
				setStorageLocal({ enabled: !local.enabled } as StorageLocalValues);
				updateActionIcon(!local.enabled);
			});
			return;
		} case CommandType.TOGGLE_IN_TAB: {
			if (tab.id !== undefined) {
				const sync = await getStorageSync(StorageSync.BAR_CONTROLS_SHOWN);
				const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
				if (isTabResearchPage(session.researchInstances, tab.id as number)) {
					disableResearchInTab(tab.id as number);
				} else {
					await createResearchInstance({ terms: [] }).then(async researchInstance => {
						researchInstance.highlightsShown = true;
						session.researchInstances[tab.id as number] = researchInstance;
						setStorageSession(session);
						await activateHighlightingInTab(
							tab.id as number,
							Object.assign(
								{ termsFromSelection: true } as HighlightMessage,
								createResearchMessage(researchInstance, false, sync.barControlsShown, sync.barLook),
							),
						);
					});
				}
			}
			return;
		} case CommandType.TOGGLE_HIGHLIGHTS: {
			if (tab.id !== undefined) {
				toggleHighlightsInTab(tab.id);
			}
			return;
		}}
		chrome.tabs.sendMessage(tab.id as number, { command: commandInfo } as HighlightMessage);
	})
);

(() => {
	const handleMessage = async (message: BackgroundMessage, senderTabId: number) => {
		const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
		if (message.highlightMessage !== undefined) {
			// TODO make this a function
			const tabId = message.tabId as number;
			if (message.executeInTab) {
				await chrome.scripting.executeScript({
					files: [ "/dist/stem-pattern-find.js", "/dist/shared-content.js", "/dist/term-highlight.js" ],
					target: { tabId },
				});
			}
			chrome.tabs.sendMessage(tabId, message.highlightMessage);
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
				await createResearchInstance({ terms: message.terms }).then(researchInstance => {
					session.researchInstances[senderTabId] = researchInstance;
				});
			}
			if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
				await getStorageSync(StorageSync.BAR_CONTROLS_SHOWN).then(sync =>
					createResearchInstance({ terms: message.terms }).then(researchInstance => {
						if (message.toggleHighlightsOn !== undefined) {
							researchInstance.highlightsShown = message.toggleHighlightsOn;
						}
						session.researchInstances[senderTabId] = researchInstance;
						activateHighlightingInTab(senderTabId,
							createResearchMessage(researchInstance, false, sync.barControlsShown));
					})
				);
			} else if (message.terms !== undefined) {
				const highlightMessage = updateCachedResearchDetails(session.researchInstances, message.terms, senderTabId);
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
		sendResponse(); // Manifest V3 bug
	});
})();

chrome.action.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
