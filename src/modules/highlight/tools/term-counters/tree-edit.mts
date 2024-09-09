/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermCounter } from "/dist/modules/highlight/tools/term-counter.d.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { getTermClass } from "/dist/modules/common.mjs";

class TermCounter implements AbstractTermCounter {
	readonly #termTokens: TermTokens;
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	countBetter (term: MatchTerm): number {
		return this.countFaster(term);
	}

	countFaster (term: MatchTerm): number {
		// This is an unstable heuristic: the more highlight elements are split, the more it overpredicts.
		const occurrences = document.body.getElementsByClassName(getTermClass(term, this.#termTokens));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length;
	}

	exists (term: MatchTerm): boolean {
		return document.body.getElementsByClassName(getTermClass(term, this.#termTokens)).length > 0;
	}
}

export { TermCounter };
