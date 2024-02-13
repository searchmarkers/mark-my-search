/**
 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
 * @param observer A highlighter-connected observer responsible for listening and responding to document mutations.
 * @returns The manager interface for the observer.
 */
const getMutationUpdates = (observer: () => MutationObserver | undefined) => ({
	observe: () => { observer()?.observe(document.body, { subtree: true, childList: true, characterData: true }); },
	disconnect: () => { observer()?.disconnect(); },
});

// TODO document
const getStyleUpdates = (
	elementsVisible: Set<Element>,
	getObservers: () => { shiftObserver: ResizeObserver | null, visibilityObserver: IntersectionObserver | null },
) => ({
	observe: (element: Element) => { getObservers().visibilityObserver?.observe(element); },
	disconnectAll: () => {
		elementsVisible.clear();
		getObservers().shiftObserver?.disconnect();
		getObservers().visibilityObserver?.disconnect();
	},
});

export { getMutationUpdates, getStyleUpdates };
