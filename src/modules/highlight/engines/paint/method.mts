import type { TreeCache, Flow, Box } from "/dist/modules/highlight/engines/paint.mjs";
import {
	type AbstractHighlightability, StandardHighlightability
} from "/dist/modules/highlight/engines/paint/highlightability.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractMethod {
	highlightables: AbstractHighlightability

	getMiscCSS: () => string

	getTermHighlightsCSS: () => string

	getTermHighlightCSS: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => string

	endHighlighting: () => void

	getHighlightedElements: () => NodeListOf<Element>

	/**
	 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
	 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
	 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
	 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
	 */
	constructHighlightStyleRule: (highlightId: string, boxes: Array<Box>, terms: Array<MatchTerm>) => string

	tempReplaceContainers: (root: Element, recurse: boolean) => void

	tempRemoveDrawElement: (element: Element) => void
}

class DummyMethod implements AbstractMethod {
	highlightables = new StandardHighlightability();
	getMiscCSS = () => "";
	getTermHighlightsCSS = () => "";
	getTermHighlightCSS = () => "";
	getHighlightedElements = (): NodeListOf<Element> => document.querySelectorAll("#_");
	endHighlighting = () => undefined;
	constructHighlightStyleRule = () => "";
	tempReplaceContainers = () => undefined;
	tempRemoveDrawElement = () => undefined;
}

const getTermBackgroundStyle = TermCSS.getHorizontalStyle;

const styleRulesGetBoxesOwned = (
	owner: Element,
	element?: Element,
	range = new Range,
): Array<Box> => {
	element ??= owner;
	return getOwnedBoxes(owner, element, range).concat(Array.from(element.children).flatMap(child =>
		(child[FlowMonitor.CACHE] ? !(child[FlowMonitor.CACHE] as TreeCache).isHighlightable : false)
			? styleRulesGetBoxesOwned(owner, child, range) : []
	));
};

const getOwnedBoxes = (
	owner: Element,
	element?: Element,
	range = new Range(),
) => {
	element ??= owner;
	const elementInfo = element[FlowMonitor.CACHE] as TreeCache;
	if (!elementInfo || elementInfo.flows.every(flow => flow.boxesInfo.length === 0)) {
		return [];
	}
	let ownerRects = Array.from(owner.getClientRects());
	if (!ownerRects.length) {
		ownerRects = [ owner.getBoundingClientRect() ];
	}
	elementPopulateBoxes(elementInfo.flows, ownerRects, range);
	return elementInfo.flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes ?? []));
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

export {
	type AbstractMethod, DummyMethod,
	getTermBackgroundStyle, styleRulesGetBoxesOwned,
};
