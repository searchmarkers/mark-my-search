/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermCounter } from "/dist/modules/highlight/tools/term-counter.d.mjs";
import type { BaseFlow } from "/dist/modules/highlight/common/matcher.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermCounter implements AbstractTermCounter {
	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	constructor (elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>) {
		this.#elementFlowsMap = elementFlowsMap;
	}

	countBetter (term: MatchTerm): number {
		return this.countFaster(term);
	}

	countFaster (term: MatchTerm): number {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let count = 0;
		let element: Node | null;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode()) if (element instanceof HTMLElement && this.#elementFlowsMap.has(element)) {
			for (const flow of this.#elementFlowsMap.get(element) ?? []) {
				for (const span of flow.spans) {
					if (span.term === term) {
						count++;
					}
				}
			}
		}
		return count;
	}

	exists (term: MatchTerm): boolean {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: Node | null;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode()) if (element instanceof HTMLElement) {
			if (this.#elementFlowsMap.get(element)?.some(flow =>
				flow.spans.filter(span => span.term === term).length > 0
			)) {
				return true;
			}
		}
		return false;
	}
}

export { TermCounter };
