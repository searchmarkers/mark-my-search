import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractSpecialEngine {
	readonly startHighlighting: (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => void

	readonly endHighlighting: () => void

	readonly handles: (element: HTMLElement) => boolean
}

export type { AbstractSpecialEngine };
