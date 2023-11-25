chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;

enum StorageContext {
	SCHEMA,
	STORE,
	INTERFACE,
}

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, Engine>
type BankValues = {
	[BankKey.RESEARCH_INSTANCES]: ResearchInstances
	[BankKey.ENGINES]: Engines
}
type StorageValue<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? {
	w_value: T
	useDefault?: true
	sync?: true
} : Context extends StorageContext.STORE ? {
	w_value: T
} : T
type StorageListValue<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? {
	listBase: Array<T>
	sync?: true
} : Context extends StorageContext.STORE ? {
	w_listIn: Array<T>
	w_listOut: Array<T>
} : {
	listBase: Array<T>
	w_listIn: Array<T>
	w_listOut: Array<T>
}
type ConfigBarControlsShown<Context = StorageContext.INTERFACE> = {
	toggleBarCollapsed: StorageValue<boolean, Context>
	disableTabResearch: StorageValue<boolean, Context>
	performSearch: StorageValue<boolean, Context>
	toggleHighlights: StorageValue<boolean, Context>
	appendTerm: StorageValue<boolean, Context>
	replaceTerms: StorageValue<boolean, Context>
}
type ConfigBarLook<Context = StorageContext.INTERFACE> = {
	showEditIcon: StorageValue<boolean, Context>
	showRevealIcon: StorageValue<boolean, Context>
	fontSize: StorageValue<string, Context>
	opacityControl: StorageValue<number, Context>
	opacityTerm: StorageValue<number, Context>
	borderRadius: StorageValue<string, Context>
}
type ConfigHighlightMethod<Context = StorageContext.INTERFACE> = {
	paintReplaceByClassic: StorageValue<boolean, Context>
	paintUseExperimental: StorageValue<boolean, Context>
	hues: StorageValue<Array<number>, Context>
}
type ConfigURLFilters<Context = StorageContext.INTERFACE> = {
	noPageModify: StorageListValue<URLFilter[number], Context>
	nonSearch: StorageListValue<URLFilter[number], Context>
}
type ConfigGroup<Context = StorageContext.INTERFACE> = Record<string,
	StorageValue<unknown, Context> | StorageListValue<unknown, Context>
>
type ConfigValues<Context = StorageContext.INTERFACE> = {
	[ConfigKey.THEME]: {
		edition: StorageValue<ThemeEdition, Context>
		variant: StorageValue<ThemeVariant, Context>
		hue: StorageValue<number, Context>
		contrast: StorageValue<number, Context>
		lightness: StorageValue<number, Context>
		saturation: StorageValue<number, Context>
		fontScale: StorageValue<number, Context>
	}
	[ConfigKey.RESEARCH_INSTANCE_OPTIONS]: {
		restoreLastInTab: StorageValue<boolean, Context>
	}
	[ConfigKey.AUTO_FIND_OPTIONS]: {
		enabled: StorageValue<boolean, Context>
		stoplist: StorageListValue<string, Context>
		searchParams: StorageListValue<string, Context>
	}
	[ConfigKey.MATCHING_DEFAULTS]: {
		matchMode: StorageValue<MatchMode, Context>
	}
	[ConfigKey.SHOW_HIGHLIGHTS]: {
		default: StorageValue<boolean, Context>
		overrideSearchPages: StorageValue<boolean, Context>
		overrideResearchPages: StorageValue<boolean, Context>
	}
	[ConfigKey.BAR_COLLAPSE]: {
		fromSearch: StorageValue<boolean, Context>
		fromTermListAuto: StorageValue<boolean, Context>
	}
	[ConfigKey.BAR_CONTROLS_SHOWN]: ConfigBarControlsShown<Context>
	[ConfigKey.BAR_LOOK]: ConfigBarLook<Context>
	[ConfigKey.HIGHLIGHT_METHOD]: ConfigHighlightMethod<Context>
	[ConfigKey.URL_FILTERS]: ConfigURLFilters<Context>
	[ConfigKey.TERM_LIST_OPTIONS]: {
		termLists: StorageValue<Array<TermList>, Context>
	}
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

enum BankKey {
	RESEARCH_INSTANCES = "researchInstances",
	ENGINES = "engines",
}

enum ConfigKey {
	THEME = "theme",
	RESEARCH_INSTANCE_OPTIONS = "researchInstanceOptions",
	AUTO_FIND_OPTIONS = "autoFindOptions",
	MATCHING_DEFAULTS = "matchingDefaults",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_COLLAPSE = "barCollapse",
	BAR_CONTROLS_SHOWN = "barControlsShown",
	BAR_LOOK = "barLook",
	HIGHLIGHT_METHOD = "highlightMethod",
	URL_FILTERS = "urlFilters",
	TERM_LIST_OPTIONS = "termListOptions",
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configResolveList = <T>(listValue: StorageListValue<T, StorageContext.INTERFACE>): Array<T> =>
	listValue.listBase.filter(value => !listValue.w_listOut.includes(value)).concat(listValue.w_listIn)
;

/**
 * The default options to be used for items missing from storage, or to which items may be reset.
 * Set to sensible values for a generic first-time user of the extension.
 */
const configDefault: ConfigValues<StorageContext.SCHEMA> = {
	theme: {
		edition: { w_value: ThemeEdition.CLASSIC },
		variant: { w_value: ThemeVariant.DARK },
		hue: { w_value: 284, useDefault: true },
		contrast: { w_value: 1 },
		lightness: { w_value: 1 },
		saturation: { w_value: 1 },
		fontScale: { w_value: 1 },
	},
	researchInstanceOptions: {
		restoreLastInTab: { w_value: true },
	},
	autoFindOptions: {
		enabled: { w_value: true },
		// TODO allow specifying mappings of params to URL filters and whether the filter should be inverted?
		searchParams: {
			listBase: [ // Order of specificity, as only the first match will be used.
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
			sync: true,
		},
		stoplist: {
			listBase: [
				"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
				"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's", "you", "your", "yours",
			],
			sync: true,
		},
	},
	matchingDefaults: {
		matchMode: {
			w_value: {
				regex: false,
				case: false,
				stem: true,
				whole: false,
				diacritics: true,
			},
			useDefault: true,
		},
	},
	showHighlights: {
		default: { w_value: true, sync: true },
		overrideSearchPages: { w_value: false, sync: true },
		overrideResearchPages: { w_value: false, sync: true },
	},
	barCollapse: {
		fromSearch: { w_value: false, sync: true },
		fromTermListAuto: { w_value: false, sync: true },
	},
	barControlsShown: {
		toggleBarCollapsed: { w_value: true, sync: true },
		disableTabResearch: { w_value: true, sync: true },
		performSearch: { w_value: false, sync: true },
		toggleHighlights: { w_value: true, sync: true },
		appendTerm: { w_value: true, sync: true },
		replaceTerms: { w_value: true, sync: true },
	},
	barLook: {
		showEditIcon: { w_value: true, sync: true },
		showRevealIcon: { w_value: true, sync: true },
		fontSize: { w_value: "14.6px", useDefault: true, sync: true },
		opacityControl: { w_value: 0.8, useDefault: true, sync: true },
		opacityTerm: { w_value: 0.86, useDefault: true, sync: true },
		borderRadius: { w_value: "4px", useDefault: true, sync: true },
	},
	highlightMethod: {
		paintReplaceByClassic: { w_value: true },
		paintUseExperimental: { w_value: false, useDefault: true },
		hues: {
			w_value: [ 300, 60, 110, 220, 30, 190, 0 ],
			useDefault: true,
			sync: true,
		},
	},
	urlFilters: {
		noPageModify: {
			listBase: [],
			sync: true
		},
		nonSearch: {
			listBase: [],
			sync: true,
		},
	},
	termListOptions: {
		termLists: {
			w_value: [],
			sync: true,
		},
	},
};

/**
 * The working cache of items retrieved from the volatile bank since the last background startup.
 */
const bankCache: Partial<BankValues> = {};
const bankDefault: BankValues = {
	researchInstances: [],
	engines: {},
};

/**
 * The working cache of items retrieved from the persistent config since the last background startup.
 */
const configCache: Partial<ConfigValues<StorageContext.STORE>> = {};

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
const bankGet = async <T extends BankKey>(keys: Array<T>): Promise<{ [P in T]: BankValues[P] }> => {
	// TODO investigate flattening storage of research instances (one level)
	const bank = {} as { [P in T]: BankValues[P] };
	const keysToGet: Array<BankKey> = keys.filter(key => {
		if (bankCache[key] !== undefined) {
			bank[key] = bankCache[key] as BankValues[T];
			return false;
		}
		return true;
	});
	chrome.storage.session.get(keysToGet).then((bankStore: BankValues) => {
		keysToGet.forEach(<K extends BankKey>(key: K) => {
			bankCache[key] = bankStore[key] ?? bankDefault[key];
		});
	});
	return bank;
};

type ConfigAreaName = "local" | "sync"

const configAreaNames: Array<ConfigAreaName> = [ "local", "sync" ];
const configValueGetAreaName = (sync?: boolean): ConfigAreaName => sync ? "sync" : "local";

// NOTE: need to consider how to deal with timings as "local" and "sync" are set separately; default value considerations etc.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configSet = async (config: Partial<ConfigValues>) => {
	const storageSends: Record<ConfigAreaName, Array<ConfigKey>> = { local: [], sync: [] };
	const storageFetchSends: Record<ConfigAreaName, Array<ConfigKey>> = { local: [], sync: [] };
	Object.entries(config).forEach(([ configKey, configGroup ]: [ ConfigKey, ConfigValues[ConfigKey] ]) => {
		const configGroupDefault = configDefault[configKey] as ConfigGroup<StorageContext.SCHEMA>;
		if (!assert(typeof configGroupDefault !== "object", "config group could not be set", "config key is invalid", { configKey }))
			return;
		const configGroupCache = ((configCache[configKey] as unknown)
			??= {}) as Partial<ConfigValues<StorageContext.STORE>[ConfigKey]>;
		Object.entries(configGroup).forEach(([ key, value ]) => {
			const configValueDefault = configGroupDefault[key];
			if (!assert(typeof configValueDefault !== "object", "config value could not be set", "key is invalid", { key }))
				return;
			configGroupCache[key] = value;
		});
		configAreaNames.forEach(areaName => {
			(Object.entries(configGroupDefault).some(([ key, valueDefault ]) =>
				configValueGetAreaName(valueDefault.sync) === areaName && configGroupCache[key] !== undefined
			) ? storageFetchSends : storageSends)[areaName].push(configKey);
		});
	});
	const storageOperations = Object.entries(storageFetchSends)
		.filter(({ 1: areaFetches }) => Object.keys(areaFetches).length)
		.map(([ areaName, areaFetches ]: [ ConfigAreaName, Array<ConfigKey> ]) =>
			chrome.storage[areaName].get(Object.keys(areaFetches)).then(configGroup => {
				// TODO needs plenty of safeguards
				//Object.entries(configGroup).forEach(([ key, value ]) => {

				//})
				//storageOperations.push(chrome.storage[areaName].set());
			})
		).concat(Object.entries(storageSends)
			.filter(({ 1: areaFetches }) => Object.keys(areaFetches).length)
			.map(([ areaName, areaFetches ]: [ ConfigAreaName, Array<ConfigKey> ]) =>
				chrome.storage[areaName].set(Object.keys(areaFetches))
			)
		);
	for (const promise of storageOperations) await promise;
};

/*const configGet = async <T extends ConfigKey>(keys: Array<T>): Promise<{ [P in T]: ConfigValues[P] }> => {
	await configCachePopulate(keys);
	const config = {} as { [P in T]: ConfigValues[P] };
	keys.forEach(key1 => {
		if ((configDefault[key1] as StorageValue<unknown, true, true>).w_value !== undefined) {
			(config[key1] as StorageValue<unknown, false>) = (configCache[key1] as StorageValue<unknown>).w_value;
		} else {
			const config1 = {} as Record<string, StorageValue<unknown, false>>;
			(config[key1] as typeof config1) = config1;
			Object.keys(configDefault[key1]).forEach(key2 => {
				config1[key2] = (configCache[key1] as Record<string, StorageValue<unknown>>)[key2].w_value;
			});
		}
	});
	return config;
};*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGet = async <T extends ConfigKey>(keys: Array<T>): Promise<{ [P in T]: ConfigValues[P] }> =>
	Object.fromEntries(keys.map(configKey =>
		[ configKey, Object.fromEntries(Object.entries(configDefault[configKey] as ConfigGroup)
			.map(([ key, valueDefault ]: [ string, Record<string, unknown> ]) =>
				[ key, ("w_value" in valueDefault) ? valueDefault.w_value : { listBase: valueDefault.listBase, w_listIn: [], w_listOut: [] } ]
			)
		) ]
	)) as { [P in T]: ConfigValues[P] }
;

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

chrome.storage.onChanged.addListener((changes, areaName) => {
	// TODO check that the change was not initiated from the same script
	switch (areaName) {
	case "session": {
		Object.entries(changes).forEach(([ key, value ]) => {
			bankCache[key] = value.newValue;
		});
		break;
	} case "local":
	case "sync": {
		const [ keyCache, keyCacheOther ] = areaName === "local"
			? [ configCacheKeysLocal, configCacheKeysSync ]
			: [ configCacheKeysSync, configCacheKeysLocal ];
		console.log(changes);
		Object.keys(changes).forEach(key1 => {
			if (configDefault[key1].w_value) {
				if (changes[key1].newValue?.w_value !== undefined) {
					(configCache[key1] as StorageValue<unknown>) = {
						w_value: changes[key1].newValue.w_value,
					};
					keyCache.add(key1);
					keyCacheOther.delete(key1);
				}
			} else {
				configCache[key1] ??= {};
				Object.keys(changes[key1].newValue ?? {}).forEach(key2 => {
					if (changes[key1].newValue[key2]?.w_value !== undefined) {
						(configCache[key1][key2] as StorageValue<unknown>) = {
							w_value: changes[key1].newValue[key2].w_value,
						};
						const key2Full = `${key1}_${key2}`;
						keyCache.add(key2Full);
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
