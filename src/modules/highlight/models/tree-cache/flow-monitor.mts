import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
	) => void

	generateBoxesInfo: (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		flowOwner: Element,
	) => void

	removeBoxesInfo: (
		terms?: Array<MatchTerm>,
		root?: HTMLElement,
	) => void
}

export type { AbstractFlowMonitor };
