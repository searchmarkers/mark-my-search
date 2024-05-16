import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";

interface AbstractTermCounter {
	/**
	 * Gets the number of matches for a term in the document.
	 * This method **prioritises accuracy** compared to its sibling.
	 * @param term A term to get the occurrence count for.
	 * @returns The **more accurate** occurrence count for the term.
	 */
	countBetter: (term: MatchTerm, termTokens: TermTokens) => number;

	/**
	 * Gets the number of matches for a term in the document.
	 * This method **prioritises speed** compared to its sibling.
	 * @param term A term to get the occurrence count for.
	 * @returns The **less accurate** occurrence count for the term.
	 */
	countFaster: (term: MatchTerm, termTokens: TermTokens) => number;

	// TODO document
	exists: (term: MatchTerm, termTokens: TermTokens) => boolean;
}

export type { AbstractTermCounter };
