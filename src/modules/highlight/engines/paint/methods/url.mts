import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

class UrlMethod implements AbstractMethod {
	readonly #termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	readonly getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: () => "",
	};

	constructHighlightStyleRule (
		highlightingId: number,
		boxes: ReadonlyArray<Box>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		return `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id="${
			highlightingId
		}"] { background-image: ${
			this.constructHighlightStyleRuleUrl(boxes, terms, hues)
		} !important; background-repeat: no-repeat !important; }`;
	}

	constructHighlightStyleRuleUrl (
		boxes: ReadonlyArray<Box>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
			boxes.map(box =>
				`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${
					hues[terms.findIndex(term => this.#termTokens.get(term) === box.token) % hues.length]
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E")`;
	}
}

export { UrlMethod };
