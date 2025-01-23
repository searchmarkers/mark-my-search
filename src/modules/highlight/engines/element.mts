/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTreeEditEngine } from "/dist/modules/highlight/models/tree-edit.mjs";
import { HIGHLIGHT_TAG, HIGHLIGHT_TAG_UPPER } from "/dist/modules/highlight/models/tree-edit/tags.mjs";
import type { FlowMutationObserver } from "/dist/modules/highlight/common/flow-mutations.d.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import TermCSS from "/dist/modules/highlight/common/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, EleClass, elementsPurgeClass, getTermClass, createContainer } from "/dist/modules/common.mjs";

class ElementEngine implements AbstractTreeEditEngine {
	readonly class = "ELEMENT";
	readonly model = "tree-edit";

	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #flowMutations: FlowMutationObserver;

	readonly #elementsJustHighlighted = new Set<HTMLElement>();

	readonly #highlightingUpdatedListeners = new Set<() => void>();

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #termStyleManagerMap = new Map<MatchTerm, StyleManager<Record<never, never>>>();

	readonly terms = createContainer<ReadonlyArray<MatchTerm>>([]);
	readonly hues = createContainer<ReadonlyArray<number>>([]);

	constructor (
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
		this.#styleManager.setStyle(`
${HIGHLIGHT_TAG} {
	font: inherit !important;
	border-radius: 2px !important;
	visibility: visible !important;
}
`
		);
		{
			const rejectSelector = Array.from(highlightTags.reject).join(", ");
			const elements = new Set<HTMLElement>();
			let periodDateLast = 0;
			let periodHighlightCount = 0;
			let throttling = false;
			let highlightIsPending = false;
			const highlightElements = () => {
				highlightIsPending = false;
				for (const element of elements) {
					this.undoHighlights(undefined, element);
					this.generateTermHighlightsUnderNode(this.terms.current, element);
				}
				periodHighlightCount += elements.size;
				elements.clear();
			};
			const highlightElementsThrottled = () => {
				const periodInterval = Date.now() - periodDateLast;
				if (periodInterval > 400) {
					const periodHighlightRate = periodHighlightCount / periodInterval; // Highlight calls per millisecond.
					//console.log(periodHighlightCount, periodInterval, periodHighlightRate);
					throttling = periodHighlightRate > 0.006;
					periodDateLast = Date.now();
					periodHighlightCount = 0;
				}
				if (throttling || highlightIsPending) {
					if (!highlightIsPending) {
						highlightIsPending = true;
						setTimeout(highlightElements, 100);
					}
				} else {
					highlightElements();
				}
			};
			const mutationObserver = new MutationObserver(mutations => {
				//mutationUpdates.disconnect();
				for (const mutation of mutations) {
					const element = mutation.target instanceof HTMLElement
						? mutation.target
						: mutation.target?.parentElement;
					if (element
						&& !this.#elementsJustHighlighted.has(element)
						&& this.canHighlightElement(rejectSelector, element)
					) {
						elements.add(element);
					}
				}
				this.#elementsJustHighlighted.clear();
				if (elements.size > 0) {
					// TODO improve this algorithm
					for (const element of elements) {
						for (const elementOther of elements) {
							if (elementOther !== element && element.contains(elementOther)) {
								// This may result in undefined behavior
								elements.delete(elementOther);
							}
						}
					}
					highlightElementsThrottled();
				}
				//mutationUpdates.observe();
				for (const listener of this.#highlightingUpdatedListeners) {
					listener();
				}
			});
			this.#flowMutations = {
				observeMutations: () => {
					mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true });
				},
				unobserveMutations: () => {
					mutationObserver.disconnect();
				},
			};
		}
	}

	deactivate () {
		this.endHighlighting();
	}

	readonly getTermBackgroundStyle = TermCSS.getDiagonalStyle;

	startHighlighting (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const termsToHighlight = terms.filter(a => this.terms.current.every(b => JSON.stringify(a) !== JSON.stringify(b)));
		const termsToPurge = this.terms.current.filter(a => terms.every(b => JSON.stringify(a) !== JSON.stringify(b)));
		// Clean up.
		this.#flowMutations.unobserveMutations();
		this.undoHighlights(termsToPurge);
		this.removeTermStyles();
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		this.addTermStyles(terms, hues);
		this.generateTermHighlightsUnderNode(termsToHighlight, document.body);
		this.#flowMutations.observeMutations();
	}

	endHighlighting () {
		this.#flowMutations.unobserveMutations();
		this.undoHighlights();
		this.removeTermStyles();
		this.terms.assign([]);
		this.hues.assign([]);
	}

	/**
	 * Revert all direct DOM tree changes introduced by the extension, under a root node.
	 * Circumstantial and non-direct alterations may remain.
	 * @param terms The terms associated with the highlights to remove. If `undefined`, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	undoHighlights (terms?: ReadonlyArray<MatchTerm>, root: HTMLElement = document.body) {
		if (terms && !terms.length) {
			return; // Optimization for removing 0 terms
		}
		const classNames = terms?.map(term => getTermClass(term, this.#termTokens));
		const highlights = Array.from(root.querySelectorAll(
			classNames ? `${HIGHLIGHT_TAG}.${classNames.join(`, ${HIGHLIGHT_TAG}.`)}` : HIGHLIGHT_TAG
		)).reverse();
		// TODO attempt to join text nodes back together
		for (const highlight of highlights) {
			highlight.outerHTML = highlight.innerHTML;
		}
		elementsPurgeClass(EleClass.FOCUS_CONTAINER, root);
		elementsPurgeClass(EleClass.FOCUS, root);
	}

	addTermStyles (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		for (let i = 0; i < terms.length; i++) {
			const styleManager = new StyleManager(new HTMLStylesheet(document.head));
			styleManager.setStyle(this.getTermCSS(terms, hues, i));
			this.#termStyleManagerMap.set(terms[i], styleManager);
		}
	}

	removeTermStyles () {
		for (const styleManager of this.#termStyleManagerMap.values()) {
			styleManager.deactivate();
		}
		this.#termStyleManagerMap.clear();
	}

	getTermCSS (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		const cycle = Math.floor(termIndex / hues.length);
		return `
#${EleID.BAR} ~ body .${EleClass.FOCUS_CONTAINER} ${HIGHLIGHT_TAG}.${getTermClass(term, this.#termTokens)},
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ${HIGHLIGHT_TAG}.${getTermClass(term, this.#termTokens)} {
	background: ${this.getTermBackgroundStyle(
		`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle,
	)} !important;
	box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35) !important;
}
`
		;
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.getHighlightedElementsForTerms(this.terms.current);
	}

	getHighlightedElementsForTerms (terms: ReadonlyArray<MatchTerm>): Iterable<HTMLElement> {
		return terms.length === 0 ? [] : document.body.querySelectorAll(terms
			.map(term => `${HIGHLIGHT_TAG}.${getTermClass(term, this.#termTokens)}`)
			.join(", ")
		);
	}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}

	/**
	 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
	 * @param terms Terms to find, highlight, and mark.
	 * @param rootNode A node under which to find and highlight term occurrences.
	 */
	readonly generateTermHighlightsUnderNode = (() => {
		/**
		 * Highlights a term matched in a text node.
		 * @param term The term matched.
		 * @param node The text node to highlight inside.
		 * @param start The first character index of the match within the text node.
		 * @param end The last character index of the match within the text node.
		 * @param nodeItems The singly linked list of consecutive text nodes being internally highlighted.
		 * @param nodeItemPrevious The previous item in the text node list.
		 * @returns The new previous item (the item just highlighted).
		 */
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _highlightInsideNode = ( // new but broken version of the function
			term: MatchTerm,
			node: Text,
			start: number,
			end: number,
			nodeItems: FlowNodeList,
			nodeItemPrevious: FlowNodeListItem | null,
		): FlowNodeListItem => {
			// This is necessarily a destructive strategy. Occasional damage to the webpage and its functionality is unavoidable.
			const text = node.textContent ?? "";
			if (text.length === 0 || !(node.parentElement instanceof HTMLElement)) {
				node.remove();
				return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first)!;
			}
			this.#elementsJustHighlighted.add(node.parentElement);
			// update: Text after Highlight Element
			if (end < text.length) {
				node.textContent = text.substring(end);
			} else {
				//nodeItems.removeItemAfter(nodeItemPrevious);
				//node.remove();
			}
			// insert: Highlight Element
			const textHighlightNode = document.createTextNode(text.substring(start, end));
			const highlight = document.createElement(HIGHLIGHT_TAG);
			highlight.classList.add(getTermClass(term, this.#termTokens));
			highlight.appendChild(textHighlightNode);
			node.parentElement.insertBefore(highlight, node);
			const textHighlightNodeItem = nodeItems.insertItemAfter(nodeItemPrevious, textHighlightNode);
			// insert if exists: Text before Highlight Element
			if (start > 0) {
				const textStartNode = document.createTextNode(text.substring(0, start));
				node.parentElement.insertBefore(textStartNode, highlight);
				nodeItems.insertItemAfter(nodeItemPrevious, textStartNode);
			}
			return textHighlightNodeItem;
		};

		const highlightInsideNode = (
			term: MatchTerm,
			textAfterNode: Node,
			start: number,
			end: number,
			nodeItems: FlowNodeList,
			nodeItemPrevious: FlowNodeListItem | null,
		): FlowNodeListItem => {
			// This is necessarily a destructive strategy. Occasional damage to the webpage and its functionality is unavoidable.
			const text = textAfterNode.textContent ?? "";
			if (text.length === 0 || !(textAfterNode.parentElement instanceof HTMLElement)) {
				textAfterNode.parentElement?.removeChild(textAfterNode);
				return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first)!;
			}
			const textEndNode = document.createTextNode(text.substring(start, end));
			const highlight = document.createElement(HIGHLIGHT_TAG);
			highlight.classList.add(getTermClass(term, this.#termTokens));
			highlight.appendChild(textEndNode);
			textAfterNode.textContent = text.substring(end);
			textAfterNode.parentElement.insertBefore(highlight, textAfterNode);
			this.#elementsJustHighlighted.add(textAfterNode.parentElement);
			const textEndNodeItem = nodeItems.insertItemAfter(nodeItemPrevious, textEndNode);
			if (start > 0) {
				const textStartNode = document.createTextNode(text.substring(0, start));
				textAfterNode.parentElement.insertBefore(textStartNode, highlight);
				nodeItems.insertItemAfter(nodeItemPrevious, textStartNode);
			}
			return textEndNodeItem;
		};

		/**
		 * Highlights terms in a block of consecutive text nodes.
		 * @param terms Terms to find and highlight.
		 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
		 */
		const highlightInBlock = (terms: ReadonlyArray<MatchTerm>, nodeItems: FlowNodeList) => {
			const textFlow = nodeItems.getText();
			for (const term of terms) {
				let nodeItemPrevious: FlowNodeListItem | null = null;
				let nodeItem = nodeItems.first!; // This should always be defined.
				let textStart = 0;
				let textEnd = nodeItem.value.length;
				for (const match of textFlow.matchAll(this.#termPatterns.get(term))) {
					let highlightStart = match.index!;
					const highlightEnd = highlightStart + match[0].length;
					while (textEnd <= highlightStart) {
						nodeItemPrevious = nodeItem;
						nodeItem = nodeItem.next!; // This should always be defined in this context.
						textStart = textEnd;
						textEnd += nodeItem.value.length;
					}
					while (true) {
						// TODO join together nodes where possible
						// TODO investigate why, under some circumstances, new empty highlight elements keep being produced
						// - (to observe, remove the code that deletes empty nodes during restoration)
						nodeItemPrevious = highlightInsideNode(
							term,
							nodeItem.value,
							highlightStart - textStart,
							Math.min(highlightEnd - textStart, textEnd),
							nodeItems,
							nodeItemPrevious,
						);
						highlightStart = textEnd;
						textStart = highlightEnd;
						if (highlightEnd <= textEnd) {
							break;
						}
						nodeItemPrevious = nodeItem;
						nodeItem = nodeItem.next!; // This should always be defined in this context.
						textStart = textEnd;
						textEnd += nodeItem.value.length;
					}
				}
			}
		};

		/**
		 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
		 * @param terms Terms to find and highlight.
		 * @param node A root node under which to match terms and insert highlights.
		 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
		 * @param visitSiblings Whether to visit the siblings of the root node.
		 */
		const insertHighlights = (
			terms: ReadonlyArray<MatchTerm>,
			node: Node,
			nodeItems: FlowNodeList,
			visitSiblings = true,
		) => {
			// TODO support for <iframe>?
			do {
				if (node instanceof HTMLElement) { if (!highlightTags.reject.has(node.tagName)) {
					const breaksFlow = !highlightTags.flow.has(node.tagName);
					if (breaksFlow && nodeItems.first) {
						highlightInBlock(terms, nodeItems);
						nodeItems.clear();
					}
					if (node.firstChild) {
						insertHighlights(terms, node.firstChild, nodeItems);
						if (breaksFlow && nodeItems.first) {
							highlightInBlock(terms, nodeItems);
							nodeItems.clear();
						}
					}
				} } else if (node instanceof Text) {
					nodeItems.push(node);
				}
				node = node.nextSibling!; // May be null (checked by loop condition).
			} while (node && visitSiblings);
		};

		return (terms: ReadonlyArray<MatchTerm>, rootNode: Node) => {
			if (rootNode instanceof Text) {
				const nodeItems = new FlowNodeList();
				nodeItems.push(rootNode);
				highlightInBlock(terms, nodeItems);
			} else {
				const nodeItems = new FlowNodeList();
				insertHighlights(terms, rootNode, nodeItems, false);
				if (nodeItems.first) {
					highlightInBlock(terms, nodeItems);
				}
			}
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		};
	})();

	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param rejectSelector A selector string for ancestor tags to cause rejection.
	 * @param element The element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	canHighlightElement (rejectSelector: string, element: HTMLElement): boolean {
		return !element.closest(rejectSelector) && element.tagName !== HIGHLIGHT_TAG_UPPER;
	}
}

/**
 * Singly linked list implementation for efficient highlight matching of DOM node 'flow' groups.
 */
class FlowNodeList {
	first: FlowNodeListItem | null = null;
	last: FlowNodeListItem | null = null;

	push (value: Text) {
		if (this.last) {
			this.last.next = { value, next: null };
			this.last = this.last.next;
		} else {
			this.first = { value, next: null };
			this.last = this.first;
		}
	}

	insertItemAfter (itemBefore: FlowNodeListItem | null, value: Text): FlowNodeListItem {
		if (itemBefore) {
			itemBefore.next = { next: itemBefore.next, value };
			return itemBefore.next;
		} else {
			this.first = { next: this.first, value };
			return this.first;
		}
	}

	removeItemAfter (itemBefore: FlowNodeListItem | null) {
		if (!itemBefore) {
			this.first = this.first?.next ?? null;
			return;
		}
		if (this.last === itemBefore.next) {
			this.last = itemBefore;
		}
		itemBefore.next = itemBefore.next?.next ?? null;
	}

	getText () {
		let text = "";
		let current = this.first;
		while (current) {
			text += current.value.textContent;
			current = current.next;
		}
		return text;
	}

	clear () {
		this.first = null;
		this.last = null;
	}

	*[Symbol.iterator] () {
		let current = this.first;
		while (current) {
			yield current;
			current = current.next;
		}
	}
}

interface FlowNodeListItem {
	readonly value: Text
	next: FlowNodeListItem | null
}

export { ElementEngine };
