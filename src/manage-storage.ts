const useChromeAPI = () =>
	!this.browser
;

chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;
chrome.storage.session ??= chrome.storage.local;

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type StorageSessionValues = {
	[StorageSession.RESEARCH_INSTANCES]: ResearchInstances
	[StorageSession.ENGINES]: Engines
}
type StorageLocalValues = {
	[StorageLocal.ENABLED]: boolean
	[StorageLocal.FOLLOW_LINKS]: boolean
	[StorageLocal.PERSIST_RESEARCH_INSTANCES]: boolean
}
type StorageSyncValues = {
	[StorageSync.AUTO_FIND_OPTIONS]: {
		stoplist: Array<string>
		searchParams: Array<string>
	}
	[StorageSync.MATCH_MODE_DEFAULTS]: MatchMode
	[StorageSync.LINK_RESEARCH_TABS]: boolean
	[StorageSync.SHOW_HIGHLIGHTS]: {
		default: boolean
		overrideSearchPages: boolean
		overrideResearchPages: boolean
	}
	[StorageSync.BAR_CONTROLS_SHOWN]: {
		disableTabResearch: boolean
		performSearch: boolean
		toggleHighlights: boolean
		appendTerm: boolean
		pinTerms: boolean
	}
	[StorageSync.BAR_LOOK]: {
		showEditIcon: boolean
		showRevealIcon: boolean
		fontSize: string
		opacityControl: number
		opacityTerm: number
		borderRadius: string
	}
	[StorageSync.HIGHLIGHT_LOOK]: {
		hues: Array<number>
	}
	[StorageSync.URL_FILTERS]: {
		noPageModify: URLFilter
		nonSearch: URLFilter
	}
	[StorageSync.TERM_LISTS]: Array<TermList>
}
type URLFilter = Array<{
	hostname: string,
	pathname: string,
}>
type TermList = {
	name: string
	terms: Array<MatchTerm>
	urlFilter: URLFilter
}

enum StorageSession { // Keys assumed to be unique across all storage areas (excluding 'managed')
	RESEARCH_INSTANCES = "researchInstances",
	ENGINES = "engines",
}

enum StorageLocal {
	ENABLED = "enabled",
	FOLLOW_LINKS = "followLinks",
	PERSIST_RESEARCH_INSTANCES = "persistResearchInstances",
}

enum StorageSync {
	AUTO_FIND_OPTIONS = "autoFindOptions",
	MATCH_MODE_DEFAULTS = "matchModeDefaults",
	LINK_RESEARCH_TABS = "linkResearchTabs",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_CONTROLS_SHOWN = "barControlsShown",
	BAR_LOOK = "barLook",
	HIGHLIGHT_LOOK = "highlightLook",
	URL_FILTERS = "urlFilters",
	TERM_LISTS = "termLists",
}

interface ResearchInstance {
	terms: MatchTerms
	highlightsShown: boolean
	autoOverwritable: boolean
	enabled: boolean
}

const defaultOptions: StorageSyncValues = {
	autoFindOptions: {
		searchParams: [ // Order of specificity as only the first found will be used.
			"searchTerms",
			"searchTerm",
			"search",
			"query",
			"phrase",
			"keywords",
			"keyword",
			"terms",
			"term",
			"s", "q", "p", "k",
			// Special cases:
			"_nkw", // eBay
		],
		stoplist: [
			"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
			"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
			"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's",
		],
	},
	matchModeDefaults: {
		regex: false,
		case: false,
		stem: true,
		whole: false,
		diacritics: false,
	},
	linkResearchTabs: false,
	showHighlights: {
		default: true,
		overrideSearchPages: true,
		overrideResearchPages: false,
	},
	barControlsShown: {
		disableTabResearch: true,
		performSearch: false,
		toggleHighlights: true,
		appendTerm: true,
		pinTerms: true,
	},
	barLook: {
		showEditIcon: true,
		showRevealIcon: true,
		fontSize: "14.6px",
		opacityControl: 0.8,
		opacityTerm: 0.86,
		borderRadius: "4px",
	},
	highlightLook: {
		hues: [ 300, 60, 110, 220, 30, 190, 0 ],
	},
	urlFilters: {
		noPageModify: [],
		nonSearch: [],
	},
	termLists: [],
};

/**
 * Stores items to browser session storage.
 * @param items An object of items to create or update.
 */
const setStorageSession = (items: StorageSessionValues) => {
	return chrome.storage.session.set(items);
};

/**
 * Retrieves items from browser session storage.
 * @param keys An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSession = async (keys?: Array<StorageSession>): Promise<StorageSessionValues> => {
	const session = await chrome.storage.session.get(keys) as StorageSessionValues;
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
const setStorageLocal = (items: StorageLocalValues) => {
	return chrome.storage.local.set(items);
};

/**
 * Retrieves items from browser local storage.
 * @param keys An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
const getStorageLocal = async (keys?: Array<StorageLocal>): Promise<StorageLocalValues> => {
	return chrome.storage.local.get(keys) as Promise<StorageLocalValues>;
};

/**
 * Stores items to browser sync storage.
 * @param items An object of items to create or update.
 */
const setStorageSync = (items: StorageSyncValues) => {
	return chrome.storage.sync.set(items);
};

/**
 * Retrieves items from browser synced storage.
 * @param keys An array of storage keys for which to retrieve the items.
 * @returns A promise that resolves with an object containing the requested items.
 */
const getStorageSync = async (keys?: Array<StorageSync>): Promise<StorageSyncValues> => {
	return chrome.storage.sync.get(keys) as Promise<StorageSyncValues>;
};

/**
 * Sets internal storage to its default working values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const initializeStorage = async () => {
	const local = await getStorageLocal();
	const localOld = { ...local };
	const toRemove: Array<string> = [];
	if (fixObjectWithDefaults(local, {
		enabled: true,
		followLinks: true,
		persistResearchInstances: true,
	} as StorageLocalValues, toRemove)) {
		console.warn("Storage 'local' cleanup rectified issues. Results:", localOld, local); // Use standard logging system?
	}
	await setStorageLocal(local);
	if (chrome.storage["session"]) { // Temporary fix. Without the 'session' API, its values may be stored in 'local'.
		await chrome.storage.local.remove(toRemove);
	}
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
 * @returns Whether or not any fixes were applied.
 */
const fixObjectWithDefaults = (
	object: Record<string, unknown>,
	defaults: Record<string, unknown>,
	toRemove: Array<string>,
	atTopLevel = true,
): boolean => {
	let hasModified = false;
	Object.keys(object).forEach(objectKey => {
		if (defaults[objectKey] === undefined) {
			delete object[objectKey];
			if (atTopLevel) {
				toRemove.push(objectKey);
			}
			hasModified = true;
		} else if (typeof(object[objectKey]) === "object" && !Array.isArray(object[objectKey])) {
			if (fixObjectWithDefaults(
				object[objectKey] as Record<string, unknown>,
				defaults[objectKey] as Record<string, unknown>,
				toRemove,
				false,
			)) {
				hasModified = true;
			}
		}
	});
	Object.keys(defaults).forEach(defaultsKey => {
		if (typeof(object[defaultsKey]) !== typeof(defaults[defaultsKey])
			|| Array.isArray(object[defaultsKey]) !== Array.isArray(defaults[defaultsKey])) {
			object[defaultsKey] = defaults[defaultsKey];
			hasModified = true;
		}
	});
	return hasModified;
};

/**
 * Checks persistent options storage for unwanted or misconfigured values, then restores it to a normal state.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const repairOptions = async () => {
	const sync = await getStorageSync();
	const syncOld = { ...sync };
	const toRemove = [];
	if (fixObjectWithDefaults(sync, defaultOptions, toRemove)) {
		console.warn("Storage 'sync' cleanup rectified issues. Results:", syncOld, sync); // Use standard logging system?
	}
	await setStorageSync(sync);
	await chrome.storage.sync.remove(toRemove);
};
