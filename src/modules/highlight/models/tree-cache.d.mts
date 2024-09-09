/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Flow } from "/dist/modules/highlight/models/tree-cache/flow-tracker.d.mjs";
import type { AbstractEngine } from "/dist/modules/highlight/engine.d.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

type Model = "tree-cache"

interface AbstractTreeCacheEngine extends AbstractEngine {
	readonly model: Model

	readonly getElementFlowsMap: () => AllReadonly<Map<HTMLElement, Array<Flow>>>;
}

export type { AbstractTreeCacheEngine };
