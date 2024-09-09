/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractEngine } from "/dist/modules/highlight/engine.d.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Model = "tree-edit"

interface AbstractTreeEditEngine extends AbstractEngine {
	readonly model: Model

	readonly getHighlightedElementsForTerms: (terms: ReadonlyArray<MatchTerm>) => Iterable<HTMLElement>
}

export type {
	AbstractTreeEditEngine,
};
