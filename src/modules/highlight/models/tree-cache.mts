import type { Flow } from "/dist/modules/highlight/models/tree-cache/flow-tracker.mjs";
import type { AbstractEngine } from "/dist/modules/highlight/engine.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

type Model = "tree-cache"

interface AbstractTreeCacheEngine extends AbstractEngine {
	readonly model: Model

	readonly getElementFlowsMap: () => AllReadonly<Map<HTMLElement, Array<Flow>>>;
}

export type { AbstractTreeCacheEngine };
