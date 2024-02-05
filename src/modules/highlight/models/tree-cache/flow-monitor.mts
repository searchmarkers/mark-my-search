import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: Array<MatchTerm>,
		onElementsAdded?: (elements: Set<Element>) => void,
	) => void

	boxesInfoCalculate: (
		terms: Array<MatchTerm>,
		flowOwner: Element,
	) => void
}

export type { AbstractFlowMonitor };
