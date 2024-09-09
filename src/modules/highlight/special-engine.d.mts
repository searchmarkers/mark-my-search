/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractSpecialEngine {
	readonly startHighlighting: (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => void

	readonly endHighlighting: () => void

	readonly handles: (element: HTMLElement) => boolean
}

export type { AbstractSpecialEngine };
