import { type AbstractEngine, getMutationUpdates, containerBlockSelector } from "/dist/modules/highlight/engine.mjs";
import { highlightTags, HIGHLIGHT_TAG, HIGHLIGHT_TAG_UPPER } from "/dist/modules/highlight/highlighting.mjs";
import { type AbstractSpecialEngine, DummySpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import {
	EleID, EleClass, AtRuleID,
	getNodeFinal, isVisible, getElementYRelative, elementsPurgeClass,
	type TermHues, getTermClass, getTermToken,
} from "/dist/modules/common.mjs";

/**
 * Determines whether or not the highlighting algorithm should be run on an element.
 * @param rejectSelector A selector string for ancestor tags to cause rejection.
 * @param element An element to test for highlighting viability.
 * @returns `true` if determined highlightable, `false` otherwise.
 */
const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
	!element.closest(rejectSelector) && element.tagName !== HIGHLIGHT_TAG_UPPER
;

/**
 * Gets the containing block of an element.
 * This is its closest ancestor which has no tag name counted as `flow` in a highlight tags object.
 * @param element An element to find the first container block of (inclusive).
 * @returns The closest container block above the element (inclusive).
 */
const getContainerBlock = (element: HTMLElement): HTMLElement =>
	// Always returns an element since "body" is not a flow tag.
	element.closest(containerBlockSelector) as HTMLElement
;

/**
 * Reverts the focusability of elements made temporarily focusable and marked as such using a class name.
 * Sets their `tabIndex` to -1.
 * @param root If supplied, an element to revert focusability under in the DOM tree (inclusive).
 */
const elementsReMakeUnfocusable = (root: HTMLElement | DocumentFragment = document.body) => {
	if (!root.parentNode) {
		return;
	}
	root.parentNode.querySelectorAll(`.${EleClass.FOCUS_REVERT}`)
		.forEach((element: HTMLElement) => {
			element.tabIndex = -1;
			element.classList.remove(EleClass.FOCUS_REVERT);
		});
};

const ELEMENT_JUST_HIGHLIGHTED = "markmysearch__just_highlighted";

interface FlowNodeListItem {
	value: Text
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
	mutationObserver: MutationObserver | null = null;
	mutationUpdates = getMutationUpdates(() => this.mutationObserver);

	specialHighlighter: AbstractSpecialEngine = new DummySpecialEngine();

	constructor (terms: Array<MatchTerm>, hues: TermHues, updateTermStatus: (term: MatchTerm) => void) {
		this.requestRefreshIndicators = requestCallFn(() => this.insertScrollMarkers(terms, hues), 50, 500);
		this.requestRefreshTermControls = requestCallFn(() => terms.forEach(term => updateTermStatus(term)), 50, 500);
		this.mutationObserver = this.getMutationUpdatesObserver(terms);
		this.specialHighlighter = new PaintSpecialEngine();
	}

	getMiscCSS () {
		return "";
	}

	getTermHighlightsCSS () {
		return `
${HIGHLIGHT_TAG} {
	font: inherit;
	border-radius: 2px;
	visibility: visible;
}
.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}`
		;
	}

	getTermHighlightCSS (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		const cycle = Math.floor(termIndex / hues.length);
		return `
#${EleID.BAR} ~ body .${EleClass.FOCUS_CONTAINER} ${HIGHLIGHT_TAG}.${getTermClass(term.token)},
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ${HIGHLIGHT_TAG}.${getTermClass(term.token)} {
	background: ${this.getTermBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle)};
	box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35);
}`
		;
	}

	getTermBackgroundStyle = TermCSS.getDiagonalStyle;

	requestRefreshIndicators?: Generator;
	requestRefreshTermControls?: Generator;

	countMatches () {
		this.requestRefreshIndicators?.next();
		this.requestRefreshTermControls?.next();
	}

	insertScrollMarkers (terms: Array<MatchTerm>, hues: TermHues) {
		if (terms.length === 0) {
			return; // No terms results in an empty selector, which is not allowed.
		}
		const regexMatchTermSelector = new RegExp(`\\b${EleClass.TERM}(?:-\\w+)+\\b`);
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement
			termsAdded: Set<string>
		}> = [];
		let markersHtml = "";
		document.body.querySelectorAll(terms
			.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
			.map(term => `${HIGHLIGHT_TAG}.${getTermClass(term.token)}`)
			.join(", ")
		).forEach((highlight: HTMLElement) => {
			const container = getContainerBlock(highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const yRelative = getElementYRelative(container);
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermToken(className))) {
						return;
					} else {
						const termsAddedCount = containersInfo[containerIdx].termsAdded.size;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(getTermToken(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermToken(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermToken(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		});
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		const scrollMarkerGutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		elementsPurgeClass(EleClass.FOCUS, scrollMarkerGutter);
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getTermClass(term.token)}` : ""}[top^="${
					Math.trunc(getElementYRelative(container) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(EleClass.FOCUS);
				return true;
			}
			return false;
		});
	}

	startHighlighting (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.undoHighlights(termsToPurge);
		// MAIN
		this.generateTermHighlightsUnderNode(termsToHighlight.length ? termsToHighlight : terms, document.body);
		this.mutationUpdates.observe();
		this.specialHighlighter.startHighlighting(terms);
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
		const classNames = terms?.map(term => getTermClass(term.token));
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
		elementsReMakeUnfocusable(root);
	}

	/**
	 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
	 * @param terms Terms to find, highlight, and mark.
	 * @param rootNode A node under which to find and highlight term occurrences.
	 */
	generateTermHighlightsUnderNode = (() => {
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
			highlight.classList.add(getTermClass(term.token));
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
			highlight.classList.add(getTermClass(term.token));
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
				for (const match of textFlow.matchAll(term.pattern)) {
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

	focusNextTerm (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | undefined,
	) {
		if (stepNotJump) {
			// Currently no support for specific terms.
			this.focusNextTermStep(reverse);
		} else {
			this.focusNextTermJump(reverse, term);
		}
	}

	/**
	 * Focuses an element, preventing immediate scroll-into-view and forcing visible focus where supported.
	 * @param element An element.
	 */
	focusElement (element: HTMLElement) {
		element.focus({
			preventScroll: true,
			focusVisible: true, // Very sparse browser compatibility
		} as FocusOptions);
	}

	// TODO document
	selectNextElement (
		reverse: boolean,
		walker: TreeWalker,
		walkSelectionFocusContainer: { accept: boolean },
		elementToSelect?: HTMLElement,
	): { elementSelected: HTMLElement | null, container: HTMLElement | null } {
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			let nodeToRemove: Node | null = null;
			if (!document.body.lastChild || document.body.lastChild.nodeType !== Node.TEXT_NODE) {
				nodeToRemove = document.createTextNode("");
				document.body.appendChild(nodeToRemove);
			}
			walker.currentNode = (reverse && document.body.lastChild)
				? document.body.lastChild
				: document.body;
			elementTerm = walker[nextNodeMethod]() as HTMLElement;
			if (nodeToRemove) {
				nodeToRemove.parentElement?.removeChild(nodeToRemove);
			}
			if (!elementTerm) {
				walkSelectionFocusContainer.accept = true;
				elementTerm = walker[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return { elementSelected: null, container: null };
				}
			}
		}
		const container = getContainerBlock(elementTerm.parentElement as HTMLElement);
		container.classList.add(EleClass.FOCUS_CONTAINER);
		elementTerm.classList.add(EleClass.FOCUS);
		elementToSelect = Array.from(container.getElementsByTagName(HIGHLIGHT_TAG))
			.every(thisElement => getContainerBlock(thisElement.parentElement as HTMLElement) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(EleClass.FOCUS_REVERT);
			elementToSelect.tabIndex = 0;
		}
		this.focusElement(elementToSelect);
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(EleClass.REMOVE);
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			this.focusElement(elementToSelect);
		}
		if (document.activeElement === elementToSelect) {
			return { elementSelected: elementToSelect, container };
		}
		return this.selectNextElement(reverse, walker, walkSelectionFocusContainer, elementToSelect);
	}

	/**
	 * Scrolls to and focuses the next block containing an occurrence of a term in the document, from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	focusNextTermJump (reverse: boolean, term?: MatchTerm) {
		const termSelector = term ? getTermClass(term.token) : undefined;
		const focusBase = document.body
			.getElementsByClassName(EleClass.FOCUS)[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(EleClass.FOCUS_CONTAINER)[0] as HTMLElement;
		const selection = document.getSelection();
		const activeElement = document.activeElement;
		if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${EleID.BAR}`)) {
			(activeElement as HTMLInputElement).blur();
		}
		const selectionFocus = selection && (!activeElement
			|| activeElement === document.body || !document.body.contains(activeElement)
			|| activeElement === focusBase || activeElement.contains(focusContainer)
		)
			? selection.focusNode
			: activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(EleClass.FOCUS);
			elementsPurgeClass(EleClass.FOCUS_CONTAINER);
			elementsReMakeUnfocusable();
		}
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(
				selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
					? selectionFocus as HTMLElement
					: selectionFocus.parentElement,
			) : undefined;
		const walkSelectionFocusContainer = { accept: false };
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === HIGHLIGHT_TAG_UPPER
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(element) !== selectionFocusContainer || walkSelectionFocusContainer.accept)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const { elementSelected, container } = this.selectNextElement(reverse, walker, walkSelectionFocusContainer);
		if (!elementSelected || !container) {
			return;
		}
		elementSelected.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementSelected, 0, elementSelected, 0);
		}
		document.body.querySelectorAll(`.${EleClass.REMOVE}`).forEach((element: HTMLElement) => {
			element.remove();
		});
		this.raiseScrollMarker(term, container);
	}

	getSiblingHighlightFinal (
		highlight: HTMLElement,
		node: Node,
		nextSiblingMethod: "nextSibling" | "previousSibling"
	) {
		return node[nextSiblingMethod]
			? (node[nextSiblingMethod] as Node).nodeType === Node.ELEMENT_NODE
				? (node[nextSiblingMethod] as HTMLElement).tagName === HIGHLIGHT_TAG_UPPER
					? this.getSiblingHighlightFinal(node[nextSiblingMethod] as HTMLElement, node[nextSiblingMethod] as HTMLElement,
						nextSiblingMethod)
					: highlight
				: (node[nextSiblingMethod] as Node).nodeType === Node.TEXT_NODE
					? (node[nextSiblingMethod] as Text).textContent === ""
						? this.getSiblingHighlightFinal(highlight, node[nextSiblingMethod] as Text, nextSiblingMethod)
						: highlight
					: highlight
			: highlight;
	}

	getTopLevelHighlight (element: Element) {
		const closestHighlight = (element.parentElement as Element).closest(HIGHLIGHT_TAG);
		return closestHighlight ? this.getTopLevelHighlight(closestHighlight) : element;
	}

	stepToElement (element: HTMLElement) {
		element = this.getTopLevelHighlight(element);
		const elementFirst = this.getSiblingHighlightFinal(element, element, "previousSibling");
		const elementLast = this.getSiblingHighlightFinal(element, element, "nextSibling");
		(getSelection() as Selection).setBaseAndExtent(elementFirst, 0, elementLast, elementLast.childNodes.length);
		element.scrollIntoView({ block: "center" });
		this.raiseScrollMarker(undefined, getContainerBlock(element));
	}

	/**
	 * Scrolls to and focuses the next occurrence of a term in the document, from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param nodeStart __Only supplied in recursion.__ Specifies a node at which to begin scanning.
	 */
	focusNextTermStep (reverse: boolean, nodeStart?: Node) {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		elementsPurgeClass(EleClass.FOCUS);
		const selection = getSelection();
		const bar = document.getElementById(EleID.BAR);
		if (!selection || !bar) {
			return;
		}
		if (document.activeElement && bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = reverse ? selection.anchorNode : selection.focusNode;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart ?? (nodeSelected
			? nodeSelected
			: nodeFocused ?? nodeBegin);
		if (document.activeElement) {
			(document.activeElement as HTMLElement).blur();
		}
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element.parentElement as Element).closest(HIGHLIGHT_TAG)
				? NodeFilter.FILTER_REJECT
				: (element.tagName === HIGHLIGHT_TAG_UPPER && isVisible(element))
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const element = walker[reverse ? "previousNode" : "nextNode"]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				this.focusNextTermStep(reverse, nodeBegin);
			}
			return;
		}
		this.stepToElement(element);
	}

	// Increasingly inaccurate as highlights elements are more often split.
	getTermOccurrenceCount (term: MatchTerm) {
		const occurrences = document.body.getElementsByClassName(getTermClass(term.token));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length; // Poor and changeable heuristic, but so far the most reliable efficient method.
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
