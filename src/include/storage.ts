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
type StorageValue<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? Readonly<{
	w_value: T
	useDefault?: true
	sync?: true
}> : Context extends StorageContext.STORE ? {
	w_value: T
} : T
type StorageListValue<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? Readonly<{
	listBase: ReadonlyArray<T>
	sync?: true
}> : Context extends StorageContext.STORE ? {
	w_listIn: Array<T>
	w_listOut: Array<T>
} : {
	listBase: ReadonlyArray<T>
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
type ConfigValue<Context = StorageContext.INTERFACE> =
	| StorageValue<unknown, Context>
	| StorageListValue<unknown, Context>
type ConfigGroup<Context = StorageContext.INTERFACE> = Record<string, ConfigValue<Context>>
type ConfigValues<Context = StorageContext.INTERFACE> = {
	theme: {
		edition: StorageValue<ThemeEdition, Context>
		variant: StorageValue<ThemeVariant, Context>
		hue: StorageValue<number, Context>
		contrast: StorageValue<number, Context>
		lightness: StorageValue<number, Context>
		saturation: StorageValue<number, Context>
		fontScale: StorageValue<number, Context>
	}
	researchInstanceOptions: {
		restoreLastInTab: StorageValue<boolean, Context>
	}
	autoFindOptions: {
		enabled: StorageValue<boolean, Context>
		stoplist: StorageListValue<string, Context>
		searchParams: StorageListValue<string, Context>
	}
	matchingDefaults: {
		matchMode: StorageValue<MatchMode, Context>
	}
	showHighlights: {
		default: StorageValue<boolean, Context>
		overrideSearchPages: StorageValue<boolean, Context>
		overrideResearchPages: StorageValue<boolean, Context>
	}
	barCollapse: {
		fromSearch: StorageValue<boolean, Context>
		fromTermListAuto: StorageValue<boolean, Context>
	}
	barControlsShown: ConfigBarControlsShown<Context>
	barLook: ConfigBarLook<Context>
	highlightMethod: ConfigHighlightMethod<Context>
	urlFilters: ConfigURLFilters<Context>
	termListOptions: {
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

type ConfigKey = keyof ConfigValues

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
//const configCache: Partial<ConfigValues<StorageContext.STORE>> = {};

//const configCacheKeysLocal: Set<string> = new Set;
//const configCacheKeysSync: Set<string> = new Set;

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
		keysToGet.forEach(<K extends T>(key: K) => {
			bankCache[key] = bankStore[key] ?? Object.assign({}, bankDefault[key]);
			bank[key] = bankCache[key] as BankValues[K];
		});
	});
	return bank;
};

type StorageAreaName = "local" | "sync"

type Partial2<T> = {
    [P in keyof T]: {
		[P1 in keyof T[P]]?: T[P][P1];
	};
};

// TODO store config to cache when setting and getting, update cache when storage changes

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configSet = async <Config extends Partial<Partial2<ConfigValues>>>(config: Config) => {
	const storageAreaValues: Record<StorageAreaName, Record<string, unknown>> = { local: {}, sync: {} };
	for (const [ configKey, group ] of Object.entries(config)) {
		for (const [ groupKey, value ] of Object.entries(group)) {
			const valueDefault = configDefault[configKey][groupKey];
			const storageValues = valueDefault.sync ? storageAreaValues.sync : storageAreaValues.local;
			const key = configKey + "." + groupKey;
			if ((valueDefault as StorageValue<unknown, StorageContext.SCHEMA>).w_value !== undefined) {
				(storageValues[key] as StorageValue<unknown, StorageContext.STORE>)
					= {
						w_value: value as StorageValue<unknown>,
					};
			} else if ((valueDefault as StorageListValue<unknown, StorageContext.SCHEMA>).listBase !== undefined) {
				(storageValues[key] as StorageListValue<unknown, StorageContext.STORE>)
					= {
						w_listIn: (value as StorageListValue<unknown>).w_listIn,
						w_listOut: (value as StorageListValue<unknown>).w_listOut,
					};
			}
		}
	}
	const storagePromises = [
		chrome.storage.local.set(storageAreaValues.local),
		chrome.storage.sync.set(storageAreaValues.sync),
	];
	for (const promise of storagePromises) await promise;
};

type ConfigKeyObject<ConfigK extends ConfigKey> = {[C in ConfigK]?: Array<keyof ConfigValues[C]> | true}

type ConfigPartial<ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>> = {
	[C in ConfigK]: KeyObject[C] extends Array<infer GroupK extends keyof ConfigValues[C]>
		? {[G in GroupK]: ConfigValues[C][G]}
		: (KeyObject[C] extends true ? ConfigValues[C] : never)
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGet = <ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>>
	(keyObject: KeyObject) => new Promise<ConfigPartial<ConfigK, KeyObject>>(resolve => {
		let pendingCount = 0;
		const config = {} as ConfigPartial<ConfigK, KeyObject>;
		const storageAreaKeys: Record<StorageAreaName, Array<string>> = { local: [], sync: [] };
		const keyObjectEntries = Object.entries(keyObject) as Array<[ ConfigK, Array<string> | true ]>;
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configDefault[configKey]);
			for (const groupKey of groupKeys) {
				const valueDefault = configDefault[configKey][groupKey] as ConfigValue<StorageContext.SCHEMA>;
				storageAreaKeys[valueDefault.sync ? "sync" : "local"].push(configKey + "." + groupKey);
			}
		}
		const storageAreaPromises: Record<StorageAreaName, Promise<Record<string, unknown>>> = {
			local: chrome.storage.local.get(storageAreaKeys.local).catch(reason => {
				assert(false, "config keys returning default values", "storage get failed", { keys: storageAreaKeys.local, reason });
				return {};
			}),
			sync: chrome.storage.sync.get(storageAreaKeys.sync).catch(reason => {
				assert(false, "config keys returning default values", "storage get failed", { keys: storageAreaKeys.sync, reason });
				return {};
			}),
		};
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configDefault[configKey]);
			groupKeys.forEach(async groupKey => {
				pendingCount++;
				const key = configKey + "." + groupKey;
				(config[configKey] as unknown) ??= {} as ConfigGroup;
				const valueDefault = configDefault[configKey][groupKey] as ConfigValue<StorageContext.SCHEMA>;
				const value = (await (valueDefault.sync ? storageAreaPromises.sync : storageAreaPromises.local))[key];
				type StorageV = StorageValue<unknown, StorageContext.SCHEMA>
				type StorageListV = StorageListValue<unknown, StorageContext.SCHEMA>
				if ((valueDefault as StorageV).w_value !== undefined) {
					if (value === undefined) {
						(config[configKey][groupKey] as StorageValue<unknown>)
							= (valueDefault as StorageV).w_value;
					} else {
						// TODO validate
						(config[configKey][groupKey] as StorageValue<unknown>)
							= (value as StorageValue<unknown, StorageContext.STORE>).w_value;
					}
				} else if ((valueDefault as StorageListV).listBase !== undefined) {
					if (value === undefined) {
						(config[configKey][groupKey] as StorageListValue<unknown>)
							= {
								listBase: (valueDefault as StorageListV).listBase,
								w_listIn: [],
								w_listOut: [],
							};
					} else {
						// TODO validate
						(config[configKey][groupKey] as StorageListValue<unknown>)
							= {
								listBase: (valueDefault as StorageListV).listBase,
								w_listIn: (value as StorageListValue<unknown, StorageContext.STORE>).w_listIn,
								w_listOut: (value as StorageListValue<unknown, StorageContext.STORE>).w_listOut,
							};
					}
				}
				pendingCount--;
				if (pendingCount === 0) resolve(config);
			});
		}
	})
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

/*chrome.storage.onChanged.addListener((changes, areaName) => {
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
});*/

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
