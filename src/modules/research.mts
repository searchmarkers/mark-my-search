/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

type ResearchRecord = {
	terms: ReadonlyArray<MatchTerm>
	highlightsShown: boolean
	barCollapsed: boolean
	active: boolean
}

export type { ResearchRecord };
