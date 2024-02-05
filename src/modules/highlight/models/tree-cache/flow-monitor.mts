import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

const CACHE = "markmysearch__cache";

type TreeCache<Flow = BaseFlow<false>> = {
	flows: Array<Flow>
}

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

export {
	CACHE, type TreeCache,
	type AbstractFlowMonitor,
};
