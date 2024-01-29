import * as Matcher from "src/modules/highlight/matcher.mjs";

const CACHE = "markmysearch__cache";

type TreeCache<Flow = Matcher.Flow> = {
	flows: Array<Flow>
}

interface AbstractHighlightability {
	checkElement: (node: Node) => boolean

	findAncestor: <T extends Element>(element: T) => T

	/**
	 * From the element specified (included) to its highest ancestor element (not included),
	 * mark each as _an element beneath a highlightable one_ (which could e.g. have a background that obscures highlights).
	 * This allows them to be selected in CSS.
	 * @param element The lowest descendant to be marked of the highlightable element.
	 */
	markElementsUpTo: (element: Element) => void
}

class StandardHighlightability implements AbstractHighlightability {
	checkElement = () => true;

	findAncestor = <T extends Element>(element: T) => element;

	markElementsUpTo = () => undefined;
}

class CSSPaintHighlightability implements AbstractHighlightability {
	checkElement = (element: Element) => !element.closest("a");

	findAncestor <T extends Element>(element: T) {
		let ancestor = element;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			// Anchors cannot (yet) be highlighted directly inside, due to security concerns with CSS Paint.
			const ancestorUnhighlightable = ancestor.closest("a") as T | null;
			if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
				ancestor = ancestorUnhighlightable.parentElement as unknown as T;
			} else {
				break;
			}
		}
		return ancestor;
	}

	markElementsUpTo (element: Element) {
		if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
			element.setAttribute("markmysearch-h_beneath", "");
			this.markElementsUpTo(element.parentElement as Element);
		}
	}
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
	AbstractHighlightability, StandardHighlightability, CSSPaintHighlightability,
	AbstractFlowMonitor, DummyFlowMonitor,
};
