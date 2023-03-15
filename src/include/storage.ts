const useChromeAPI = () =>
	!this.browser
;

chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;
chrome.storage.session ??= chrome.storage.local;

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type BankValues = {
	[BankKey.RESEARCH_INSTANCES]: ResearchInstances
	[BankKey.ENGINES]: Engines
}
type StorageValueWrapped<T, Wrapped = true> = Wrapped extends true ? {
	wValue: T
	wSync: boolean
} : T
type StorageDefaultWrapped<T, Wrapped = true> = StorageValueWrapped<T, Wrapped> & (Wrapped extends true ? {
	wUseDefault: boolean
} : T)
type StorageArrayWrapped<T, Wrapped = true> = StorageValueWrapped<T, Wrapped> & (Wrapped extends true ? {
	wInlist: T
	wOutlist: T
} : T)
type ConfigBarControlsShown<Wrapped = false> = {
	toggleBarCollapsed: StorageValueWrapped<boolean, Wrapped>
	disableTabResearch: StorageValueWrapped<boolean, Wrapped>
	performSearch: StorageValueWrapped<boolean, Wrapped>
	toggleHighlights: StorageValueWrapped<boolean, Wrapped>
	appendTerm: StorageValueWrapped<boolean, Wrapped>
	replaceTerms: StorageValueWrapped<boolean, Wrapped>
}
type ConfigBarLook<Wrapped = false> = {
	showEditIcon: StorageValueWrapped<boolean, Wrapped>
	showRevealIcon: StorageValueWrapped<boolean, Wrapped>
	fontSize: StorageDefaultWrapped<string, Wrapped>
	opacityControl: StorageDefaultWrapped<number, Wrapped>
	opacityTerm: StorageDefaultWrapped<number, Wrapped>
	borderRadius: StorageDefaultWrapped<string, Wrapped>
}
type ConfigHighlightMethod<Wrapped = false> = {
	paintReplaceByClassic: StorageValueWrapped<boolean, Wrapped>
	paintUseExperimental: StorageDefaultWrapped<boolean, Wrapped>
	hues: StorageDefaultWrapped<Array<number>, Wrapped>
}
type ConfigURLFilters<Wrapped = false> = {
	noPageModify: StorageArrayWrapped<URLFilter, Wrapped>
	nonSearch: StorageArrayWrapped<URLFilter, Wrapped>
}
type ConfigValues<Wrapped = false> = {
	[ConfigKey.RESEARCH_INSTANCE_OPTIONS]: {
		restoreLastInTab: StorageValueWrapped<boolean, Wrapped>
	}
	[ConfigKey.AUTO_FIND_OPTIONS]: {
		enabled: StorageValueWrapped<boolean, Wrapped>
		stoplist: StorageArrayWrapped<Array<string>, Wrapped>
		searchParams: StorageArrayWrapped<Array<string>, Wrapped>
	}
	[ConfigKey.MATCH_MODE_DEFAULTS]: StorageDefaultWrapped<MatchMode, Wrapped>
	[ConfigKey.SHOW_HIGHLIGHTS]: {
		default: StorageValueWrapped<boolean, Wrapped>
		overrideSearchPages: StorageValueWrapped<boolean, Wrapped>
		overrideResearchPages: StorageValueWrapped<boolean, Wrapped>
	}
	[ConfigKey.BAR_COLLAPSE]: {
		fromSearch: StorageValueWrapped<boolean, Wrapped>
		fromTermListAuto: StorageValueWrapped<boolean, Wrapped>
	}
	[ConfigKey.BAR_CONTROLS_SHOWN]: ConfigBarControlsShown<Wrapped>
	[ConfigKey.BAR_LOOK]: ConfigBarLook<Wrapped>
	[ConfigKey.HIGHLIGHT_METHOD]: ConfigHighlightMethod<Wrapped>
	[ConfigKey.URL_FILTERS]: ConfigURLFilters<Wrapped>
	[ConfigKey.TERM_LISTS]: StorageValueWrapped<Array<TermList>, Wrapped>
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

//type StorageAreaName = "session" | "local" | "sync"

//type StorageArea<Area extends StorageAreaName> =
//	Area extends "session" ? StorageVolatile :
//	Area extends "local" ? StorageLocal :
//	Area extends "sync" ? Storage :
//never;

//type StorageAreaValues<Area extends StorageAreaName> =
//	Area extends "session" ? StorageSessionValues :
//	Area extends "local" ? StorageLocalValues :
//	Area extends "sync" ? StorageSyncValues :
//never;

enum BankKey { // Keys assumed to be unique across all storage areas (excluding 'managed')
	RESEARCH_INSTANCES = "researchInstances",
	ENGINES = "engines",
}

enum ConfigKey {
	OPTIONS = "options",
	RESEARCH_INSTANCE_OPTIONS = "researchInstanceOptions",
	AUTO_FIND_OPTIONS = "autoFindOptions",
	MATCH_MODE_DEFAULTS = "matchModeDefaults",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_COLLAPSE = "barCollapse",
	BAR_CONTROLS_SHOWN = "barControlsShown",
	BAR_LOOK = "barLook",
	HIGHLIGHT_METHOD = "highlightMethod",
	URL_FILTERS = "urlFilters",
	TERM_LISTS = "termLists",
}

interface ResearchInstance {
	terms: MatchTerms
	highlightsShown: boolean
	barCollapsed: boolean
	enabled: boolean
}

/**
 * The default options to be used for items missing from storage, or to which items may be reset.
 * Set to sensible options for a generic first-time user of the extension.
 */
const configWrappers: ConfigValues<true> = {
	researchInstanceOptions: {
		restoreLastInTab: {
			wValue: true,
			wSync: false,
		},
	},
	autoFindOptions: {
		enabled: {
			wValue: true,
			wSync: false,
		},
		searchParams: {
			wValue: [ // Order of specificity, as only the first match will be used.
				"search_terms", "search_term", "searchTerms", "searchTerm",
				"search_query", "searchQuery",
				"search",
				"query",
				"phrase",
				"keywords", "keyword",
				"terms", "term",
				"text",
				// Short forms:
				"s", "q", "p", "k",
				// Special cases:
				"_nkw", // eBay
				"wd", // Baidu
			],
			wInlist: [],
			wOutlist: [],
			wSync: true,
		},
		stoplist: {
			wValue: [
				"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
				"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's", "you", "your", "yours",
			],
			wInlist: [],
			wOutlist: [],
			wSync: true,
		},
	},
	matchModeDefaults: {
		wValue: {
			regex: false,
			case: false,
			stem: true,
			whole: false,
			diacritics: false,
		},
		wUseDefault: true,
		wSync: false,
	},
	showHighlights: {
		default: {
			wValue: true,
			wSync: true,
		},
		overrideSearchPages: {
			wValue: false,
			wSync: true,
		},
		overrideResearchPages: {
			wValue: false,
			wSync: true,
		},
	},
	barCollapse: {
		fromSearch: {
			wValue: false,
			wSync: true,
		},
		fromTermListAuto: {
			wValue: false,
			wSync: true,
		},
	},
	barControlsShown: {
		toggleBarCollapsed: {
			wValue: true,
			wSync: true,
		},
		disableTabResearch: {
			wValue: true,
			wSync: true,
		},
		performSearch: {
			wValue: false,
			wSync: true,
		},
		toggleHighlights: {
			wValue: true,
			wSync: true,
		},
		appendTerm: {
			wValue: true,
			wSync: true,
		},
		replaceTerms: {
			wValue: true,
			wSync: true,
		},
	},
	barLook: {
		showEditIcon: {
			wValue: true,
			wSync: true,
		},
		showRevealIcon: {
			wValue: true,
			wSync: true,
		},
		fontSize: {
			wValue: "14.6px",
			wUseDefault: true,
			wSync: true,
		},
		opacityControl: {
			wValue: 0.8,
			wUseDefault: true,
			wSync: true,
		},
		opacityTerm: {
			wValue: 0.86,
			wUseDefault: true,
			wSync: true,
		},
		borderRadius: {
			wValue: "4px",
			wUseDefault: true,
			wSync: true,
		},
	},
	highlightMethod: {
		paintReplaceByClassic: {
			wValue: true,
			wSync: false,
		},
		paintUseExperimental: {
			wValue: false,
			wUseDefault: true,
			wSync: false,
		},
		hues: {
			wValue: [ 300, 60, 110, 220, 30, 190, 0 ],
			wUseDefault: true,
			wSync: true,
		},
	},
	urlFilters: {
		noPageModify: {
			wValue: [],
			wInlist: [],
			wOutlist: [],
			wSync: true
		},
		nonSearch: {
			wValue: [],
			wInlist: [],
			wOutlist: [],
			wSync: true,
		},
	},
	termLists: {
		wValue: [],
		wSync: true,
	},
};

/**
 * The working cache of items retrieved from the volatile bank since the last background startup.
 */
const bankCache: Partial<BankValues> = {};

/**
 * The working cache of items retrieved from the persistent config since the last background startup.
 */
const configCache: Partial<ConfigValues> = {};

/**
 * Gets an object of key-value pairs corresponding to a set of keys in the given area of storage.
 * Storage may be fetched asynchronously or immediately retrieved from a cache.
 * @param area The name of the storage area from which to retrieve values.
 * @param keys The keys corresponding to the entries to retrieve.
 * @returns A promise resolving to an object of storage entries.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
//const storageGet = async <Area extends StorageAreaName>(area: Area, keys?: Array<StorageArea<Area>>):
//	Promise<StorageAreaValues<Area>> =>
//{
//	if (keys && keys.every(key => storageCache[area][key as string] !== undefined)) {
//		return { ...storageCache[area] } as StorageAreaValues<Area>;
//	}
//	const store = await chrome.storage[area].get(keys) as StorageAreaValues<Area>;
//	const storeAsSession = store as StorageAreaValues<"session">;
//	if (storeAsSession.engines) {
//		const engines = storeAsSession.engines as Engines;
//		Object.keys(engines).forEach(id => engines[id] = Object.assign(new Engine, engines[id]));
//	}
//	Object.entries(store).forEach(([ key, value ]) => {
//		storageCache[area][key] = value;
//	});
//	return { ...store };
//};

const bankSet = async(bank: Partial<BankValues>) => {
	Object.entries(bank).forEach(([ key, value ]) => {
		bankCache[key] = value;
	});
	await chrome.storage.session.set(bank);
};

const bankGet = async (keys: Array<BankKey>): Promise<BankValues> => {
	return {} as BankValues;
};

const configSet = async(config: Partial<ConfigValues>) => {
	//
};

const configGet = async (keys: Array<ConfigKey>): Promise<ConfigValues> => {
	if (keys && keys.every(key => configCache[key] !== undefined)) {
		return { ...configCache } as ConfigValues;
	}
	const getLocal = chrome.storage.local.get(keys) as Promise<Partial<ConfigValues>>;
	const getSync = chrome.storage.sync.get(keys) as Promise<Partial<ConfigValues>>;
	const configLocal = await getLocal;
	const configSync = await getSync;
	const config: Partial<ConfigValues> = {};
	keys.forEach(key1 => {
		const config1Wrapper = configWrappers[key1];
		const config1Local = configLocal[key1];
		const config1Sync = configSync[key1];
		if (config1Wrapper.wValue) {
			const setupW = config1Wrapper as StorageValueWrapped<any>;
			config[key1] = setupW.wSync ? config1Sync : config1Local;
		} else {
			config[key1] = {};
			Object.keys(config1Wrapper).forEach(key2 => {
				const config2Wrapper = config1Wrapper[key2] as StorageValueWrapped<any>;
				config[key1][key2] = config2Wrapper.wSync ? config1Sync[key2] : config1Local[key2];
			});
		}
	});
	Object.keys(config).forEach(key => {
		configCache[key] = config[key];
	});
	return { ...config } as ConfigValues;
};

const storageSet = async <Area extends StorageAreaName>(area: Area, store: StorageAreaValues<Area>) => {
	Object.entries(store).forEach(([ key, value ]) => {
		storageCache[area][key] = value;
	});
	await chrome.storage[area].set(store);
};

/**
 * Sets internal storage to its default working values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const storageInitialize = async () => {
	//const local = await storageGet("local");
	//const localOld = { ...local };
	//const toRemove: Array<string> = [];
	//if (objectFixWithDefaults(local, {
	//	enabled: true,
	//	persistResearchInstances: true,
	//} as ConfigValues, toRemove)) {
	//	console.warn("Storage 'local' cleanup rectified issues. Results:", localOld, local); // Use standard logging system?
	//}
	//await configSet(local);
	//if (chrome.storage["session"]) { // Temporary fix. Without the 'session' API, its values may be stored in 'local'.
	//	await chrome.storage.local.remove(toRemove);
	//}
	//await bankSet({
	//	researchInstances: {},
	//	engines: {},
	//});
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
const objectFixWithDefaults = (
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
			if (objectFixWithDefaults(
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
const optionsRepair = async () => {
	//const sync = await storageGet("sync");
	//const syncOld = { ...sync };
	//const toRemove = [];
	//if (objectFixWithDefaults(sync, configValues, toRemove)) {
	//	console.warn("Storage 'sync' cleanup rectified issues. Results:", syncOld, sync); // Use standard logging system?
	//}
	//configSet(sync);
	//await chrome.storage.sync.remove(toRemove);
};

chrome.storage.onChanged.addListener((changes, areaName) => {
	// TODO check that the change was not initiated from the same script
	//if ([ "researchInstances", "engines" ].some(key => changes[key])) {
	//	areaName = "session";
	//}
	switch (areaName) {
	case "session": {
		Object.entries(changes).forEach(([ key, value ]) => {
			bankCache[areaName][key] = value.newValue;
		});
		break;
	} case "local":
	case "sync": {
		Object.entries(changes).forEach(([ key, value ]) => {
			configCache[areaName][key] = value.newValue;
		});
		break;
	}}
});

/*const updateCache = (changes: Record<string, chrome.storage.StorageChange>, areaName: StorageAreaName | "managed") => {
	if (areaName === "managed") {
		return;
	}
	if ([ "researchInstances", "engines" ].some(key => changes[key])) {
		areaName = "session";
	}
	Object.entries(changes).forEach(([ key, value ]) => {
		storageCache[areaName][key] = value.newValue;
	});
};

chrome.storage.onChanged.addListener(updateCache);

(() => {
	Object.keys(storageCache).forEach(async (areaName: StorageAreaName) => {
		const area = await chrome.storage[areaName].get();
		const areaChange: Record<string, chrome.storage.StorageChange> = {};
		Object.keys(area).forEach(key => {
			areaChange[key] = { oldValue: area[key], newValue: area[key] };
		});
		updateCache(areaChange, areaName);
	});
})();*/
