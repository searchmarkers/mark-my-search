import type { AbstractTermCounter } from "/dist/modules/highlight/term-counter.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface HighlighterCounterInterface {
	readonly termCounter: AbstractTermCounter;
}

interface HighlighterWalkerInterface {
	/**
	 * Moves to the next (downwards) occurrence of a term in the document, beginning from the current selection position.
	 * If an occurrence is successfully focused, the corresponding term marker in the scrollbar will be raised.
	 * *Refer to the TermWalker and TermMarker interfaces for more details.*
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param stepNotJump 
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 * @returns The element landed on by the function, if any.
	 */
	readonly stepToNextOccurrence: (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
	) => HTMLElement | null
}

export type {
	HighlighterCounterInterface,
	HighlighterWalkerInterface,
};
