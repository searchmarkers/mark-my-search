const createResearchInstance = (args: {
	url?: { stoplist: Stoplist, url: string, engine?: Engine }
	terms?: MatchTerms
}): ResearchInstance => {
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
		};
	}
	args.terms = args.terms ?? [];
	return { phrases: args.terms.map(term => term.phrase), terms: args.terms };
};

const getSearchQuery = (url: string) =>
	new URL(url).searchParams.get([ "q", "query" ].find(param => new URL(url).searchParams.has(param)) ?? "") ?? ""
;

const getMenuSwitchId = (activate: boolean) =>
	(activate ? "" : "de") + "activate-research-mode"
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

const createResearchMessage = (researchInstance: ResearchInstance) =>
	({ terms: researchInstance.terms } as HighlightMessage)
;

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
			/*console.log(`Injection into tab ${tabId} failed: ${reason}`)*/  false
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
		setStorageLocal({ engines } as StorageLocalValues);
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
		browser.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocal.ENGINES).then(local => {
			nodes.forEach(node => setEngines(
				local.engines, node => node.url ? updateEngine(local.engines, node.id, node.url) : undefined, node
			));
			setStorageLocal({ engines: local.engines } as StorageLocalValues);
		}));

		browser.bookmarks.onRemoved.addListener((id, removeInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
			setEngines(
				local.engines, node => delete(local.engines[node.id]), removeInfo.node
			);
			setStorageLocal({ engines: local.engines } as StorageLocalValues);
		}));

		browser.bookmarks.onCreated.addListener((id, createInfo) => createInfo.url ?
			getStorageLocal(StorageLocal.ENGINES).then(local => {
				updateEngine(local.engines, id, createInfo.url ?? "");
				setStorageLocal({ engines: local.engines } as StorageLocalValues);
			}) : undefined
		);

		browser.bookmarks.onChanged.addListener((id, changeInfo) => changeInfo.url ?
			getStorageLocal(StorageLocal.ENGINES).then(local => {
				updateEngine(local.engines, id, changeInfo.url ?? "");
				setStorageLocal({ engines: local.engines } as StorageLocalValues);
			}) : undefined
		);
	};
})();

const createContextMenuItem = () => {
	browser.contextMenus.removeAll();
	browser.contextMenus.create({
		title: "Researc&h Selection",
		id: getMenuSwitchId(true),
		contexts: [ "selection" ],
	});
	browser.contextMenus.onClicked.addListener((info, tab) => !tab || tab.id === undefined ? undefined :
		activateHighlightingInTab(tab.id, { termsFromSelection: true } as HighlightMessage)
	);
};

(() => {
	const setUp = () => {
		setStorageSync({
			isSetUp: true,
			stoplist: [
				"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
				"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's"
			],
			linkResearchTabs: false,
		});
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
		createContextMenuItem();
		initStorageLocal();
	};

	browser.runtime.onInstalled.addListener(() => {
		getStorageSync(StorageSync.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
		initialize();
	});

	browser.runtime.onStartup.addListener(initialize);
})();

(() => {
	const pageModifyRemote = (url: string, tabId: number) => getStorageSync(StorageSync.STOPLIST).then(sync =>
		getStorageLocal([ StorageLocal.ENABLED, StorageLocal.RESEARCH_INSTANCES, StorageLocal.ENGINES ]).then(local => {
			const [ isSearchPage, engine ] = local.enabled ? isTabSearchPage(local.engines, url) : [ false, undefined ];
			const isResearchPage = isTabResearchPage(local.researchInstances, tabId);
			if (isSearchPage) {
				const researchInstance = createResearchInstance({ url: { stoplist: sync.stoplist, url, engine } });
				if (!isResearchPage || local.researchInstances[tabId].phrases.length !== researchInstance.phrases.length
					|| local.researchInstances[tabId].phrases.some((phrase, i) => phrase !== researchInstance.phrases[i])) {
					local.researchInstances[tabId] = researchInstance;
					setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
					activateHighlightingInTab(tabId, createResearchMessage(local.researchInstances[tabId]));
				}
			}
			if (isResearchPage) {
				activateHighlightingInTab(tabId, createResearchMessage(local.researchInstances[tabId]));
			}
		})
	);
	
	browser.tabs.onCreated.addListener(tab => getStorageSync(StorageSync.LINK_RESEARCH_TABS).then(sync =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
			if (tab && tab.id !== undefined && tab.openerTabId !== undefined
				&& isTabResearchPage(local.researchInstances, tab.openerTabId)) {
				local.researchInstances[tab.id] = sync.linkResearchTabs
					? local.researchInstances[tab.openerTabId]
					: { ...local.researchInstances[tab.openerTabId] };
				setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
			}
		})
	));

	browser.tabs.onUpdated.addListener((tabId, changeInfo) => !changeInfo.url ? undefined :
		pageModifyRemote(changeInfo.url, tabId)
	);
})();

browser.commands.onCommand.addListener(command =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) => tab.id === undefined ? undefined :
		browser.tabs.sendMessage(tab.id, { command } as HighlightMessage)
	)
);

(() => {
	const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
			if (message.toggleResearchOn !== undefined) {
				setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues);
			} else if (message.disablePageResearch) {
				delete(local.researchInstances[senderTabId]);
				browser.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
			} else {
				if (!isTabResearchPage(local.researchInstances, senderTabId)) {
					local.researchInstances[senderTabId] = createResearchInstance({ terms: message.terms });
				}
				if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
					local.researchInstances[senderTabId] = createResearchInstance({ terms: message.terms });
					browser.tabs.sendMessage(senderTabId, createResearchMessage(local.researchInstances[senderTabId]));
				} else if (message.terms) {
					const highlightMessage = updateCachedResearchDetails(local.researchInstances, message.terms, senderTabId);
					highlightMessage.termUpdate = message.termChanged;
					highlightMessage.termToUpdateIdx = message.termChangedIdx;
					Object.keys(local.researchInstances).forEach(tabId =>
						local.researchInstances[tabId] === local.researchInstances[senderTabId] && Number(tabId) !== senderTabId
							? browser.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
					);
				}
			}
			setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
		})
	;

	browser.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
		if (sender.tab && sender.tab.id !== undefined) {
			handleMessage(message, sender.tab.id);
		} else {
			browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) => tab.id === undefined ? undefined :
				handleMessage(message, tab.id)
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
