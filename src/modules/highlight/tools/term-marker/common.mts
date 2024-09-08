/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { Z_INDEX_MAX, EleID, EleClass, AtRuleID, getTermClass } from "/dist/modules/common.mjs";

abstract class Styles {
	static readonly mainCSS = (`
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

@keyframes ${AtRuleID.MARKER_ON} {
	from {} to { padding-right: 16px; };
}
@keyframes ${AtRuleID.MARKER_OFF} {
	from { padding-right: 16px; } to { padding-right: 0; };
}
`
	);

	static getTermCSS (
		term: MatchTerm,
		termIndex: number,
		hues: ReadonlyArray<number>,
		termTokens: TermTokens,
	): string {
		const hue = hues[termIndex % hues.length];
		return `
#${EleID.MARKER_GUTTER} .${getTermClass(term, termTokens)} {
	background: hsl(${hue} 100% 44%);
}
`
		;
	}
}

export { Styles };
