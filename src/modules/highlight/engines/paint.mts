import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.mjs";
import type * as Cache from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { FlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/flow-monitor.mjs";
import { getMutationUpdates, getStyleUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID, createContainer } from "/dist/modules/common.mjs";

type TreeCache = {
	id: string
	styleRuleIdx?: number
	isHighlightable: boolean
} & Cache.TreeCache<Flow>

type Flow = BaseFlow<true, BoxInfoBoxes>

type BoxInfo = BaseBoxInfo<true, BoxInfoBoxes>

type BoxInfoBoxes = { boxes: Array<Box> }

type CachingElement<HasCache = false> = Cache.BaseCachingElement<TreeCache, HasCache>

type CachingHTMLElement<HasCache = false> = Cache.BaseCachingHTMLElement<TreeCache, HasCache>

type Box = {
	token: string
	x: number
	y: number
	width: number
	height: number
}

type StyleRuleInfo = {
	rule: string
	element: CachingElement<true>
}

class PaintEngine implements AbstractTreeCacheEngine {
	readonly class = "PAINT";
	readonly model = "tree-cache";

	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly method: AbstractMethod;

	readonly flowMonitor: AbstractFlowMonitor;

	readonly mutationUpdates: ReturnType<typeof getMutationUpdates>;

	readonly elementsVisible: Set<CachingElement> = new Set();
	readonly shiftObserver: ResizeObserver;
	readonly visibilityObserver: IntersectionObserver;
	readonly styleUpdates: ReturnType<typeof getStyleUpdates>;

	readonly terms = createContainer<ReadonlyArray<MatchTerm>>([]);
	readonly hues = createContainer<ReadonlyArray<number>>([]);

	/**
	 * 
	 * @param terms 
	 * @param methodPreference 
	 */
	constructor (
		method: AbstractMethod,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.method = method;
		this.getHighlightedElements = method.getHighlightedElements;
		this.getCSS = method.getCSS;
		this.flowMonitor = new FlowMonitor<BoxInfoBoxes, TreeCache>(
			this.terms,
			termPatterns,
			this.highlightingUpdatedListeners,
			{
				createElementCache: element => ({
					id: "",
					isHighlightable: this.method.isElementHighlightable(element),
					flows: [],
				}),
				onNewHighlightedAncestor: ancestor => {
					const ancestorHighlightable = this.method.findHighlightableAncestor(ancestor) as CachingElement<true>;
					ancestorHighlightable[CACHE] ??= {
						id: "",
						isHighlightable: true,
						flows: [],
					};
					this.styleUpdates.observe(ancestorHighlightable);
					//console.log(highlighting);
					if (ancestorHighlightable[CACHE].id === "") {
						ancestorHighlightable[CACHE].id = highlightingId.next().value;
						// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
						// TODO make sure there is cleanup once the highlighting ID becomes invalid (e.g. when the cache is removed).
						ancestorHighlightable.setAttribute("markmysearch-h_id", ancestorHighlightable[CACHE].id);
					}
					this.method.markElementsUpToHighlightable(ancestor);
				},
			},
		);
		this.mutationUpdates = getMutationUpdates(this.flowMonitor.mutationObserver);
		const { shiftObserver, visibilityObserver } = this.getShiftAndVisibilityObservers();
		this.shiftObserver = shiftObserver;
		this.visibilityObserver = visibilityObserver;
		this.styleUpdates = getStyleUpdates(this.elementsVisible, this.shiftObserver, this.visibilityObserver);
		const highlightingId: Generator<string, never, unknown> = (function* () {
			let i = 0;
			while (true) {
				yield (i++).toString();
			}
		})();
	}

	readonly getCSS: EngineCSS;

	readonly getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.flowMonitor.removeBoxesInfo(termsToPurge); // BoxInfo stores highlighting, so this effectively 'undoes' highlights.
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		this.flowMonitor.generateBoxesInfo(terms, this.termPatterns, document.body);
		this.mutationUpdates.observe();
		this.styleUpdate(
			Array.from(new Set(
				Array.from(this.elementsVisible).map(element => this.method.findHighlightableAncestor(element))
			)).flatMap(ancestor => this.getStyleRules(ancestor, false, terms, hues))
		);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.styleUpdates.disconnectAll();
		this.flowMonitor.removeBoxesInfo();
		// FIXME this should really be applied automatically and judiciously, and the stylesheet should be cleaned up with it
		for (const element of document.body.querySelectorAll("[markmysearch-h_id]")) {
			element.removeAttribute("markmysearch-h_id");
		}
		this.method.endHighlighting();
	}

	readonly getHighlightedElements: () => Iterable<HTMLElement>;

	readonly highlightingUpdatedListeners = new Set<Generator>();

	registerHighlightingUpdatedListener (listener: Generator) {
		this.highlightingUpdatedListeners.add(listener);
	}

	getStyleRules (
		root: CachingElement,
		recurse: boolean,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	): Array<StyleRuleInfo> {
		if (CACHE in root) {
			this.method.tempReplaceContainers(root, recurse);
		}
		const styleRules: Array<StyleRuleInfo> = [];
		this.collectStyleRules(root, recurse, new Range(), styleRules, terms, hues);
		return styleRules;
	}

	collectStyleRules (
		ancestor: CachingElement,
		recurse: boolean,
		range: Range,
		styleRules: Array<StyleRuleInfo>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		if (ancestor && CACHE in ancestor) {
			styleRules.push({
				rule: this.method.constructHighlightStyleRule(
					ancestor[CACHE].id,
					getBoxesOwned(this.termTokens, ancestor),
					terms,
					hues,
				),
				element: ancestor,
			});
		}
		if (recurse) {
			const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT, element =>
				highlightTags.reject.has((element as Element).tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
			);
			let child: CachingElement;
			// eslint-disable-next-line no-cond-assign
			while (child = walker.nextNode() as CachingElement) if (CACHE in child) {
				styleRules.push({
					rule: this.method.constructHighlightStyleRule(
						child[CACHE].id,
						getBoxesOwned(this.termTokens, child),
						terms,
						hues,
					),
					element: child,
				});
			}
		}
	}
	
	styleUpdate (styleRules: ReadonlyArray<StyleRuleInfo>) {
		const styleSheet = (document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement).sheet as CSSStyleSheet;
		for (const { rule, element } of styleRules) {
			if (element[CACHE].styleRuleIdx === undefined) {
				element[CACHE].styleRuleIdx = styleSheet.cssRules.length;
			} else {
				if (styleSheet.cssRules.item(element[CACHE].styleRuleIdx)?.cssText === rule) {
					continue;
				}
				styleSheet.deleteRule(element[CACHE].styleRuleIdx);
			}
			styleSheet.insertRule(rule, element[CACHE].styleRuleIdx);
		}
	}

	getShiftAndVisibilityObservers () {
		const visibilityObserver = new IntersectionObserver(entries => {
			let styleRules: ReadonlyArray<StyleRuleInfo> = [];
			for (const entry of entries as Array<{ isIntersecting: boolean, target: CachingElement }>) {
				if (entry.isIntersecting) {
					//console.log(entry.target, "intersecting");
					if (CACHE in entry.target) {
						this.elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						styleRules = styleRules.concat(this.getStyleRules(
							this.method.findHighlightableAncestor(entry.target),
							false,
							this.terms.current,
							this.hues.current,
						));
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (CACHE in entry.target) {
						this.method.tempRemoveDrawElement(entry.target);
					}
					this.elementsVisible.delete(entry.target);
					shiftObserver.unobserve(entry.target);
				}
			}
			if (styleRules.length > 0) {
				this.styleUpdate(styleRules);
			}
		}, { rootMargin: "400px" });
		const shiftObserver = new ResizeObserver(entries => {
			const styleRules: Array<StyleRuleInfo> = entries.flatMap(entry =>
				this.getStyleRules(
					this.method.findHighlightableAncestor(entry.target as CachingElement),
					true,
					this.terms.current,
					this.hues.current,
				)
			);
			if (styleRules.length > 0) {
				this.styleUpdate(styleRules);
			}
		});
		return { shiftObserver, visibilityObserver };
	}
}

export {
	type TreeCache, type Flow, type BoxInfo, type BoxInfoBoxes, type Box,
	type CachingElement,
	type CachingHTMLElement,
	PaintEngine,
};
