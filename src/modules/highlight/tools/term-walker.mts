/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractTermWalker {
	readonly deactivate: () => void

	/**
	 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param stepNotJump 
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 * @returns The element landed on by the function, if any.
	 */
	readonly step: (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
	) => HTMLElement | null
	
	readonly cleanup: () => void
}

export type { AbstractTermWalker };
