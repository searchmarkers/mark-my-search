import type { TreeCache, Box, AbstractMethod } from "src/modules/highlight/method.mjs";
const {
	getTermBackgroundStyle, styleRulesGetBoxesOwned,
} = await import("src/modules/highlight/method.mjs");
const { StandardHighlightability } = await import("src/modules/highlight/highlightability.mjs");
const FlowMonitor = await import("src/modules/highlight/flow-monitor.mjs");
const { EleID, EleClass, getTermClass } = await import("src/modules/common.mjs");

class ElementMethod implements AbstractMethod {
	highlightables = new StandardHighlightability();

	getMiscCSS () {
		return `
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
		;
	}

	getTermHighlightsCSS = () => "";

	getTermHighlightCSS (terms: MatchTerms, hues: Array<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		const cycle = Math.floor(termIndex / hues.length);
		const selector = `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${
			getTermClass(term.token)
		}`;
		const backgroundStyle = getTermBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle);
		return`${selector} { background: ${backgroundStyle}; }`;
	}

	endHighlighting = () => undefined;

	getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

	getElementDrawId = (highlightId: string) => EleID.DRAW_ELEMENT + "-" + highlightId;

	constructHighlightStyleRule = (highlightId: string) =>
		`body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
			this.getElementDrawId(highlightId)
		}) !important; background-repeat: no-repeat !important; }`;

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
		const elementInfo = element[FlowMonitor.CACHE] as TreeCache;
		const boxes: Array<Box> = styleRulesGetBoxesOwned(element);
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
			for (const child of element.children) if (child[FlowMonitor.CACHE]) {
				this.collectElements(child, recurse, containers, range);
			}
		}
	}

	tempRemoveDrawElement (element: Element) {
		document.getElementById(this.getElementDrawId((element[FlowMonitor.CACHE] as TreeCache).id))?.remove();
	}
}

export { ElementMethod }
