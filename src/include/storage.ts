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
type StorageValue<T, Wrapped = true, Meta = false> = Wrapped extends true ? {
	wValue: T // TODO replace "w" members with another wrapper object (light enough?)
	sync: Meta extends true ? boolean : undefined
} : T
type StorageValueWithDefault<T, Wrapped = true, Meta = false> = (Wrapped extends true ? {
	wUseDefault: boolean
} : T) & StorageValue<T, Wrapped, Meta>
type StorageArray<T, Wrapped = true, Meta = false> = (Wrapped extends true ? {
	list: T
	wOutlist: T
} : T) & StorageValue<T, Wrapped, Meta>
type ConfigBarControlsShown<Wrapped = false, Meta = false> = {
	toggleBarCollapsed: StorageValue<boolean, Wrapped, Meta>
	disableTabResearch: StorageValue<boolean, Wrapped, Meta>
	performSearch: StorageValue<boolean, Wrapped, Meta>
	toggleHighlights: StorageValue<boolean, Wrapped, Meta>
	appendTerm: StorageValue<boolean, Wrapped, Meta>
	replaceTerms: StorageValue<boolean, Wrapped, Meta>
}
type ConfigBarLook<Wrapped = false, Meta = false> = {
	showEditIcon: StorageValue<boolean, Wrapped, Meta>
	showRevealIcon: StorageValue<boolean, Wrapped, Meta>
	fontSize: StorageValueWithDefault<string, Wrapped, Meta>
	opacityControl: StorageValueWithDefault<number, Wrapped, Meta>
	opacityTerm: StorageValueWithDefault<number, Wrapped, Meta>
	borderRadius: StorageValueWithDefault<string, Wrapped, Meta>
}
type ConfigHighlightMethod<Wrapped = false, Meta = false> = {
	paintReplaceByClassic: StorageValue<boolean, Wrapped, Meta>
	paintUseExperimental: StorageValueWithDefault<boolean, Wrapped, Meta>
	hues: StorageValueWithDefault<Array<number>, Wrapped, Meta>
}
type ConfigURLFilters<Wrapped = false, Meta = false> = {
	noPageModify: StorageArray<URLFilter, Wrapped, Meta>
	nonSearch: StorageArray<URLFilter, Wrapped, Meta>
}
type ConfigValues<Wrapped = false, Meta = false> = {
	[ConfigKey.THEME]: {
		edition: StorageValueWithDefault<ThemeEdition, Wrapped, Meta>
		variant: StorageValueWithDefault<ThemeVariant, Wrapped, Meta>
		hue: StorageValueWithDefault<number, Wrapped, Meta>
		contrast: StorageValue<number, Wrapped, Meta>
		lightness: StorageValue<number, Wrapped, Meta>
		saturation: StorageValue<number, Wrapped, Meta>
		fontScale: StorageValue<number, Wrapped, Meta>
	}
	[ConfigKey.RESEARCH_INSTANCE_OPTIONS]: {
		restoreLastInTab: StorageValue<boolean, Wrapped, Meta>
	}
	[ConfigKey.AUTO_FIND_OPTIONS]: {
		enabled: StorageValue<boolean, Wrapped, Meta>
		stoplist: StorageArray<Array<string>, Wrapped, Meta>
		searchParams: StorageArray<Array<string>, Wrapped, Meta>
	}
	[ConfigKey.MATCH_MODE_DEFAULTS]: StorageValueWithDefault<MatchMode, Wrapped, Meta>
	[ConfigKey.SHOW_HIGHLIGHTS]: {
		default: StorageValue<boolean, Wrapped, Meta>
		overrideSearchPages: StorageValue<boolean, Wrapped, Meta>
		overrideResearchPages: StorageValue<boolean, Wrapped, Meta>
	}
	[ConfigKey.BAR_COLLAPSE]: {
		fromSearch: StorageValue<boolean, Wrapped, Meta>
		fromTermListAuto: StorageValue<boolean, Wrapped, Meta>
	}
	[ConfigKey.BAR_CONTROLS_SHOWN]: ConfigBarControlsShown<Wrapped, Meta>
	[ConfigKey.BAR_LOOK]: ConfigBarLook<Wrapped, Meta>
	[ConfigKey.HIGHLIGHT_METHOD]: ConfigHighlightMethod<Wrapped, Meta>
	[ConfigKey.URL_FILTERS]: ConfigURLFilters<Wrapped, Meta>
	[ConfigKey.TERM_LISTS]: StorageValue<Array<TermList>, Wrapped, Meta>
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
	THEME = "theme",
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

enum ThemeEdition {
	CLASSIC = "classic",
}

enum ThemeVariant {
	DARK = "dark",
	LIGHT = "light",
	AUTO = "auto",
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
const configDefault: ConfigValues<true, true> = {
	theme: {
		edition: {
			wValue: ThemeEdition.CLASSIC,
			wUseDefault: false,
			sync: false,
		},
		variant: {
			wValue: ThemeVariant.DARK,
			wUseDefault: true,
			sync: false,
		},
		hue: {
			wValue: 284,
			wUseDefault: true,
			sync: true,
		},
		contrast: {
			wValue: 1,
			sync: true,
		},
		lightness: {
			wValue: 1,
			sync: true,
		},
		saturation: {
			wValue: 1,
			sync: true,
		},
		fontScale: {
			wValue: 1,
			sync: false,
		},
	},
	researchInstanceOptions: {
		restoreLastInTab: {
			wValue: true,
			sync: false,
		},
	},
	autoFindOptions: {
		enabled: {
			wValue: true,
			sync: false,
		},
		searchParams: {
			list: [ // Order of specificity, as only the first match will be used.
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
			wValue: [],
			wOutlist: [],
			sync: true,
		},
		stoplist: {
			list: [
				"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
				"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's", "you", "your", "yours",
			],
			wValue: [],
			wOutlist: [],
			sync: true,
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
		sync: false,
	},
	showHighlights: {
		default: {
			wValue: true,
			sync: true,
		},
		overrideSearchPages: {
			wValue: false,
			sync: true,
		},
		overrideResearchPages: {
			wValue: false,
			sync: true,
		},
	},
	barCollapse: {
		fromSearch: {
			wValue: false,
			sync: true,
		},
		fromTermListAuto: {
			wValue: false,
			sync: true,
		},
	},
	barControlsShown: {
		toggleBarCollapsed: {
			wValue: true,
			sync: true,
		},
		disableTabResearch: {
			wValue: true,
			sync: true,
		},
		performSearch: {
			wValue: false,
			sync: true,
		},
		toggleHighlights: {
			wValue: true,
			sync: true,
		},
		appendTerm: {
			wValue: true,
			sync: true,
		},
		replaceTerms: {
			wValue: true,
			sync: true,
		},
	},
	barLook: {
		showEditIcon: {
			wValue: true,
			sync: true,
		},
		showRevealIcon: {
			wValue: true,
			sync: true,
		},
		fontSize: {
			wValue: "14.6px",
			wUseDefault: true,
			sync: true,
		},
		opacityControl: {
			wValue: 0.8,
			wUseDefault: true,
			sync: true,
		},
		opacityTerm: {
			wValue: 0.86,
			wUseDefault: true,
			sync: true,
		},
		borderRadius: {
			wValue: "4px",
			wUseDefault: true,
			sync: true,
		},
	},
	highlightMethod: {
		paintReplaceByClassic: {
			wValue: true,
			sync: false,
		},
		paintUseExperimental: {
			wValue: false,
			wUseDefault: true,
			sync: false,
		},
		hues: {
			wValue: [ 300, 60, 110, 220, 30, 190, 0 ],
			wUseDefault: true,
			sync: true,
		},
	},
	urlFilters: {
		noPageModify: {
			list: [],
			wValue: [],
			wOutlist: [],
			sync: true
		},
		nonSearch: {
			list: [],
			wValue: [],
			wOutlist: [],
			sync: true,
		},
	},
	termLists: {
		wValue: [],
		sync: true,
	},
};

/**
 * The working cache of items retrieved from the volatile bank since the last background startup.
 */
const bankCache: Partial<BankValues> = {};

/**
 * The working cache of items retrieved from the persistent config since the last background startup.
 */
const configCache: Partial<ConfigValues<true>> = {};

const configCacheKeysLocal: Set<string> = new Set;
const configCacheKeysSync: Set<string> = new Set;

/**
 * Gets an object of key-value pairs corresponding to a set of keys in the given area of storage.
 * Storage may be fetched asynchronously or immediately retrieved from a cache.
 * @param area The name of the storage area from which to retrieve values.
 * @param keys The keys corresponding to the entries to retrieve.
 * @returns A promise resolving to an object of storage entries.
 */
//

const bankSet = async (bank: Partial<BankValues>) => {
	Object.entries(bank).forEach(([ key, value ]) => {
		bankCache[key] = value;
	});
	await chrome.storage.session.set(bank);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bankGet = async (keys: Array<BankKey>): Promise<BankValues> => {
	// TODO investigate flattening storage of research instances (one level)
	return await (chrome.storage.session ? chrome.storage.session.get(keys) : chrome.storage.local.get(keys)) as BankValues;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configSet = async (config: Partial<ConfigValues>) => {
	await configCachePopulate(Object.keys(config) as Array<ConfigKey>);
	const configWrappedLocal: Partial<ConfigValues<true>> = {};
	const configWrappedSync: Partial<ConfigValues<true>> = {};
	//Object.keys(configCache).forEach(key1 => {
	//	configCacheKeysLocal.
	//});
	Object.keys(config).forEach(key1 => {
		const config1WrappedDefault = configDefault[key1] as StorageValue<true> | Record<string, StorageValue<true>>;
		if (config1WrappedDefault.wValue !== undefined) {
			configCache[key1] ??= configDefault[key1];
			configCache[key1].wValue = config[key1];
			if (configCacheKeysLocal.has(key1)) {
				configWrappedLocal[key1] = configCache[key1];
			} else if (configCacheKeysSync.has(key1)) {
				configWrappedSync[key1] = configCache[key1];
			}
		} else {
			configWrappedLocal[key1] ??= {};
			configWrappedSync[key1] ??= {};
			Object.keys(config1WrappedDefault).forEach(key2 => {
				configCache[key1][key2] ??= configDefault[key1][key2];
				configCache[key1][key2].wValue = config[key1][key2];
				const key2Full = `${key1}_${key2}`;
				if (configCacheKeysLocal.has(key2Full)) {
					configWrappedLocal[key1][key2] = configCache[key1][key2];
				} else if (configCacheKeysSync.has(key2Full)) {
					configWrappedSync[key1][key2] = configCache[key1][key2];
				}
			});
		}
	});
	const setLocal = chrome.storage.local.set(configWrappedLocal);
	const setSync = chrome.storage.sync.set(configWrappedSync);
	//console.log("setting", configWrappedLocal, configWrappedSync);
	await setLocal;
	await setSync;
};

const configCachePopulate = async (keys: Array<ConfigKey>) => {
	// TODO flatten storage AT LEAST one level, e.g. {key1}_{key2} where key1.key2 maps to a wrapped value
	keys = keys.filter(key1 => configDefault[key1].wValue !== undefined
		? (!configCacheKeysLocal.has(key1) && !configCacheKeysSync.has(key1))
		: Object.keys(configDefault[key1]).every(key2 =>
			!configCacheKeysLocal.has(`${key1}_${key2}`) && !configCacheKeysSync.has(`${key1}_${key2}`)
		));
	if (!keys.length) {
		return;
	}
	const getLocal = chrome.storage.local.get(keys) as Promise<Partial<ConfigValues<true>>>;
	const getSync = chrome.storage.sync.get(keys) as Promise<Partial<ConfigValues<true>>>;
	const configWrappedLocal = await getLocal;
	const configWrappedSync = await getSync;
	const configWrappedLocalAdd: Partial<ConfigValues<true>> = {};
	const configWrappedSyncAdd: Partial<ConfigValues<true>> = {};
	//console.log("getting", configWrappedLocal, configWrappedSync, keys);
	keys.forEach(key1 => {
		const configWrapped1Default = configDefault[key1] as StorageValue<unknown, true, true> | Record<string, StorageValue<unknown, true, true>>;
		const configWrapped1Local = configWrappedLocal[key1] as StorageValue<unknown> | Record<string, StorageValue<unknown>> | undefined;
		const configWrapped1Sync = configWrappedSync[key1] as StorageValue<unknown> | Record<string, StorageValue<unknown>> | undefined;
		if (configWrapped1Default.wValue !== undefined) {
			configCache[key1] = (configWrapped1Local ?? configWrapped1Sync) ?? configWrapped1Default;
			if (configWrapped1Local) {
				configCacheKeysLocal.add(key1);
			} else if (configWrapped1Sync) {
				configCacheKeysSync.add(key1);
			} else {
				if (configWrapped1Default.sync) {
					configWrappedSyncAdd[key1] = configWrapped1Default;
					configCacheKeysSync.add(key1);
				} else {
					configWrappedLocalAdd[key1] = configWrapped1Default;
					configCacheKeysLocal.add(key1);
				}
			}
		} else {
			configCache[key1] ??= {};
			configWrappedLocalAdd[key1] = {};
			configWrappedSyncAdd[key1] = {};
			let addLocal = false;
			let addSync = false;
			Object.keys(configWrapped1Default).forEach(key2 => {
				const configWrapped2Default = configWrapped1Default[key2] as StorageValue<unknown, true, true>;
				const configWrapped2Local = configWrapped1Local ? configWrapped1Local[key2] as StorageValue<unknown> : undefined;
				const configWrapped2Sync = configWrapped1Sync ? configWrapped1Sync[key2] as StorageValue<unknown> : undefined;
				configCache[key1][key2] = (configWrapped2Local ?? configWrapped2Sync) ?? configWrapped2Default;
				const key2Full = `${key1}_${key2}`;
				if (configWrapped2Local) {
					configWrappedLocalAdd[key1][key2] = configWrapped2Local;
					configCacheKeysLocal.add(key2Full);
				} else if (configWrapped2Sync) {
					configWrappedSyncAdd[key1][key2] = configWrapped2Sync;
					configCacheKeysSync.add(key2Full);
				} else {
					if (configWrapped2Default.sync) {
						addSync = true;
						configWrappedSyncAdd[key1][key2] = configWrapped2Default;
						configCacheKeysSync.add(key2Full);
					} else {
						addLocal = true;
						configWrappedLocalAdd[key1][key2] = configWrapped2Default;
						configCacheKeysLocal.add(key2Full);
					}
				}
			});
			if (!addLocal) {
				delete configWrappedLocalAdd[key1];
			}
			if (!addSync) {
				delete configWrappedSyncAdd[key1];
			}
		}
	});
	if (Object.keys(configWrappedLocalAdd).length || Object.keys(configWrappedSyncAdd).length) {
		//console.log("setting defaults", configWrappedLocalAdd, configWrappedSyncAdd);
	}
	const setLocal = Object.keys(configWrappedLocalAdd).length ? chrome.storage.local.set(configWrappedLocalAdd) : undefined;
	const setSync = Object.keys(configWrappedSyncAdd).length ? chrome.storage.sync.set(configWrappedSyncAdd) : undefined;
	await setLocal;
	await setSync;
	//console.log(JSON.stringify(configCache, undefined, 1));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGet = async (keys: Array<ConfigKey>): Promise<ConfigValues> => {
	await configCachePopulate(keys);
	const config: Partial<ConfigValues> = {};
	keys.forEach(key1 => {
		if (configDefault[key1].wValue !== undefined) {
			config[key1] = configCache[key1].wValue;
		} else {
			config[key1] = {};
			Object.keys(configDefault[key1]).forEach(key2 => {
				//console.log("retrieve", key1, key2);
				config[key1][key2] = configCache[key1][key2].wValue;
			});
		}
	});
	//console.log(JSON.stringify(config));
	return config as ConfigValues;
};

/**
 * Sets internal storage to its default working values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const storageInitialize = async () => {
	await bankSet({
		researchInstances: [],
		engines: {},
	});
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
	//	researchInstances: [],
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
	[ BankKey.RESEARCH_INSTANCES, BankKey.ENGINES ].forEach(key => {
		if (changes[key] !== undefined) {
			bankCache[key] = changes[key].newValue;
			delete changes[key];
		}
	});
	switch (areaName) {
	case "session": {
		Object.entries(changes).forEach(([ key, value ]) => {
			bankCache[key] = value.newValue;
		});
		break;
	} case "local":
	case "sync": {
		const keyCacheThis = areaName === "local" ? configCacheKeysLocal : configCacheKeysSync;
		const keyCacheOther = areaName === "local" ? configCacheKeysSync : configCacheKeysLocal;
		Object.entries(changes).forEach(([ key1, value ]) => {
			if (value.newValue.wValue) {
				configCache[key1] = value.newValue;
				keyCacheThis.add(key1);
				keyCacheOther.delete(key1);
			} else {
				Object.keys(value.newValue).forEach(key2 => {
					configCache[key1][key2] = value.newValue[key2];
					const key2Full = `${key1}_${key2}`;
					keyCacheThis.add(key2Full);
					keyCacheOther.delete(key2Full);
				});
			}
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
