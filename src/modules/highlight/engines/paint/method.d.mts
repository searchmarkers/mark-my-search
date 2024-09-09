/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.d.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractMethod {
	readonly deactivate: () => void

	readonly startHighlighting: (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => void

	readonly endHighlighting: () => void

	readonly highlightables?: Highlightables

	/**
	 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
	 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
	 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
	 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
	 */
	readonly constructHighlightStyleRule: (
		highlightId: number,
		boxes: ReadonlyArray<Box>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => string
}

export type { AbstractMethod };
