import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type { Box, CachingElement, CachingHTMLElement } from "/dist/modules/highlight/engines/paint.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { Z_INDEX_MIN, EleID, EleClass, getTermClass, getTermTokenClass } from "/dist/modules/common.mjs";

class ElementMethod implements AbstractMethod {
	readonly termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.termTokens = termTokens;
	}

	isElementHighlightable () {
		return true;
	}

	findHighlightableAncestor (element: CachingElement): CachingElement {
		return element;
	}

	markElementsUpToHighlightable () {}

	readonly getCSS: EngineCSS = {
		misc: () => {
			return (`
#${EleID.DRAW_CONTAINER} {
& {
	position: fixed;
	width: 100%;
	height: 100%;
	top: 100%;
	z-index: ${Z_INDEX_MIN};
}
& > * {
	position: fixed;
	width: 100%;
	height: 100%;
}
}

#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${EleClass.TERM} {
outline: 2px solid hsl(0 0% 0% / 0.1);
outline-offset: -2px;
border-radius: 2px;
}`
			);
		},
		termHighlights: () => "",
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			const selector = `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${
				getTermClass(term, this.termTokens)
			}`;
			const backgroundStyle = TermCSS.getHorizontalStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle);
			return`${selector} { background: ${backgroundStyle}; }`;
		},
	};

	endHighlighting () {}

	getHighlightedElements () {
		return document.body.querySelectorAll(
			"[markmysearch-h_id]",
		) as NodeListOf<CachingHTMLElement<true>>;
	}

	getElementDrawId (highlightId: string) {
		return EleID.DRAW_ELEMENT + "-" + highlightId;
	}

	constructHighlightStyleRule (highlightId: string) {
		return `body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
			this.getElementDrawId(highlightId)
		}) !important; background-repeat: no-repeat !important; }`;
	}

	tempReplaceContainers (root: CachingElement<true>, recurse: boolean) {
		// This whole operation is plagued with issues. Containers will almost never get deleted when they should
		// (e.g. when all terms have been removed or highlighting is disabled), and removing an individual term does not
		// result in the associated elements being deleted. TODO
		const containers: Array<Element> = [];
		this.collectElements(root, recurse, containers, new Range());
		const parent = document.getElementById(EleID.DRAW_CONTAINER) as Element;
		for (const container of containers) {
			const containerExisting = document.getElementById(container.id);
			if (containerExisting) {
				containerExisting.remove();
			}
			parent.appendChild(container);
		}
	}
	
	collectElements (
		element: CachingElement<true>,
		recurse: boolean,
		containers: Array<Element>,
		range: Range,
	) {
		const boxes: Array<Box> = getBoxesOwned(this.termTokens, element);
		if (boxes.length) {
			const container = document.createElement("div");
			container.id = this.getElementDrawId(element[CACHE].id);
			for (const box of boxes) {
				const element = document.createElement("div");
				element.style.position = "absolute"; // Should it be "fixed"? Should it be applied in a stylesheet?
				element.style.left = box.x.toString() + "px";
				element.style.top = box.y.toString() + "px";
				element.style.width = box.width.toString() + "px";
				element.style.height = box.height.toString() + "px";
				element.classList.add(EleClass.TERM, getTermTokenClass(box.token));
				container.appendChild(element);
			}
			const boxRightmost = boxes.reduce((box, boxCurrent) =>
				box && (box.x + box.width > boxCurrent.x + boxCurrent.width) ? box : boxCurrent
			);
			const boxDownmost = boxes.reduce((box, boxCurrent) =>
				box && (box.y + box.height > boxCurrent.y + boxCurrent.height) ? box : boxCurrent
			);
			container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
			container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
			containers.push(container);
		}
		if (recurse) {
			for (const child of element.children as HTMLCollectionOf<CachingElement>) if (CACHE in child) {
				this.collectElements(child, recurse, containers, range);
			}
		}
	}

	tempRemoveDrawElement (element: CachingElement<true>) {
		document.getElementById(this.getElementDrawId(element[CACHE].id))?.remove();
	}
}

export { ElementMethod };
