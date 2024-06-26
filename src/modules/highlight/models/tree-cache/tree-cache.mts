import type { BaseFlow } from "/dist/modules/highlight/matcher.mjs";

interface TreeCache<Flow extends BaseFlow<false>> {
	flows: Array<Flow>
}

type CachingElement<Flow extends BaseFlow<false>, HasCache = false> = (
	BaseCachingElement<TreeCache<Flow>, HasCache>
)

type CachingHTMLElement<Flow extends BaseFlow<false>, HasCache = false> = (
	BaseCachingHTMLElement<TreeCache<Flow>, HasCache>
)

type BaseCachingElement<TC extends TreeCache<BaseFlow<false>>, HasCache = false> = (
	BaseCachingE<Element, TC, HasCache>
)

type BaseCachingHTMLElement<TC extends TreeCache<BaseFlow<false>>, HasCache = false> = (
	BaseCachingE<HTMLElement, TC, HasCache>
)

type UnknownCachingElement = Element & { [CACHE]: unknown }

type UnknownCachingHTMLElement = HTMLElement & { [CACHE]: unknown }

type BaseCachingE<E extends Element, TC extends TreeCache<BaseFlow<false>>, C = false> = (C extends true
	? (E & { [CACHE]: TC })
	: (E | (E & { [CACHE]: TC }))
)

const CACHE = "markmysearch__cache";

export {
	type TreeCache,
	type BaseCachingElement, type CachingElement, type UnknownCachingElement,
	type BaseCachingHTMLElement, type CachingHTMLElement, type UnknownCachingHTMLElement,
	CACHE,
};
