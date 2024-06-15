import type { CachingElement } from "/dist/modules/highlight/engines/paint.mjs";

interface Highlightables {
	isElementHighlightable: (element: Element) => boolean

	findHighlightableAncestor: (element: CachingElement) => CachingElement

	/**
	 * From the element specified (included) to its highest ancestor element (not included),
	 * mark each as _an element beneath a highlightable one_ (which could e.g. have a background that obscures highlights).
	 * This allows them to be selected in CSS.
	 * @param element The lowest descendant to be marked of the highlightable element.
	 */
	markElementsUpToHighlightable: (element: Element) => void
}

export type { Highlightables };
