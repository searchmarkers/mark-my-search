import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

class UrlMethod implements AbstractMethod {
	readonly termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.termTokens = termTokens;
	}

	highlightables: Highlightables = {
		checkElement: () => true,
		findAncestor: <T extends Element> (element: T) => element,
		markElementsUpTo: () => undefined,
	};

	getCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: () => "",
	};

	endHighlighting = () => undefined;

	getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

	constructHighlightStyleRule = (highlightId: string, boxes: Array<Box>, terms: Array<MatchTerm>, hues: Array<number>) =>
		`#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id="${highlightId}"] { background-image: ${
			this.constructHighlightStyleRuleUrl(boxes, terms, hues)
		} !important; background-repeat: no-repeat !important; }`;

	constructHighlightStyleRuleUrl = (boxes: Array<Box>, terms: Array<MatchTerm>, hues: Array<number>) =>
		`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
			boxes.map(box =>
				`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${
					hues[terms.findIndex(term => this.termTokens.get(term) === box.token) % hues.length]
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E")`;

	tempReplaceContainers = () => undefined;

	tempRemoveDrawElement = () => undefined;
}

export { UrlMethod };
