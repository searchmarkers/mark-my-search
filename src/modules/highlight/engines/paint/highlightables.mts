interface Highlightables {
	isElementHighlightable: (element: HTMLElement) => boolean

	findHighlightableAncestor: (element: HTMLElement) => HTMLElement
}

export type { Highlightables };
