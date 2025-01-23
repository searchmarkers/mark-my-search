/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { Engine, RContainer } from "/dist/modules/common.mjs";

type Model = "tree-edit" | "tree-cache"

interface AbstractEngine extends Highlighter {
	readonly class: Engine
	readonly model: Model

	readonly terms: RContainer<ReadonlyArray<MatchTerm>>;
	readonly hues: RContainer<ReadonlyArray<number>>;

	readonly deactivate: () => void

	readonly getHighlightedElements: () => Iterable<HTMLElement>
}

interface Highlighter extends HighlighterCSSInterface, HighlightingInterface {}

interface HighlighterCSSInterface {
	readonly getTermBackgroundStyle: (colorA: string, colorB: string, cycle: number) => string
}

interface HighlightingInterface {
	/**
	 * Removes previous highlighting, then highlights the document using the terms supplied.
	 * Disables then restarts continuous highlighting.
	 * @param terms Terms to be continuously found and highlighted within the DOM.
	 */
	readonly startHighlighting: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) => void

	readonly endHighlighting: () => void

	readonly addHighlightingUpdatedListener: (listener: () => void) => void
}

export type {
	AbstractEngine,
	Highlighter,
	HighlighterCSSInterface,
	HighlightingInterface,
};
