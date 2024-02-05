import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";

type TreeCache<Flow = BaseFlow<false>> = {
	flows: Array<Flow>
}

const CACHE = "markmysearch__cache";

export {
	type TreeCache,
	CACHE,
};
