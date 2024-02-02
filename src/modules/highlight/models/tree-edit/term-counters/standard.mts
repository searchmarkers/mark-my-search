import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { getTermClass } from "/dist/modules/common.mjs";

class StandardTermCounter implements AbstractTermCounter {
	betterNumberOf = this.fasterNumberOf;

	fasterNumberOf (term: MatchTerm) {
		// This is an unstable heuristic: the more highlight elements are split, the more it overpredicts.
		const occurrences = document.body.getElementsByClassName(getTermClass(term.token));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length;
	}

	anyOf (term: MatchTerm) {
		return document.body.getElementsByClassName(getTermClass(term.token)).length > 0;
	}
}

export { StandardTermCounter };
