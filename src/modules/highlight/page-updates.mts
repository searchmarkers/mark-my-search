/**
 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
 * @param observer A highlighter-connected observer responsible for listening and responding to document mutations.
 * @returns The manager interface for the observer.
 */
const getMutationUpdates = (observer: MutationObserver) => ({
	observe: () => {
		observer.observe(document.body, { subtree: true, childList: true, characterData: true });
	},
	disconnect: () => {
		observer.disconnect();
	},
});

// TODO document
const getStyleUpdates = (
	elementsVisible: Set<Element>,
	shiftObserver: ResizeObserver,
	visibilityObserver: IntersectionObserver,
) => ({
	observe: (element: Element) => { visibilityObserver.observe(element); },
	disconnectAll: () => {
		elementsVisible.clear();
		shiftObserver.disconnect();
		visibilityObserver.disconnect();
	},
});

export { getMutationUpdates, getStyleUpdates };
