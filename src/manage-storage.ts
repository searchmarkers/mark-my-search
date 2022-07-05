type ResearchInstances = Record<number, ResearchInstance>
type Stoplist = Array<string>
type Engines = Record<string, Engine>
type StorageLocalValues = {
	[StorageLocal.ENABLED]: boolean
	[StorageLocal.RESEARCH_INSTANCES]: ResearchInstances
	[StorageLocal.ENGINES]: Engines
}
type StorageSyncValues = {
	[StorageSync.IS_SET_UP]: boolean
	[StorageSync.STOPLIST]: Stoplist
	[StorageSync.LINK_RESEARCH_TABS]: boolean
	[StorageSync.SHOW_HIGHLIGHTS]: {
		default: boolean
		overrideSearchPages: boolean
		overrideResearchPages: boolean
	}
	[StorageSync.BAR_CONTROLS_SHOWN]: {
		[BarControl.DISABLE_TAB_RESEARCH]: boolean
		[BarControl.PERFORM_SEARCH]: boolean
		[BarControl.APPEND_TERM]: boolean
	}
}

enum StorageLocal {
	ENABLED = "enabled",
	RESEARCH_INSTANCES = "researchInstances",
	_ID_R_INSTANCES = "idResearchInstances",
    _TAB_R_INSTANCE_IDS = "tabResearchInstanceIds",
	ENGINES = "engines",
}

enum StorageSync {
	IS_SET_UP = "isSetUp", // TODO: supplement with detection of unused keys
	STOPLIST = "stoplist",
	LINK_RESEARCH_TABS = "linkResearchTabs",
	SHOW_HIGHLIGHTS = "showHighlights",
	BAR_CONTROLS_SHOWN = "barControlsShown",
}

interface ResearchInstance {
	phrases: ReadonlyArray<string>
	terms: MatchTerms
	highlightsShown: boolean
}

const defaultOptions: StorageSyncValues = {
	isSetUp: true,
	stoplist: [
		"i", "a", "an", "and", "or", "not", "the", "that", "there", "where", "which", "to", "do", "of", "in", "on", "at", "too",
		"if", "for", "while", "is", "as", "isn't", "are", "aren't", "can", "can't", "how", "vs",
		"them", "their", "theirs", "her", "hers", "him", "his", "it", "its", "me", "my", "one", "one's"
	],
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
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageLocal = (items: StorageLocalValues) => {
	if (Object.keys(items).includes(StorageLocal.RESEARCH_INSTANCES)) {
		// TODO: disable object shallow copying when linking disabled in settings
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
		items[StorageLocal._ID_R_INSTANCES] = idRInstances;
		items[StorageLocal._TAB_R_INSTANCE_IDS] = tabRInstanceIds;
	}
	return browser.storage.local.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageLocal = async (keysParam?: StorageLocal | Array<StorageLocal>): Promise<StorageLocalValues> => {
	const keys = keysParam === undefined
		? undefined
		: typeof(keysParam) === "string" ? [ keysParam ] : Array.from(new Set(keysParam));
	const gettingRInstances = keys && keys.includes(StorageLocal.RESEARCH_INSTANCES);
	if (gettingRInstances) {
		keys.splice(keys.indexOf(StorageLocal.RESEARCH_INSTANCES), 1);
		keys.push(StorageLocal._ID_R_INSTANCES);
		keys.push(StorageLocal._TAB_R_INSTANCE_IDS);
	}
	const local = await browser.storage.local.get(keys) as StorageLocalValues;
	if (gettingRInstances) {
		const idRInstances = local[StorageLocal._ID_R_INSTANCES];
		const tabRInstanceIds = local[StorageLocal._TAB_R_INSTANCE_IDS];
		delete(local[StorageLocal._ID_R_INSTANCES]);
		delete(local[StorageLocal._TAB_R_INSTANCE_IDS]);
		const tabRInstances = {};
		Object.keys(tabRInstanceIds).forEach(tab => {
			tabRInstances[tab] = idRInstances[tabRInstanceIds[tab]];
		});
		local.researchInstances = tabRInstances;
	}
	if (local.engines) {
		const engines = local.engines as Engines;
		Object.keys(engines).forEach(id => engines[id] = Object.assign(new Engine, engines[id]));
	}
	return local;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const initStorageLocal = () => getStorageLocal(StorageLocal.ENABLED).then(local =>
	setStorageLocal({
		enabled: local.enabled === undefined ? true : local.enabled,
		researchInstances: {},
		engines: {},
	})
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSync = (items: StorageSyncValues) => {
	return browser.storage.sync.set(items);
};

// TODO: make generic function for sync and local
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSync = (keysParam?: StorageSync | Array<StorageSync>): Promise<StorageSyncValues> => {
	return browser.storage.sync.get(keysParam) as Promise<StorageSyncValues>;
};

const fixObjectWithDefaults = (
	object: Record<string, unknown>,
	defaults: Record<string, unknown>,
	toRemove: Array<string>,
	atTopLevel = false,
) => {
	Object.keys(object).forEach(objectKey => {
		if (defaults[objectKey] === undefined) {
			if (atTopLevel) {
				toRemove.push(objectKey);
			} else {
				delete(object[objectKey]);
			}
		} else if (typeof(object[objectKey]) === "object" && Array.isArray(object[objectKey])) {
			fixObjectWithDefaults(
				object[objectKey] as Record<string, unknown>,
				defaults[objectKey] as Record<string, unknown>,
				toRemove,
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const repairOptions = () => getStorageSync().then(sync => {
	const toRemove = [];
	fixObjectWithDefaults(sync, defaultOptions, toRemove, true);
	setStorageSync(sync);
	browser.storage.sync.remove(toRemove);
});
