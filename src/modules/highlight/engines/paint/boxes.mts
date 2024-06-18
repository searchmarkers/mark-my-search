import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { Flow, Box, CachingElement } from "/dist/modules/highlight/engines/paint.mjs";
import type { TermTokens } from "/dist/modules/match-term.mjs";

const getBoxesOwned = (
	termTokens: TermTokens,
	owner: Element,
	range = new Range(),
): Array<Box> => {
	let boxes = getBoxes(termTokens, owner, owner, range);
	const walker = document.createTreeWalker(owner, NodeFilter.SHOW_ELEMENT, element =>
		highlightTags.reject.has((element as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
	);
	let child: CachingElement;
	// eslint-disable-next-line no-cond-assign
	while (child = walker.nextNode() as CachingElement) {
		if (CACHE in child && !child[CACHE].isHighlightable) {
			boxes = boxes.concat(getBoxes(termTokens, owner, child, range));
		}
	}
	return boxes;
};

const getBoxes = (
	termTokens: TermTokens,
	owner: CachingElement,
	element?: CachingElement,
	range = new Range(),
) => {
	element ??= owner;
	if (!(CACHE in element) || element[CACHE].flows.every(flow => flow.boxesInfo.length === 0)) {
		return [];
	}
	let ownerRects = Array.from(owner.getClientRects());
	if (!ownerRects.length) {
		ownerRects = [ owner.getBoundingClientRect() ];
	}
	elementPopulateBoxes(element[CACHE].flows, ownerRects, termTokens, range);
	return element[CACHE].flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes ?? []));
};

const elementPopulateBoxes = (
	elementFlows: Array<Flow>,
	elementRects: Array<DOMRect>,
	termTokens: TermTokens,
	range = new Range(),
) => {
	for (const flow of elementFlows) for (const boxInfo of flow.boxesInfo) {
		boxInfo.boxes?.splice(0);
		range.setStart(boxInfo.node, boxInfo.start);
		range.setEnd(boxInfo.node, boxInfo.end);
		const textRects = range.getClientRects();
		for (let i = 0; i < textRects.length; i++) {
			const textRect = textRects.item(i) as DOMRect;
			if (i !== 0
				&& textRect.x === (textRects.item(i - 1) as DOMRect).x
				&& textRect.y === (textRects.item(i - 1) as DOMRect).y
			) {
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
				token: termTokens.get(boxInfo.term),
				x: Math.round(x),
				y: Math.round(y),
				width: Math.round(textRect.width),
				height: Math.round(textRect.height),
			});
		}
	}
};

export { getBoxesOwned };
