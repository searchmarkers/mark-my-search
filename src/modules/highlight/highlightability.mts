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

export { AbstractHighlightability, StandardHighlightability }
