/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermWalker } from "/dist/modules/highlight/tools/term-walker.d.mjs";
import * as Styles from "/dist/modules/highlight/tools/term-walker/common.mjs";
import { getContainerBlock } from "/dist/modules/highlight/common/container-blocks.mjs";
import { HIGHLIGHT_TAG, HIGHLIGHT_TAG_UPPER } from "/dist/modules/highlight/models/tree-edit/tags.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, EleClass, getNodeFinal, isVisible, elementsPurgeClass, getTermClass } from "/dist/modules/common.mjs";

class TermWalker implements AbstractTermWalker {
	readonly #termTokens: TermTokens;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
		this.#styleManager.setStyle(Styles.mainCSS);
	}

	deactivate () {
		this.cleanup();
		this.#styleManager.deactivate();
	}

	step (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
	): HTMLElement | null {
		if (stepNotJump) {
			// Currently no support for specific terms.
			return this.focusNextTermStep(reverse);
		} else {
			return this.focusNextTermJump(reverse, term);
		}
	}

	cleanup () {
		this.elementsReMakeUnfocusable();
	}

	/**
	 * Scrolls to and focuses the next block containing an occurrence of a term in the document,
	 * from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse,
	 * selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumped to.
	 */
	focusNextTermJump (reverse: boolean, term: MatchTerm | null): HTMLElement | null {
		const termSelector = term ? getTermClass(term, this.#termTokens) : undefined;
		const focusBase = document.body
			.getElementsByClassName(EleClass.FOCUS)[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(EleClass.FOCUS_CONTAINER)[0] as HTMLElement;
		const selection = document.getSelection();
		const focus = document.activeElement;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
		if (focus instanceof HTMLElement && focus.id === EleID.BAR) {
			focus.blur();
		}
		const selectionFocus = selection && (!focus
			|| focus === document.body || !document.body.contains(focus)
			|| focus === focusBase || focus.contains(focusContainer)
		)
			? selection.focusNode
			: focus ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(EleClass.FOCUS);
			elementsPurgeClass(EleClass.FOCUS_CONTAINER);
			this.elementsReMakeUnfocusable();
		}
		const selectionFocusContainer = (selectionFocus instanceof HTMLElement
			? getContainerBlock(selectionFocus)
			: selectionFocus?.parentElement && getContainerBlock(selectionFocus.parentElement));
		const walkSelectionFocusContainer = { accept: false };
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_ELEMENT,
			(element =>
				element instanceof HTMLElement
				&& element.tagName === HIGHLIGHT_TAG_UPPER
				&& (termSelector ? element.classList.contains(termSelector) : true)
				&& isVisible(element)
				&& (getContainerBlock(element) !== selectionFocusContainer || walkSelectionFocusContainer.accept)
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_SKIP
			),
		);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const { elementSelected, container } = this.selectNextElement(reverse, walker, walkSelectionFocusContainer);
		if (!elementSelected || !container) {
			return null;
		}
		elementSelected.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementSelected, 0, elementSelected, 0);
		}
		for (const element of document.body.querySelectorAll(`.${EleClass.REMOVE}`)) {
			element.remove();
		}
		return elementSelected;
	}

	// TODO document
	selectNextElement (
		reverse: boolean,
		walker: TreeWalker,
		walkSelectionFocusContainer: { accept: boolean },
		elementToSelect?: HTMLElement,
	): { elementSelected: HTMLElement | null, container: HTMLElement | null } {
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]();
		if (!(elementTerm instanceof HTMLElement)) {
			let nodeToRemove: Node | null = null;
			if (!document.body.lastChild || document.body.lastChild.nodeType !== Node.TEXT_NODE) {
				nodeToRemove = document.createTextNode("");
				document.body.appendChild(nodeToRemove);
			}
			walker.currentNode = (reverse && document.body.lastChild)
				? document.body.lastChild
				: document.body;
			elementTerm = walker[nextNodeMethod]();
			if (nodeToRemove) {
				nodeToRemove.parentElement?.removeChild(nodeToRemove);
			}
			if (!(elementTerm instanceof HTMLElement)) {
				walkSelectionFocusContainer.accept = true;
				elementTerm = walker[nextNodeMethod]();
				if (!(elementTerm instanceof HTMLElement)) {
					return { elementSelected: null, container: null };
				}
			}
		}
		const container = getContainerBlock(elementTerm.parentElement!);
		container.classList.add(EleClass.FOCUS_CONTAINER);
		elementTerm.classList.add(EleClass.FOCUS);
		elementToSelect = Array.from(container.getElementsByTagName(HIGHLIGHT_TAG))
			.every(thisElement => getContainerBlock(thisElement.parentElement!) === container)
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
	 * Reverts the focusability of elements made temporarily focusable and marked as such using a class name.
	 * Sets their `tabIndex` to -1.
	 * @param root If supplied, an element to revert focusability under in the DOM tree (inclusive).
	 */
	elementsReMakeUnfocusable (root: HTMLElement = document.body) {
		for (const element of root.querySelectorAll<HTMLElement>(`.${EleClass.FOCUS_REVERT}`)) {
			element.tabIndex = -1;
			element.classList.remove(EleClass.FOCUS_REVERT);
		}
	}

	/**
	 * Focuses an element, preventing automatic scroll-into-view and forcing visible focus *(where supported)*.
	 * @param element The element to focus.
	 */
	focusElement (element: HTMLElement) {
		const focusOptions: FocusOptions & { focusVisible?: boolean } = {
			preventScroll: true,
			focusVisible: true, // Sparse browser compatibility
		};
		element.focus(focusOptions);
	}

	/**
	 * Scrolls to and focuses the next occurrence of a term in the document, from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param nodeStart __Only supplied in recursion.__ Specifies a node at which to begin scanning.
	 */
	focusNextTermStep (reverse: boolean, nodeStart?: Node): HTMLElement | null {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		elementsPurgeClass(EleClass.FOCUS);
		const selection = getSelection();
		if (!selection) {
			return null;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
		if (document.activeElement instanceof HTMLElement && document.activeElement.id === EleID.BAR) {
			document.activeElement.blur();
		}
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = reverse ? selection.anchorNode : selection.focusNode;
		const nodeFocused = document.activeElement instanceof HTMLElement
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			? (document.activeElement === document.body || document.activeElement.id === EleID.BAR)
				? null
				: document.activeElement
			: null;
		const nodeCurrent = nodeStart ?? (nodeSelected
			? nodeSelected
			: nodeFocused ?? nodeBegin);
		if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_ELEMENT,
			(element =>
				element.parentElement!.closest(HIGHLIGHT_TAG)
					? NodeFilter.FILTER_REJECT
					: (element instanceof HTMLElement && element.tagName === HIGHLIGHT_TAG_UPPER && isVisible(element))
						? NodeFilter.FILTER_ACCEPT
						: NodeFilter.FILTER_SKIP
			),
		);
		walker.currentNode = nodeCurrent;
		const highlight = reverse ? walker.previousNode() : walker.nextNode();
		if (!(highlight instanceof HTMLElement)) {
			if (!nodeStart) {
				this.focusNextTermStep(reverse, nodeBegin);
			}
			return null;
		}
		this.stepToElement(highlight);
		return highlight;
	}

	stepToElement (highlight: HTMLElement) {
		highlight = this.getTopLevelHighlight(highlight);
		const siblingFirst = this.getSiblingHighlightFinal(highlight, highlight, "previousSibling");
		const siblingLast = this.getSiblingHighlightFinal(highlight, highlight, "nextSibling");
		getSelection()?.setBaseAndExtent(siblingFirst, 0, siblingLast, siblingLast.childNodes.length);
		highlight.scrollIntoView({ block: "center" });
	}

	getTopLevelHighlight (element: HTMLElement): HTMLElement {
		const closestHighlight = (element.parentElement instanceof HTMLElement
			&& (element.parentElement).closest(HIGHLIGHT_TAG));
		return closestHighlight instanceof HTMLElement ? this.getTopLevelHighlight(closestHighlight) : element;
	}

	getSiblingHighlightFinal (
		highlight: HTMLElement,
		node: Node,
		nextSiblingMethod: "nextSibling" | "previousSibling"
	): HTMLElement {
		const nextSibling = node[nextSiblingMethod];
		if (!nextSibling) {
			return highlight;
		}
		if (nextSibling instanceof HTMLElement) {
			if (nextSibling.tagName === HIGHLIGHT_TAG_UPPER) {
				return this.getSiblingHighlightFinal(nextSibling, nextSibling, nextSiblingMethod);
			}
			return highlight;
		} else if (nextSibling instanceof Text) {
			if (nextSibling.textContent === "") {
				return this.getSiblingHighlightFinal(highlight, nextSibling, nextSiblingMethod);
			}
			return highlight;
		}
		return highlight;
	}
}

export { TermWalker };
