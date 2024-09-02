/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Flow, Span, AbstractFlowTracker } from "/dist/modules/highlight/models/tree-cache/flow-tracker.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import { matchInTextFlow } from "/dist/modules/highlight/matcher.mjs";
import { MatchTerm, type TermPatterns } from "/dist/modules/match-term.mjs";
import type { RContainer, AllReadonly } from "/dist/modules/common.mjs";

class FlowTracker implements AbstractFlowTracker {
	readonly #termPatterns: TermPatterns;

	/**
	 * A MutationObserver which responds to mutations by calling methods
	 * to update cached highlighting information, based on the elements changed.
	 * @returns The MutationObserver object.
	 */
	readonly #mutationObserver: MutationObserver;

	readonly #elementFlowsMap = new Map<HTMLElement, Array<Flow>>();

	#newSpanOwnerListener?: (flowOwner: HTMLElement) => void;
	#spansCreatedListener?: (flowOwner: HTMLElement, spansCreated: AllReadonly<Array<Span>>) => void;
	#spansRemovedListener?: (flowOwner: HTMLElement, spansRemoved: AllReadonly<Array<Span>>) => void;
	#nonSpanOwnerListener?: (flowOwner: HTMLElement) => void;
	readonly #highlightingUpdatedListeners = new Set<Generator>();

	/**
	 * 
	 * @param terms A live container of the *current terms being highlighted*.
	 * Highlighting is assumed to be up to date with the current terms.
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
						this.removeHighlighting(node);
					}
				}
			}
			for (const element of elementsAffected) {
				// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated.
				// We assume that ALL such flows are incorrect.
				// TODO avoid recalculating the same box info or flow on the same pass
				if (highlightTags.flow.has(element.tagName)) {
					// The element may include non self-contained flows.
					this.generateBoxesInfoForFlowOwners(terms.current, element);
				} else {
					// The element can only include self-contained flows, so flows need only be recalculated below the element.
					this.generateHighlightSpansFor(terms.current, element);
				}
			}
		});
	}

	observeMutations () {
		this.#mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
	}

	unobserveMutations () {
		this.#mutationObserver.disconnect();
	}

	generateBoxesInfoForFlowOwners (terms: ReadonlyArray<MatchTerm>, node: Node) {
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
				this.generateHighlightSpansFor(terms, parent);
			} else {
				// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
				this.generateBoxesInfoForFlowOwners(terms, parent);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.generateHighlightSpansFor(terms, parent);
		}
	}

	generateHighlightSpansFor (terms: ReadonlyArray<MatchTerm>, flowOwner: HTMLElement) {
		if (!flowOwner.firstChild) {
			return;
		}
		const elementBreaksFlow = !highlightTags.flow.has(flowOwner.tagName);
		const textFlows: ReadonlyArray<ReadonlyArray<Text>> = this.getTextFlows(flowOwner.firstChild);
		this.removeHighlighting(flowOwner);
		for ( // The first flow is always before the first break, and the last flow after the last break. Either may be empty.
			let i = (elementBreaksFlow && textFlows[0].length) ? 0 : 1;
			i < textFlows.length + ((elementBreaksFlow && textFlows.at(-1)?.length) ? 0 : -1);
			i++
		) {
			this.cacheFlowWithSpans(terms, textFlows[i]);
		}
		for (const listener of this.#highlightingUpdatedListeners) {
			listener.next();
		}
	}

	/**
	 * Removes highlighting from all descendant elements (inclusive).
	 * @param ancestor The element below which to remove highlighting.
	 */
	removeHighlighting (ancestor: HTMLElement) {
		if (highlightTags.reject.has(ancestor.tagName)) {
			return;
		}
		const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT, element =>
			highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
		);
		let element: Node | null = ancestor;
		do if (element instanceof HTMLElement) {
			// Delete all flows with highlight spans from the element; if they existed, call appropriate callbacks.
			const flows = this.#elementFlowsMap.get(element);
			if (flows) {
				this.#elementFlowsMap.delete(element);
				if (this.#spansRemovedListener)
					this.#spansRemovedListener(element, flows.flatMap(flow => flow.spans));
				if (this.#nonSpanOwnerListener)
					this.#nonSpanOwnerListener(element);
			}
		// eslint-disable-next-line no-cond-assign
		} while (element = walker.nextNode());
	}

	/**
	 * Remove highlighting for specific terms.
	 * @param terms Terms for which to remove highlight spans. If undefined, all spans are removed.
	 */
	removeHighlightSpansFor (terms?: ReadonlyArray<MatchTerm>) {
		if (terms) {
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
					if (spansRemoved.length > 0) {
						if (this.#spansRemovedListener)
							this.#spansRemovedListener(element, spansRemoved);
					}
				} else {
					this.#elementFlowsMap.delete(element);
					if (this.#spansRemovedListener)
						this.#spansRemovedListener(element, spansRemoved);
					if (this.#nonSpanOwnerListener)
						this.#nonSpanOwnerListener(element);
				}
			}
		} else {
			if (this.#spansRemovedListener || this.#nonSpanOwnerListener) {
				for (const [ element, flows ] of this.#elementFlowsMap) {
					if (this.#spansRemovedListener)
						this.#spansRemovedListener(element, flows.flatMap(flow => flow.spans));
					if (this.#nonSpanOwnerListener)
						this.#nonSpanOwnerListener(element);
				}
			}
			this.#elementFlowsMap.clear();
		}
		for (const listener of this.#highlightingUpdatedListeners) {
			listener.next();
		}
	}

	getTextFlows (node: Node): Array<Array<Text>> {
		const textFlows: Array<Array<Text>> = [ [] ];
		this.populateTextFlows(node, textFlows, textFlows[0]);
		return textFlows;
	}
	
	/**
	 * Gets an array of all flows from the node provided to its final sibling,
	 * where a 'flow' is an array of text nodes considered to flow into each other in the document.
	 * @param node The node from which flows are collected, up to the last descendant of its final sibling.
	 * @param textFlows Holds the flows gathered so far.
	 * @param textFlow Points to the last flow in `textFlows`.
	 */
	populateTextFlows (node: Node, textFlows: Array<Array<Text>>, textFlow: Array<Text>) {
		do {
			if (node instanceof Text) {
				textFlow.push(node);
			} else if (node instanceof HTMLElement && !highlightTags.reject.has(node.tagName)) {
				const breaksFlow = !highlightTags.flow.has(node.tagName);
				if (breaksFlow && (textFlow.length || textFlows.length === 1)) { // Ensure the first flow is always the one before a break.
					textFlow = [];
					textFlows.push(textFlow);
				}
				if (node.firstChild) {
					this.populateTextFlows(node.firstChild, textFlows, textFlow);
					textFlow = textFlows[textFlows.length - 1];
					if (breaksFlow && textFlow.length) {
						textFlow = [];
						textFlows.push(textFlow);
					}
				}
			}
			node = node.nextSibling!; // May be null (checked by loop condition).
		} while (node);
	}

	/**
	 * TODO document
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	cacheFlowWithSpans (terms: ReadonlyArray<MatchTerm>, textFlow: ReadonlyArray<Text>) {
		const text = textFlow.map(node => node.textContent).join("");
		const ancestor = this.getAncestorCommon(
			textFlow[0].parentElement!,
			textFlow[textFlow.length - 1],
		)!;
		if (ancestor === null) {
			console.warn("Unexpected condition: Common ancestor not found.", textFlow);
			return;
		}
		// TODO should the same function remove the flows, to replace them entirely?
		// Match the terms inside the flow to produce highlighting box info.
		const spansCreated = matchInTextFlow(terms, this.#termPatterns, text, textFlow);
		let flows = this.#elementFlowsMap.get(ancestor);
		if (!flows) {
			flows = [];
			this.#elementFlowsMap.set(ancestor, flows);
		}
		flows.push({ text, spans: spansCreated });
		if (flows.length === 1) {
			if (this.#newSpanOwnerListener)
				this.#newSpanOwnerListener(ancestor);
		}
		if (this.#spansCreatedListener)
			this.#spansCreatedListener(ancestor, spansCreated);
	}

	getAncestorCommon (nodeA_ancestor: HTMLElement, nodeB: Node): HTMLElement | null {
		if (nodeA_ancestor.contains(nodeB)) {
			return nodeA_ancestor;
		}
		if (nodeA_ancestor.parentElement) {
			return this.getAncestorCommon(nodeA_ancestor.parentElement, nodeB);
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

	addHighlightingUpdatedListener (listener: Generator) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export { FlowTracker };
