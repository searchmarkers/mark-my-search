/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { HighlighterCounterInterface, HighlighterWalkerInterface } from "/dist/modules/highlight/model.d.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.d.mjs";
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

export type { AbstractEngineManager };
