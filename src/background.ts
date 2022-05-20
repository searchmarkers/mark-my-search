interface ResearchArgs {
	terms?: MatchTerms
	termsRaw?: Array<string>
	stoplist?: Stoplist
	url?: string
	engine?: Engine
}

if (browser) {
	self["chrome" + ""] = browser;
}

const getResearchInstance = (args: ResearchArgs): ResearchInstance => {
	if (args.terms) {
		return { terms: args.terms };
	}
	const searchQuery = new URL(args.url).searchParams.get(SEARCH_PARAM);
	if (!args.termsRaw) {
		if (args.engine) {
			args.termsRaw = args.engine.extract(args.url);
		} else {
			const phraseGroups = searchQuery.split("\"");
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

class Engine {
	hostname: string
	pathname: [string, string]
	param: string

	constructor (pattern: string) {
		// TODO: error checking?
		const urlPattern = new URL(pattern);
		this.hostname = urlPattern.hostname;
		if (urlPattern.pathname.includes(ENGINE_RFIELD)) {
			const parts = urlPattern.pathname.split(ENGINE_RFIELD);
			this.pathname = [parts[0], parts[1].slice(0, parts[1].endsWith("/") ? parts[1].length : undefined)];
		} else {
			this.param = Array.from(urlPattern.searchParams).find(param => param[1].includes(ENGINE_RFIELD))[0];
		}
	}

	extract (urlString: string, matchOnly = false) {
		const url = new URL(urlString);
		return url.hostname !== this.hostname ? null : this.pathname
			? url.pathname.startsWith(this.pathname[0]) && url.pathname.slice(this.pathname[0].length).includes(this.pathname[1])
				? matchOnly ? [] : url.pathname.slice(
					url.pathname.indexOf(this.pathname[0]) + this.pathname[0].length,
					url.pathname.lastIndexOf(this.pathname[1])).split("+")
				: null
			: url.searchParams.has(this.param)
				? matchOnly ? [] : url.searchParams.get(this.param).split(" ")
				: null;
	}

	match (urlString: string) {
		return !!this.extract(urlString, true);
	}

	equals (engine: Engine) {
		return engine.hostname === this.hostname
			&& engine.param === this.param
			&& engine.pathname === this.pathname;
	}
}

const ENGINE_RFIELD = "%s";
const SEARCH_PARAM = "q";

const getMenuSwitchId = (activate: boolean) =>
	(activate ? "" : "de") + "activate-research-mode"
;

const isTabSearchPage = (engines: Engines, url: string): [boolean, Engine] => {
	if (new URL(url).searchParams.has(SEARCH_PARAM)) {
		return [true, undefined];
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return [!!engine, engine];
	}
};

const isTabResearchPage = (researchInstances: ResearchInstances, tabId: number) =>
	tabId in researchInstances
;

const storeNewResearchDetails = (researchInstances: ResearchInstances, researchInstance: ResearchInstance, tabId: number) => {
	researchInstances[tabId] = researchInstance;
	return { terms: researchInstances[tabId].terms } as HighlightMessage;
};

const getCachedResearchDetails = (researchInstances: ResearchInstances, tabId: number) =>
	({ terms: researchInstances[tabId].terms } as HighlightMessage)
;

const updateCachedResearchDetails = (researchInstances: ResearchInstances, terms: MatchTerms, tabId: number) => {
	researchInstances[tabId].terms = terms;
	return { terms } as HighlightMessage;
};

const injectScripts = (tabId: number, script: string, message?: HighlightMessage) =>
	browser.tabs.executeScript(tabId, { file: "/dist/stem-pattern-find.js" }).then(() =>
		browser.tabs.executeScript(tabId, { file: "/dist/shared-content.js" }).then(() =>
			browser.tabs.executeScript(tabId, { file: script }).then(() =>
				chrome.commands.getAll().then(commands =>
					chrome.tabs.sendMessage(tabId,
						Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message))))))
;

chrome.webNavigation.onCommitted.addListener(details => getStorageSync(StorageSyncKey.STOPLIST).then(sync =>
	getStorageLocal([StorageLocalKey.ENABLED, StorageLocalKey.RESEARCH_INSTANCES, StorageLocalKey.ENGINES]).then(local => {
		if (details.frameId !== 0)
			return;
		const [isSearchPage, engine] = isTabSearchPage(local.engines, details.url);
		if ((isSearchPage && local.enabled) || isTabResearchPage(local.researchInstances, details.tabId)) {
			chrome.tabs.get(details.tabId).then(tab => {
				if (tab.url || tab.pendingUrl) {
					injectScripts(tab.id, "/dist/term-highlight.js", isSearchPage
						? storeNewResearchDetails(local.researchInstances, getResearchInstance({ stoplist: sync.stoplist, url: tab.url, engine }), tab.id)
						: getCachedResearchDetails(local.researchInstances, tab.id));
				} else {
					delete(local.researchInstances[tab.id]); // Mitigates Chrome assigning openerTabId for new tabs (so extra research ids).
				}
			}).then(() => setStorageLocal({ researchInstances: local.researchInstances }));
		}
	}))
);

chrome.tabs.onCreated.addListener(tab => getStorageLocal(StorageLocalKey.RESEARCH_INSTANCES).then(local => {
	if ((tab.openerTabId in local.researchInstances)) {
		local.researchInstances[tab.id] = local.researchInstances[tab.openerTabId];
		setStorageLocal({ researchInstances: local.researchInstances });
	}
}));

const createContextMenuItem = () => {
	chrome.contextMenus.removeAll();
	chrome.contextMenus.create({
		title: "Researc&h Selection",
		id: getMenuSwitchId(true),
		contexts: ["selection"],
	});
	chrome.contextMenus.onClicked.addListener((info, tab) =>
		getStorageLocal(StorageLocalKey.RESEARCH_INSTANCES).then(local => tab.id in local.researchInstances
			? chrome.tabs.sendMessage(tab.id, { termsFromSelection: true } as HighlightMessage)
			: injectScripts(tab.id, "/dist/term-highlight.js", { termsFromSelection: true } as HighlightMessage)
		)
	);
};

const handleEnginesCache = (() => {
	const addEngine = (engines: Engines, id: string, pattern: string) => {
		if (!pattern) return;
		if (!pattern.includes(ENGINE_RFIELD)) {
			delete(engines[id]);
			return;
		}
		const engine = new Engine(pattern);
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
		engines[id] = engine;
		setStorageLocal({ engines });
	};

	const setEngines = (engines: Engines, setEngine: (node: chrome.bookmarks.BookmarkTreeNode) => void,
		node: chrome.bookmarks.BookmarkTreeNode) =>
		node["type"] === "bookmark"
			? setEngine(node)
			: node["type"] === "folder"
				? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
	;

	return () => {
		if (!browser)
			return;
		if (!chrome.bookmarks) {
			// TODO: request permission
			return;
		}
		chrome.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			nodes.forEach(node => setEngines(local.engines, node =>
				addEngine(local.engines, node.id, node.url), node));
			setStorageLocal({ engines: local.engines });
		}));
		chrome.bookmarks.onRemoved.addListener((id, removeInfo) => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			setEngines(local.engines, node =>
				delete(local.engines[node.id]), removeInfo.node);
			setStorageLocal({ engines: local.engines });
		}));
		chrome.bookmarks.onCreated.addListener((id, createInfo) => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			addEngine(local.engines, id, createInfo.url);
			setStorageLocal({ engines: local.engines });
		}));
		chrome.bookmarks.onChanged.addListener((id, changeInfo) => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			addEngine(local.engines, id, changeInfo.url);
			setStorageLocal({ engines: local.engines });
		}));
	};
})();

chrome.commands.onCommand.addListener(command =>
	chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		chrome.tabs.sendMessage(tabs[0].id, { command } as HighlightMessage)
	)
);

const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
	getStorageLocal(StorageLocalKey.RESEARCH_INSTANCES).then(local => {
		if (message.toggleResearchOn !== undefined) {
			setStorageLocal({ enabled: message.toggleResearchOn });
		} else if (message.disablePageResearch) {
			delete(local.researchInstances[senderTabId]);
			chrome.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
		} else {
			if (!(senderTabId in local.researchInstances)) {
				local.researchInstances[senderTabId] = getResearchInstance({ terms: message.terms });
			}
			if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
				chrome.tabs.sendMessage(senderTabId, storeNewResearchDetails(
					local.researchInstances, getResearchInstance({ terms: message.terms }), senderTabId));
			} else if (message.terms) {
				const highlightMessage = updateCachedResearchDetails(local.researchInstances, message.terms, senderTabId);
				highlightMessage.termUpdate = message.termChanged;
				highlightMessage.termToUpdateIdx = message.termChangedIdx;
				Object.keys(local.researchInstances).forEach(tabId =>
					local.researchInstances[tabId] === local.researchInstances[senderTabId] && Number(tabId) !== senderTabId
						? chrome.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
				);
			}
		}
		setStorageLocal({ researchInstances: local.researchInstances });
	})
;

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
	if (sender.tab) {
		handleMessage(message, sender.tab.id);
	} else {
		chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => handleMessage(message, tabs[0].id));
	}
	sendResponse(); // Manifest V3 bug.
});

(() => {
	const setUp = () => {
		setStorageSync({
			isSetUp: true,
			stoplist: ["i", "a", "an", "and", "or", "not", "the", "there", "where", "to", "do", "of", "in", "on", "at",
				"is", "isn't", "are", "aren't", "can", "can't", "how"],
		});
		if (chrome.commands["update"]) {
			chrome.commands["update"]({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			for (let i = 0; i < 10; i++) {
				chrome.commands["update"]({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				chrome.commands["update"]({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		} else {
			// TODO: instruct user how to assign the appropriate shortcuts
		}
	};

	return (() => {
		handleEnginesCache();
		createContextMenuItem();
		getStorageLocal(StorageLocalKey.ENABLED).then(local =>
			setStorageLocal({ enabled: local.enabled === undefined ? true : local.enabled, researchInstances: {}, engines: {} }));
		getStorageSync(StorageSyncKey.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
	});
})()();
