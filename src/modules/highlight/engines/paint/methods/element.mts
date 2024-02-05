import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type { TreeCache, Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { Z_INDEX_MIN, EleID, EleClass, getTermClass } from "/dist/modules/common.mjs";

class ElementMethod implements AbstractMethod {
	highlightables: Highlightables = {
		checkElement: () => true,
		findAncestor: <T extends Element> (element: T) => element,
		markElementsUpTo: () => undefined,
	};

	getCSS = {
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
		termHighlight: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			const selector = `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${
				getTermClass(term.token)
			}`;
			const backgroundStyle = TermCSS.getHorizontalStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle);
			return`${selector} { background: ${backgroundStyle}; }`;
		},
	};

	endHighlighting = () => undefined;

	getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

	getElementDrawId = (highlightId: string) => EleID.DRAW_ELEMENT + "-" + highlightId;

	constructHighlightStyleRule = (highlightId: string) => (
		`body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
			this.getElementDrawId(highlightId)
		}) !important; background-repeat: no-repeat !important; }`
	);

	tempReplaceContainers (root: Element, recurse: boolean) {
		// This whole operation is plagued with issues. Containers will almost never get deleted when they should
		// (e.g. when all terms have been removed or highlighting is disabled), and removing an individual term does not
		// result in the associated elements being deleted. TODO
		const containers: Array<Element> = [];
		this.collectElements(root, recurse, containers);
		const parent = document.getElementById(EleID.DRAW_CONTAINER) as Element;
		containers.forEach(container => {
			const containerExisting = document.getElementById(container.id);
			if (containerExisting) {
				containerExisting.remove();
			}
			parent.appendChild(container);
		});
	}
	
	collectElements (
		element: Element,
		recurse: boolean,
		containers: Array<Element>,
		range = new Range(),
	) {
		const elementInfo = element[CACHE] as TreeCache;
		const boxes: Array<Box> = getBoxesOwned(element);
		if (boxes.length) {
			const container = document.createElement("div");
			container.id = this.getElementDrawId(elementInfo.id);
			boxes.forEach(box => {
				const element = document.createElement("div");
				element.style.position = "absolute"; // Should it be "fixed"? Should it be applied in a stylesheet?
				element.style.left = box.x.toString() + "px";
				element.style.top = box.y.toString() + "px";
				element.style.width = box.width.toString() + "px";
				element.style.height = box.height.toString() + "px";
				element.classList.add(EleClass.TERM, getTermClass(box.token));
				container.appendChild(element);
			});
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
			for (const child of element.children) if (child[CACHE]) {
				this.collectElements(child, recurse, containers, range);
			}
		}
	}

	tempRemoveDrawElement (element: Element) {
		document.getElementById(this.getElementDrawId((element[CACHE] as TreeCache).id))?.remove();
	}
}

export { ElementMethod };