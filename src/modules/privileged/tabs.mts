import { storageGet } from "/dist/modules/privileged/storage.mjs";

/**
 * Gets whether or not a tab has active highlighting information stored, so is considered highlighted.
 * @param tabId The ID of a tab.
 * @returns `true` if the tab is considered highlighted, `false` otherwise.
 */
const isTabResearchPage = async (tabId: number): Promise<boolean> => {
	const { researchInstances } = await storageGet("session", [ "researchInstances" ]);
	return (tabId in researchInstances) && researchInstances[tabId].enabled;
};

export { isTabResearchPage };
