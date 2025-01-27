/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, AtRuleID } from "/dist/modules/common.mjs";

const mainCSS = `
.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}

@keyframes ${AtRuleID.FLASH} {
	from { background-color: hsl(0 0% 65% / 0.8); } to {};
}
`;

export { mainCSS };
