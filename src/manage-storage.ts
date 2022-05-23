type ResearchInstances = Record<number, ResearchInstance>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;
type StorageLocalValues = {
	[StorageLocal.ENABLED]?: boolean,
	[StorageLocal.RESEARCH_INSTANCES]?: ResearchInstances,
	[StorageLocal.ENGINES]?: Engines,
}
type StorageSyncValues = {
	[StorageSync.IS_SET_UP]?: boolean,
	[StorageSync.STOPLIST]?: Stoplist,
}

interface ResearchInstance {
	terms: MatchTerms
}

enum StorageLocal {
	ENABLED = "enabled",
	RESEARCH_INSTANCES = "researchInstances",
	_ID_R_INSTANCES = "idResearchInstances",
    _TAB_R_INSTANCE_IDS = "tabResearchInstanceIds",
	ENGINES = "engines",
}

enum StorageSync {
	IS_SET_UP = "isSetUp",
	STOPLIST = "stoplist",
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageLocal = (items: StorageLocalValues) => {
	if (Object.keys(items).includes(StorageLocal.RESEARCH_INSTANCES)) {
		const tabRInstances = items[StorageLocal.RESEARCH_INSTANCES];
		const tabs = Object.keys(tabRInstances);
		const idRInstances = [];
		const tabRInstanceIds = {};
		delete(items[StorageLocal.RESEARCH_INSTANCES]);
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
	return chrome.storage.local.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageLocal = (keysParam: string | Array<string>): Promise<StorageLocalValues> => {
	const keys = typeof(keysParam) === "string" ? [keysParam] : keysParam;
	const gettingRInstances = keys.includes(StorageLocal.RESEARCH_INSTANCES);
	if (gettingRInstances) {
		keys.splice(keys.indexOf(StorageLocal.RESEARCH_INSTANCES), 1);
		keys.push(StorageLocal._ID_R_INSTANCES);
		keys.push(StorageLocal._TAB_R_INSTANCE_IDS);
	}
	return chrome.storage.local.get(keys).then(local => {
		if (gettingRInstances) {
			const idRInstances = local[StorageLocal._ID_R_INSTANCES];
			const tabRInstanceIds = local[StorageLocal._TAB_R_INSTANCE_IDS];
			delete(local[StorageLocal._ID_R_INSTANCES]);
			delete(local[StorageLocal._TAB_R_INSTANCE_IDS]);
			const tabRInstances = {};
			Object.keys(tabRInstanceIds).forEach(tab => {
				tabRInstances[tab] = idRInstances[tabRInstanceIds[tab]];
			});
			local[StorageLocal.RESEARCH_INSTANCES] = tabRInstances;
		}
		return local;
	});
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSync = (items: StorageSyncValues) => {
	return chrome.storage.sync.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSync = (keysParam: string | Array<string>): Promise<StorageSyncValues> => {
	return chrome.storage.sync.get(keysParam);
};
