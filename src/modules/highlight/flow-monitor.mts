import type * as Matcher from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

const CACHE = "markmysearch__cache";

type TreeCache<Flow = Matcher.Flow> = {
	flows: Array<Flow>
}

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: Array<MatchTerm>,
		onElementsAdded: (elements: Set<Element>) => void,
	) => void

	boxesInfoCalculate: (
		terms: Array<MatchTerm>,
		flowOwner: Element,
	) => void
}

class DummyFlowMonitor implements AbstractFlowMonitor {
	mutationObserver = new MutationObserver(() => undefined);
	initMutationUpdatesObserver = () => undefined;
	boxesInfoCalculate = () => undefined;
}

export {
	CACHE, type TreeCache,
	type AbstractFlowMonitor, DummyFlowMonitor,
};
