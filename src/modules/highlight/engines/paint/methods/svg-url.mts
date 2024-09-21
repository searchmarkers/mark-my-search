/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.d.mjs";
import { highlightingIdAttr } from "/dist/modules/highlight/engines/paint/common.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

class SvgUrlMethod implements AbstractMethod {
	readonly #termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	deactivate () {}

	startHighlighting () {}

	endHighlighting () {}

	constructHighlightStyleRule (
		highlightingId: number,
		boxes: ReadonlyArray<Box>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		return `#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ body [${ highlightingIdAttr }="${
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
				`%3Crect width='${ box.width }' height='${ box.height }' x='${ box.x }' y='${ box.y }' fill='hsl(${
					hues[terms.findIndex(term => this.#termTokens.get(term) === box.token) % hues.length]
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E")`;
	}
}

export { SvgUrlMethod };
