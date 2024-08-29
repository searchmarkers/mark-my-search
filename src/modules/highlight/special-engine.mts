import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractSpecialEngine {
	startHighlighting: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) => void

	endHighlighting: () => void

	handles: (element: HTMLElement) => boolean
}

export type { AbstractSpecialEngine };
