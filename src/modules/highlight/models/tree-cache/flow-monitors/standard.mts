import type { TreeCache, AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { highlightTags } from "/dist/modules/highlight/highlighting.mjs";
import { type BaseFlow, matchInTextFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

class StandardFlowMonitor<Flow = BaseFlow<true>> implements AbstractFlowMonitor {
	mutationObserver = new MutationObserver(() => undefined);

	createElementCache: (element: Element) => TreeCache<Flow> = () => ({ flows: [] });

	onHighlightingUpdated: () => void = () => undefined;

	onNewHighlightedAncestor?: (ancestor: Element) => void = () => undefined;

	onBoxesInfoPopulated?: (element: Element) => void;
	onBoxesInfoRemoved?: (element: Element) => void;

	constructor (
		createElementCache: (element: Element) => TreeCache<Flow>,
		onHighlightingUpdated: () => void,
		onNewHighlightedAncestor?: (ancestor: Element) => void,
		onBoxesInfoPopulated?: (element: Element & { [FlowMonitor.CACHE]: TreeCache<Flow> }) => void,
		onBoxesInfoRemoved?: (element: Element & { [FlowMonitor.CACHE]: TreeCache<Flow> }) => void,
	) {
		this.createElementCache = createElementCache;
		this.onHighlightingUpdated = onHighlightingUpdated;
		this.onNewHighlightedAncestor = onNewHighlightedAncestor;
		this.onBoxesInfoPopulated = onBoxesInfoPopulated;
		this.onBoxesInfoRemoved = onBoxesInfoRemoved;
	}

	initMutationUpdatesObserver (
		terms: Array<MatchTerm>,
		onElementsAdded?: (elements: Set<HTMLElement>) => void,
	) {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		this.mutationObserver = new MutationObserver(mutations => {
			// TODO optimise
			const elementsAffected: Set<HTMLElement> = new Set();
			const elementsAdded: Set<HTMLElement> = new Set();
			for (const mutation of mutations) {
				if (mutation.type === "characterData"
					&& mutation.target.parentElement
					&& canHighlightElement(rejectSelector, mutation.target.parentElement)
				) {
					elementsAffected.add(mutation.target.parentElement);
				}
				for (const node of mutation.addedNodes) if (node.parentElement) {
					switch (node.nodeType) {
					case Node.ELEMENT_NODE: {
						const element = node as HTMLElement;
						if (canHighlightElement(rejectSelector, element)) {
							elementsAdded.add(element);
							elementsAffected.add(element);
						}
						break;
					}
					case Node.TEXT_NODE: {
						if (canHighlightElement(rejectSelector, node.parentElement)) {
							elementsAffected.add(node.parentElement);
						}
						break;
					}}
				}
				//this.onBoxesInfoCleared && this.onBoxesInfoCleared(Array.from(mutation.removedNodes).flatMap(node =>
				//	(node[FlowMonitor.CACHE] as TreeCache<Flow> | undefined)?.flows.flatMap(flow => flow.boxesInfo) ?? []
				//));
				//if (this.onBoxesInfoCleared) {
				//	for (const node of mutation.removedNodes) {
				//		if (node[FlowMonitor.CACHE]) {
				//			this.onBoxesInfoCleared(node as Element);
				//		}
				//	}
				//}
				for (const node of mutation.removedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						this.flowsRemove(node as Element);
					}
				}
			}
			onElementsAdded && onElementsAdded(elementsAdded);
			for (const element of elementsAffected) {
				this.boxesInfoCalculateForFlowOwnersFromContent(terms, element);
			}
		});
	}

	boxesInfoCalculateForFlowOwnersFromContent (terms: Array<MatchTerm>, element: Element) {
		// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		if (highlightTags.flow.has(element.tagName)) {
			// The element may include non self-contained flows.
			this.boxesInfoCalculateForFlowOwners(terms, element);
		} else {
			// The element can only include self-contained flows, so flows need only be recalculated below the element.
			this.boxesInfoCalculate(terms, element);
		}
	}

	boxesInfoCalculateForFlowOwners (terms: Array<MatchTerm>, node: Node) {
		// Text flows may have been disrupted at `node`, so flows which include it must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		const parent = node.parentElement;
		if (!parent) {
			return;
		}
		if (highlightTags.flow.has(parent.tagName)) {
			// The parent may include non self-contained flows.
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
			walker.currentNode = node;
			let breakFirst: Element | null = walker.previousNode() as Element;
			while (breakFirst && highlightTags.flow.has(breakFirst.tagName)) {
				breakFirst = breakFirst !== parent ? walker.previousNode() as Element : null;
			}
			walker.currentNode = node.nextSibling ?? node;
			let breakLast: Element | null = node.nextSibling ? walker.nextNode() as Element : null;
			while (breakLast && highlightTags.flow.has(breakLast.tagName)) {
				breakLast = parent.contains(breakLast) ? walker.nextNode() as Element : null;
			}
			if (breakFirst && breakLast) {
				// The flow containing the node starts and ends within the parent, so flows need only be recalculated below the parent.
				// ALL flows of descendants are recalculated. See below.
				this.boxesInfoCalculate(terms, parent);
			} else {
				// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
				this.boxesInfoCalculateForFlowOwners(terms, parent);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.boxesInfoCalculate(terms, parent);
		}
	}

	boxesInfoCalculate (terms: Array<MatchTerm>, flowOwner: Element) {
		if (!flowOwner.firstChild)
			return;
		const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
		const textFlows = getTextFlows(flowOwner.firstChild);
		this.flowsRemove(flowOwner);
		textFlows // The first flow is always before the first break, and the last flow after the last break. Either may be empty.
			.slice((breaksFlow && textFlows[0]?.length) ? 0 : 1, (breaksFlow && textFlows.at(-1)?.length) ? undefined : -1)
			.forEach(textFlow => this.flowCacheWithBoxesInfo(terms, textFlow));
		this.onHighlightingUpdated();
	}

	/**
	 * Removes the flows cache from all descendant elements (inclusive).
	 * @param element The ancestor below which to forget flows.
	 */
	flowsRemove (ancestor: Element) {
		if (highlightTags.reject.has(ancestor.tagName)) {
			return;
		}
		if (ancestor[FlowMonitor.CACHE]) {
			this.onBoxesInfoRemoved && this.onBoxesInfoRemoved(ancestor);
			delete ancestor[FlowMonitor.CACHE];
		}
		const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (element[FlowMonitor.CACHE]) {
				this.onBoxesInfoRemoved && this.onBoxesInfoRemoved(element);
				delete element[FlowMonitor.CACHE];
			}
		}
	}

	/**
	 * TODO document
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	flowCacheWithBoxesInfo (terms: Array<MatchTerm>, textFlow: Array<Text>) {
		const text = textFlow.map(node => node.textContent).join("");
		const getAncestorCommon = (ancestor: Element, node: Node): Element =>
			ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as Element, node);
		const ancestor = getAncestorCommon(textFlow[0].parentElement as Element, textFlow.at(-1) as Text);
		let ancestorHighlighting = ancestor[FlowMonitor.CACHE] as TreeCache<Flow> | undefined;
		// TODO check that the types used make sense (Flow, BaseFlow, BoxInfo, BaseBoxInfo)
		const flow: BaseFlow<true> = {
			text,
			// Match the terms inside the flow to produce highlighting box info.
			boxesInfo: matchInTextFlow(terms, text, textFlow),
		};
		if (ancestorHighlighting) {
			ancestorHighlighting.flows.push(flow as Flow);
		} else {
			ancestorHighlighting = this.createElementCache(ancestor);
			ancestorHighlighting.flows.push(flow as Flow);
			ancestor[FlowMonitor.CACHE] = ancestorHighlighting;
		}
		this.onBoxesInfoPopulated && this.onBoxesInfoPopulated(ancestor);
		if (flow.boxesInfo.length > 0) {
			this.onNewHighlightedAncestor && this.onNewHighlightedAncestor(ancestor);
		}
	}
}

/**
 * Determines whether or not the highlighting algorithm should be run on an element.
 * @param rejectSelector A selector string for ancestor tags to cause rejection.
 * @param element An element to test for highlighting viability.
 * @returns `true` if determined highlightable, `false` otherwise.
 */
const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
	!element.closest(rejectSelector)
;

/**
 * Gets an array of all flows from the node provided to its last OR first sibling,
 * where a 'flow' is an array of text nodes considered to flow into each other in the document.
 * For example, a paragraph will _ideally_ be considered a flow, but in fact may not be heuristically detected as such.
 * @param node The node from which flows are collected, up to the last descendant of its last sibling.
 * @param textFlows __Only supplied in recursion.__ Holds the flows gathered so far.
 * @param textFlow __Only supplied in recursion.__ Points to the last flow in `textFlows`.
 */
const getTextFlows = (
	node: Node,
	textFlows: Array<Array<Text>> = [ [] ],
	textFlow: Array<Text> = textFlows[0],
): Array<Array<Text>> => {
	do {
		if (node.nodeType === Node.TEXT_NODE) {
			textFlow.push(node as Text);
		} else if ((node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
			&& !highlightTags.reject.has((node as Element).tagName)) {
			const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
			if (breaksFlow && (textFlow.length || textFlows.length === 1)) { // Ensure the first flow is always the one before a break.
				textFlow = [];
				textFlows.push(textFlow);
			}
			if (node.firstChild) {
				getTextFlows(node.firstChild, textFlows, textFlow);
				textFlow = textFlows[textFlows.length - 1];
				if (breaksFlow && textFlow.length) {
					textFlow = [];
					textFlows.push(textFlow);
				}
			}
		}
		node = node.nextSibling as ChildNode; // May be null (checked by loop condition).
	} while (node);
	return textFlows;
};

export { StandardFlowMonitor };
