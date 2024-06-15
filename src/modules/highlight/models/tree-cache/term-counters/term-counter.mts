import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import { type CachingElement, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Flow = BaseFlow<false>

class TermCounter implements AbstractTermCounter {
	countBetter (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has((element as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let count = 0;
		let element: CachingElement<Flow>;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as CachingElement<Flow>) if (CACHE in element) {
			for (const flow of element[CACHE].flows) {
				for (const boxInfo of flow.boxesInfo) {
					if (boxInfo.term === term) {
						count++;
					}
				}
			}
		}
		return count;
	}

	readonly countFaster = this.countBetter;

	exists (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has((element as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: CachingElement<Flow>;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as CachingElement<Flow>) {
			if (CACHE in element && element[CACHE].flows.some(flow =>
				flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length > 0
			)) {
				return true;
			}
		}
		return false;
	}
}

export { TermCounter };
