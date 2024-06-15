import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver

	generateBoxesInfo: (
		terms: ReadonlyArray<MatchTerm>,
		termPatterns: TermPatterns,
		flowOwner: HTMLElement,
	) => void

	removeBoxesInfo: (
		terms?: ReadonlyArray<MatchTerm>,
		root?: HTMLElement,
	) => void
}

export type { AbstractFlowMonitor };
