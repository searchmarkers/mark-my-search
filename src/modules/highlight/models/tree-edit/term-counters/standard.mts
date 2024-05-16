import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { getTermClass } from "/dist/modules/common.mjs";

class StandardTermCounter implements AbstractTermCounter {
	readonly countBetter = this.countFaster;

	countFaster (term: MatchTerm, termTokens: TermTokens) {
		// This is an unstable heuristic: the more highlight elements are split, the more it overpredicts.
		const occurrences = document.body.getElementsByClassName(getTermClass(term, termTokens));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length;
	}

	exists (term: MatchTerm, termTokens: TermTokens) {
		return document.body.getElementsByClassName(getTermClass(term, termTokens)).length > 0;
	}
}

export { StandardTermCounter };
