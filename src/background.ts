self["importScripts"]("/dist/manage-storage.js", "/dist/stem-pattern-find.js", "/dist/shared-content.js");

interface ResearchArgs {
	terms?: MatchTerms
	termsRaw?: Array<string>
	stoplist?: Stoplist
	url?: string
	engine?: Engine
}

const getResearchInstance = (args: ResearchArgs): ResearchInstance => {
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

const getNewResearchDetails = (researchInstance: ResearchInstance) =>
	({ terms: researchInstance.terms } as HighlightMessage)
;

const getCachedResearchDetails = (researchInstances: ResearchInstances, tabId: number) =>
	({ terms: researchInstances[tabId].terms } as HighlightMessage)
;

const updateCachedResearchDetails = (researchInstances: ResearchInstances, terms: MatchTerms, tabId: number) => {
	researchInstances[tabId].terms = terms;
	return { terms } as HighlightMessage;
};

const injectScripts = (tabId: number, message?: HighlightMessage) =>
	chrome.scripting.executeScript({
		target: { tabId },
		files: ["/dist/stem-pattern-find.js", "/dist/shared-content.js", "/dist/term-highlight.js"]
	}).then(() =>
		chrome.commands.getAll().then(commands =>
			chrome.tabs.sendMessage(tabId,
				Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)))
	)
;

(() => {
	const setUp = () => {
		setStorageSync({
			isSetUp: true,
			stoplist: ["i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "isn't", "are", "aren't", "can", "can't", "how"],
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

	const initialize = (() => {
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
			};
		
			const setEngines = (engines: Engines, setEngine: (node: chrome.bookmarks.BookmarkTreeNode) => void,
				node: chrome.bookmarks.BookmarkTreeNode) =>
				node["type"] === "bookmark"
					? setEngine(node)
					: node["type"] === "folder"
						? node.children.forEach(child => setEngines(engines, setEngine, child)): undefined
			;
		
			return () => {
				if (!chrome.bookmarks)
					return;
				chrome.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocal.ENGINES).then(local => {
					nodes.forEach(node => setEngines(local.engines, node =>
						addEngine(local.engines, node.id, node.url), node));
					setStorageLocal({ engines: local.engines });
				}));
				chrome.bookmarks.onRemoved.addListener((id, removeInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
					setEngines(local.engines, node =>
						delete(local.engines[node.id]), removeInfo.node);
					setStorageLocal({ engines: local.engines });
				}));
				chrome.bookmarks.onCreated.addListener((id, createInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
					addEngine(local.engines, id, createInfo.url);
					setStorageLocal({ engines: local.engines });
				}));
				chrome.bookmarks.onChanged.addListener((id, changeInfo) => getStorageLocal(StorageLocal.ENGINES).then(local => {
					addEngine(local.engines, id, changeInfo.url);
					setStorageLocal({ engines: local.engines });
				}));
			};
		})();

		const createContextMenuItem = () => {
			chrome.contextMenus.removeAll();
			chrome.contextMenus.create({
				title: "Researc&h Selection",
				id: getMenuSwitchId(true),
				contexts: ["selection"],
			});
			chrome.contextMenus.onClicked.addListener((info, tab) =>
				getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
					if (tab.id in local.managedTabs) {
						chrome.tabs.sendMessage(tab.id, { termsFromSelection: true } as HighlightMessage);
					} else {
						local.managedTabs[tab.id] = true;
						injectScripts(tab.id, { termsFromSelection: true } as HighlightMessage);
						setStorageLocal({ managedTabs: local.managedTabs });
					}
				})
			);
		};

		return () => {
			handleEnginesCache();
			createContextMenuItem();
			initStorageLocal();
		};
	})();

	chrome.runtime.onInstalled.addListener(() => {
		getStorageSync(StorageSync.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
		initialize();
	});

	chrome.runtime.onStartup.addListener(initialize);
})();

(() => {
	const pageModifyRemote = (url: string, tabId: number) => getStorageSync(StorageSync.STOPLIST).then(sync =>
		getStorageLocal([StorageLocal.ENABLED, StorageLocal.RESEARCH_INSTANCES, StorageLocal.MANAGED_TABS, StorageLocal.ENGINES]).then(local => {
			const [isSearchPage, engine] = isTabSearchPage(local.engines, url);
			const isResearchPage = isTabResearchPage(local.researchInstances, tabId);
			if ((isSearchPage && local.enabled) || isResearchPage) {
				chrome.tabs.get(tabId).then(tab => {
					if (!tab.url && !tab.pendingUrl) {
						delete(local.researchInstances[tab.id]); // Chromium sets openerTabId for new tabs; unwanted research instances.
						return;
					}
					if (isSearchPage) {
						const researchInstance = getResearchInstance({ stoplist: sync.stoplist, url, engine });
						if (isResearchPage && local.managedTabs[tabId]
							&& local.researchInstances[tabId].terms.length === researchInstance.terms.length
							&& local.researchInstances[tabId].terms.every((term, i) => term.phrase === researchInstance.terms[i].phrase)) {
							return;
						}
						local.researchInstances[tab.id] = researchInstance;
					}
					if (local.managedTabs[tabId]) {
						chrome.tabs.sendMessage(tabId, getNewResearchDetails(local.researchInstances[tabId]));
					} else {
						local.managedTabs[tab.id] = true;
						injectScripts(tab.id, isSearchPage
							? getNewResearchDetails(local.researchInstances[tab.id])
							: getCachedResearchDetails(local.researchInstances, tab.id));
					}
				}).then(() => setStorageLocal({ researchInstances: local.researchInstances, managedTabs: local.managedTabs }));
			}
		})
	);

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => changeInfo.url
		? pageModifyRemote(changeInfo.url, tabId) : undefined
	);

	chrome.webNavigation.onBeforeNavigate.addListener(details => details.frameId === 0
		? getStorageLocal(StorageLocal.MANAGED_TABS).then(local => {
			if (local.managedTabs[details.tabId]) {
				delete(local.managedTabs[details.tabId]);
				setStorageLocal({ managedTabs: local.managedTabs });
			}
		}) : undefined
	);

	chrome.webNavigation.onCommitted.addListener(details => details.frameId === 0
		? pageModifyRemote(details.url, details.tabId) : undefined
	);
})();

chrome.tabs.onCreated.addListener(tab => getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
	if (isTabResearchPage(local.researchInstances, tab.openerTabId)) {
		local.researchInstances[tab.id] = local.researchInstances[tab.openerTabId];
		setStorageLocal({ researchInstances: local.researchInstances });
	}
}));

chrome.commands.onCommand.addListener(command =>
	chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
		chrome.tabs.sendMessage(tabs[0].id, { command } as HighlightMessage)
	)
);

(() => {
	const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
			if (message.toggleResearchOn !== undefined) {
				setStorageLocal({ enabled: message.toggleResearchOn });
			} else if (message.disablePageResearch) {
				delete(local.researchInstances[senderTabId]);
				chrome.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
			} else {
				if (!isTabResearchPage(local.researchInstances, senderTabId)) {
					local.researchInstances[senderTabId] = getResearchInstance({ terms: message.terms });
				}
				if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
					local.researchInstances[senderTabId] = getResearchInstance({ terms: message.terms });
					chrome.tabs.sendMessage(senderTabId, getNewResearchDetails(local.researchInstances[senderTabId]));
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
})();
