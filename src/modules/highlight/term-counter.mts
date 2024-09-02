/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractTermCounter {
	/**
	 * Gets the number of matches for a term in the document.
	 * This method **prioritises accuracy** compared to its sibling.
	 * @param term A term to get the occurrence count for.
	 * @returns The **more accurate** occurrence count for the term.
	 */
	readonly countBetter: (term: MatchTerm) => number;

	/**
	 * Gets the number of matches for a term in the document.
	 * This method **prioritises speed** compared to its sibling.
	 * @param term A term to get the occurrence count for.
	 * @returns The **less accurate** occurrence count for the term.
	 */
	readonly countFaster: (term: MatchTerm) => number;

	// TODO document
	readonly exists: (term: MatchTerm) => boolean;
}

export type { AbstractTermCounter };
