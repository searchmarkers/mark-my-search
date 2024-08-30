interface Highlightables {
	readonly isElementHighlightable: (element: HTMLElement) => boolean

	readonly findHighlightableAncestor: (element: HTMLElement) => HTMLElement
}

export type { Highlightables };
