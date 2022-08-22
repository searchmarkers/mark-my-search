const isBrowserChromium = () =>
	!this.browser
;

chrome.storage = isBrowserChromium() /* Running in Chromium */  ? chrome.storage : browser.storage as typeof chrome.storage;
chrome.storage.session = chrome.storage.session ?? chrome.storage.local;

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type StorageSessionValues = {
	[StorageSession.RESEARCH_INSTANCES]: ResearchInstances
	[StorageSession.ENGINES]: Engines
}
type StorageLocalValues = {
	[StorageLocal.ENABLED]: boolean
}
type StorageSyncValues = {
	[StorageSync.AUTO_FIND_OPTIONS]: {
		stoplist: Array<string>
		searchParams: Array<string>
	}
	[StorageSync.LINK_RESEARCH_TABS]: boolean
	[StorageSync.SHOW_HIGHLIGHTS]: {
		default: boolean
		overrideSearchPages: boolean
		overrideResearchPages: boolean
	}
	[StorageSync.BAR_CONTROLS_SHOWN]: {
		disableTabResearch: boolean
		performSearch: boolean
		appendTerm: boolean
	}
	[StorageSync.BAR_LOOK]: {
		showEditIcon: boolean
	}
	[StorageSync.HIGHLIGHT_LOOK]: {
		hues: Array<number>
	}
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ControlButtonName = keyof StorageSyncValues["barControlsShown"]
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type BarLook = keyof StorageSyncValues["barLook"]

enum StorageSession {
	RESEARCH_INSTANCES = "researchInstances",
	_ID_R_INSTANCES = "idResearchInstances",
    _TAB_R_INSTANCE_IDS = "tabResearchInstanceIds",
	ENGINES = "engines",
}

enum StorageLocal {
	ENABLED = "enabled",
}

enum StorageSync {
	IS_SET_UP = "isSetUp", // TODO supplement with detection of unused keys
	AUTO_FIND_OPTIONS = "autoFindOptions",
	LINK_RESEARCH_TABS = "linkResearchTabs",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_CONTROLS_SHOWN = "barControlsShown",
	BAR_LOOK = "barLook",
	HIGHLIGHT_LOOK = "highlightLook",
}

interface ResearchInstance {
	phrases: ReadonlyArray<string>
	terms: MatchTerms
	highlightsShown: boolean
	autoOverwritable: boolean
}

const defaultOptions: StorageSyncValues = {
	autoFindOptions: {
		searchParams: [ // Order of specificity
			"searchTerms",
			"searchTerm",
			"search",
			"query",
			"keywords",
			"keyword",
			"terms",
			"term",
			"q", "s", "k",
		],
		stoplist: [
			"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
			"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
			"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's",
		],
	},
	linkResearchTabs: false,
	showHighlights: {
		default: true,
		overrideSearchPages: true,
		overrideResearchPages: false,
	},
	barControlsShown: {
		disableTabResearch: true,
		performSearch: true,
		appendTerm: true,
	},
	barLook: {
		showEditIcon: true,
	},
	highlightLook: {
		hues: [ 300, 60, 110, 220, 30, 190, 0 ],
	},
};

/**
 * Stores items to browser session storage.
 * @param items An object of items to create or update.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSession = (items: StorageSessionValues) => {
	if (Object.keys(items).includes(StorageSession.RESEARCH_INSTANCES)) {
		// TODO disable object shallow copying when linking disabled in settings
		const tabRInstances = items.researchInstances;
		const tabs = Object.keys(tabRInstances);
		const idRInstances: Array<ResearchInstance> = [];
		const tabRInstanceIds = {};
		items.researchInstances = {};
		tabs.forEach(tab => {
			const id = idRInstances.indexOf(tabRInstances[tab]);
			if (id === -1) {
				tabRInstanceIds[tab] = idRInstances.length;
				idRInstances.push(tabRInstances[tab]);
			} else {
				tabRInstanceIds[tab] = id;
			}
		});
		items[StorageSession._ID_R_INSTANCES] = idRInstances;
		items[StorageSession._TAB_R_INSTANCE_IDS] = tabRInstanceIds;
	}
	return chrome.storage.session.set(items);
};

/**
 * Retrieves items from browser session storage.
 * @param keysParam An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSession = async (keysParam?: Array<StorageSession>): Promise<StorageSessionValues> => {
	const keys = keysParam === undefined
		? undefined
		: typeof(keysParam) === "string" ? [ keysParam ] : Array.from(new Set(keysParam));
	const gettingRInstances = keys && keys.includes(StorageSession.RESEARCH_INSTANCES);
	if (gettingRInstances) {
		keys.splice(keys.indexOf(StorageSession.RESEARCH_INSTANCES), 1);
		keys.push(StorageSession._ID_R_INSTANCES);
		keys.push(StorageSession._TAB_R_INSTANCE_IDS);
	}
	const session = await chrome.storage.session.get(keys) as StorageSessionValues;
	if (gettingRInstances) {
		const idRInstances = session[StorageSession._ID_R_INSTANCES];
		const tabRInstanceIds = session[StorageSession._TAB_R_INSTANCE_IDS];
		delete session[StorageSession._ID_R_INSTANCES];
		delete session[StorageSession._TAB_R_INSTANCE_IDS];
		const tabRInstances = {};
		Object.keys(tabRInstanceIds).forEach(tab => {
			tabRInstances[tab] = idRInstances[tabRInstanceIds[tab]];
		});
		session.researchInstances = tabRInstances;
	}
	if (session.engines) {
		const engines = session.engines as Engines;
		Object.keys(engines).forEach(id => engines[id] = Object.assign(new Engine, engines[id]));
	}
	return session;
};

/**
 * Stores items to browser local storage.
 * @param items An object of items to create or update.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageLocal = (items: StorageLocalValues) => {
	return chrome.storage.local.set(items);
};

/**
 * Retrieves items from browser local storage.
 * @param keysParam An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageLocal = (keysParam?: Array<StorageLocal>): Promise<StorageLocalValues> => {
	return chrome.storage.local.get(keysParam) as Promise<StorageLocalValues>;
};

/**
 * Stores items to browser sync storage.
 * @param items An object of items to create or update.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSync = (items: StorageSyncValues) => {
	return chrome.storage.sync.set(items);
};

/**
 * Retrieves items from browser synced storage.
 * @param keysParam An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSync = (keysParam?: Array<StorageSync>): Promise<StorageSyncValues> => {
	return chrome.storage.sync.get(keysParam) as Promise<StorageSyncValues>;
};

/**
 * Set internal storage to its default working values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const initializeStorage = async () => {
	const local = await getStorageLocal([ StorageLocal.ENABLED ]);
	await setStorageLocal({
		enabled: local.enabled ?? true,
	});
	await setStorageSession({
		researchInstances: {},
		engines: {},
	});
};

/**
 * Makes an object conform to an object of defaults.
 * Missing default items are assigned, and items with no corresponding default are removed. Items within arrays are ignored.
 * @param object An object to repair.
 * @param defaults An object of default items to be compared with the first object.
 * @param toRemove An empty array to be filled with deleted top-level keys.
 * @param atTopLevel Indicates whether or not the function is currently at the top level of the object.
 */
const fixObjectWithDefaults = (
	object: Record<string, unknown>,
	defaults: Record<string, unknown>,
	toRemove: Array<string>,
	atTopLevel = true,
) => {
	Object.keys(object).forEach(objectKey => {
		if (defaults[objectKey] === undefined) {
			delete object[objectKey];
			if (atTopLevel) {
				toRemove.push(objectKey);
			}
		} else if (typeof(object[objectKey]) === "object" && !Array.isArray(object[objectKey])) {
			fixObjectWithDefaults(
				object[objectKey] as Record<string, unknown>,
				defaults[objectKey] as Record<string, unknown>,
				toRemove,
				false,
			);
		}
	});
	Object.keys(defaults).forEach(defaultsKey => {
		if (typeof(object[defaultsKey]) !== typeof(defaults[defaultsKey])
			|| Array.isArray(object[defaultsKey]) !== Array.isArray(defaults[defaultsKey])) {
			object[defaultsKey] = defaults[defaultsKey];
		}
	});
};

/**
 * Checks persistent options storage for unwanted or misconfigured values, then restores it to a normal state.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const repairOptions = async () => {
	const sync = await getStorageSync();
	const toRemove = [];
	fixObjectWithDefaults(sync, defaultOptions, toRemove);
	setStorageSync(sync);
	chrome.storage.sync.remove(toRemove);
};
