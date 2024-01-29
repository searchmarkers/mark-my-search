const { highlightTags } = await import("src/modules/highlight/highlighting.mjs");
import type { TermHues } from "src/modules/common.mjs"

type Highlighter = { current: AbstractEngine }

enum HighlighterProcess {
	REFRESH_TERM_CONTROLS,
	REFRESH_INDICATORS,
}

interface AbstractEngine {
	// TODO document each
	getMiscCSS: () => string
	getTermHighlightsCSS: () => string
	getTermHighlightCSS: (terms: MatchTerms, hues: Array<number>, termIndex: number) => string

	// TODO document
	getTermBackgroundStyle: (colorA: string, colorB: string, cycle: number) => string

	// TODO document
	getRequestWaitDuration: (process: HighlighterProcess) => number

	// TODO document
	getRequestReschedulingDelayMax: (process: HighlighterProcess) => number

	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insertScrollMarkers: (
		terms: MatchTerms,
		hues: TermHues,
	) => void

	// TODO document
	raiseScrollMarker: (
		term: MatchTerm | undefined,
		container: HTMLElement,
	) => void

	/**
	 * Removes previous highlighting, then highlights the document using the terms supplied.
	 * Disables then restarts continuous highlighting.
	 * @param terms Terms to be continuously found and highlighted within the DOM.
	 * @param termsToPurge Terms for which to remove previous highlights.
	 */
	startHighlighting: (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
	) => void
	
	// TODO document
	undoHighlights: (
		terms?: MatchTerms | undefined,
		root?: HTMLElement | DocumentFragment,
	) => void

	// TODO document
	endHighlighting: () => void

	// TODO document
	focusNextTerm: (
		reverse: boolean,
		stepNotJump: boolean,
		term?: MatchTerm,
	) => void

	/**
	 * Gets the number of matches for a term in the document.
	 * @param term A term to get the occurrence count for.
	 * @returns The occurrence count for the term.
	 */
	getTermOccurrenceCount: (
		term: MatchTerm,
		checkExistsOnly?: boolean,
	) => number
}

/**
 * A selector string for the container block of an element.
 */
const containerBlockSelector = `:not(${Array.from(highlightTags.flow).join(", ")})`;

/**
 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
 * @param observer A highlighter-connected observer responsible for listening and responding to document mutations.
 * @returns The manager interface for the observer.
 */
const getMutationUpdates = (observer: () => MutationObserver | null) => ({
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

export {
	Highlighter, HighlighterProcess,
	AbstractEngine,
	getMutationUpdates, getStyleUpdates,
	containerBlockSelector,
};
