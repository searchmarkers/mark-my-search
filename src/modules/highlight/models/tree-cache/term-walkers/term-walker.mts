import type { AbstractTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import { type TreeCache, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass, getNodeFinal, isVisible, elementsPurgeClass, focusClosest } from "/dist/modules/common.mjs";

class TermWalker implements AbstractTermWalker {
	step (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
		termTokens: TermTokens,
		nodeStart?: Node,
	): HTMLElement | null {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		const selection = document.getSelection() as Selection;
		const bar = document.getElementById(EleID.BAR) as HTMLElement;
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = selection ? selection.anchorNode : null;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart
			?? (nodeFocused
				? (nodeSelected ? (nodeFocused.contains(nodeSelected) ? nodeSelected : nodeFocused) : nodeFocused)
				: nodeSelected ?? nodeBegin
			);
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement & { [CACHE]?: TreeCache }) =>
			element[CACHE]?.flows.some(flow =>
				term ? flow.boxesInfo.some(boxInfo => boxInfo.term === term) : flow.boxesInfo.length
			) && isVisible(element)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				this.step(reverse, stepNotJump, term, termTokens, nodeBegin);
			}
			return null;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		focusClosest(element, element =>
			element[CACHE] && (element[CACHE] as TreeCache).flows.length > 0
		);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		return element;
	}

	cleanup () {}
}

export { TermWalker };
