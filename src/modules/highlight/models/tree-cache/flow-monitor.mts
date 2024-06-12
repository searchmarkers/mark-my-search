import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	generateBoxesInfo: (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		flowOwner: HTMLElement,
	) => void

	removeBoxesInfo: (
		terms?: Array<MatchTerm>,
		root?: HTMLElement,
	) => void
}

export type { AbstractFlowMonitor };
