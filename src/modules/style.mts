/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { Z_INDEX_MAX, EleID, EleClass, AtRuleID, getTermClass } from "/dist/modules/common.mjs";

class Style {
	#styleManager = new StyleManager(new HTMLStylesheet(document.head));

	updateStyle (
		terms: ReadonlyArray<MatchTerm>,
		termTokens: TermTokens,
		hues: ReadonlyArray<number>,
	) {
		/** Prevents websites from taking precedence by applying !important to every rule. */
		const makeImportant = (styleText: string) => (
			styleText.replace(/;/g, " !important;")
		);
		let style = makeImportant(`
/* || Scroll Markers */

#${EleID.MARKER_GUTTER} {
	& {
		display: block;
		position: fixed;
		right: 0;
		top: 0;
		width: 0;
		height: 100%;
		z-index: ${Z_INDEX_MAX};
	}
	& * {
		width: 16px;
		height: 1px;
		position: absolute;
		right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
		padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
	& .${EleClass.FOCUS} {
		padding-right: 16px;
		transition: unset;
	}
}

/* || Term Highlights */

.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}
`) + (`
/* || Transitions */

@keyframes ${AtRuleID.MARKER_ON} {
	from {} to { padding-right: 16px; };
}
@keyframes ${AtRuleID.MARKER_OFF} {
	from { padding-right: 16px; } to { padding-right: 0; };
}
@keyframes ${AtRuleID.FLASH} {
	from { background-color: hsl(0 0% 65% / 0.8); } to {};
}
`
		);
		for (let i = 0; i < terms.length; i++) {
			const term = terms[i];
			const hue = hues[i % hues.length];
			style += makeImportant(`
/* || Term Scroll Markers */

#${EleID.MARKER_GUTTER} .${getTermClass(term, termTokens)} {
	background: hsl(${hue} 100% 44%);
}
`
			);
		}
		this.#styleManager.setStyle(style);
	}
}

export { Style };
