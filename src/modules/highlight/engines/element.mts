import type { AbstractEngine, EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import { TermCounter } from "/dist/modules/highlight/models/tree-edit/term-counters/term-counter.mjs";
import { TermWalker } from "/dist/modules/highlight/models/tree-edit/term-walkers/term-walker.mjs";
import { TermMarker } from "/dist/modules/highlight/models/tree-edit/term-markers/term-marker.mjs";
import { HIGHLIGHT_TAG, HIGHLIGHT_TAG_UPPER } from "/dist/modules/highlight/models/tree-edit/tags.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import { getMutationUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { EleID, EleClass, AtRuleID, elementsPurgeClass, type TermHues, getTermClass } from "/dist/modules/common.mjs";

/**
 * Determines whether or not the highlighting algorithm should be run on an element.
 * @param rejectSelector A selector string for ancestor tags to cause rejection.
 * @param element An element to test for highlighting viability.
 * @returns `true` if determined highlightable, `false` otherwise.
 */
const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
	!element.closest(rejectSelector) && element.tagName !== HIGHLIGHT_TAG_UPPER
;

const ELEMENT_JUST_HIGHLIGHTED = "markmysearch__just_highlighted";

interface FlowNodeListItem {
	readonly value: Text
	next: FlowNodeListItem | null
}

/**
 * Singly linked list implementation for efficient highlight matching of DOM node 'flow' groups.
 */
class FlowNodeList {
	first: FlowNodeListItem | null;
	last: FlowNodeListItem | null;

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
		do {
			text += (current as FlowNodeListItem).value.textContent;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as FlowNodeListItem).next);
		return text;
	}

	clear () {
		this.first = null;
		this.last = null;
	}

	*[Symbol.iterator] () {
		let current = this.first;
		do {
			yield current as FlowNodeListItem;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as FlowNodeListItem).next);
	}
}

class ElementEngine implements AbstractEngine {
	readonly termOccurrences: AbstractTermCounter = new TermCounter();
	readonly termWalker: AbstractTermWalker = new TermWalker();
	readonly termMarkers: AbstractTermMarker = new TermMarker();

	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly mutationUpdates: ReturnType<typeof getMutationUpdates>;

	readonly specialHighlighter: AbstractSpecialEngine;

	constructor (
		terms: Array<MatchTerm>,
		hues: TermHues,
		updateTermStatus: UpdateTermStatus,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.requestRefreshIndicators = requestCallFn(() => (
			this.termMarkers.insert(terms, termTokens, hues, Array.from(document.body.querySelectorAll(terms
				.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
				.map(term => `${HIGHLIGHT_TAG}.${getTermClass(term, termTokens)}`)
				.join(", ")
			) as NodeListOf<HTMLElement>))
		), 50, 500);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.mutationUpdates = getMutationUpdates(this.getMutationUpdatesObserver(terms));
		this.specialHighlighter = new PaintSpecialEngine(termTokens, termPatterns);
	}

	readonly getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => {
			return (`
${HIGHLIGHT_TAG} {
	font: inherit;
	border-radius: 2px;
	visibility: visible;
}
.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}`
			);
		},
		termHighlight: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			return (`
#${EleID.BAR} ~ body .${EleClass.FOCUS_CONTAINER} ${HIGHLIGHT_TAG}.${getTermClass(term, this.termTokens)},
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ${HIGHLIGHT_TAG}.${getTermClass(term, this.termTokens)} {
	background: ${this.getTermBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle)};
	box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35);
}`
			);
		},
	};

	readonly getTermBackgroundStyle = TermCSS.getDiagonalStyle;

	readonly requestRefreshIndicators: Generator;
	readonly requestRefreshTermControls: Generator;

	countMatches () {
		this.requestRefreshIndicators.next();
		this.requestRefreshTermControls.next();
	}

	startHighlighting (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
		hues: Array<number>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.undoHighlights(termsToPurge);
		// MAIN
		this.generateTermHighlightsUnderNode(termsToHighlight.length ? termsToHighlight : terms, document.body);
		this.mutationUpdates.observe();
		this.specialHighlighter.startHighlighting(terms, hues);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.undoHighlights();
		this.specialHighlighter.endHighlighting();
	}

	/**
	 * Revert all direct DOM tree changes introduced by the extension, under a root node.
	 * Circumstantial and non-direct alterations may remain.
	 * @param terms The terms associated with the highlights to remove. If `undefined`, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	undoHighlights (terms?: Array<MatchTerm>, root: HTMLElement | DocumentFragment = document.body) {
		if (terms && !terms.length)
			return; // Optimization for removing 0 terms
		const classNames = terms?.map(term => getTermClass(term, this.termTokens));
		const highlights = Array.from(root.querySelectorAll(
			classNames ? `${HIGHLIGHT_TAG}.${classNames.join(`, ${HIGHLIGHT_TAG}.`)}` : HIGHLIGHT_TAG
		)).reverse();
		// TODO attempt to join text nodes back together
		for (const highlight of highlights) {
			highlight.outerHTML = highlight.innerHTML;
		}
		if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			root = (root as DocumentFragment).getRootNode() as HTMLElement;
			if (root.nodeType === Node.TEXT_NODE) {
				return;
			}
		}
		elementsPurgeClass(EleClass.FOCUS_CONTAINER, root);
		elementsPurgeClass(EleClass.FOCUS, root);
		this.termWalker.cleanup();
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
			if (text.length === 0) {
				node.remove();
				return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as FlowNodeListItem;
			}
			const parent = node.parentElement as Element;
			parent[ELEMENT_JUST_HIGHLIGHTED] = true;
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
			highlight.classList.add(getTermClass(term, this.termTokens));
			highlight.appendChild(textHighlightNode);
			parent.insertBefore(highlight, node);
			const textHighlightNodeItem = nodeItems.insertItemAfter(nodeItemPrevious, textHighlightNode);
			// insert if exists: Text before Highlight Element
			if (start > 0) {
				const textStartNode = document.createTextNode(text.substring(0, start));
				parent.insertBefore(textStartNode, highlight);
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
			if (text.length === 0) {
				textAfterNode.parentElement?.removeChild(textAfterNode);
				return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as FlowNodeListItem;
			}
			const parent = textAfterNode.parentNode as Node;
			const textEndNode = document.createTextNode(text.substring(start, end));
			const highlight = document.createElement(HIGHLIGHT_TAG);
			highlight.classList.add(getTermClass(term, this.termTokens));
			highlight.appendChild(textEndNode);
			textAfterNode.textContent = text.substring(end);
			parent.insertBefore(highlight, textAfterNode);
			parent[ELEMENT_JUST_HIGHLIGHTED] = true;
			const textEndNodeItem = nodeItems.insertItemAfter(nodeItemPrevious, textEndNode);
			if (start > 0) {
				const textStartNode = document.createTextNode(text.substring(0, start));
				parent.insertBefore(textStartNode, highlight);
				nodeItems.insertItemAfter(nodeItemPrevious, textStartNode);
			}
			return textEndNodeItem;
		};

		/**
		 * Highlights terms in a block of consecutive text nodes.
		 * @param terms Terms to find and highlight.
		 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
		 */
		const highlightInBlock = (terms: Array<MatchTerm>, nodeItems: FlowNodeList) => {
			const textFlow = nodeItems.getText();
			for (const term of terms) {
				let nodeItemPrevious: FlowNodeListItem | null = null;
				let nodeItem = nodeItems.first as FlowNodeListItem;
				let textStart = 0;
				let textEnd = nodeItem.value.length;
				for (const match of textFlow.matchAll(this.termPatterns.get(term))) {
					let highlightStart = match.index as number;
					const highlightEnd = highlightStart + match[0].length;
					while (textEnd <= highlightStart) {
						nodeItemPrevious = nodeItem;
						nodeItem = nodeItem.next as FlowNodeListItem;
						textStart = textEnd;
						textEnd += nodeItem.value.length;
					}
					// eslint-disable-next-line no-constant-condition
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
						nodeItem = nodeItem.next as FlowNodeListItem;
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
			terms: Array<MatchTerm>,
			node: Node,
			nodeItems: FlowNodeList,
			visitSiblings = true,
		) => {
			// TODO support for <iframe>?
			do {
				switch (node.nodeType) {
				case Node.ELEMENT_NODE:
				case Node.DOCUMENT_FRAGMENT_NODE: {
					if (highlightTags.reject.has((node as Element).tagName)) {
						break;
					}
					const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
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
					break;
				} case Node.TEXT_NODE: {
					nodeItems.push(node as Text);
					break;
				}}
				node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
			} while (node && visitSiblings);
		};

		return (terms: Array<MatchTerm>, rootNode: Node) => {
			if (rootNode.nodeType === Node.TEXT_NODE) {
				const nodeItems = new FlowNodeList();
				nodeItems.push(rootNode as Text);
				highlightInBlock(terms, nodeItems);
			} else {
				const nodeItems = new FlowNodeList();
				insertHighlights(terms, rootNode, nodeItems, false);
				if (nodeItems.first) {
					highlightInBlock(terms, nodeItems);
				}
			}
			this.countMatches();
		};
	})();

	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		const focus = this.termWalker.step(reverse, stepNotJump, term, this.termTokens);
		if (focus) {
			this.termMarkers.raise(term, this.termTokens, getContainerBlock(focus));
		}
		return focus;
	}

	getMutationUpdatesObserver (terms: Array<MatchTerm>) {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		const elements: Set<HTMLElement> = new Set();
		let periodDateLast = 0;
		let periodHighlightCount = 0;
		let throttling = false;
		let highlightIsPending = false;
		const highlightElements = () => {
			highlightIsPending = false;
			for (const element of elements) {
				this.undoHighlights(undefined, element);
				this.generateTermHighlightsUnderNode(terms, element);
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
		return new MutationObserver(mutations => {
			//mutationUpdates.disconnect();
			const elementsJustHighlighted: Set<HTMLElement> = new Set();
			for (const mutation of mutations) {
				const element = mutation.target.nodeType === Node.TEXT_NODE
					? mutation.target.parentElement as HTMLElement
					: mutation.target as HTMLElement;
				if (element) {
					if (element[ELEMENT_JUST_HIGHLIGHTED]) {
						elementsJustHighlighted.add(element);
					} else if (canHighlightElement(rejectSelector, element)) {
						elements.add(element);
					}
				}
			}
			for (const element of elementsJustHighlighted) {
				delete element[ELEMENT_JUST_HIGHLIGHTED];
			}
			if (elements.size) {
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
		});
	}
}

export { ElementEngine };
