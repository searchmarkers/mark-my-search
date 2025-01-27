/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.d.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import { highlightingIdAttr } from "/dist/modules/highlight/engines/paint/common.mjs";
import type { HighlightingStyleObservable, Flow, Span, Box } from "/dist/modules/highlight/engines/paint.mjs";
import * as TermBackground from "/dist/modules/highlight/common/term-background.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";
import { Z_INDEX_MIN, EleID, EleClass, getTermClass, getTermTokenClass } from "/dist/modules/common.mjs";

// TODO investigate whether `mozSetImageElement()` is a viable alternative to the draw container

class ElementImageMethod implements AbstractMethod {
	readonly #termTokens: TermTokens;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;
	readonly #spanBoxesMap: AllReadonly<Map<Span, Array<Box>>>;
	readonly #elementHighlightingIdMap: AllReadonly<Map<HTMLElement, number>>;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #termStyleManagerMap = new Map<MatchTerm, StyleManager<Record<never, never>>>();
	readonly #drawContainersParent: HTMLElement;
	readonly #elementDrawContainerMap = new Map<HTMLElement, HTMLElement>();

	constructor (
		termTokens: TermTokens,
		elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
		spanBoxesMap: Map<Readonly<Span>, Array<Readonly<Box>>>,
		elementHighlightingIdMap: AllReadonly<Map<HTMLElement, number>>,
		styleObserver: HighlightingStyleObservable,
	) {
		this.#termTokens = termTokens;
		this.#elementFlowsMap = elementFlowsMap;
		this.#spanBoxesMap = spanBoxesMap;
		this.#elementHighlightingIdMap = elementHighlightingIdMap;
		this.#styleManager.setStyle(`
#${ EleID.DRAW_CONTAINER } {
	& {
		position: fixed !important;
		width: 100% !important;
		height: 100% !important;
		top: 100% !important;
		z-index: ${ Z_INDEX_MIN } !important;
	}
	& > * {
		position: fixed !important;
		width: 100% !important;
		height: 100% !important;
	}
}

#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ #${ EleID.DRAW_CONTAINER } .${ EleClass.TERM } {
	outline: 2px solid hsl(0 0% 0% / 0.1) !important;
	outline-offset: -2px !important;
	border-radius: 2px !important;
}
`
		);
		this.#drawContainersParent = document.createElement("div");
		this.#drawContainersParent.id = EleID.DRAW_CONTAINER;
		document.body.insertAdjacentElement("afterend", this.#drawContainersParent);
		const newlyStyledElements = new Set<HTMLElement>();
		const newlyUnstyledElements = new Set<HTMLElement>();
		styleObserver.addHighlightingStyleRuleChangedListener(element => {
			newlyStyledElements.add(element);
		});
		styleObserver.addHighlightingStyleRuleDeletedListener(element => {
			newlyUnstyledElements.add(element);
		});
		styleObserver.addHighlightingAppliedListener(() => {
			for (const element of newlyUnstyledElements) {
				this.#elementDrawContainerMap.get(element)?.remove();
				this.#elementDrawContainerMap.delete(element);
			}
			for (const element of newlyStyledElements) {
				const container = this.getDrawElementContainer(element);
				this.#elementDrawContainerMap.get(element)?.remove();
				if (container) {
					this.#elementDrawContainerMap.set(element, container);
					this.#drawContainersParent.appendChild(container);
				} else {
					this.#elementDrawContainerMap.delete(element);
				}
			}
		});
	}

	deactivate () {
		this.endHighlighting();
		this.#drawContainersParent.remove();
		this.#styleManager.deactivate();
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.removeTermStyles();
		for (let i = 0; i < terms.length; i++) {
			const styleManager = new StyleManager(new HTMLStylesheet(document.head));
			styleManager.setStyle(this.getTermCSS(terms, hues, i));
			this.#termStyleManagerMap.set(terms[i], styleManager);
		}
	}

	endHighlighting () {
		this.removeTermStyles();
	}

	removeTermStyles () {
		for (const styleManager of this.#termStyleManagerMap.values()) {
			styleManager.deactivate();
		}
		this.#termStyleManagerMap.clear();
	}

	getTermCSS (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number): string {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		const cycle = Math.floor(termIndex / hues.length);
		const selector = `#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ #${ EleID.DRAW_CONTAINER } .${
			getTermClass(term, this.#termTokens)
		}`;
		const backgroundStyle = TermBackground.getHorizontalStyle(
			`hsl(${ hue } 100% 60% / 0.4)`,
			`hsl(${ hue } 100% 88% / 0.4)`,
			cycle,
		);
		return`${ selector } { background: ${ backgroundStyle } !important; }`;
	}

	constructHighlightStyleRule (highlightingId: number) {
		return `body [${ highlightingIdAttr }="${ highlightingId }"] { background-image: -moz-element(#${
			EleID.DRAW_ELEMENT + highlightingId.toString()
		}) !important; background-repeat: no-repeat !important; }`;
	}

	getDrawElementContainer (element: HTMLElement): HTMLElement | null {
		const highlightingId = this.#elementHighlightingIdMap.get(element);
		if (highlightingId === undefined) {
			return null;
		}
		const boxes: ReadonlyArray<Box> = getBoxesOwned(
			element,
			false,
			this.#elementFlowsMap,
			this.#spanBoxesMap,
			null,
			this.#termTokens,
		);
		if (boxes.length === 0) {
			return null;
		}
		const container = document.createElement("div");
		container.id = EleID.DRAW_ELEMENT + highlightingId.toString();
		let boxRightmost = boxes[0];
		let boxDownmost = boxes[0];
		for (const box of boxes) {
			if (box.x + box.width > boxRightmost.x + boxRightmost.width) {
				boxRightmost = box;
			}
			if (box.y + box.height > boxDownmost.y + boxDownmost.height) {
				boxDownmost = box;
			}
			const drawElement = document.createElement("div");
			drawElement.style.position = "absolute"; // Should it be "fixed"? Should it be applied in a stylesheet?
			drawElement.style.left = box.x.toString() + "px";
			drawElement.style.top = box.y.toString() + "px";
			drawElement.style.width = box.width.toString() + "px";
			drawElement.style.height = box.height.toString() + "px";
			drawElement.classList.add(EleClass.TERM, getTermTokenClass(box.token));
			container.appendChild(drawElement);
		}
		container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
		container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
		return container;
	}
}

export { ElementImageMethod };
