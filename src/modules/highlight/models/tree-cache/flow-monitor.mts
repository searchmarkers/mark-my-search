import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: Array<MatchTerm>,
	) => void

	generateBoxesInfo: (
		terms: Array<MatchTerm>,
		flowOwner: Element,
	) => void

	removeBoxesInfo: (
		terms?: Array<MatchTerm>,
		root?: HTMLElement,
	) => void
}

export type { AbstractFlowMonitor };
