import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import { StandardHighlightability } from "/dist/modules/highlight/engines/paint/highlightability.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

class UrlMethod implements AbstractMethod {
	highlightables = new StandardHighlightability();

	getMiscCSS = () => "";

	getTermHighlightsCSS = () => "";

	getTermHighlightCSS = () => "";

	endHighlighting = () => undefined;

	getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

	constructHighlightStyleRule = (highlightId: string, boxes: Array<Box>, terms: Array<MatchTerm>) =>
		`#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id="${highlightId}"] { background-image: ${
			this.constructHighlightStyleRuleUrl(boxes, terms)
		} !important; background-repeat: no-repeat !important; }`;

	constructHighlightStyleRuleUrl = (boxes: Array<Box>, terms: Array<MatchTerm>) =>
		`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
			boxes.map(box =>
				`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${(
					terms.find(term => term.token === box.token) as MatchTerm).hue
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E")`;

	tempReplaceContainers = () => undefined;

	tempRemoveDrawElement = () => undefined;
}

export { UrlMethod };
