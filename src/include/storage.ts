chrome.storage = useChromeAPI() ? chrome.storage : browser.storage as typeof chrome.storage;

enum StorageContext {
	SCHEMA,
	STORE,
	INTERFACE,
}

type ResearchInstances = Record<number, ResearchInstance>
type Engines = Record<string, SearchSite>

type BankValues = {
	[BankKey.RESEARCH_INSTANCES]: ResearchInstances
	[BankKey.ENGINES]: Engines
}

enum StoreType {
	IMMEDIATE,
	LIST,
}

type StoreImmediate<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? Readonly<{
	type: StoreType.IMMEDIATE
	defaultValue: T
	sync?: true
}> : Context extends StorageContext.STORE ? T : T

type StoreList<T, Context = StorageContext.INTERFACE> = Context extends StorageContext.SCHEMA ? Readonly<{
	type: StoreType.LIST
	baseList: Array<T>
	sync?: true
}> : Context extends StorageContext.STORE ?
	{
		userList: Array<T>,
		baseExcludeList: Array<T>,
		baseExcludeAll: boolean,
	}
: StoreListInterface<T>

type Store<Context = StorageContext.INTERFACE> =
	| StoreImmediate<unknown, Context>
	| StoreList<unknown, Context>
;

type StoreGroup<Context = StorageContext.INTERFACE> = Record<string, Store<Context>>

class StoreListInterface<T> {
	readonly baseList: Array<T>;
	userList: Array<T>;
	baseExcludeList: Array<T>;
	baseExcludeAll: boolean;

	constructor (baseList: Array<T>, userList?: Array<T>, baseExcludeList?: Array<T> | true) {
		this.baseList = baseList;
		this.userList = userList ?? [];
		if (baseExcludeList === true) {
			this.baseExcludeList = [];
			this.baseExcludeAll = true;
		} else {
			this.baseExcludeList = baseExcludeList ?? [];
			this.baseExcludeAll = false;
		}
	}

	setList (list: Array<T>, forbidBaseItems?: true): void {
		this.userList = list.filter(item => !this.baseList.includes(item));
		if (forbidBaseItems) {
			this.baseExcludeList = [];
			this.baseExcludeAll = true;
		} else {
			this.baseExcludeList = this.baseList.filter(item => !list.includes(item));
			this.baseExcludeAll = false;
		}
	}

	getList (): Array<T> {
		return this.baseList.filter(item => !this.baseExcludeList.includes(item)).concat(this.userList);
	}
}

type ConfigBarControlsShown<Context = StorageContext.INTERFACE> = {
	toggleBarCollapsed: StoreImmediate<boolean, Context>
	disableTabResearch: StoreImmediate<boolean, Context>
	performSearch: StoreImmediate<boolean, Context>
	toggleHighlights: StoreImmediate<boolean, Context>
	appendTerm: StoreImmediate<boolean, Context>
	replaceTerms: StoreImmediate<boolean, Context>
}
type ConfigBarLook<Context = StorageContext.INTERFACE> = {
	showEditIcon: StoreImmediate<boolean, Context>
	showRevealIcon: StoreImmediate<boolean, Context>
	fontSize: StoreImmediate<string, Context>
	opacityControl: StoreImmediate<number, Context>
	opacityTerm: StoreImmediate<number, Context>
	borderRadius: StoreImmediate<string, Context>
}
type ConfigHighlightLook<Context = StorageContext.INTERFACE> = {
	hues: StoreImmediate<Array<number>, Context>
}
type ConfigHighlighter<Context = StorageContext.INTERFACE> = {
	engine: StoreImmediate<Engine, Context>
	paintEngine: StoreImmediate<PaintEngineConfig, Context>
}
type ConfigURLFilters<Context = StorageContext.INTERFACE> = {
	noPageModify: StoreImmediate<URLFilter, Context>
	noHighlight: StoreImmediate<URLFilter, Context>
	nonSearch: StoreImmediate<URLFilter, Context>
}

type ConfigValues<Context = StorageContext.INTERFACE> = {
	theme: {
		edition: StoreImmediate<ThemeEdition, Context>
		variant: StoreImmediate<ThemeVariant, Context>
		hue: StoreImmediate<number, Context>
		contrast: StoreImmediate<number, Context>
		lightness: StoreImmediate<number, Context>
		saturation: StoreImmediate<number, Context>
		fontScale: StoreImmediate<number, Context>
	}
	researchInstanceOptions: {
		restoreLastInTab: StoreImmediate<boolean, Context>
	}
	autoFindOptions: {
		enabled: StoreImmediate<boolean, Context>
		stoplist: StoreList<string, Context>
		searchParams: StoreList<string, Context>
	}
	matchingDefaults: {
		matchMode: StoreImmediate<MatchMode, Context>
	}
	showHighlights: {
		default: StoreImmediate<boolean, Context>
		overrideSearchPages: StoreImmediate<boolean, Context>
		overrideResearchPages: StoreImmediate<boolean, Context>
	}
	barCollapse: {
		fromSearch: StoreImmediate<boolean, Context>
		fromTermListAuto: StoreImmediate<boolean, Context>
	}
	barControlsShown: ConfigBarControlsShown<Context>
	barLook: ConfigBarLook<Context>
	highlightLook: ConfigHighlightLook<Context>
	highlighter: ConfigHighlighter<Context>
	urlFilters: ConfigURLFilters<Context>
	termListOptions: {
		termLists: StoreImmediate<Array<TermList>, Context>
	}
}

type ConfigKey = keyof ConfigValues

interface PaintEngineConfig {
	method: PaintEngineMethod
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
 * Set to sensible values for a generic first-time user of the extension.
 */
const configSchema: ConfigValues<StorageContext.SCHEMA> = {
	theme: {
		edition: {
			type: StoreType.IMMEDIATE,
			defaultValue: ThemeEdition.CLASSIC,
		},
		variant: {
			type: StoreType.IMMEDIATE,
			defaultValue: ThemeVariant.DARK,
		},
		hue: {
			type: StoreType.IMMEDIATE,
			defaultValue: 284,
		},
		contrast: {
			type: StoreType.IMMEDIATE,
			defaultValue: 1,
		},
		lightness: {
			type: StoreType.IMMEDIATE,
			defaultValue: 1,
		},
		saturation: {
			type: StoreType.IMMEDIATE,
			defaultValue: 1,
		},
		fontScale: {
			type: StoreType.IMMEDIATE,
			defaultValue: 1,
		},
	},
	researchInstanceOptions: {
		restoreLastInTab: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
		},
	},
	autoFindOptions: {
		enabled: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
		},
		// TODO allow specifying mappings of params to URL filters and whether the filter should be inverted?
		searchParams: {
			type: StoreType.LIST,
			baseList: [ // Order of specificity, as only the first match will be used.
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
			type: StoreType.LIST,
			baseList: [
				"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
				"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
				"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's", "you", "your", "yours",
			],
			sync: true,
		},
	},
	matchingDefaults: {
		matchMode: {
			type: StoreType.IMMEDIATE,
			defaultValue: {
				regex: false,
				case: false,
				stem: true,
				whole: false,
				diacritics: true,
			},
		},
	},
	showHighlights: {
		default: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		overrideSearchPages: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
			sync: true,
		},
		overrideResearchPages: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
			sync: true,
		},
	},
	barCollapse: {
		fromSearch: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
			sync: true,
		},
		fromTermListAuto: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
			sync: true,
		},
	},
	barControlsShown: {
		toggleBarCollapsed: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		disableTabResearch: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		performSearch: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
			sync: true,
		},
		toggleHighlights: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		appendTerm: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		replaceTerms: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
	},
	barLook: {
		showEditIcon: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		showRevealIcon: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
			sync: true,
		},
		fontSize: {
			type: StoreType.IMMEDIATE,
			defaultValue: "14.6px",
			sync: true,
		},
		opacityControl: {
			type: StoreType.IMMEDIATE,
			defaultValue: 0.8,
			sync: true,
		},
		opacityTerm: {
			type: StoreType.IMMEDIATE,
			defaultValue: 0.86,
			sync: true,
		},
		borderRadius: {
			type: StoreType.IMMEDIATE,
			defaultValue: "4px",
			sync: true,
		},
	},
	highlightLook: {
		hues: {
			type: StoreType.IMMEDIATE,
			defaultValue: [ 300, 60, 110, 220, 30, 190, 0 ],
			sync: true,
		},
	},
	highlighter: {
		engine: {
			type: StoreType.IMMEDIATE,
			defaultValue: Engine.ELEMENT,
		},
		paintEngine: {
			type: StoreType.IMMEDIATE,
			defaultValue: {
				method: PaintEngineMethod.PAINT,
			},
		},
	},
	urlFilters: {
		noPageModify: {
			type: StoreType.IMMEDIATE,
			defaultValue: [],
			sync: true,
		},
		noHighlight: {
			type: StoreType.IMMEDIATE,
			defaultValue: [],
			sync: true,
		},
		nonSearch: {
			type: StoreType.IMMEDIATE,
			defaultValue: [],
			sync: true,
		},
	},
	termListOptions: {
		termLists: {
			type: StoreType.IMMEDIATE,
			defaultValue: [],
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

type ConfigKeyObject<ConfigK extends ConfigKey> = {[C in ConfigK]?: Array<keyof ConfigValues[C]> | true}

type ConfigPartial<ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>> = {
	[C in ConfigK]: KeyObject[C] extends Array<infer GroupK extends keyof ConfigValues[C]>
		? {[G in GroupK]: ConfigValues[C][G]}
		: (KeyObject[C] extends true ? ConfigValues[C] : never)
}

type ConfigTypesPartial<ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>> = {
	[C in ConfigK]: KeyObject[C] extends Array<infer GroupK extends keyof ConfigValues[C]>
		? {[G in GroupK]: StoreType}
		: (KeyObject[C] extends true ? Record<keyof ConfigValues[C], StoreType> : never)
}

// TODO store config to cache when setting and getting, update cache when storage changes

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configSet = async (config: Partial<Partial2<ConfigValues>>) => {
	const storageAreaValues: Record<StorageAreaName, Record<string, unknown>> = { local: {}, sync: {} };
	for (const [ configKey, group ] of Object.entries(config)) {
		for (const [ groupKey, value ] of Object.entries(group)) {
			const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
			const storageValues = valueSchema.sync ? storageAreaValues.sync : storageAreaValues.local;
			const key = configKey + "." + groupKey;
			switch (valueSchema.type) {
			case StoreType.IMMEDIATE: {
				(storageValues[key] as StoreImmediate<unknown, StorageContext.STORE>) = value as StoreImmediate<unknown>;
				break;
			} case StoreType.LIST: {
				(storageValues[key] as StoreList<unknown, StorageContext.STORE>) = {
					userList: (value as StoreList<unknown>).userList,
					baseExcludeList: (value as StoreList<unknown>).baseExcludeList,
					baseExcludeAll: (value as StoreList<unknown>).baseExcludeAll,
				};
				break;
			}}
		}
	}
	const storagePromises = [
		chrome.storage.local.set(storageAreaValues.local),
		chrome.storage.sync.set(storageAreaValues.sync),
	];
	for (const promise of storagePromises) await promise;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configUnset = async <ConfigK extends ConfigKey>(keyObject: ConfigKeyObject<ConfigK> | true) => {
	const storageAreaKeys: Record<StorageAreaName, Array<string>> = { local: [], sync: [] };
	const keyObjectEntries = (typeof keyObject === "object"
		? Object.entries(keyObject)
		: Object.keys(configSchema).map((key: ConfigK) => [ key, true ])) as Array<[ ConfigK, Array<string> | true ]>;
	for (const [ configKey, groupInfo ] of keyObjectEntries) {
		const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
		for (const groupKey of groupKeys) {
			const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
			const storageKeys = valueSchema.sync ? storageAreaKeys.sync : storageAreaKeys.local;
			storageKeys.push(configKey + "." + groupKey);
		}
	}
	const storagePromises = [
		chrome.storage.local.remove(storageAreaKeys.local),
		chrome.storage.sync.remove(storageAreaKeys.sync),
	];
	for (const promise of storagePromises) await promise;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGet = <ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>>
	(keyObject: KeyObject) => new Promise<ConfigPartial<ConfigK, KeyObject>>(resolve => {
		let pendingCount = 0;
		const config = {} as ConfigPartial<ConfigK, KeyObject>;
		const storageAreaKeys: Record<StorageAreaName, Array<string>> = { local: [], sync: [] };
		const keyObjectEntries = Object.entries(keyObject) as Array<[ ConfigK, Array<string> | true ]>;
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
			for (const groupKey of groupKeys) {
				const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
				storageAreaKeys[valueSchema.sync ? "sync" : "local"].push(configKey + "." + groupKey);
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
			const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
			groupKeys.forEach(async groupKey => {
				pendingCount++;
				(config[configKey] as unknown) ??= {} as StoreGroup;
				const key = configKey + "." + groupKey;
				const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
				const value = (await (valueSchema.sync ? storageAreaPromises.sync : storageAreaPromises.local))[key];
				switch (valueSchema.type) {
				case StoreType.IMMEDIATE: {
					if (value !== undefined
						&& assert(typeof value === typeof valueSchema.defaultValue,
							"config key returning default value", "value has wrong type", { key, value })
					) {
						(config[configKey][groupKey] as StoreImmediate<unknown>) = value as StoreImmediate<unknown>;
					} else {
						(config[configKey][groupKey] as StoreImmediate<unknown>) = valueSchema.defaultValue;
					}
					break;
				} case StoreType.LIST: {
					if (value !== undefined
						&& assert(typeof value === "object" && (value as StoreList<unknown>).userList,
							"config key returning default value", "list value has poor shape", { key, value })
					) {
						(config[configKey][groupKey] as StoreList<unknown>) = new StoreListInterface(
							valueSchema.baseList,
							(value as StoreList<unknown>).userList,
							((value as StoreList<unknown>).baseExcludeAll || (value as StoreList<unknown>).baseExcludeList) ?? [],
						);
					} else {
						(config[configKey][groupKey] as StoreList<unknown>) = new StoreListInterface(valueSchema.baseList);
					}
					break;
				}}
				pendingCount--;
				if (pendingCount === 0) resolve(config);
			});
		}
	})
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGetDefault = <ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>>
	(keyObject: KeyObject): ConfigPartial<ConfigK, KeyObject> => {
	const config = {} as ConfigPartial<ConfigK, KeyObject>;
	const keyObjectEntries = Object.entries(keyObject) as Array<[ ConfigK, Array<string> | true ]>;
	for (const [ configKey, groupInfo ] of keyObjectEntries) {
		(config[configKey] as unknown) = {} as StoreGroup;
		const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
		for (const groupKey of groupKeys) {
			const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
			switch (valueSchema.type) {
			case StoreType.IMMEDIATE: {
				(config[configKey][groupKey] as StoreImmediate<unknown>) = valueSchema.defaultValue;
				break;
			} case StoreType.LIST: {
				(config[configKey][groupKey] as StoreList<unknown>) = new StoreListInterface(valueSchema.baseList);
				break;
			}}
		}
	}
	return config;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const configGetType = <ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>>
	(keyObject: KeyObject): ConfigTypesPartial<ConfigK, KeyObject> => {
	const configTypes = {} as ConfigTypesPartial<ConfigK, KeyObject>;
	const keyObjectEntries = Object.entries(keyObject) as Array<[ ConfigK, Array<string> | true ]>;
	for (const [ configKey, groupInfo ] of keyObjectEntries) {
		(configTypes[configKey] as unknown) = {} as StoreGroup;
		const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
		for (const groupKey of groupKeys) {
			const valueSchema: Store<StorageContext.SCHEMA> = configSchema[configKey][groupKey];
			configTypes[configKey][groupKey] = valueSchema.type;
		}
	}
	return configTypes;
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
