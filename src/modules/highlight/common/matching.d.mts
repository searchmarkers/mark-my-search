/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

type BaseFlow<WithNode extends boolean> = {
	text: string
	spans: Array<BaseSpan<WithNode>>
}

type BaseSpan<WithNode extends boolean> = {
	term: MatchTerm
	start: number
	end: number
} & (WithNode extends true
	? { node: Text }
	: Record<never, never>
)

export type { BaseFlow, BaseSpan };
