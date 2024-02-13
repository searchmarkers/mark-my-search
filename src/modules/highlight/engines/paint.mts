import type { AbstractEngine, EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type * as Cache from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { StandardFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/standard.mjs";
import { StandardTermCounter } from "/dist/modules/highlight/models/tree-cache/term-counters/standard.mjs";
import { StandardTermWalker } from "/dist/modules/highlight/models/tree-cache/term-walkers/standard.mjs";
import { StandardTermMarker } from "/dist/modules/highlight/models/tree-cache/term-markers/standard.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import { getMutationUpdates, getStyleUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { EleID, type TermHues } from "/dist/modules/common.mjs";

type TreeCache = {
	id: string
	styleRuleIdx: number
	isHighlightable: boolean
} & Cache.TreeCache<Flow>

type Flow = BaseFlow<true, BoxInfoBoxes>

type BoxInfo = BaseBoxInfo<true, BoxInfoBoxes>

type BoxInfoBoxes = { boxes: Array<Box> }

type Box = {
	token: string
	x: number
	y: number
	width: number
	height: number
}

type StyleRuleInfo = {
	rule: string
	element: Element
}

class PaintEngine implements AbstractEngine {
	termOccurrences = new StandardTermCounter();
	termWalker = new StandardTermWalker();
	termMarkers = new StandardTermMarker();

	#method?: AbstractMethod;
	set method (method: AbstractMethod | undefined) {
		this.getCSS = method?.getCSS;
		this.#method = method;
	}
	get method () {
		return this.#method;
	}

	flowMonitor?: AbstractFlowMonitor;

	mutationUpdates = getMutationUpdates(() => this.flowMonitor?.mutationObserver);

	elementsVisible: Set<Element> = new Set();
	shiftObserver: ResizeObserver | null = null;
	visibilityObserver: IntersectionObserver | null = null;
	styleUpdates = getStyleUpdates(this.elementsVisible, () => ({
		shiftObserver: this.shiftObserver,
		visibilityObserver: this.visibilityObserver,
	}));

	specialHighlighter?: AbstractSpecialEngine;

	/**
	 * 
	 * @param terms 
	 * @param methodPreference 
	 */
	constructor (
		terms: Array<MatchTerm>,
		hues: TermHues,
		updateTermStatus: UpdateTermStatus,
		method: AbstractMethod,
	) {
		this.method = method;
		this.requestRefreshIndicators = requestCallFn(() => (
			this.termMarkers.insert(terms, hues,
				this.method ? Array.from(this.method.getHighlightedElements()) as Array<HTMLElement> : []
			)
		), 200, 2000);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.flowMonitor = new StandardFlowMonitor(
			(element): TreeCache => ({
				id: "",
				styleRuleIdx: -1,
				isHighlightable: this.method?.highlightables.checkElement(element) ?? false,
				flows: [],
			}),
			() => this.countMatches(),
			ancestor => {
				if (!this.method) {
					return;
				}
				const ancestorHighlightable = this.method.highlightables.findAncestor(ancestor);
				this.styleUpdates.observe(ancestorHighlightable);
				const highlighting = ancestorHighlightable[CACHE] as TreeCache ?? {
					id: "",
					styleRuleIdx: -1,
					isHighlightable: true,
					flows: [],
				};
				ancestorHighlightable[CACHE] = highlighting;
				//console.log(highlighting);
				if (highlighting.id === "") {
					highlighting.id = highlightingId.next().value;
					// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
					// TODO make sure there is cleanup once the highlighting ID becomes invalid (e.g. when the cache is removed).
					ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
				}
				this.method.highlightables.markElementsUpTo(ancestor);
			},
		);
		this.flowMonitor.initMutationUpdatesObserver(terms);
		const { shiftObserver, visibilityObserver } = this.getShiftAndVisibilityObservers(terms);
		this.shiftObserver = shiftObserver;
		this.visibilityObserver = visibilityObserver;
		const highlightingId: Generator<string, never, unknown> = (function* () {
			let i = 0;
			while (true) {
				yield (i++).toString();
			}
		})();
		this.specialHighlighter = new PaintSpecialEngine();
	}

	getCSS?: EngineCSS;

	getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	requestRefreshIndicators?: Generator;
	requestRefreshTermControls?: Generator;

	countMatches () {
		this.requestRefreshIndicators?.next();
		this.requestRefreshTermControls?.next();
	}

	startHighlighting (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.boxesInfoRemoveForTerms(termsToPurge); // BoxInfo stores highlighting, so this effectively 'undoes' highlights.
		// MAIN
		this.flowMonitor?.boxesInfoCalculate(terms, document.body);
		this.mutationUpdates.observe();
		const method = this.method;
		if (method) {
			this.styleUpdate(
				Array.from(new Set(
					Array.from(this.elementsVisible)
						.map(element => method.highlightables.findAncestor(element))
				)).flatMap(ancestor => this.getStyleRules(ancestor, false, terms))
			);
		}
		this.specialHighlighter?.startHighlighting(terms);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.styleUpdates.disconnectAll();
		this.undoHighlights();
		document.querySelectorAll("*").forEach(element => {
			delete element[CACHE];
		});
		document.body.querySelectorAll("[markmysearch-h_id]").forEach(element => {
			element.removeAttribute("markmysearch-h_id");
		});
		this.method?.endHighlighting();
		this.specialHighlighter?.endHighlighting();
	}

	undoHighlights (terms?: Array<MatchTerm>) {
		this.boxesInfoRemoveForTerms(terms, document.body);
		this.termWalker.cleanup();
	}
	
	/** TODO update documentation
	 * FIXME this is a cut-down and adapted legacy function which may not function efficiently or fully correctly.
	 * Remove highlights for matches of terms.
	 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	boxesInfoRemoveForTerms (terms?: Array<MatchTerm>, root: HTMLElement | DocumentFragment = document.body) {
		const editFlow: (flow: Flow) => void = terms
			? flow => flow.boxesInfo = flow.boxesInfo.filter(boxInfo => terms.every(term => term.token !== boxInfo.term.token))
			: flow => flow.boxesInfo = [];
		for (const element of root.querySelectorAll("[markmysearch-h_id]")) {
			const filterBoxesInfo = (element: Element) => {
				const highlighting = element[CACHE] as TreeCache;
				if (!highlighting) {
					return;
				}
				highlighting.flows.forEach(editFlow);
				Array.from(element.children).forEach(filterBoxesInfo);
			};
			filterBoxesInfo(element);
		}
	}

	getStyleRules (root: Element, recurse: boolean, terms: Array<MatchTerm>) {
		this.method?.tempReplaceContainers(root, recurse);
		const styleRules: Array<StyleRuleInfo> = [];
		// 'root' must have [elementInfo].
		this.collectStyleRules(root, recurse, new Range(), styleRules, terms);
		return styleRules;
	}

	collectStyleRules (
		ancestor: Element,
		recurse: boolean,
		range: Range,
		styleRules: Array<StyleRuleInfo>,
		terms: Array<MatchTerm>,
	) {
		const method = this.method;
		if (!method) {
			return;
		}
		if (ancestor && CACHE in ancestor) {
			styleRules.push({
				rule: method.constructHighlightStyleRule((ancestor[CACHE] as TreeCache).id, getBoxesOwned(ancestor), terms),
				element: ancestor,
			});
		}
		if (recurse) {
			const walker = document.createTreeWalker(ancestor, NodeFilter.SHOW_ELEMENT, (element: Element) =>
				highlightTags.reject.has(element.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
			);
			let child: Element;
			// eslint-disable-next-line no-cond-assign
			while (child = walker.nextNode() as Element) {
				if (CACHE in child) {
					styleRules.push({
						rule: method.constructHighlightStyleRule((child[CACHE] as TreeCache).id, getBoxesOwned(child), terms),
						element: child,
					});
				}
			}
		}
	}
	
	styleUpdate (styleRules: Array<StyleRuleInfo>) {
		const styleSheet = (document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement).sheet as CSSStyleSheet;
		styleRules.forEach(({ rule, element }) => {
			const highlighting = element[CACHE] as TreeCache | undefined;
			if (!highlighting) {
				return;
			}
			if (highlighting.styleRuleIdx === -1) {
				highlighting.styleRuleIdx = styleSheet.cssRules.length;
			} else {
				if (styleSheet.cssRules.item(highlighting.styleRuleIdx)?.cssText === rule) {
					return;
				}
				styleSheet.deleteRule(highlighting.styleRuleIdx);
			}
			styleSheet.insertRule(rule, highlighting.styleRuleIdx);
		});
	}

	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term?: MatchTerm | undefined): HTMLElement | null {
		const focus = this.termWalker.step(reverse, stepNotJump, term);
		if (focus) {
			this.termMarkers.raise(term, getContainerBlock(focus));
		}
		return focus;
	}

	getShiftAndVisibilityObservers (terms: Array<MatchTerm>) {
		const shiftObserver = new ResizeObserver(entries => {
			const method = this.method;
			if (!method) {
				return;
			}
			const styleRules: Array<StyleRuleInfo> = entries.flatMap(entry =>
				this.getStyleRules(method.highlightables.findAncestor(entry.target), true, terms)
			);
			if (styleRules.length) {
				this.styleUpdate(styleRules);
			}
		});
		const visibilityObserver = new IntersectionObserver(entries => {
			const method = this.method;
			if (!method) {
				return;
			}
			let styleRules: Array<StyleRuleInfo> = [];
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					//console.log(entry.target, "intersecting");
					if (CACHE in entry.target) {
						this.elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						styleRules = styleRules.concat(
							this.getStyleRules(method.highlightables.findAncestor(entry.target), false, terms)
						);
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (CACHE in entry.target) {
						method.tempRemoveDrawElement(entry.target);
					}
					this.elementsVisible.delete(entry.target);
					shiftObserver.unobserve(entry.target);
				}
			});
			if (styleRules.length) {
				this.styleUpdate(styleRules);
			}
		}, { rootMargin: "400px" });
		return { shiftObserver, visibilityObserver };
	}
}

export {
	type TreeCache, type Flow, type BoxInfo, type BoxInfoBoxes, type Box,
	PaintEngine,
};
