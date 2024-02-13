import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { TreeCache, Flow, Box } from "/dist/modules/highlight/engines/paint.mjs";

const getBoxesOwned = (
	owner: Element,
	range = new Range(),
): Array<Box> => {
	let boxes = getBoxes(owner, owner, range);
	const walker = document.createTreeWalker(owner, NodeFilter.SHOW_ELEMENT, (element: Element) =>
		highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
	);
	let child: Element;
	// eslint-disable-next-line no-cond-assign
	while (child = walker.nextNode() as Element) {
		if (CACHE in child && !(child[CACHE] as TreeCache).isHighlightable) {
			boxes = boxes.concat(getBoxes(owner, child, range));
		}
	}
	return boxes;
};

const getBoxes = (
	owner: Element,
	element?: Element,
	range = new Range(),
) => {
	element ??= owner;
	const highlighting = element[CACHE] as TreeCache;
	if (!highlighting || highlighting.flows.every(flow => flow.boxesInfo.length === 0)) {
		return [];
	}
	let ownerRects = Array.from(owner.getClientRects());
	if (!ownerRects.length) {
		ownerRects = [ owner.getBoundingClientRect() ];
	}
	elementPopulateBoxes(highlighting.flows, ownerRects, range);
	return highlighting.flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes ?? []));
};

const elementPopulateBoxes = (
	elementFlows: Array<Flow>,
	elementRects: Array<DOMRect>,
	range = new Range(),
) =>
	elementFlows.forEach(flow => flow.boxesInfo.forEach(boxInfo => {
		boxInfo.boxes?.splice(0);
		range.setStart(boxInfo.node, boxInfo.start);
		range.setEnd(boxInfo.node, boxInfo.end);
		const textRects = range.getClientRects();
		for (let i = 0; i < textRects.length; i++) {
			const textRect = textRects.item(i) as DOMRect;
			if (i !== 0
				&& textRect.x === (textRects.item(i - 1) as DOMRect).x
				&& textRect.y === (textRects.item(i - 1) as DOMRect).y) {
				continue;
			}
			let x = 0;
			let y = 0;
			for (const ownerRect of elementRects) {
				if (ownerRect.bottom > textRect.top) {
					x += textRect.x - ownerRect.x;
					y = textRect.y - ownerRect.y;
					break;
				} else {
					x += ownerRect.width;
				}
			}
			boxInfo.boxes ??= [];
			boxInfo.boxes.push({
				token: boxInfo.term.token,
				x: Math.round(x),
				y: Math.round(y),
				width: Math.round(textRect.width),
				height: Math.round(textRect.height),
			});
		}
	}))
;

export { getBoxesOwned };
