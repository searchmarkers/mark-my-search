type ResearchInstances = Record<number, ResearchInstance>;
type Stoplist = Array<string>;
type Engines = Record<string, Engine>;
type StorageLocal = {
	[StorageLocalKey.ENABLED]?: boolean,
	[StorageLocalKey.RESEARCH_INSTANCES]?: ResearchInstances,
	[StorageLocalKey.ENGINES]?: Engines,
}
type StorageSync = {
	[StorageSyncKey.IS_SET_UP]?: boolean,
	[StorageSyncKey.STOPLIST]?: Stoplist,
}

interface ResearchInstance {
	terms: MatchTerms
}

enum StorageLocalKey {
	ENABLED = "enabled",
	RESEARCH_INSTANCES = "researchInstances",
	_ID_R_INSTANCES = "idResearchInstances",
    _TAB_R_INSTANCE_IDS = "tabResearchInstanceIds",
	ENGINES = "engines",
}

enum StorageSyncKey {
	IS_SET_UP = "isSetUp",
	STOPLIST = "stoplist",
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageLocal = (items: StorageLocal) => {
	if (Object.keys(items).includes(StorageLocalKey.RESEARCH_INSTANCES)) {
		const tabRInstances = items[StorageLocalKey.RESEARCH_INSTANCES];
		const tabs = Object.keys(tabRInstances);
		const idRInstances = [];
		const tabRInstanceIds = {};
		delete(items[StorageLocalKey.RESEARCH_INSTANCES]);
		tabs.forEach(tab => {
			const id = idRInstances.indexOf(tabRInstances[tab]);
			if (id === -1) {
				tabRInstanceIds[tab] = idRInstances.length;
				idRInstances.push(tabRInstances[tab]);
			} else {
				tabRInstanceIds[tab] = id;
			}
		});
		items[StorageLocalKey._ID_R_INSTANCES] = idRInstances;
		items[StorageLocalKey._TAB_R_INSTANCE_IDS] = tabRInstanceIds;
	}
	return chrome.storage.local.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageLocal = (keysParam: string | Array<string>): Promise<StorageLocal> => {
	const keys = typeof(keysParam) === "string" ? [keysParam] : keysParam;
	const gettingRInstances = keys.includes(StorageLocalKey.RESEARCH_INSTANCES);
	if (gettingRInstances) {
		keys.splice(keys.indexOf(StorageLocalKey.RESEARCH_INSTANCES), 1);
		keys.push(StorageLocalKey._ID_R_INSTANCES);
		keys.push(StorageLocalKey._TAB_R_INSTANCE_IDS);
	}
	return chrome.storage.local.get(keys).then(local => {
		if (gettingRInstances) {
			const idRInstances = local[StorageLocalKey._ID_R_INSTANCES];
			const tabRInstanceIds = local[StorageLocalKey._TAB_R_INSTANCE_IDS];
			delete(local[StorageLocalKey._ID_R_INSTANCES]);
			delete(local[StorageLocalKey._TAB_R_INSTANCE_IDS]);
			const tabRInstances = {};
			Object.keys(tabRInstanceIds).forEach(tab => {
				tabRInstances[tab] = idRInstances[tabRInstanceIds[tab]];
			});
			local[StorageLocalKey.RESEARCH_INSTANCES] = tabRInstances;
		}
		return local;
	});
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const setStorageSync = (items: StorageSync) => {
	return chrome.storage.sync.set(items);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStorageSync = (keysParam: string | Array<string>): Promise<StorageSync> => {
	return chrome.storage.sync.get(keysParam);
};
