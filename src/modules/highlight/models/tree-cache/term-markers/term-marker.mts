import type { AbstractTermMarker } from "/dist/modules/highlight/term-marker.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, getElementYRelative, getTermClass, type AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermMarker implements AbstractTermMarker {
	readonly #termTokens: TermTokens;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	constructor (
		termTokens: TermTokens,
		elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
	) {
		this.#termTokens = termTokens;
		this.#elementFlowsMap = elementFlowsMap;
	}

	insert (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<HTMLElement>,
	) {
		const termsSet = new Set(terms);
		const gutter = document.getElementById(EleID.MARKER_GUTTER)!;
		let markersHtml = "";
		for (const element of highlightedElements) if (this.#elementFlowsMap.has(element)) {
			const highlightedTerms = new Set((this.#elementFlowsMap.get(element) ?? []).flatMap(flow =>
				flow.spans.filter(span => termsSet.has(span.term)).map(span => span.term)
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
