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
	new URL(url).searchParams.get([ "q", "query" ].find(param => new URL(url).searchParams.has(param)) ?? "") ?? ""
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

const activateHighlightingInTab = (tabId: number, message?: HighlightMessage) =>
	browser.commands.getAll().then(commands => browser.tabs.sendMessage(tabId,
		Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)
	).catch(() =>
		browser.tabs.executeScript(tabId, { file: "/dist/stem-pattern-find.js" }).then(() =>
			browser.tabs.executeScript(tabId, { file: "/dist/shared-content.js" }).then(() =>
				browser.tabs.executeScript(tabId, { file: "/dist/term-highlight.js" }).then(() =>
					browser.tabs.sendMessage(tabId,
						Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message))))
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		).catch(reason =>
			/*console.error(`Injection into tab ${tabId} failed: ${reason}`)*/  false
		)
	))
;

const manageEnginesCacheOnBookmarkUpdate = (() => {
	const updateEngine = (engines: Engines, id: string, urlPatternString: string) => {
		if (!urlPatternString) return;
		if (!urlPatternString.includes("%s")) {
			delete(engines[id]);
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
		if (!browser.bookmarks)
			return;
		browser.bookmarks.getTree().then(nodes => getStorageSession(StorageSession.ENGINES).then(session => {
			nodes.forEach(node => setEngines(
				session.engines, node => node.url ? updateEngine(session.engines, node.id, node.url) : undefined, node
			));
			setStorageSession({ engines: session.engines } as StorageSessionValues);
		}));

		browser.bookmarks.onRemoved.addListener((id, removeInfo) =>
			getStorageSession(StorageSession.ENGINES).then(session => {
				setEngines(
					session.engines, node => delete(session.engines[node.id]), removeInfo.node
				);
				setStorageSession({ engines: session.engines } as StorageSessionValues);
			})
		);

		browser.bookmarks.onCreated.addListener((id, createInfo) => createInfo.url ?
			getStorageSession(StorageSession.ENGINES).then(session => {
				updateEngine(session.engines, id, createInfo.url ?? "");
				setStorageSession({ engines: session.engines } as StorageSessionValues);
			}) : undefined
		);

		browser.bookmarks.onChanged.addListener((id, changeInfo) => changeInfo.url ?
			getStorageSession(StorageSession.ENGINES).then(session => {
				updateEngine(session.engines, id, changeInfo.url ?? "");
				setStorageSession({ engines: session.engines } as StorageSessionValues);
			}) : undefined
		);
	};
})();

const updateActionIcon = (enabled?: boolean) =>
	enabled === undefined
		? getStorageLocal(StorageLocal.ENABLED).then(local => updateActionIcon(local.enabled))
		: browser.browserAction.setIcon({ path: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg" })
;

(() => {
	const createContextMenuItems = () => {
		const getMenuSwitchId = () =>
			"activate-research-mode"
		;
	
		browser.contextMenus.onClicked.addListener((info, tab) => !tab || tab.id === undefined ? undefined :
			activateHighlightingInTab(tab.id, { termsFromSelection: true } as HighlightMessage)
		);
	
		return (() => {
			browser.contextMenus.removeAll();
			browser.contextMenus.create({
				title: "Researc&h Selection",
				id: getMenuSwitchId(),
				contexts: [ "selection", "page" ],
			});
		})();
	};

	const setUp = () => {
		if (browser.commands.update) {
			browser.commands.update({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			for (let i = 0; i < 10; i++) {
				browser.commands.update({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				browser.commands.update({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		} else {
			// TODO: instruct user how to assign the appropriate shortcuts
		}
	};

	const initialize = () => {
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		initStorage();
		updateActionIcon();
	};

	browser.runtime.onInstalled.addListener(() => {
		getStorageSync(StorageSync.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
		repairOptions();
		initialize();
	});

	browser.runtime.onStartup.addListener(initialize);
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
			await createResearchInstance({ url: { stoplist: sync.stoplist, url, engine } }).then(researchInstance => {
				if (!isResearchPage || !itemsMatchLoosely(session.researchInstances[tabId].phrases, researchInstance.phrases)) {
					session.researchInstances[tabId] = researchInstance;
					setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
					activateHighlightingInTab(tabId,
						createResearchMessage(session.researchInstances[tabId], overrideHighlightsShown,
							sync.barControlsShown, sync.barLook));
				}
			});
		}
		if (isResearchPage) {
			activateHighlightingInTab(tabId,
				createResearchMessage(session.researchInstances[tabId], overrideHighlightsShown,
					sync.barControlsShown, sync.barLook));
		}
	};
	
	browser.tabs.onCreated.addListener(tab => getStorageSync(StorageSync.LINK_RESEARCH_TABS).then(sync =>
		getStorageSession(StorageSession.RESEARCH_INSTANCES).then(session => {
			if (tab && tab.id !== undefined && tab.openerTabId !== undefined
				&& isTabResearchPage(session.researchInstances, tab.openerTabId)) {
				session.researchInstances[tab.id] = sync.linkResearchTabs
					? session.researchInstances[tab.openerTabId]
					: { ...session.researchInstances[tab.openerTabId] };
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
			}
		})
	));

	browser.tabs.onUpdated.addListener((tabId, changeInfo) => !changeInfo.url ? undefined :
		pageModifyRemote(changeInfo.url, tabId)
	);
})();

const toggleHighlightsInTab = async (tabId: number, toggleHighlightsOn?: boolean) => {
	const sync = await getStorageSync(StorageSync.BAR_CONTROLS_SHOWN);
	const session = await getStorageSession(StorageSession.RESEARCH_INSTANCES);
	if (isTabResearchPage(session.researchInstances, tabId)) {
		const researchInstance = session.researchInstances[tabId];
		researchInstance.highlightsShown = toggleHighlightsOn ?? !researchInstance.highlightsShown;
		browser.tabs.sendMessage(tabId, {
			toggleHighlightsOn: researchInstance.highlightsShown,
			barControlsShown: sync.barControlsShown,
		} as HighlightMessage);
		setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
	}
};

browser.commands.onCommand.addListener(commandString =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([ tab ]) => {
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
					// TODO: make this a function
					delete(session.researchInstances[tab.id as number]);
					browser.tabs.sendMessage(tab.id as number, { disable: true } as HighlightMessage);
				} else {
					await createResearchInstance({ terms: [] }).then(researchInstance => {
						researchInstance.highlightsShown = true;
						session.researchInstances[tab.id as number] = researchInstance;
						activateHighlightingInTab(tab.id as number,
							createResearchMessage(researchInstance, false, sync.barControlsShown, sync.barLook));
					});
				}
				setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
			}
			return;
		} case CommandType.TOGGLE_HIGHLIGHTS: {
			if (tab.id !== undefined) {
				toggleHighlightsInTab(tab.id);
			}
			return;
		}}
		browser.tabs.sendMessage(tab.id as number, { command: commandInfo } as HighlightMessage);
	})
);

(() => {
	const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
		getStorageSession(StorageSession.RESEARCH_INSTANCES).then(async session => {
			if (message.toggleResearchOn !== undefined) {
				setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues)
					.then(() => updateActionIcon(message.toggleResearchOn));
			} else if (message.disableTabResearch) {
				delete(session.researchInstances[senderTabId]);
				browser.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
			} else if (message.performSearch) {
				browser.search.search({
					query: session.researchInstances[senderTabId].terms.map(term => term.phrase).join(" "),
					tabId: senderTabId
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
							? browser.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
					);
				}
			}
			setStorageSession({ researchInstances: session.researchInstances } as StorageSessionValues);
		})
	;

	browser.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
		if (sender.tab && sender.tab.id !== undefined) {
			handleMessage(message, sender.tab.id);
		} else {
			browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
				handleMessage(message, tab.id as number)
			);
		}
		sendResponse(); // Manifest V3 bug.
	});
})();

browser.browserAction.onClicked.addListener(() =>
	browser.permissions.request({ permissions: [ "bookmarks" ] })
);

browser.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
