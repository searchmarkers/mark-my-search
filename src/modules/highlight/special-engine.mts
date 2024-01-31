import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractSpecialEngine {
	startHighlighting: (terms: Array<MatchTerm>) => void

	endHighlighting: () => void

	handles: (element: Element) => boolean
}

class DummySpecialEngine implements AbstractSpecialEngine {
	startHighlighting = () => undefined;
	endHighlighting = () => undefined;
	handles = () => false;
}

export { type AbstractSpecialEngine, DummySpecialEngine };
