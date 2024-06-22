import type { AbstractTermCounter } from "/dist/modules/highlight/term-counter.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { getTermClass } from "/dist/modules/common.mjs";

class TermCounter implements AbstractTermCounter {
	#termTokens: TermTokens;
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	readonly countBetter = this.countFaster;

	countFaster (term: MatchTerm) {
		// This is an unstable heuristic: the more highlight elements are split, the more it overpredicts.
		const occurrences = document.body.getElementsByClassName(getTermClass(term, this.#termTokens));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length;
	}

	exists (term: MatchTerm) {
		return document.body.getElementsByClassName(getTermClass(term, this.#termTokens)).length > 0;
	}
}

export { TermCounter };
