import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { TreeCache } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

class StandardTermCounter implements AbstractTermCounter {
	betterNumberOf (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(FlowMonitor.CACHE in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let count = 0;
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			(element[FlowMonitor.CACHE] as TreeCache).flows.forEach(flow => {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			});
		}
		return count;
	}

	fasterNumberOf = this.betterNumberOf;

	anyOf (term: MatchTerm) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(FlowMonitor.CACHE in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if ((element[FlowMonitor.CACHE] as TreeCache).flows.some(flow =>
				flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length > 0
			)) {
				return true;
			}
		}
		return false;
	}
}

export { StandardTermCounter };
