import type { AbstractTermMarker } from "/dist/modules/highlight/term-marker.mjs";
import { type CachingHTMLElement, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, getElementYRelative, getTermClass } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermMarker implements AbstractTermMarker {
	#termTokens: TermTokens;
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	insert (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<CachingHTMLElement<Flow>>,
	) {
		const termsSet = new Set(terms);
		const gutter = document.getElementById(EleID.MARKER_GUTTER)!;
		let markersHtml = "";
		for (const element of highlightedElements) if (CACHE in element) {
			const highlightedTerms = new Set(element[CACHE].flows.flatMap(flow =>
				flow.boxesInfo.filter(boxInfo => termsSet.has(boxInfo.term)).map(boxInfo => boxInfo.term)
			));
			const yRelative = getElementYRelative(element);
			// TODO use single marker with custom style
			markersHtml += Array.from(highlightedTerms)
				.map((term, i) => `<div class="${
					getTermClass(term, this.#termTokens)
				}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`)
				.join("");
		}
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raise (term: MatchTerm | null, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
}

export { TermMarker };
