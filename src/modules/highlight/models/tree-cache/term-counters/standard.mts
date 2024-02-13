import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import { type TreeCache, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

class StandardTermCounter implements AbstractTermCounter {
	betterNumberOf (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let count = 0;
		let element: Element & { [CACHE]?: TreeCache };
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			element[CACHE]?.flows.forEach(flow => {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			});
		}
		return count;
	}

	fasterNumberOf = this.betterNumberOf;

	anyOf (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: Element & { [CACHE]?: TreeCache };
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (element[CACHE]?.flows.some(flow =>
				flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length > 0
			)) {
				return true;
			}
		}
		return false;
	}
}

export { StandardTermCounter };
