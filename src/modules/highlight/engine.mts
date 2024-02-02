import { highlightTags } from "/dist/modules/highlight/highlighting.mjs";
import { type AbstractTermCounter, DummyTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import { type AbstractTermWalker, DummyTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import { type AbstractTermMarker, DummyTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Highlighter = { current: AbstractEngine }

type HighlighterProcess =
	| "refreshTermControls"
	| "refreshIndicators"
;

interface AbstractEngine {
	termOccurrences: AbstractTermCounter
	termWalker: AbstractTermWalker
	termMarkers: AbstractTermMarker

	// TODO document each
	getMiscCSS: () => string
	getTermHighlightsCSS: () => string
	getTermHighlightCSS: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => string

	// TODO document
	getTermBackgroundStyle: (colorA: string, colorB: string, cycle: number) => string

	// TODO document
	countMatches: () => void

	/**
	 * Removes previous highlighting, then highlights the document using the terms supplied.
	 * Disables then restarts continuous highlighting.
	 * @param terms Terms to be continuously found and highlighted within the DOM.
	 * @param termsToPurge Terms for which to remove previous highlights.
	 */
	startHighlighting: (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
	) => void
	
	// TODO document
	undoHighlights: (
		terms?: Array<MatchTerm> | undefined,
	) => void

	// TODO document
	endHighlighting: () => void

	/**
	 * Moves to the next (downwards) occurrence of a term in the document, beginning from the current selection position.
	 * If an occurrence is successfully focused, the corresponding term marker in the scrollbar will be raised.
	 * *Refer to the TermWalker and TermMarker interfaces for more details.*
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param stepNotJump 
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 * @returns The element landed on by the function, if any.
	 */
	stepToNextOccurrence: (
		reverse: boolean,
		stepNotJump: boolean,
		term?: MatchTerm,
	) => HTMLElement | null
}

class DummyEngine implements AbstractEngine {
	termOccurrences = new DummyTermCounter();
	termWalker = new DummyTermWalker();
	termMarkers = new DummyTermMarker();
	getMiscCSS = () => "";
	getTermHighlightsCSS = () => "";
	getTermHighlightCSS = () => "";
	getTermBackgroundStyle = () => "";
	countMatches = () => undefined;
	startHighlighting = () => undefined;
	undoHighlights = () => undefined;
	endHighlighting = () => undefined;
	stepToNextOccurrence = () => null;
}

/**
 * A selector string for the container block of an element.
 */
const containerBlockSelector = `:not(${Array.from(highlightTags.flow).join(", ")})`;

/**
 * Gets the containing block of an element.
 * This is its **closest ancestor (inclusive)** which has no tag name counted as `flow` in a highlight tags object.
 * @param element The element of which to find the first container block.
 * @returns The closest container block ancestor.
 */
const getContainerBlock = (element: HTMLElement): HTMLElement =>
	// Always returns an element since "body" is not a flow tag.
	element.closest(containerBlockSelector) as HTMLElement
;

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
	type Highlighter, type HighlighterProcess,
	type AbstractEngine, DummyEngine,
	getMutationUpdates, getStyleUpdates,
	containerBlockSelector, getContainerBlock,
};
