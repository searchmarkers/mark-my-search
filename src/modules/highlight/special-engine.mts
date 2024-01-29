interface AbstractSpecialEngine {
	startHighlighting: (terms: MatchTerms) => void

	endHighlighting: () => void

	handles: (element: Element) => boolean
}

class DummySpecialEngine implements AbstractSpecialEngine {
	startHighlighting = () => undefined;
	endHighlighting = () => undefined;
	handles = () => false;
}

export { AbstractSpecialEngine, DummySpecialEngine };
