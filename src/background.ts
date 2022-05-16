self["importScripts"]("/dist/stem-pattern-find.js", "/dist/shared-content.js");

type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;
type StorageLocal = {
	[StorageLocalKey.ENABLED]?: boolean,
	[StorageLocalKey.RESEARCH_IDS]?: ResearchIDs,
	[StorageLocalKey.ENGINES]?: Engines,
}
type StorageSync = {
	[StorageSyncKey.IS_SET_UP]?: boolean,
	[StorageSyncKey.STOPLIST]?: Stoplist,
}

enum StorageLocalKey {
	ENABLED = "enabled",
	RESEARCH_IDS = "researchIds",
	ENGINES = "engines",
}

enum StorageSyncKey {
	IS_SET_UP = "isSetUp",
	STOPLIST = "stoplist",
}

const setStorageLocal = (items: StorageLocal) =>
	chrome.storage.local.set(items);
const getStorageLocal = (keys: string | Array<string>): Promise<StorageLocal> =>
	chrome.storage.local.get(keys);
const setStorageSync = (items: StorageSync) =>
	chrome.storage.sync.set(items);
const getStorageSync = (keys: string | Array<string>): Promise<StorageSync> =>
	chrome.storage.sync.get(keys)
;

interface ResearchArgs {
	terms?: MatchTerms
	termsRaw?: Array<string>
	stoplist?: Stoplist
	url?: string
	engine?: Engine
}

interface ResearchID {
	terms: MatchTerms
}

const getResearchId = (args: ResearchArgs): ResearchID => {
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

const isTabResearchPage = (researchIds: ResearchIDs, tabId: number) =>
	tabId in researchIds
;

const storeNewResearchDetails = (researchIds: ResearchIDs, researchId: ResearchID, tabId: number) => {
	researchIds[tabId] = researchId;
	return { terms: researchIds[tabId].terms } as HighlightMessage;
};

const getCachedResearchDetails = (researchIds: ResearchIDs, tabId: number) =>
	({ terms: researchIds[tabId].terms } as HighlightMessage)
;

const updateCachedResearchDetails = (researchIds: ResearchIDs, terms: MatchTerms, tabId: number) => {
	researchIds[tabId].terms = terms;
	return { terms } as HighlightMessage;
};

const injectScripts = (tabId: number, script: string, message?: HighlightMessage) =>
	chrome.scripting.executeScript({
		target: { tabId },
		files: ["/dist/stem-pattern-find.js", "/dist/shared-content.js", "/dist/term-highlight.js"]
	}).then(() =>
		chrome.commands.getAll().then(commands =>
			chrome.tabs.sendMessage(tabId,
				Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)))
	)
;

chrome.webNavigation.onCommitted.addListener(details => getStorageSync(StorageSyncKey.STOPLIST).then(sync =>
	getStorageLocal([StorageLocalKey.ENABLED, StorageLocalKey.RESEARCH_IDS, StorageLocalKey.ENGINES]).then(local => {
		if (details.frameId !== 0)
			return;
		const [isSearchPage, engine] = isTabSearchPage(local.engines, details.url);
		if ((isSearchPage && local.enabled) || isTabResearchPage(local.researchIds, details.tabId)) {
			chrome.tabs.get(details.tabId).then(tab => {
				if (tab.url || tab.pendingUrl) {
					injectScripts(tab.id, "/dist/term-highlight.js", isSearchPage
						? storeNewResearchDetails(local.researchIds, getResearchId({ stoplist: sync.stoplist, url: tab.url, engine }), tab.id)
						: getCachedResearchDetails(local.researchIds, tab.id));
				} else {
					delete local.researchIds[tab.id]; // Mitigates Chrome assigning openerTabId for new tabs, resulting in extra research ids.
				}
			}).then(() => setStorageLocal({ researchIds: local.researchIds }));
		}
	}))
);

chrome.tabs.onCreated.addListener(tab => getStorageLocal(StorageLocalKey.RESEARCH_IDS).then(local => {
	if ((tab.openerTabId in local.researchIds)) {
		local.researchIds[tab.id] = local.researchIds[tab.openerTabId];
		setStorageLocal({ researchIds: local.researchIds });
	}
}));

const createContextMenuItem = () => {
	chrome.contextMenus.create({
		title: "Researc&h Selection",
		id: getMenuSwitchId(true),
		contexts: ["selection"],
	});
	chrome.contextMenus.onClicked.addListener((info, tab) =>
		getStorageLocal(StorageLocalKey.RESEARCH_IDS).then(local => tab.id in local.researchIds
			? chrome.tabs.sendMessage(tab.id, { termsFromSelection: true } as HighlightMessage)
			: injectScripts(tab.id, "/dist/term-highlight.js", { termsFromSelection: true } as HighlightMessage)
		)
	);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const handleEnginesCache = (() => {
	const addEngine = (engines: Engines, id: string, pattern: string) => {
		if (!pattern) return;
		if (!pattern.includes(ENGINE_RFIELD)) {
			delete engines[id];
			return;
		}
		const engine = new Engine(pattern);
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
		engines[id] = engine;
	};

	const setEngines = (engines: Engines, setEngine: (node: chrome.bookmarks.BookmarkTreeNode) => void,
		node: chrome.bookmarks.BookmarkTreeNode) =>
		node["type"] === "bookmark"
			? setEngine(node)
			: node["type"] === "folder"
				? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
	;

	return () => {
		chrome.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			nodes.forEach(node => setEngines(local.engines, node =>
				addEngine(local.engines, node.id, node.url), node));
			setStorageLocal({ engines: local.engines });
		}));
		chrome.bookmarks.onRemoved.addListener((id, removeInfo) => getStorageLocal(StorageLocalKey.ENGINES).then(local => {
			setEngines(local.engines, node =>
				delete local.engines[node.id], removeInfo.node);
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
	getStorageLocal(StorageLocalKey.RESEARCH_IDS).then(local => {
		if (message.toggleResearchOn !== undefined) {
			setStorageLocal({ enabled: message.toggleResearchOn });
		} else if (message.disablePageResearch) {
			delete local.researchIds[senderTabId];
			chrome.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
		} else {
			if (!(senderTabId in local.researchIds)) {
				local.researchIds[senderTabId] = getResearchId({ terms: message.terms });
			}
			if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
				chrome.tabs.sendMessage(senderTabId, storeNewResearchDetails(
					local.researchIds, getResearchId({ terms: message.terms }), senderTabId));
			} else if (message.terms) {
				const highlightMessage = updateCachedResearchDetails(local.researchIds, message.terms, senderTabId);
				highlightMessage.termUpdate = message.termChanged;
				highlightMessage.termToUpdateIdx = message.termChangedIdx;
				Object.keys(local.researchIds).forEach(tabId =>
					local.researchIds[tabId] === local.researchIds[senderTabId] && Number(tabId) !== senderTabId
						? chrome.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
				);
			}
		}
		setStorageLocal({ researchIds: local.researchIds });
	})
;

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => (sender.tab
	? handleMessage(message, sender.tab.id)
	: chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => handleMessage(message, tabs[0].id)))
	&& sendResponse() // Manifest V3 bug.
);

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
		//handleEnginesCache();
		createContextMenuItem();
		getStorageLocal(StorageLocalKey.ENABLED).then(local =>
			setStorageLocal({ enabled: local.enabled === undefined ? true : local.enabled, researchIds: {}, engines: {} }));
		getStorageSync(StorageSyncKey.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
	});
})()();
