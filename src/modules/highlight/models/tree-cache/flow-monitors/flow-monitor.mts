import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import type {
	TreeCache, CachingElement, CachingHTMLElement,
} from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import { type BaseFlow, matchInTextFlow } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

class FlowMonitor<Flow = BaseFlow<true>> implements AbstractFlowMonitor {
	readonly mutationObserver = new MutationObserver(() => undefined);

	readonly createElementCache: (element: Element) => TreeCache<Flow> = () => ({ flows: [] });

	readonly onHighlightingUpdated: () => void = () => undefined;

	readonly onNewHighlightedAncestor?: (ancestor: HTMLElement) => void = () => undefined;

	readonly onBoxesInfoPopulated?: (element: CachingHTMLElement) => void;
	readonly onBoxesInfoRemoved?: (element: CachingHTMLElement) => void;

	constructor (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		functions: {
			createElementCache: (element: Element) => TreeCache<Flow>,
			onHighlightingUpdated: () => void,
			onNewHighlightedAncestor?: (ancestor: HTMLElement) => void,
			onBoxesInfoPopulated?: (element: CachingHTMLElement) => void,
			onBoxesInfoRemoved?: (element: CachingHTMLElement) => void,
		},
	) {
		this.mutationObserver = this.getMutationUpdatesObserver(terms, termPatterns);
		this.createElementCache = functions.createElementCache;
		this.onHighlightingUpdated = functions.onHighlightingUpdated;
		this.onNewHighlightedAncestor = functions.onNewHighlightedAncestor;
		this.onBoxesInfoPopulated = functions.onBoxesInfoPopulated;
		this.onBoxesInfoRemoved = functions.onBoxesInfoRemoved;
	}

	getMutationUpdatesObserver (terms: Array<MatchTerm>, termPatterns: TermPatterns) {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		return new MutationObserver(mutations => {
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
				for (const node of mutation.removedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						this.removeFlows(node as HTMLElement);
					}
				}
			}
			for (const element of elementsAffected) {
				this.generateBoxesInfoForFlowOwnersFromContent(terms, termPatterns, element);
			}
		});
	}

	generateBoxesInfoForFlowOwnersFromContent (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		element: HTMLElement,
	) {
		// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		if (highlightTags.flow.has(element.tagName)) {
			// The element may include non self-contained flows.
			this.generateBoxesInfoForFlowOwners(terms, termPatterns, element);
		} else {
			// The element can only include self-contained flows, so flows need only be recalculated below the element.
			this.generateBoxesInfo(terms, termPatterns, element);
		}
	}

	generateBoxesInfoForFlowOwners (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		node: Node,
	) {
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
				this.generateBoxesInfo(terms, termPatterns, parent);
			} else {
				// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
				this.generateBoxesInfoForFlowOwners(terms, termPatterns, parent);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.generateBoxesInfo(terms, termPatterns, parent);
		}
	}

	generateBoxesInfo (
		terms: Array<MatchTerm>,
		termPatterns: TermPatterns,
		flowOwner: HTMLElement,
	) {
		if (!flowOwner.firstChild)
			return;
		const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
		const textFlows = getTextFlows(flowOwner.firstChild);
		this.removeFlows(flowOwner);
		textFlows // The first flow is always before the first break, and the last flow after the last break. Either may be empty.
			.slice((breaksFlow && textFlows[0]?.length) ? 0 : 1, (breaksFlow && textFlows.at(-1)?.length) ? undefined : -1)
			.forEach(textFlow => this.flowCacheWithBoxesInfo(terms, termPatterns, textFlow));
		this.onHighlightingUpdated();
	}

	/**
	 * Removes the flows cache from all descendant elements (inclusive).
	 * @param element The ancestor below which to forget flows.
	 */
	removeFlows (ancestor: HTMLElement) {
		if (highlightTags.reject.has(ancestor.tagName)) {
			return;
		}
		if (CACHE in ancestor) {
			this.onBoxesInfoRemoved && this.onBoxesInfoRemoved(ancestor as CachingHTMLElement);
			delete ancestor[CACHE];
		}
		const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: HTMLElement;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as HTMLElement) {
			if (CACHE in element) {
				this.onBoxesInfoRemoved && this.onBoxesInfoRemoved(element as CachingHTMLElement);
				delete element[CACHE];
			}
		}
	}

	/**
	 * Remove highlighting information for specific terms.
	 * @param terms Terms for which to remove highlights. If undefined, all highlights are removed.
	 */
	removeBoxesInfo (terms?: Array<MatchTerm>) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: Element) =>
			highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : (
				(CACHE in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
			)
		);
		let element: CachingElement;
		if (terms) {
			// eslint-disable-next-line no-cond-assign
			while (element = walker.nextNode() as CachingElement) {
				element[CACHE].flows = element[CACHE].flows.filter(flow => {
					flow.boxesInfo = flow.boxesInfo.filter(boxInfo =>
						!terms.includes(boxInfo.term) // TODO-REMOVE this used to compare tokens
					);
					return flow.boxesInfo.length > 0;
				});
				if (element[CACHE].flows.length === 0) {
					delete (element as Element)[CACHE];
				}
			}
		} else {
			// eslint-disable-next-line no-cond-assign
			while (element = walker.nextNode() as CachingElement) {
				delete (element as Element)[CACHE];
			}
		}
	}

	/**
	 * TODO document
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	flowCacheWithBoxesInfo (terms: Array<MatchTerm>, termPatterns: TermPatterns, textFlow: Array<Text>) {
		const text = textFlow.map(node => node.textContent).join("");
		const getAncestorCommon = (ancestor: HTMLElement, node: Node): HTMLElement =>
			ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as HTMLElement, node);
		const ancestor = getAncestorCommon(textFlow[0].parentElement as HTMLElement, textFlow.at(-1) as Text);
		let ancestorHighlighting = ancestor[CACHE] as TreeCache<Flow> | undefined;
		// TODO check that the types used make sense (Flow, BaseFlow, BoxInfo, BaseBoxInfo)
		const flow: BaseFlow<true> = {
			text,
			// Match the terms inside the flow to produce highlighting box info.
			boxesInfo: matchInTextFlow(terms, termPatterns, text, textFlow),
		};
		if (ancestorHighlighting) {
			ancestorHighlighting.flows.push(flow as Flow);
		} else {
			ancestorHighlighting = this.createElementCache(ancestor);
			ancestorHighlighting.flows.push(flow as Flow);
			ancestor[CACHE] = ancestorHighlighting;
		}
		this.onBoxesInfoPopulated && this.onBoxesInfoPopulated(ancestor as CachingHTMLElement);
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

export {
	type CachingElement as ElementWithCache,
	type CachingHTMLElement as HTMLElementWithCache,
	FlowMonitor,
};
