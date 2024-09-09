/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermMarker } from "/dist/modules/highlight/tools/term-marker.d.mjs";
import { Styles } from "/dist/modules/highlight/tools/term-marker/common.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, getElementYRelative, getTermClass, type AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermMarker implements AbstractTermMarker {
	readonly #termTokens: TermTokens;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #termsStyleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #scrollGutter: HTMLElement;

	constructor (
		termTokens: TermTokens,
		elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
	) {
		this.#termTokens = termTokens;
		this.#elementFlowsMap = elementFlowsMap;
		this.#styleManager.setStyle(Styles.mainCSS);
		this.#scrollGutter = document.createElement("div");
		this.#scrollGutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", this.#scrollGutter);
	}

	deactivate () {
		this.#scrollGutter.remove();
		this.#termsStyleManager.deactivate();
		this.#styleManager.deactivate();
	}

	insert (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<HTMLElement>,
	) {
		this.setTermsStyle(terms, hues);
		const termsSet = new Set(terms);
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
		this.#scrollGutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		this.#scrollGutter.innerHTML = markersHtml;
	}

	setTermsStyle (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const styles = terms.map((term, i) => Styles.getTermCSS(term, i, hues, this.#termTokens));
		this.#termsStyleManager.setStyle(styles.join(""));
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raise (term: MatchTerm | null, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
}

export { TermMarker };
