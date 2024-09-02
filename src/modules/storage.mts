/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchMode, MatchTerm } from "/dist/modules/match-term.mjs";
import { SearchSite } from "/dist/modules/search-site.mjs";
import type { Engine, PaintEngineMethod, Entries } from "/dist/modules/common.mjs";
import { log, assert, compatibility } from "/dist/modules/common.mjs";

chrome.storage = compatibility.browser === "chromium"
	? chrome.storage
	: browser.storage as typeof chrome.storage
;

enum ConfigContext {
	SCHEMA,
	STORE,
	INTERFACE,
}

type ResearchInstances = Record<number, ResearchInstance>
type SearchSites = Record<string, SearchSite>

type BankValues = {
	researchInstances: ResearchInstances
	engines: SearchSites
}

enum StoreType {
	IMMEDIATE,
	LIST,
}

type StoreImmediate<T, Context = ConfigContext.INTERFACE>
= Context extends ConfigContext.SCHEMA ? Readonly<{
	type: StoreType.IMMEDIATE
	defaultValue: T
	sync?: true
}>
: Context extends ConfigContext.STORE ? T
: T

type StoreList<T, Context = ConfigContext.INTERFACE>
= Context extends ConfigContext.SCHEMA ? Readonly<{
	type: StoreType.LIST
	baseList: Array<T>
	sync?: true
}>
: Context extends ConfigContext.STORE ? {
	userList: Array<T>,
	baseExcludeList: Array<T>,
	baseExcludeAll: boolean,
}
: StoreListInterface<T>

type Store<Context = ConfigContext.INTERFACE> =
	| StoreImmediate<unknown, Context>
	| StoreList<unknown, Context>
;

type StoreGroup<Context = ConfigContext.INTERFACE> = Record<string, Store<Context>>

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

type ConfigBarControlsShown<Context = ConfigContext.INTERFACE> = {
	toggleBarCollapsed: StoreImmediate<boolean, Context>
	disableTabResearch: StoreImmediate<boolean, Context>
	performSearch: StoreImmediate<boolean, Context>
	toggleHighlights: StoreImmediate<boolean, Context>
	appendTerm: StoreImmediate<boolean, Context>
	replaceTerms: StoreImmediate<boolean, Context>
}
type ConfigBarLook<Context = ConfigContext.INTERFACE> = {
	showEditIcon: StoreImmediate<boolean, Context>
	showRevealIcon: StoreImmediate<boolean, Context>
	fontSize: StoreImmediate<string, Context>
	opacityControl: StoreImmediate<number, Context>
	opacityTerm: StoreImmediate<number, Context>
	borderRadius: StoreImmediate<string, Context>
}
type ConfigHighlightLook<Context = ConfigContext.INTERFACE> = {
	hues: StoreImmediate<Array<number>, Context>
}
type ConfigHighlighter<Context = ConfigContext.INTERFACE> = {
	engine: StoreImmediate<Engine, Context>
	paintEngine: StoreImmediate<PaintEngineConfig, Context>
}
type ConfigURLFilters<Context = ConfigContext.INTERFACE> = {
	noPageModify: StoreImmediate<URLFilter, Context>
	noHighlight: StoreImmediate<URLFilter, Context>
	nonSearch: StoreImmediate<URLFilter, Context>
}

type ConfigValues<Context = ConfigContext.INTERFACE> = {
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
	matchModeDefaults: Record<keyof MatchMode, StoreImmediate<boolean, Context>>
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

type PaintEngineConfig = {
	method: PaintEngineMethod
}

type URLFilter = Array<{
	hostname: string,
	pathname: string,
}>

type TermList = {
	name: string
	terms: ReadonlyArray<MatchTerm>
	urlFilter: URLFilter
}

type BankKey = keyof BankValues

enum ThemeEdition {
	CLASSIC = "classic",
}

enum ThemeVariant {
	DARK = "dark",
	LIGHT = "light",
	AUTO = "auto",
}

type ResearchInstance = {
	terms: ReadonlyArray<MatchTerm>
	highlightsShown: boolean
	barCollapsed: boolean
	enabled: boolean
}

/**
 * The default options to be used for items missing from storage, or to which items may be reset.
 * Set to sensible values for a generic first-time user of the extension.
 */
const configSchema: ConfigValues<ConfigContext.SCHEMA> = {
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
	matchModeDefaults: {
		regex: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
		},
		case: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
		},
		stem: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
		},
		whole: {
			type: StoreType.IMMEDIATE,
			defaultValue: false,
		},
		diacritics: {
			type: StoreType.IMMEDIATE,
			defaultValue: true,
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
			defaultValue: "ELEMENT",
		},
		paintEngine: {
			type: StoreType.IMMEDIATE,
			defaultValue: {
				method: "paint",
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

/*
 * Gets an object of key-value pairs corresponding to a set of keys in the given area of storage.
 * Storage may be fetched asynchronously or immediately retrieved from a cache.
 * @param area The name of the storage area from which to retrieve values.
 * @param keys The keys corresponding to the entries to retrieve.
 * @returns A promise resolving to an object of storage entries.
 */
//

abstract class Bank {
	static async set (bank: Partial<BankValues>) {
		(Object.entries as Entries)(bank).forEach(<K extends BankKey>([ key, value ]: [ K, BankValues[K] ]) => {
			bankCache[key] = value;
		});
		await chrome.storage.session.set(bank);
	}

	static async get <T extends BankKey>(keys: Array<T>): Promise<{ [P in T]: BankValues[P] }> {
		// TODO investigate flattening storage of research instances (one level)
		const bank = {} as { [P in T]: BankValues[P] };
		const keysToGet = keys.filter(key => {
			if (bankCache[key] !== undefined) {
				bank[key] = bankCache[key] as BankValues[T];
				return false;
			}
			return true;
		});
		await chrome.storage.session.get(keysToGet).then(store => {
			const bankStore = store as BankValues;
			for (const key of keysToGet) {
				bankCache[key] = bankStore[key] ?? Object.assign({}, bankDefault[key]);
				bank[key] = bankCache[key] as BankValues[typeof key];
			}
		});
		return bank;
	}
}

chrome.storage.session.onChanged.addListener(changes => {
	// TODO check that the change was not initiated from the same script?
	for (const [ key, value ] of (Object.entries as Entries)(changes as Record<BankKey, chrome.storage.StorageChange>)) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		bankCache[key] = value.newValue;
	}
});

type StorageAreaName = "local" | "sync"

type Partial2<T> = {
    [P in keyof T]: {
		[P1 in keyof T[P]]?: T[P][P1];
	};
};

// TODO ensure that correct call syntax is enforced even for generic use (e.g. { [configKey]: { [groupKey]: true } })
type ConfigKeyObject<ConfigK extends ConfigKey> = {[C in ConfigK]?: {[G in keyof ConfigValues[C]]?: true} | true}

type ConfigPartial<ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>> = {
	[C in ConfigK]: KeyObject[C] extends Record<infer GroupK extends keyof ConfigValues[C], true>
		? {[G in GroupK]: ConfigValues[C][G]}
		: (KeyObject[C] extends true ? ConfigValues[C] : never)
}

type ConfigTypesPartial<ConfigK extends ConfigKey, KeyObject extends ConfigKeyObject<ConfigK>> = {
	[C in ConfigK]: KeyObject[C] extends Array<infer GroupK extends keyof ConfigValues[C]>
		? {[G in GroupK]: StoreType}
		: (KeyObject[C] extends true ? Record<keyof ConfigValues[C], StoreType> : never)
}

abstract class Config {
	static async set (config: Partial<Partial2<ConfigValues>>) {
		const storageAreaValues: Record<StorageAreaName, Record<string, unknown>> = { local: {}, sync: {} };
		for (const [ configKey, group ] of Object.entries(config)) {
			for (const [ groupKey, value ] of Object.entries(group)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
				const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
				const storageValues = valueSchema.sync ? storageAreaValues.sync : storageAreaValues.local;
				const key = configKey + "." + groupKey;
				switch (valueSchema.type) {
				case StoreType.IMMEDIATE: {
					(storageValues[key] as StoreImmediate<unknown, ConfigContext.STORE>) = value as StoreImmediate<unknown>;
					break;
				} case StoreType.LIST: {
					(storageValues[key] as StoreList<unknown, ConfigContext.STORE>) = {
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
	}

	static async unset <ConfigK extends ConfigKey>(keyObject: ConfigKeyObject<ConfigK> | true) {
		const storageAreaKeys: Record<StorageAreaName, Array<string>> = { local: [], sync: [] };
		const keyObjectEntries = (typeof keyObject === "object"
			? Object.entries(keyObject)
			: (Object.keys(configSchema) as Array<ConfigK>).map(key => [ key, true ])) as Array<[ ConfigK, Array<string> | true ]>;
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			const groupKeys = typeof groupInfo === "object" ? groupInfo : Object.keys(configSchema[configKey]);
			for (const groupKey of groupKeys) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
				const storageKeys = valueSchema.sync ? storageAreaKeys.sync : storageAreaKeys.local;
				storageKeys.push(configKey + "." + groupKey);
			}
		}
		const storagePromises = [
			chrome.storage.local.remove(storageAreaKeys.local),
			chrome.storage.sync.remove(storageAreaKeys.sync),
		];
		for (const promise of storagePromises) await promise;
	}

	static async get <K extends ConfigKey, Keys extends ConfigKeyObject<K>> (keyObject: Keys) {
		return new Promise<ConfigPartial<K, Keys>>(resolve => {
			let pendingCount = 0;
			const config = {} as ConfigPartial<K, Keys>;
			const storageAreaKeys: Record<StorageAreaName, Array<string>> = { local: [], sync: [] };
			const keyObjectEntries = Object.entries(keyObject) as Array<[ K, Record<string, true> | true ]>;
			for (const [ configKey, groupInfo ] of keyObjectEntries) {
				const groupKeys = typeof groupInfo === "object" ? Object.keys(groupInfo) : Object.keys(configSchema[configKey]);
				for (const groupKey of groupKeys) {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
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
				const groupKeys = typeof groupInfo === "object" ? Object.keys(groupInfo) : Object.keys(configSchema[configKey]);
				groupKeys.forEach(async groupKey => {
					pendingCount++;
					(config[configKey] as unknown) ??= {} as StoreGroup;
					const key = configKey + "." + groupKey;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
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
		});
	}

	static getDefault <K extends ConfigKey, Keys extends ConfigKeyObject<K>> (keyObject: Keys): ConfigPartial<K, Keys> {
		const config = {} as ConfigPartial<K, Keys>;
		const keyObjectEntries = Object.entries(keyObject) as Array<[ K, Record<string, true> | true ]>;
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			(config[configKey] as unknown) = {} as StoreGroup;
			const groupKeys = typeof groupInfo === "object" ? Object.keys(groupInfo) : Object.keys(configSchema[configKey]);
			for (const groupKey of groupKeys) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
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
	}

	static getType <K extends ConfigKey, Keys extends ConfigKeyObject<K>> (keyObject: Keys): ConfigTypesPartial<K, Keys> {
		const configTypes = {} as ConfigTypesPartial<K, Keys>;
		const keyObjectEntries = Object.entries(keyObject) as Array<[ K, Record<string, true> | true ]>;
		for (const [ configKey, groupInfo ] of keyObjectEntries) {
			(configTypes[configKey] as unknown) = {} as StoreGroup;
			const groupKeys = typeof groupInfo === "object" ? Object.keys(groupInfo) : Object.keys(configSchema[configKey]);
			for (const groupKey of groupKeys) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const valueSchema: Store<ConfigContext.SCHEMA> = configSchema[configKey][groupKey];
				configTypes[configKey][groupKey] = valueSchema.type;
			}
		}
		return configTypes;
	}
}

const SCHEMA_VERSION = 2;

// DO NOT EDIT EXISTING ENTRIES.
const KEYS = {
	special: {
		/** Since 2.0.0 */
		schemaVersion: "_schemaVersion",
		/** Since 2.0.0 */
		old_contents: "_old_contents",
		/** Since 2.0.0 */
		old_timestamp: "_old_timestamp",
	} as const,

	reserved: {
	} as const,

	reservedFor: {
		local: {
			/** Since 1.x */
			schemaVersion1: "persistResearchInstances",
		} as const,

		sync: {
			/** Since 1.x */
			schemaVersion1: "highlightMethod",
		} as const,
	} as const,
} as const;

const SPECIAL_KEYS_SET: ReadonlySet<string> = new Set(Object.values(KEYS.special));

type StorageKey = string
type StorageObject = Record<StorageKey, unknown>

const migrations: Record<number, Record<number, (storage: StorageObject, areaName: StorageAreaName) => StorageObject>> = {
	1: {
		2: (old, areaName) => {
			// TODO initialize with all top-level keys and use only Partial2
			const config: Partial<Partial2<ConfigValues>> = {};
			switch (areaName) {
			case "local": {
				config.autoFindOptions ??= {};
				config.autoFindOptions.enabled = old.enabled as boolean;
				config.researchInstanceOptions ??= {};
				config.researchInstanceOptions.restoreLastInTab = old.persistResearchInstances as boolean;
				return config;
			} case "sync": {
				if (old.highlightMethod && typeof old.highlightMethod === "object") {
					config.highlightLook ??= {};
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
					config.highlightLook.hues = old.highlightMethod["hues"];
					config.highlighter ??= {};
					config.highlighter.engine = old.highlightMethod["paintReplaceByClassic"] !== false ? "ELEMENT" : "PAINT";
					config.highlighter.paintEngine = {
						method: old.highlightMethod["paintUseExperimental"] === true
							? (globalThis.browser ? "element" : "paint")
							: "url",
					};
				}
				config.urlFilters = old.urlFilters as Partial<ConfigURLFilters>;
				if (old.autoFindOptions && typeof old.autoFindOptions === "object") {
					config.autoFindOptions ??= {};
					const searchParams = Config.getDefault({ autoFindOptions: { searchParams: true } }).autoFindOptions.searchParams;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					searchParams.setList(old.autoFindOptions["searchParams"] ?? []);
					config.autoFindOptions.searchParams = searchParams;
					const stoplist = Config.getDefault({ autoFindOptions: { stoplist: true } }).autoFindOptions.stoplist;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					stoplist.setList(old.autoFindOptions["stoplist"] ?? []);
					config.autoFindOptions.stoplist = stoplist;
				}
				if (old.matchModeDefaults) {
					const matchMode = Object.assign({}, old.matchModeDefaults as MatchMode);
					matchMode.diacritics = !matchMode.diacritics;
					config.matchModeDefaults = matchMode;
				}
				config.showHighlights = old.showHighlights as ConfigValues["showHighlights"];
				config.barCollapse = old.barCollapse as ConfigValues["barCollapse"];
				config.barControlsShown = old.barControlsShown as ConfigBarControlsShown;
				config.barLook = old.barLook as ConfigBarLook;
				if (old.termLists) {
					config.termListOptions ??= {};
					config.termListOptions.termLists = old.termLists as Array<TermList>;
				}
				return config;
			}}
		},
	},
};

//const findMigrationPath = (fromVersion: number, toVersion: number) => {
//};

const storageResetArea = async (
	areaName: StorageAreaName,
	reason: string,
	initialWarning?: boolean,
): Promise<StorageObject> => {
	if (initialWarning) {
		assert(false, "storage-initialize (single-area) reset begin", reason, { areaName });
	} else {
		log("storage-initialize (single-area) reset begin", reason, { areaName });
	}
	const storageArea: chrome.storage.StorageArea = chrome.storage[areaName];
	const storage = await storageArea.get();
	await storageArea.set({
		[KEYS.special.schemaVersion]: SCHEMA_VERSION,
		[KEYS.special.old_contents]: Object.fromEntries(Object.entries(storage).map(
			([ key, value ]) => [ key, key === KEYS.special.old_contents ? null : value ]
		)),
		[KEYS.special.old_timestamp]: Date.now(),
	});
	log("storage-initialize (single-area) reset complete", "old contents have been moved and the area has been prepared",
		{ areaName, schemaVersion: SCHEMA_VERSION, specialKeys: Object.values(KEYS.special) }
	);
	return storage;
};

const storageCleanAreaOf = async (areaName: StorageAreaName, keysToRemove: Array<StorageKey>) => {
	log("storage-initialize (single-area) cleanup begin", "", { areaName });
	const storageArea: chrome.storage.StorageArea = chrome.storage[areaName];
	await storageArea.remove(keysToRemove.filter(key => !SPECIAL_KEYS_SET.has(key)));
	log("storage-initialize (single-area) cleanup complete", "", { areaName });
};

const storageMigrateArea = async (areaName: StorageAreaName, schemaVersion: number) => {
	log("storage-initialize (single-area) migration begin", "", { areaName });
	const storage = await storageResetArea(areaName, "reset required before migration");
	await storageCleanAreaOf(areaName, Object.keys(storage));
	const config = migrations[schemaVersion][SCHEMA_VERSION](storage, areaName);
	await Config.set(config);
	log("storage-initialize (single-area) migration complete", "old contents have been migrated",
		{ areaName, schemaVersion: SCHEMA_VERSION, specialKeys: Object.values(KEYS.special) }
	);
};

const storageInitializeArea = async (areaName: StorageAreaName) => {
	const storageArea: chrome.storage.StorageArea = chrome.storage[areaName];
	const version1Key = KEYS.reservedFor[areaName].schemaVersion1;
	const storageSpecial = await storageArea.get([ "schemaVersion", KEYS.special.schemaVersion ]);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const versionValue = storageSpecial[KEYS.special.schemaVersion] ?? (storageSpecial[version1Key] ? 1 : undefined);
	const schemaVersion = (typeof versionValue === "number") ? versionValue : 0;
	if (schemaVersion === SCHEMA_VERSION) {
		log("storage-initialize (single-area) complete with no changes", "schema version matches", { areaName, schemaVersion });
		return;
	}
	assert(false, "storage-initialize (single-area) migration needed", "detected schema version does not match current",
		{ areaName, detectedVersion: schemaVersion, SCHEMA_VERSION });
	// Currently, only supports single-step migrations.
	if (migrations[schemaVersion] && migrations[schemaVersion][SCHEMA_VERSION]) {
		await storageMigrateArea(areaName, schemaVersion);
	} else {
		const storage = await storageResetArea(areaName, "no appropriate migration found", true);
		storageCleanAreaOf(areaName, Object.keys(storage));
	}
	log("storage-initialize (single-area) complete", "", { areaName });
};

const configInitialize = async () => {
	log("storage-initialize begin", "", { areaNames: [ "local", "sync" ] });
	const localPromise = storageInitializeArea("local");
	const syncPromise = storageInitializeArea("sync");
	await localPromise;
	await syncPromise;
};

export type {
	BankValues,
	Store, StoreImmediate, StoreList, StoreListInterface,
	ConfigValues, ConfigKey,
	ConfigBarControlsShown, ConfigURLFilters,
	URLFilter,
	SearchSites,
	ResearchInstances, ResearchInstance,
};

export {
	StoreType,
	Bank,
	Config,
	configInitialize,
};
