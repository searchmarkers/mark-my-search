import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { TermHues } from "/dist/modules/common.mjs";

interface AbstractTermMarker {
	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insert: (
		terms: Array<MatchTerm>,
		hues: TermHues,
		highlightedElements: Array<HTMLElement>,
	) => void

	// TODO document
	raise: (
		term: MatchTerm | undefined,
		container: HTMLElement,
	) => void
}

export type { AbstractTermMarker };
