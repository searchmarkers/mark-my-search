import type * as Matcher from "src/modules/highlight/matcher.mjs";

const CACHE = "markmysearch__cache";

type TreeCache<Flow = Matcher.Flow> = {
	flows: Array<Flow>
}

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: MatchTerms,
		onElementsAdded: (elements: Set<Element>) => void,
	) => void

	boxesInfoCalculate: (
		terms: MatchTerms,
		flowOwner: Element,
	) => void
}

class DummyFlowMonitor implements AbstractFlowMonitor {
	mutationObserver = new MutationObserver(() => undefined);
	initMutationUpdatesObserver = () => undefined;
	boxesInfoCalculate = () => undefined;
}

export {
	CACHE, TreeCache,
	AbstractFlowMonitor, DummyFlowMonitor,
};
