const createResearchInstance = (args: {
	terms?: MatchTerms
	termsRaw?: Array<string>
	stoplist?: Stoplist
	url?: string
	engine?: Engine
}): ResearchInstance => {
	if (args.terms)
		return { terms: args.terms };
	if (!args.termsRaw) {
		if (args.engine) {
			args.termsRaw = args.engine.extract(args.url);
		} else {
			const phraseGroups = getSearchQuery(args.url).split("\"");
			args.termsRaw = phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		}
	}
	return { terms: Array.from(new Set(args.termsRaw))
		.filter(phrase => !args.stoplist.includes(phrase))
		.map(phrase => new MatchTerm(phrase))
	};
};

const getSearchQuery = (url: string) =>
	new URL(url).searchParams.get(["q", "query"].find(param => new URL(url).searchParams.has(param)))
;

const getMenuSwitchId = (activate: boolean) =>
	(activate ? "" : "de") + "activate-research-mode"
;

const isTabSearchPage = (engines: Engines, url: string): [boolean, Engine] => {
	if (getSearchQuery(url)) {
		return [true, undefined];
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return [!!engine, engine];
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

const activateHighlighting = (tabId: number, message?: HighlightMessage) =>
	browser.commands.getAll().then(commands => browser.tabs.sendMessage(tabId,
		Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)
	).catch(() =>
		browser.tabs.executeScript(tabId, { file: "/dist/stem-pattern-find.js" }).then(() =>
			browser.tabs.executeScript(tabId, { file: "/dist/shared-content.js"}).then(() =>
				browser.tabs.executeScript(tabId, { file: "/dist/term-highlight.js" }).then(() =>
					browser.tabs.sendMessage(tabId,
						Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message))))
		).catch(() => { /* Many injection errors can occur, often when a privileged page is loaded. Usually safe to ignore. */ })
	))
;

const handleEnginesCache = (() => {
	const addEngine = (engines: Engines, id: string, urlPatternString: string) => {
		if (!urlPatternString) return;
		if (!urlPatternString.includes("%s")) {
			delete(engines[id]);
			return;
		}
		const engine = new Engine({ urlPatternString });
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
		engines[id] = engine;
		setStorageLocal({ engines });
	};

	const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) =>
		node["type"] === "bookmark"
			? setEngine(node)
			: node["type"] === "folder"
				? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
	;

	return () => {
		if (!browser.bookmarks)
			return;
		browser.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocal.ENGINES).then(local => {
			nodes.forEach(node => setEngines(local.engines, node =>
				addEngine(local.engines, node.id, node.url), node));
			setStorageLocal({ engines: local.engines });
		}));
		browser.bookmarks.onRemoved.addListener((id, removeInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
			setEngines(local.engines, node =>
				delete(local.engines[node.id]), removeInfo.node);
			setStorageLocal({ engines: local.engines });
		}));
		browser.bookmarks.onCreated.addListener((id, createInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
			addEngine(local.engines, id, createInfo.url);
			setStorageLocal({ engines: local.engines });
		}));
		browser.bookmarks.onChanged.addListener((id, changeInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
			addEngine(local.engines, id, changeInfo.url);
			setStorageLocal({ engines: local.engines });
		}));
	};
})();

const createContextMenuItem = () => {
	browser.contextMenus.removeAll();
	browser.contextMenus.create({
		title: "Researc&h Selection",
		id: getMenuSwitchId(true),
		contexts: ["selection"],
	});
	browser.contextMenus.onClicked.addListener((info, tab) =>
		activateHighlighting(tab.id, { termsFromSelection: true } as HighlightMessage)
	);
};

(() => {
	const setUp = () => {
		setStorageSync({
			isSetUp: true,
			stoplist: ["i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how"],
		});
		if (browser.commands["update"]) {
			browser.commands["update"]({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			for (let i = 0; i < 10; i++) {
				browser.commands["update"]({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				browser.commands["update"]({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		} else {
			// TODO: instruct user how to assign the appropriate shortcuts
		}
	};

	const initialize = () => {
		handleEnginesCache();
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
		getStorageLocal([StorageLocal.ENABLED, StorageLocal.RESEARCH_INSTANCES, StorageLocal.ENGINES]).then(local => {
			const [isSearchPage, engine] = local.enabled ? isTabSearchPage(local.engines, url) : [false, undefined];
			const isResearchPage = isTabResearchPage(local.researchInstances, tabId);
			if (isSearchPage) {
				const researchInstance = createResearchInstance({ stoplist: sync.stoplist, url, engine });
				// TODO: make function for checking terms' (phrase) equality
				if (!isResearchPage || local.researchInstances[tabId].terms.length !== researchInstance.terms.length
					|| local.researchInstances[tabId].terms.some((term, i) => term.phrase !== researchInstance.terms[i].phrase)) {
					local.researchInstances[tabId] = researchInstance;
					setStorageLocal({ researchInstances: local.researchInstances });
					activateHighlighting(tabId, createResearchMessage(local.researchInstances[tabId]));
				}
			}
			if (isResearchPage) {
				activateHighlighting(tabId, createResearchMessage(local.researchInstances[tabId]));
			}
		})
	);

	browser.tabs.onUpdated.addListener((tabId, changeInfo) => changeInfo.url
		? pageModifyRemote(changeInfo.url, tabId) : undefined
	);

	browser.webNavigation.onCommitted.addListener(details => details.frameId === 0
		? pageModifyRemote(details.url, details.tabId) : undefined
	);
})();

browser.tabs.onCreated.addListener(tab => getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
	if (isTabResearchPage(local.researchInstances, tab.openerTabId)) {
		local.researchInstances[tab.id] = local.researchInstances[tab.openerTabId];
		setStorageLocal({ researchInstances: local.researchInstances });
	}
}));

browser.commands.onCommand.addListener(command =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		browser.tabs.sendMessage(tabs[0].id, { command } as HighlightMessage)
	)
);

(() => {
	const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
			if (message.toggleResearchOn !== undefined) {
				setStorageLocal({ enabled: message.toggleResearchOn });
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
			setStorageLocal({ researchInstances: local.researchInstances });
		})
	;

	browser.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
		if (sender.tab) {
			handleMessage(message, sender.tab.id);
		} else {
			browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => handleMessage(message, tabs[0].id));
		}
		sendResponse(); // Manifest V3 bug.
	});
})();

browser.browserAction.onClicked.addListener(() =>
	browser.permissions.request({ permissions: ["bookmarks"] })
);

browser.permissions.onAdded.addListener(permissions =>
	permissions.permissions.includes("bookmarks")
		? handleEnginesCache() : undefined
);
