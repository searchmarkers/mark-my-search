/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Flow, Span, AbstractFlowTracker } from "/dist/modules/highlight/models/tree-cache/flow-tracker.d.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import { matchInTextFlow } from "/dist/modules/highlight/common/matching.mjs";
import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";
import type { RContainer, AllReadonly } from "/dist/modules/common.mjs";

type InternalFlow = Flow & {
	firstNode: Text
}

class FlowTracker implements AbstractFlowTracker {
	readonly #termPatterns: TermPatterns;

	/**
	 * A MutationObserver which responds to mutations by calling methods
	 * to update cached highlighting information, based on the elements changed.
	 * @returns The MutationObserver object.
	 */
	readonly #mutationObserver: MutationObserver;

	readonly #elementFlowsMap = new Map<HTMLElement, Array<InternalFlow>>();

	/**
	 * 
	 * @param terms A live container of the *current terms being highlighted*.
	 * Highlighting is assumed to be up-to-date with the current terms,
	 * so as soon as the terms are updated, a highlighting method should always be called.
	 * TODO add an abstraction layer which manages this automatically
	 * @param termPatterns 
	 */
	constructor (
		terms: RContainer<ReadonlyArray<MatchTerm>>,
		termPatterns: TermPatterns,
	) {
		this.#termPatterns = termPatterns;
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		this.#mutationObserver = new MutationObserver(mutations => {
			// TODO optimise
			const elementsAffected = new Set<HTMLElement>();
			//const elementsAdded: Set<HTMLElement> = new Set();
			for (const mutation of mutations) {
				if (mutation.type === "characterData"
					&& mutation.target.parentElement
					&& this.canHighlightElement(rejectSelector, mutation.target.parentElement)
				) {
					elementsAffected.add(mutation.target.parentElement);
				}
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLElement) {
						if (this.canHighlightElement(rejectSelector, node)) {
							//elementsAdded.add(node);
							elementsAffected.add(node);
						}
						break;
					} else if (node instanceof Text && node.parentElement) {
						if (this.canHighlightElement(rejectSelector, node.parentElement)) {
							elementsAffected.add(node.parentElement);
						}
						break;
					}
				}
				for (const node of mutation.removedNodes) {
					if (node instanceof HTMLElement) {
						this.removeHighlighting(node, false);
					}
				}
			}
			for (const element of elementsAffected) {
				// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated.
				// We assume that ALL such flows are incorrect.
				// TODO avoid recalculating the same box info or flow on the same pass
				if (highlightTags.flow.has(element.tagName)) {
					// The element may include non self-contained flows.
					this.generateSpansForFlowOwners(terms.current, element, false);
				} else {
					// The element can only include self-contained flows, so flows need only be recalculated below the element.
					this.generateHighlightSpansFor(terms.current, element, false);
				}
			}
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		});
	}

	observeMutations () {
		this.#mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
	}

	unobserveMutations () {
		this.#mutationObserver.disconnect();
	}

	generateSpansForFlowOwners (
		terms: ReadonlyArray<MatchTerm>,
		node: Node,
		fireUpdatedListeners = true,
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
			let breakFirst = walker.previousNode();
			while (breakFirst && highlightTags.flow.has(breakFirst.nodeName)) {
				breakFirst = breakFirst !== parent ? walker.previousNode() : null;
			}
			walker.currentNode = node.nextSibling ?? node;
			let breakLast = node.nextSibling ? walker.nextNode() : null;
			while (breakLast && highlightTags.flow.has(breakLast.nodeName)) {
				breakLast = parent.contains(breakLast) ? walker.nextNode() : null;
			}
			if (breakFirst && breakLast) {
				// The flow containing the node starts and ends within the parent, so flows need only be recalculated below the parent.
				// ALL flows of descendants are recalculated. See below.
				this.generateHighlightSpansFor(terms, parent, fireUpdatedListeners);
			} else {
				// The flow containing the node may leave the parent, which may have disrupted the text flows of an ancestor.
				this.generateSpansForFlowOwners(terms, parent);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.generateHighlightSpansFor(terms, parent, fireUpdatedListeners);
		}
	}

	/**
	 * @param terms The terms to highlight. Highlighting is removed for all terms not included.
	 * @param root The highest element below which to generate highlight spans for flows.
	 * This is assumed to be a flow-breaking element; an element at whose boundaries text flows start and end.
	 * Otherwise the function would need to look above the element, since the boundary flows would extend outside.
	 */
	generateHighlightSpansFor (
		terms: ReadonlyArray<MatchTerm>,
		root: HTMLElement = document.body,
		fireUpdatedListeners = true,
	) {
		if (!root.firstChild) {
			return;
		}
		const elementBreaksFlow = !highlightTags.flow.has(root.tagName);
		const textFlows: ReadonlyArray<ReadonlyArray<Text>> = this.getTextFlows(root.firstChild);
		for ( // The first flow is always before the first break, and the last flow after the last break. Either may be empty.
			let i = (elementBreaksFlow && textFlows[0].length) ? 0 : 1;
			i < textFlows.length + ((elementBreaksFlow && textFlows[textFlows.length - 1].length) ? 0 : -1);
			i++
		) {
			this.cacheFlowWithSpans(terms, textFlows[i]);
		}
		if (fireUpdatedListeners) {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		}
	}

	/**
	 * We assume that the highlighting information is fully correct for the old array of terms
	 * (i.e. it hasn't become malformed by the document changing shape).
	 * The only work to be done here is changing *which* terms are highlighted in the element-flows-spans cache.
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	cacheFlowWithSpans (terms: ReadonlyArray<MatchTerm>, textFlow: ReadonlyArray<Text>) {
		const text = textFlow.map(node => node.textContent).join("");
		const flowOwner = this.getTextAncestorCommon(
			textFlow[0].parentElement!,
			textFlow[textFlow.length - 1],
		)!;
		// Match the terms inside the flow to produce highlighting box info.
		const spansMatched = matchInTextFlow(terms, this.#termPatterns, text, textFlow);
		let flows = this.#elementFlowsMap.get(flowOwner);
		if (!flows) {
			flows = [];
			this.#elementFlowsMap.set(flowOwner, flows);
		}
		const previousOwnedSpanCount = flows.reduce(
			(previous, current) => previous + current.spans.length, 0,
		);
		const flowIndex = flows.findIndex(flow => flow.firstNode === textFlow[0]);
		const flowPreviousSpans = flowIndex !== -1 ? flows[flowIndex].spans : undefined;
		if (flowIndex !== -1) {
			if (spansMatched.length > 0) {
				// Assumption: the text property is the same,
				// as the document hasn't changed shape here since last being highlighted.
				flows[flowIndex].spans = spansMatched;
			} else {
				flows.splice(flowIndex, 1);
			}
		} else if (spansMatched.length > 0) {
			flows.push({
				text,
				spans: spansMatched,
				firstNode: textFlow[0],
			});
		}
		if (this.#newSpanOwnerListener && previousOwnedSpanCount === 0 && spansMatched.length > 0) {
			this.#newSpanOwnerListener(flowOwner);
		} else if (this.#nonSpanOwnerListener
			&& previousOwnedSpanCount > 0
			&& previousOwnedSpanCount === flowPreviousSpans?.length
			&& spansMatched.length === 0
		) {
			this.#nonSpanOwnerListener(flowOwner);
		}
		if (this.#spansRemovedListener && flowPreviousSpans && flowPreviousSpans.length > 0) {
			this.#spansRemovedListener(flowOwner, flowPreviousSpans);
		}
		if (this.#spansCreatedListener && spansMatched.length > 0) {
			this.#spansCreatedListener(flowOwner, spansMatched);
		}
	}

	/**
	 * @param terms The terms for which to remove highlighting.
	 * @param fireUpdatedListeners Whether to fire listeners of {@link addHighlightingUpdatedListener}.
	 */
	removeHighlightSpansFor (
		terms: ReadonlyArray<MatchTerm>,
		fireUpdatedListeners = true,
	) {
		for (const [ element, flows ] of this.#elementFlowsMap) {
			const spansRemoved: Array<Span> = [];
			const flowsNew = flows.filter(flow => {
				flow.spans = flow.spans.filter(span => {
					if (terms.includes(span.term)) {
						spansRemoved.push(span);
						return false;
					}
					return true;
				});
				return flow.spans.length > 0;
			});
			if (flowsNew.length > 0) {
				this.#elementFlowsMap.set(element, flowsNew);
				if (this.#spansRemovedListener && spansRemoved.length > 0) {
					this.#spansRemovedListener(element, spansRemoved);
				}
			} else {
				this.#elementFlowsMap.delete(element);
				if (this.#spansRemovedListener) {
					this.#spansRemovedListener(element, spansRemoved);
				}
				if (this.#nonSpanOwnerListener) {
					this.#nonSpanOwnerListener(element);
				}
			}
		}
		if (fireUpdatedListeners) {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		}
	}

	/**
	 * Removes highlighting from all descendant elements (inclusive).
	 * @param root The element below which to remove highlighting.
	 */
	removeHighlighting (
		root: HTMLElement,
		fireUpdatedListeners = true,
	) {
		if (highlightTags.reject.has(root.tagName)) {
			return;
		}
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: Node | null = root;
		do if (element instanceof HTMLElement) {
			// Delete all flows with highlight spans from the element; if they existed, call appropriate callbacks.
			const flows = this.#elementFlowsMap.get(element);
			if (flows) {
				this.#elementFlowsMap.delete(element);
				if (this.#spansRemovedListener) {
					this.#spansRemovedListener(element, flows.flatMap(flow => flow.spans));
				}
				if (this.#nonSpanOwnerListener) {
					this.#nonSpanOwnerListener(element);
				}
			}
		// eslint-disable-next-line no-cond-assign
		} while (element = walker.nextNode());
		if (fireUpdatedListeners) {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		}
	}

	/**
	 * @param fireUpdatedListeners Whether to fire listeners of {@link addHighlightingUpdatedListener}.
	 */
	removeHighlightSpans (fireUpdatedListeners = true) {
		if (this.#spansRemovedListener || this.#nonSpanOwnerListener) {
			for (const [ element, flows ] of this.#elementFlowsMap) {
				if (this.#spansRemovedListener) {
					this.#spansRemovedListener(element, flows.flatMap(flow => flow.spans));
				}
				if (this.#nonSpanOwnerListener) {
					this.#nonSpanOwnerListener(element);
				}
			}
		}
		this.#elementFlowsMap.clear();
		if (fireUpdatedListeners) {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		}
	}

	/**
	 * Gets an array of all flows from the node provided to its final sibling.
	 * where a *flow* is an array of {@link Text} considered to flow into each other in the document.
	 * @param node The node from which flows are collected, up to its last descendant.
	 * @returns The array of text flows.
	 */
	getTextFlows (node: Node): Array<Array<Text>> {
		const textFlows: Array<Array<Text>> = [ [] ];
		this.populateTextFlows(node, textFlows, textFlows[0]);
		return textFlows;
	}

	/**
	 * Gets an array of all flows from the node provided to its last descendant,
	 * where a *flow* is an array of {@link Text} considered to flow into each other in the document.
	 * @param node The node from which flows are collected, up to its last descendant.
	 * @param textFlows Holds the flows gathered so far.
	 * @param textFlow Points to the last flow in {@link textFlows}.
	 */
	populateTextFlows (node: Node, textFlows: Array<Array<Text>>, textFlow: Array<Text>) {
		do {
			if (node instanceof Text) {
				textFlow.push(node);
			} else if (node instanceof HTMLElement && !highlightTags.reject.has(node.tagName)) {
				const breaksFlow = !highlightTags.flow.has(node.tagName);
				if (breaksFlow && (textFlow.length > 0 || textFlows.length === 1)) {
					// Ensure the first flow is always the one before a break.
					textFlow = [];
					textFlows.push(textFlow);
				}
				if (node.firstChild) {
					this.populateTextFlows(node.firstChild, textFlows, textFlow);
					textFlow = textFlows[textFlows.length - 1];
					if (breaksFlow && textFlow.length > 0) {
						textFlow = [];
						textFlows.push(textFlow);
					}
				}
			}
			node = node.nextSibling!; // May be null (checked by loop condition).
		} while (node);
	}

	getTextAncestorCommon (textA_ancestor: HTMLElement, textB: Text): HTMLElement | null {
		if (textA_ancestor.contains(textB)) {
			return textA_ancestor;
		}
		if (textA_ancestor.parentElement) {
			return this.getTextAncestorCommon(textA_ancestor.parentElement, textB);
		}
		return null;
	}

	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param rejectSelector A selector string for ancestor tags to cause rejection.
	 * @param element The element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	canHighlightElement (rejectSelector: string, element: HTMLElement): boolean {
		return !element.closest(rejectSelector);
	}

	getElementFlowsMap (): AllReadonly<Map<HTMLElement, Array<Flow>>> {
		return this.#elementFlowsMap;
	}

	/** See {@link setNewSpanOwnerListener}. */
	#newSpanOwnerListener?: (flowOwner: HTMLElement) => void;

	/** See {@link setSpansCreatedListener}. */
	#spansCreatedListener?: (flowOwner: HTMLElement, spansCreated: AllReadonly<Array<Span>>) => void;

	/** See {@link setSpansRemovedListener}. */
	#spansRemovedListener?: (flowOwner: HTMLElement, spansRemoved: AllReadonly<Array<Span>>) => void;

	/** See {@link setNonSpanOwnerListener}. */
	#nonSpanOwnerListener?: (flowOwner: HTMLElement) => void;

	/** See {@link addHighlightingUpdatedListener}. */
	readonly #highlightingUpdatedListeners = new Set<() => void>();

	setNewSpanOwnerListener (listener: (flowOwner: HTMLElement) => void) {
		this.#newSpanOwnerListener = listener;
	}

	setSpansCreatedListener (listener: (flowOwner: HTMLElement, spansCreated: AllReadonly<Array<Span>>) => void) {
		this.#spansCreatedListener = listener;
	}

	setSpansRemovedListener (listener: (flowOwner: HTMLElement, spansRemoved: AllReadonly<Array<Span>>) => void) {
		this.#spansRemovedListener = listener;
	}

	setNonSpanOwnerListener (listener: (flowOwner: HTMLElement) => void): void {
		this.#nonSpanOwnerListener = listener;
	}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export { FlowTracker };
