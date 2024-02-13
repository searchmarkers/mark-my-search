import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Highlighter = { current?: AbstractEngine }

type HighlighterProcess =
	| "refreshTermControls"
	| "refreshIndicators"
;

interface EngineCSS {
	misc: () => string
	termHighlights: () => string
	termHighlight: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => string
}

interface AbstractEngine {
	termOccurrences?: AbstractTermCounter
	termWalker?: AbstractTermWalker
	termMarkers?: AbstractTermMarker

	getCSS?: EngineCSS

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

export {
	type Highlighter, type HighlighterProcess,
	type AbstractEngine, type EngineCSS,
};
