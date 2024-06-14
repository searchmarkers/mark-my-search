import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractSpecialEngine {
	startHighlighting: (terms: Array<MatchTerm>, hues: Array<number>) => void

	endHighlighting: () => void

	handles: (element: Element) => boolean
}

export type { AbstractSpecialEngine };
