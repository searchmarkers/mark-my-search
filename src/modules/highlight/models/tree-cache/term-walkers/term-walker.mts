import type { AbstractTermWalker } from "/dist/modules/highlight/term-walker.mjs";
import { type CachingHTMLElement, CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { EleID, EleClass, getNodeFinal, isVisible, elementsPurgeClass, focusClosest } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermWalker implements AbstractTermWalker {
	step (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
		nodeStart?: Node,
	): CachingHTMLElement<Flow> | null {
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
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_ELEMENT,
			(term
				// If a term has been passed, we are looking for elements with at least 1 occurrence of that term.
				? element => (CACHE in element
					&& element[CACHE].flows.some(flow => flow.boxesInfo.some(boxInfo => boxInfo.term === term))
					&& isVisible(element)
				) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
				// If NO term has been passed, we are looking for elements with any highlighting.
				: element => (CACHE in element
					&& element[CACHE].flows.some(flow => flow.boxesInfo.length > 0)
					&& isVisible(element)
				) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
			) as ((element: CachingHTMLElement<Flow>) => number) as (node: Node) => number,
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]() as CachingHTMLElement<Flow> | null;
		if (!element) {
			if (!nodeStart) {
				this.step(reverse, stepNotJump, term, nodeBegin);
			}
			return null;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		focusClosest(element, element => CACHE in element && element[CACHE].flows.length > 0);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		return element;
	}

	cleanup () {}
}

export { TermWalker };
