/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

interface Highlightables {
	readonly isElementHighlightable: (element: HTMLElement) => boolean

	readonly findHighlightableAncestor: (element: HTMLElement) => HTMLElement
}

export type { Highlightables };
