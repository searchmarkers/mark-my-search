import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import type { TreeCache } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { EleID, getElementYRelative, type TermHues, getTermClass } from "/dist/modules/common.mjs";

class StandardTermMarker implements AbstractTermMarker {
	insert (terms: Array<MatchTerm>, hues: TermHues, highlightedElements: Array<HTMLElement>) {
		if (terms.length === 0) {
			return; // Efficient escape in case of no possible markers to be inserted.
		}
		// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
		const termsAllowed = new Set(terms.slice(0, hues.length));
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		let markersHtml = "";
		for (const element of highlightedElements) {
			const terms = (element[FlowMonitor.CACHE] as TreeCache | undefined)?.flows.flatMap(flow => flow.boxesInfo
				.map(boxInfo => boxInfo.term)
				.filter(term => termsAllowed.has(term))
			) ?? [];
			const yRelative = getElementYRelative(element);
			// TODO use single marker with custom style
			markersHtml += terms.map((term, i) => `<div class="${
				getTermClass(term.token)
			}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`);
		}
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raise (term: MatchTerm | undefined, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
}

export { StandardTermMarker };
