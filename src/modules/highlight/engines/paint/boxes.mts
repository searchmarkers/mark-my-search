/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Flow, Span, Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { TermTokens } from "/dist/modules/match-term.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

const getBoxesOwned = <R extends boolean>(
	owner: HTMLElement,
	recalculate: R,
	elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
	spanBoxesMap: (R extends true
		? Map<Readonly<Span>, Array<Readonly<Box>>>
		: AllReadonly<Map<Span, Array<Box>>>),
	highlightables: Highlightables | null,
	termTokens: TermTokens,
): Array<Box> => {
	const boxes = getBoxes(owner, owner, recalculate, elementFlowsMap, spanBoxesMap, termTokens);
	const walker = document.createTreeWalker(owner, NodeFilter.SHOW_ELEMENT, element =>
		highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
	);
	if (highlightables) {
		let child: Node | null;
		// eslint-disable-next-line no-cond-assign
		while (child = walker.nextNode()) if (child instanceof HTMLElement) {
			if (elementFlowsMap.has(child) && !highlightables.isElementHighlightable(child)) {
				boxes.push(...getBoxes(owner, child, recalculate, elementFlowsMap, spanBoxesMap, termTokens));
			}
		}
	}
	return boxes;
};

const getBoxes = <R extends boolean>(
	owner: HTMLElement,
	element: HTMLElement,
	recalculate: R,
	elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
	spanBoxesMap: (R extends true
		? Map<Readonly<Span>, Array<Readonly<Box>>>
		: AllReadonly<Map<Span, Array<Box>>>),
	termTokens: TermTokens,
): Array<Box> => {
	const elementFlows = elementFlowsMap.get(element);
	if (!elementFlows || elementFlows.every(flow => flow.spans.length === 0)) {
		return [];
	}
	let ownerRects = Array.from(owner.getClientRects());
	if (!ownerRects.length) {
		ownerRects = [ owner.getBoundingClientRect() ];
	}
	if (recalculate) {
		elementPopulateBoxes(
			elementFlows,
			ownerRects,
			// Recalculate is true, so this type is correct.
			spanBoxesMap as Map<Readonly<Span>, Array<Readonly<Box>>>,
			termTokens,
		);
	}
	return elementFlows.flatMap(flow => flow.spans.flatMap(span => spanBoxesMap.get(span) ?? []));
};

const range = new Range();

const elementPopulateBoxes = (
	elementFlows: AllReadonly<Array<Flow>>,
	elementRects: Array<DOMRect>,
	spanBoxesMap: Map<Readonly<Span>, Array<Readonly<Box>>>,
	termTokens: TermTokens,
) => {
	for (const flow of elementFlows) {
		for (const span of flow.spans) {
			const spanBoxes = spanBoxesMap.get(span) ?? [];
			spanBoxes.splice(0);
			range.setStart(span.node, span.start);
			range.setEnd(span.node, span.end);
			const textRects = range.getClientRects();
			for (let i = 0; i < textRects.length; i++) {
				const textRect = textRects.item(i)!;
				if (i !== 0
					&& textRect.x === textRects.item(i - 1)!.x
					&& textRect.y === textRects.item(i - 1)!.y
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
				spanBoxes.push({
					token: termTokens.get(span.term),
					x: Math.round(x),
					y: Math.round(y),
					width: Math.round(textRect.width),
					height: Math.round(textRect.height),
				});
			}
			if (spanBoxes.length > 0) {
				spanBoxesMap.set(span, spanBoxes);
			} else {
				spanBoxesMap.delete(span);
			}
		}
	}
};

export { getBoxesOwned };
