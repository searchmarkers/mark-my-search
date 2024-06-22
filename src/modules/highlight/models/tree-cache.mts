import type { AbstractEngine } from "/dist/modules/highlight/engine.mjs";

type Model = "tree-cache"

interface AbstractTreeCacheEngine extends AbstractEngine {
	readonly model: Model
}

export type {
	AbstractTreeCacheEngine,
};
