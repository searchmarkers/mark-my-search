import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { TreeCache } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { highlightTags } from "/dist/modules/highlight/highlighting.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

class StandardTermCounter implements AbstractTermCounter {
	betterNumberOf (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let count = 0;
		let element: Element & { [FlowMonitor.CACHE]?: TreeCache };
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			element[FlowMonitor.CACHE]?.flows.forEach(flow => {
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
		let element: Element & { [FlowMonitor.CACHE]?: TreeCache };
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (element[FlowMonitor.CACHE]?.flows.some(flow =>
				flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length > 0
			)) {
				return true;
			}
		}
		return false;
	}
}

export { StandardTermCounter };
