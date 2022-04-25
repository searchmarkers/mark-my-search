type ResearchIDs = Record<number, ResearchID>;
type Stoplist = Set<string>;
type Engines = Record<string, Engine>;

interface ResearchArgs {
	terms?: MatchTerms
	termsRaw?: Array<string>
	stoplist?: Stoplist
	url?: string
	engine?: Engine
}

class ResearchID {
	terms: MatchTerms

	constructor(args: ResearchArgs) {
		if (args.terms) {
			this.terms = args.terms;
			return;
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
		this.terms = Array.from(new Set(args.termsRaw))
			.filter(phrase => !args.stoplist.has(phrase))
			.map(phrase => new MatchTerm(phrase));
	}
}

class Engine {
	hostname: string
	pathname: [string, string]
	param: string

	constructor(pattern: string) {
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

	extract(urlString: string, matchOnly = false) {
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

	match(urlString: string) {
		return !!this.extract(urlString, true);
	}

	equals(engine: Engine) {
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

const updateContextMenus = async (researchIds: ResearchIDs) => {
	const tabUrls: Array<string> = [];
	for (const tabId of Object.keys(researchIds)) {
		await browser.tabs.get(Number(tabId)).then(tab => tabUrls.push(tab.url));
	}
	browser.contextMenus.update(getMenuSwitchId(false), { documentUrlPatterns: Array.from(new Set(tabUrls)) });
};

const storeNewResearchDetails = (researchIds: ResearchIDs, researchId: ResearchID, tabId: number) => {
	researchIds[tabId] = researchId;
	updateContextMenus(researchIds);
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
	browser.tabs.executeScript(tabId, { file: "/dist/stemmer.js" }).then(() =>
		browser.tabs.executeScript(tabId, { file: "/dist/shared-content.js" }).then(() =>
			browser.tabs.executeScript(tabId, { file: script }).then(() =>
				browser.commands.getAll().then(commands =>
					browser.tabs.sendMessage(tabId, Object.assign({ extensionCommands: commands } as HighlightMessage, message))))))
;

const injectScriptsOnNavigation = (stoplist: Stoplist, engines: Engines, researchIds: ResearchIDs, script: string) =>
	browser.webNavigation.onCommitted.addListener(details => {
		if (details.frameId !== 0) return;
		const [isSearchPage, engine] = isTabSearchPage(engines, details.url);
		if (isSearchPage || isTabResearchPage(researchIds, details.tabId)) {
			browser.tabs.get(details.tabId).then(tab => {
				injectScripts(tab.id, script, isSearchPage
					? storeNewResearchDetails(researchIds, new ResearchID({ stoplist, url: tab.url, engine }), tab.id)
					: getCachedResearchDetails(researchIds, tab.id));
				if (!isSearchPage)
					updateContextMenus(researchIds);
			});
		}
	})
;

const extendResearchOnTabCreated = (researchIds: ResearchIDs) =>
	browser.tabs.onCreated.addListener(tab => {
		if (tab.openerTabId in researchIds) {
			researchIds[tab.id] = researchIds[tab.openerTabId];
			updateContextMenus(researchIds);
		}
	})
;

const createMenuSwitches = (researchIds: ResearchIDs) => {
	browser.contextMenus.create({ title: "Stop Researc&h", id: getMenuSwitchId(false), contexts: ["page"],
		documentUrlPatterns: [], onclick: (event, tab) => {
			browser.tabs.sendMessage(tab.id, { terms: [], disable: true } as HighlightMessage);
			browser.tabs.get(tab.id).then(tab => {
				delete researchIds[tab.id];
				updateContextMenus(researchIds);
			});
		}
	});
	browser.contextMenus.create({ title: "Researc&h Selection", id: getMenuSwitchId(true), contexts: ["selection"],
		onclick: async (event, tab) => tab.id in researchIds
			? browser.tabs.sendMessage(tab.id, { terms: [] } as HighlightMessage)
			: injectScripts(tab.id, "/dist/term-highlight.js", { terms: [] } as HighlightMessage)
	});
};

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

const addEngineOnBookmarkChanged = (engines: Engines) => {
	browser.bookmarks.getTree().then(nodes =>
		nodes.forEach(node => setEngines(engines, node =>
			addEngine(engines, node.id, node.url), node)));
	browser.bookmarks.onRemoved.addListener((id, removeInfo) =>
		setEngines(engines, node =>
			delete engines[node.id], removeInfo.node));
	browser.bookmarks.onCreated.addListener((id, createInfo) =>
		addEngine(engines, id, createInfo.url));
	browser.bookmarks.onChanged.addListener((id, changeInfo) =>
		addEngine(engines, id, changeInfo.url));
};

const sendMessageOnCommand = () => browser.commands.onCommand.addListener(command =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		browser.tabs.sendMessage(tabs[0].id, { command } as HighlightMessage)
	)
);

const sendUpdateMessagesOnMessage = (researchIds: ResearchIDs) =>
	browser.runtime.onMessage.addListener((message: BackgroundMessage, sender) => {
		if (!(sender.tab.id in researchIds)) {
			researchIds[sender.tab.id] = new ResearchID({ terms: message.terms });
		}
		if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
			browser.tabs.sendMessage(sender.tab.id, storeNewResearchDetails(
				researchIds, new ResearchID({ terms: message.terms }), sender.tab.id));
		} else {
			const highlightMessage = updateCachedResearchDetails(researchIds, message.terms, sender.tab.id);
			highlightMessage.termUpdate = message.termChanged;
			highlightMessage.termToUpdateIdx = message.termChangedIdx;
			Object.keys(researchIds).forEach(tabId =>
				researchIds[tabId] === researchIds[sender.tab.id]
					? browser.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
			);
		}
	})
;

(() => {
	const stoplist: Stoplist = new Set([
		"a",
		"about",
		"above",
		"after",
		"again",
		"against",
		"all",
		"am",
		"an",
		"and",
		"any",
		"are",
		"aren't",
		"as",
		"at",
		"be",
		"because",
		"been",
		"before",
		"being",
		"below",
		"between",
		"both",
		"but",
		"by",
		"can't",
		"cannot",
		"could",
		"couldn't",
		"did",
		"didn't",
		"do",
		"does",
		"doesn't",
		"doing",
		"don't",
		"down",
		"during",
		"each",
		"few",
		"for",
		"from",
		"further",
		"had",
		"hadn't",
		"has",
		"hasn't",
		"have",
		"haven't",
		"having",
		"he",
		"he'd",
		"he'll",
		"he's",
		"her",
		"here",
		"here's",
		"hers",
		"herself",
		"him",
		"himself",
		"his",
		"how",
		"how's",
		"i",
		"i'd",
		"i'll",
		"i'm",
		"i've",
		"if",
		"in",
		"into",
		"is",
		"isn't",
		"it",
		"it's",
		"its",
		"itself",
		"let's",
		"me",
		"more",
		"most",
		"mustn't",
		"my",
		"myself",
		"no",
		"nor",
		"not",
		"of",
		"off",
		"on",
		"once",
		"only",
		"or",
		"other",
		"ought",
		"our",
		"ours",
		"ourselves",
		"out",
		"over",
		"own",
		"same",
		"shan't",
		"she",
		"she'd",
		"she'll",
		"she's",
		"should",
		"shouldn't",
		"so",
		"some",
		"such",
		"than",
		"that",
		"that's",
		"the",
		"their",
		"theirs",
		"them",
		"themselves",
		"then",
		"there",
		"there's",
		"these",
		"they",
		"they'd",
		"they'll",
		"they're",
		"they've",
		"this",
		"those",
		"through",
		"to",
		"too",
		"under",
		"until",
		"up",
		"very",
		"was",
		"wasn't",
		"we",
		"we'd",
		"we'll",
		"we're",
		"we've",
		"were",
		"weren't",
		"what",
		"what's",
		"when",
		"when's",
		"where",
		"where's",
		"which",
		"while",
		"who",
		"who's",
		"whom",
		"why",
		"why's",
		"with",
		"won't",
		"would",
		"wouldn't",
		"you",
		"you'd",
		"you'll",
		"you're",
		"you've",
		"your",
		"yours",
		"yourself",
		"yourselves",
	]);
	const researchIds: ResearchIDs = {};
	const engines: Engines = {};
	createMenuSwitches(researchIds);
	injectScriptsOnNavigation(stoplist, engines, researchIds, "/dist/term-highlight.js");
	extendResearchOnTabCreated(researchIds);
	addEngineOnBookmarkChanged(engines);
	sendMessageOnCommand();
	sendUpdateMessagesOnMessage(researchIds);
})();
