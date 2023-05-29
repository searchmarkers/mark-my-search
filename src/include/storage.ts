chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;
chrome.storage.session ??= chrome.storage.local;

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type BankValues = {
	[BankKey.RESEARCH_INSTANCES]: ResearchInstances
	[BankKey.ENGINES]: Engines
}
type StorageValue<T, Wrapped = true, Meta = false> = Wrapped extends true
	? (Meta extends true
		? {
			wValue: T
			sync: boolean
		} : {
			wValue: T
		}
	) : T
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
			diacritics: true,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bankSet = async (bank: Partial<BankValues>) => {
	Object.entries(bank).forEach(([ key, value ]) => {
		bankCache[key] = value;
	});
	await chrome.storage.session.set(bank);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const bankGet = async (keys: Array<BankKey>): Promise<BankValues> => {
	// TODO investigate flattening storage of research instances (one level)
	const bank = await (chrome.storage.session
		? chrome.storage.session.get(keys)
		: chrome.storage.local.get(keys)) as BankValues;
	keys.forEach(key => {
		if (!(key in bank) || bank[key] === undefined) {
			bank[key] = {};
		}
	});
	return bank;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configSet = async (config: Partial<ConfigValues>) => {
	await configCachePopulate(Object.keys(config) as Array<ConfigKey>);
	const configWrappedLocal: Partial<ConfigValues<true>> = {};
	const configWrappedSync: Partial<ConfigValues<true>> = {};
	Object.keys(config).forEach(key1 => {
		if ((configDefault[key1] as StorageValue<unknown, true, true>).wValue !== undefined) {
			const config1WrappedDefault = configDefault[key1] as StorageValue<true>;
			if (typeof config[key1] !== typeof config1WrappedDefault.wValue) {
				config[key1] = config1WrappedDefault.wValue;
				console.log("mismatched type", config[key1], key1);
			}
			configCache[key1].wValue = config[key1];
			if (configCacheKeysLocal.has(key1)) {
				configWrappedLocal[key1] = configCache[key1];
			} else if (configCacheKeysSync.has(key1)) {
				configWrappedSync[key1] = configCache[key1];
			}
		} else {
			if (typeof config[key1] !== "object") {
				config[key1] = {};
				console.log("mismatched type", config[key1], key1);
			}
			const config1WrappedDefault = configDefault[key1] as Record<string, StorageValue<unknown, true, true>>;
			configWrappedLocal[key1] ??= {};
			configWrappedSync[key1] ??= {};
			Object.keys(config1WrappedDefault).forEach(key2 => {
				if (typeof config[key1][key2] !== typeof config1WrappedDefault[key2].wValue) {
					config[key1][key2] = config1WrappedDefault[key2].wValue;
					console.log("mismatched type", config[key1][key2], key1, key2);
				}
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
	await setLocal;
	await setSync;
};

const configCachePopulate = async (keys: Array<ConfigKey>) => {
	// TODO flatten storage AT LEAST one level, e.g. {key1}_{key2} where key1.key2 maps to a wrapped value
	keys = keys.filter(key1 => (configDefault[key1] as StorageValue<unknown, true, true>).wValue !== undefined
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
	keys.forEach(key1 => {
		if ((configDefault[key1] as StorageValue<unknown, true, true>).wValue !== undefined) {
			const configWrapped1Default = configDefault[key1] as StorageValue<unknown, true, true>;
			const configWrapped1Local = (configWrappedLocal[key1] as StorageValue<unknown> | undefined)?.wValue
				? (configWrappedLocal[key1] as StorageValue<unknown>)
				: undefined;
			const configWrapped1Sync = (configWrappedSync[key1] as StorageValue<unknown> | undefined)?.wValue
				? (configWrappedLocal[key1] as StorageValue<unknown>)
				: undefined;
			(configCache[key1] as StorageValue<unknown>) = {
				wValue: configWrapped1Local?.wValue ?? configWrapped1Sync?.wValue ?? configWrapped1Default.wValue,
			};
			if (configWrapped1Local?.wValue) {
				if (typeof configWrapped1Local.wValue !== typeof configWrapped1Default.wValue) {
					(configCache[key1] as StorageValue<unknown>).wValue = configWrapped1Default.wValue;
					(configWrappedLocalAdd[key1] as StorageValue<unknown>) = {
						wValue: configWrapped1Default.wValue,
					};
					configCacheKeysLocal.add(key1);
				}
				configCacheKeysLocal.add(key1);
			} else if (configWrapped1Sync?.wValue) {
				if (typeof configWrapped1Sync.wValue !== typeof configWrapped1Default.wValue) {
					(configCache[key1] as StorageValue<unknown>).wValue = configWrapped1Default.wValue;
					(configWrappedSyncAdd[key1] as StorageValue<unknown>) = {
						wValue: configWrapped1Default.wValue,
					};
					configCacheKeysSync.add(key1);
				}
				configCacheKeysSync.add(key1);
			} else {
				if (configWrapped1Default.sync) {
					(configWrappedSyncAdd[key1] as StorageValue<unknown>) = {
						wValue: configWrapped1Default.wValue,
					};
					configCacheKeysSync.add(key1);
				} else {
					(configWrappedLocalAdd[key1] as StorageValue<unknown>) = {
						wValue: configWrapped1Default.wValue,
					};
					configCacheKeysLocal.add(key1);
				}
			}
		} else {
			const configWrapped1Default = configDefault[key1] as Record<string, StorageValue<unknown, true, true>>;
			const configWrapped1Local = (configWrappedLocal[key1] ?? {}) as Record<string, StorageValue<unknown>>;
			const configWrapped1Sync = (configWrappedSync[key1] ?? {}) as Record<string, StorageValue<unknown>>;
			const configWrapped1LocalAdd = {} as Record<string, StorageValue<unknown>>;
			const configWrapped1SyncAdd = {} as Record<string, StorageValue<unknown>>;
			(configWrappedLocalAdd[key1] as typeof configWrapped1LocalAdd) = configWrapped1LocalAdd;
			(configWrappedSyncAdd[key1] as typeof configWrapped1SyncAdd) = configWrapped1SyncAdd;
			const configCache1 = (configCache[key1] ?? {}) as Record<string, StorageValue<unknown>>;
			(configCache[key1] as typeof configCache1) = configCache1;
			let addLocal = false;
			let addSync = false;
			Object.keys(configWrapped1Default).forEach(key2 => {
				const configWrapped2Default = configWrapped1Default[key2];
				const configWrapped2Local = (configWrapped1Local[key2] as StorageValue<unknown> | undefined)?.wValue !== undefined
					? configWrapped1Local[key2]
					: undefined;
				const configWrapped2Sync = (configWrapped1Sync[key2] as StorageValue<unknown> | undefined)?.wValue !== undefined
					? configWrapped1Sync[key2]
					: undefined;
				configCache1[key2] = {
					wValue: configWrapped2Local?.wValue ?? configWrapped2Sync?.wValue ?? configWrapped2Default.wValue,
				};
				const key2Full = `${key1}_${key2}`;
				if (configWrapped2Local?.wValue) {
					if (typeof configWrapped2Local.wValue !== typeof configWrapped2Default.wValue) { // TODO make function
						addLocal = true;
						configWrapped1LocalAdd[key2] = {
							wValue: configWrapped2Default.wValue,
						};
						configCacheKeysLocal.add(key2Full);
					}
					configCacheKeysLocal.add(key2Full);
				} else if (configWrapped2Sync?.wValue) {
					if (typeof configWrapped2Sync.wValue !== typeof configWrapped2Default.wValue) { // TODO make function
						addSync = true;
						configWrapped1SyncAdd[key2] = {
							wValue: configWrapped2Default.wValue,
						};
						configCacheKeysSync.add(key2Full);
					}
					configCacheKeysSync.add(key2Full);
				} else {
					if (configWrapped2Default.sync) {
						addSync = true;
						configWrapped1SyncAdd[key2] = {
							wValue: configWrapped2Default.wValue,
						};
						configCacheKeysSync.add(key2Full);
					} else {
						addLocal = true;
						configWrapped1LocalAdd[key2] = {
							wValue: configWrapped2Default.wValue,
						};
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
	//const setLocal = Object.keys(configWrappedLocalAdd).length ? chrome.storage.local.set(configWrappedLocalAdd) : undefined;
	//const setSync = Object.keys(configWrappedSyncAdd).length ? chrome.storage.sync.set(configWrappedSyncAdd) : undefined;
	//await setLocal;
	//await setSync;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGet = async <T extends ConfigKey>(keys: Array<T>): Promise<{ [P in T]: ConfigValues[P] }> => {
	await configCachePopulate(keys);
	const config = {} as { [P in T]: ConfigValues[P] };
	keys.forEach(key1 => {
		if ((configDefault[key1] as StorageValue<unknown, true, true>).wValue !== undefined) {
			(config[key1] as StorageValue<unknown, false>) = (configCache[key1] as StorageValue<unknown>).wValue;
		} else {
			const config1 = {} as Record<string, StorageValue<unknown, false>>;
			(config[key1] as typeof config1) = config1;
			Object.keys(configDefault[key1]).forEach(key2 => {
				config1[key2] = (configCache[key1] as Record<string, StorageValue<unknown>>)[key2].wValue;
			});
		}
	});
	return config;
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
		console.log(changes);
		Object.keys(changes).forEach(key1 => {
			if (configDefault[key1].wValue) {
				if (changes[key1].newValue?.wValue !== undefined) {
					(configCache[key1] as StorageValue<unknown>) = {
						wValue: changes[key1].newValue.wValue,
					};
					keyCacheThis.add(key1);
					keyCacheOther.delete(key1);
				}
			} else {
				configCache[key1] ??= {};
				Object.keys(changes[key1].newValue ?? {}).forEach(key2 => {
					if (changes[key1].newValue[key2]?.wValue !== undefined) {
						(configCache[key1][key2] as StorageValue<unknown>) = {
							wValue: changes[key1].newValue[key2].wValue,
						};
						const key2Full = `${key1}_${key2}`;
						keyCacheThis.add(key2Full);
						keyCacheOther.delete(key2Full);
					}
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
