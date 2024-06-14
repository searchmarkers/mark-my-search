import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";

type TreeCache<Flow = BaseFlow<false>> = {
	flows: Array<Flow>
}

type CachingElement<Flow = BaseFlow<true>> = Element & { [CACHE]: TreeCache<Flow> }

type CachingHTMLElement<Flow = BaseFlow<true>> = HTMLElement & { [CACHE]: TreeCache<Flow> }

const CACHE = "markmysearch__cache";

export {
	type TreeCache,
	type CachingElement as CachingElement,
	type CachingHTMLElement as CachingHTMLElement,
	CACHE,
};
