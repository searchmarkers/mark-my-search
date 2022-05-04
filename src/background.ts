type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;
type CacheItems = { [CacheKey.RESEARCH_IDS]?: ResearchIDs, [CacheKey.ENGINES]?: Engines }
type StorageItems = { [StorageKey.IS_SET_UP]?: boolean, [StorageKey.STOPLIST]?: Stoplist }

enum CacheKey {
	RESEARCH_IDS = "researchIds",
	ENGINES = "engines",
}

enum StorageKey {
	IS_SET_UP = "isSetUp",
	STOPLIST = "stoplist",
}

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
	browser.tabs.executeScript(tabId, { file: "/browser-polyfill.min.js" }).then(() =>
		browser.tabs.executeScript(tabId, { file: "/dist/stemmer.js" }).then(() =>
			browser.tabs.executeScript(tabId, { file: "/dist/shared-content.js" }).then(() =>
				browser.tabs.executeScript(tabId, { file: script }).then(() =>
					browser.commands.getAll().then(commands =>
						browser.tabs.sendMessage(tabId, Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)))))))
;

browser.webNavigation.onCommitted.addListener(details => getStorage(StorageKey.STOPLIST).then(storage =>
	getCache([CacheKey.RESEARCH_IDS, CacheKey.ENGINES]).then(cache => {
		console.log(cache);
		if (details.frameId !== 0) return;
		const [isSearchPage, engine] = isTabSearchPage(cache.engines, details.url);
		if (isSearchPage || isTabResearchPage(cache.researchIds, details.tabId)) {
			browser.tabs.get(details.tabId).then(tab =>
				injectScripts(tab.id, "/dist/term-highlight.js", isSearchPage
					? storeNewResearchDetails(cache.researchIds, getResearchId({ stoplist: storage.stoplist, url: tab.url, engine }), tab.id)
					: getCachedResearchDetails(cache.researchIds, tab.id))
			).then(() => isSearchPage ? setCache({ researchIds: cache.researchIds }) : undefined);
		}
	}))
);

browser.tabs.onCreated.addListener(tab => getCache(CacheKey.RESEARCH_IDS).then(cache => {
	if (tab.openerTabId in cache.researchIds) {
		cache.researchIds[tab.id] = cache.researchIds[tab.openerTabId];
		setCache({ researchIds: cache.researchIds });
	}
}));

const createContextMenuItem = () => {
	browser.contextMenus.create({
		title: "Researc&h Selection",
		id: getMenuSwitchId(true),
		contexts: ["selection"],
		onclick: async (event, tab) => getCache(CacheKey.RESEARCH_IDS).then(cache => tab.id in cache.researchIds
			? browser.tabs.sendMessage(tab.id, { termsFromSelection: true } as HighlightMessage)
			: injectScripts(tab.id, "/dist/term-highlight.js", { termsFromSelection: true } as HighlightMessage)
		),
	});
};

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

	const setEngines = (engines: Engines, setEngine: (node: browser.bookmarks.BookmarkTreeNode) => void,
		node: browser.bookmarks.BookmarkTreeNode) =>
		node.type === "bookmark"
			? setEngine(node)
			: node.type === "folder"
				? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
	;

	return () => {
		browser.bookmarks.getTree().then(nodes => getCache(CacheKey.ENGINES).then(cache => {
			nodes.forEach(node => setEngines(cache.engines, node =>
				addEngine(cache.engines, node.id, node.url), node));
			setCache({ engines: cache.engines });
		}));
		browser.bookmarks.onRemoved.addListener((id, removeInfo) => getCache(CacheKey.ENGINES).then(cache => {
			setEngines(cache.engines, node =>
				delete cache.engines[node.id], removeInfo.node);
			setCache({ engines: cache.engines });
		}));
		browser.bookmarks.onCreated.addListener((id, createInfo) => getCache(CacheKey.ENGINES).then(cache => {
			addEngine(cache.engines, id, createInfo.url);
			setCache({ engines: cache.engines });
		}));
		browser.bookmarks.onChanged.addListener((id, changeInfo) => getCache(CacheKey.ENGINES).then(cache => {
			addEngine(cache.engines, id, changeInfo.url);
			setCache({ engines: cache.engines });
		}));
	};
})();

browser.commands.onCommand.addListener(command =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		browser.tabs.sendMessage(tabs[0].id, { command } as HighlightMessage)
	)
);

browser.runtime.onMessage.addListener((message: BackgroundMessage, sender) =>
	getCache(CacheKey.RESEARCH_IDS).then(cache => {
		console.log(message);
		if (!(sender.tab.id in cache.researchIds)) {
			cache.researchIds[sender.tab.id] = getResearchId({ terms: message.terms });
		}
		if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
			browser.tabs.sendMessage(sender.tab.id, storeNewResearchDetails(
				cache.researchIds, getResearchId({ terms: message.terms }), sender.tab.id));
		} else {
			const highlightMessage = updateCachedResearchDetails(cache.researchIds, message.terms, sender.tab.id);
			highlightMessage.termUpdate = message.termChanged;
			highlightMessage.termToUpdateIdx = message.termChangedIdx;
			Object.keys(cache.researchIds).forEach(tabId =>
				cache.researchIds[tabId] === cache.researchIds[sender.tab.id] && Number(tabId) !== sender.tab.id
					? browser.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
			);
		}
		setCache({ researchIds: cache.researchIds });
	})
);

const setCache = (items: CacheItems) =>
	browser.storage.local.set(items)
;

const getCache = (keys: string | Array<string>): Promise<CacheItems> =>
	browser.storage.local.get(keys)
;

const setStorage = (items: StorageItems) =>
	browser.storage.sync.set(items)
;

const getStorage = (keys: string | Array<string>): Promise<StorageItems> =>
	browser.storage.sync.get(keys)
;

const startUp = () => {
	const setUp = () => {
		setStorage({
			isSetUp: true,
			stoplist: ["i", "a", "an", "and", "or", "not", "the", "there", "where", "to", "do", "of",
				"is", "isn't", "are", "aren't", "can", "can't", "how"],
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

	setCache({ researchIds: {}, engines: {} });
	getStorage(StorageKey.IS_SET_UP).then(items =>
		items.isSetUp ? undefined : setUp()
	);
};

handleEnginesCache();
createContextMenuItem();
startUp();
