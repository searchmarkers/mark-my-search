import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import { type CachingHTMLElement, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, getElementYRelative, getTermClass } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermMarker implements AbstractTermMarker {
	insert (
		terms: ReadonlyArray<MatchTerm>,
		termTokens: TermTokens,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<CachingHTMLElement<Flow>>,
	) {
		if (terms.length === 0) {
			return; // Efficient escape in case of no possible markers to be inserted.
		}
		// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
		const termsAllowed = new Set(terms.slice(0, hues.length));
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		let markersHtml = "";
		for (const element of highlightedElements) if (CACHE in element) {
			const terms = new Set(element[CACHE].flows.flatMap(flow =>
				flow.boxesInfo.filter(boxInfo => termsAllowed.has(boxInfo.term)).map(boxInfo => boxInfo.term)
			));
			const yRelative = getElementYRelative(element);
			// TODO use single marker with custom style
			markersHtml += Array.from(terms).map((term, i) => `<div class="${
				getTermClass(term, termTokens)
			}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`);
		}
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raise (term: MatchTerm | null, termTokens: TermTokens, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
}

export { TermMarker };