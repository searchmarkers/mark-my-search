/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Highlighter } from "/dist/modules/highlight/engine.d.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/tools/term-counter.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { Engine, PaintEngineMethod } from "/dist/modules/common.mjs";

interface AbstractEngineManager extends Highlighter, HighlighterCounterInterface, HighlighterWalkerInterface {
	readonly setEngine: (preference: Engine) => Promise<void>

	readonly applyEngine: () => void

	readonly removeEngine: () => void

	readonly signalPaintEngineMethod: (preference: PaintEngineMethod) => void

	readonly applyPaintEngineMethod: (preference: PaintEngineMethod) => Promise<void>

	readonly setSpecialEngine: () => Promise<void>

	readonly removeSpecialEngine: () => void
}

interface HighlighterCounterInterface {
	readonly termCounter: AbstractTermCounter;
}

interface HighlighterWalkerInterface {
	/**
	 * Moves to the next (downwards) occurrence of a term in the document, beginning from the current selection position.
	 * If an occurrence is successfully focused, the corresponding term marker in the scrollbar will be raised.
	 * *Refer to the TermWalker and TermMarker interfaces for more details.*
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param stepNotJump 
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 * @returns The element landed on by the function, if any.
	 */
	readonly stepToNextOccurrence: (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
	) => HTMLElement | null
}

export type {
	AbstractEngineManager,
	HighlighterCounterInterface,
	HighlighterWalkerInterface,
};
