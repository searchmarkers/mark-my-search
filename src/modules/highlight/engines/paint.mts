import type { AbstractEngine, EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type * as Cache from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { FlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/flow-monitor.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import { TermCounter } from "/dist/modules/highlight/models/tree-cache/term-counters/term-counter.mjs";
import { TermWalker } from "/dist/modules/highlight/models/tree-cache/term-walkers/term-walker.mjs";
import { TermMarker } from "/dist/modules/highlight/models/tree-cache/term-markers/term-marker.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import { getMutationUpdates, getStyleUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";
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
	readonly termOccurrences: AbstractTermCounter = new TermCounter();
	readonly termWalker: AbstractTermWalker = new TermWalker();
	readonly termMarkers: AbstractTermMarker = new TermMarker();

	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly method: AbstractMethod;

	readonly flowMonitor: AbstractFlowMonitor;

	readonly mutationUpdates: ReturnType<typeof getMutationUpdates>;

	readonly elementsVisible: Set<Element> = new Set();
	readonly shiftObserver: ResizeObserver;
	readonly visibilityObserver: IntersectionObserver;
	readonly styleUpdates: ReturnType<typeof getStyleUpdates>;

	readonly specialHighlighter: AbstractSpecialEngine;

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
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.method = method;
		this.getCSS = method.getCSS;
		this.requestRefreshIndicators = requestCallFn(
			() => this.termMarkers.insert(terms, termTokens, hues, Array.from(this.method.getHighlightedElements())),
			200, 2000,
		);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.flowMonitor = new FlowMonitor(
			terms,
			termPatterns,
			(element): TreeCache => ({
				id: "",
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightables.checkElement(element),
				flows: [],
			}),
			() => this.countMatches(),
			ancestor => {
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
		this.mutationUpdates = getMutationUpdates(this.flowMonitor.mutationObserver);
		const { shiftObserver, visibilityObserver } = this.getShiftAndVisibilityObservers(terms, hues);
		this.shiftObserver = shiftObserver;
		this.visibilityObserver = visibilityObserver;
		this.styleUpdates = getStyleUpdates(this.elementsVisible, this.shiftObserver, this.visibilityObserver);
		const highlightingId: Generator<string, never, unknown> = (function* () {
			let i = 0;
			while (true) {
				yield (i++).toString();
			}
		})();
		this.specialHighlighter = new PaintSpecialEngine(termTokens, termPatterns);
	}

	readonly getCSS: EngineCSS;

	readonly getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	readonly requestRefreshIndicators: Generator;
	readonly requestRefreshTermControls: Generator;

	countMatches () {
		this.requestRefreshIndicators.next();
		this.requestRefreshTermControls.next();
	}

	startHighlighting (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
		hues: Array<number>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.flowMonitor.removeBoxesInfo(termsToPurge); // BoxInfo stores highlighting, so this effectively 'undoes' highlights.
		// MAIN
		this.flowMonitor.generateBoxesInfo(terms, this.termPatterns, document.body);
		this.mutationUpdates.observe();
		this.styleUpdate(
			Array.from(new Set(
				Array.from(this.elementsVisible).map(element => this.method.highlightables.findAncestor(element))
			)).flatMap(ancestor => this.getStyleRules(ancestor, false, terms, hues))
		);
		this.specialHighlighter.startHighlighting(terms, hues);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.styleUpdates.disconnectAll();
		this.undoHighlights();
		// FIXME this should really be applied automatically and judiciously, and the stylesheet should be cleaned up with it
		document.body.querySelectorAll("[markmysearch-h_id]").forEach(element => {
			element.removeAttribute("markmysearch-h_id");
		});
		this.method.endHighlighting();
		this.specialHighlighter.endHighlighting();
		this.termWalker.cleanup();
	}

	undoHighlights (terms?: Array<MatchTerm>) {
		this.flowMonitor.removeBoxesInfo(terms);
	}

	getStyleRules (root: Element, recurse: boolean, terms: Array<MatchTerm>, hues: Array<number>) {
		this.method.tempReplaceContainers(root, recurse);
		const styleRules: Array<StyleRuleInfo> = [];
		// 'root' must have [elementInfo].
		this.collectStyleRules(root, recurse, new Range(), styleRules, terms, hues);
		return styleRules;
	}

	collectStyleRules (
		ancestor: Element,
		recurse: boolean,
		range: Range,
		styleRules: Array<StyleRuleInfo>,
		terms: Array<MatchTerm>,
		hues: Array<number>,
	) {
		if (ancestor && CACHE in ancestor) {
			styleRules.push({
				rule: this.method.constructHighlightStyleRule(
					(ancestor[CACHE] as TreeCache).id,
					getBoxesOwned(this.termTokens, ancestor),
					terms,
					hues,
				),
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
						rule: this.method.constructHighlightStyleRule(
							(child[CACHE] as TreeCache).id,
							getBoxesOwned(this.termTokens, child),
							terms,
							hues,
						),
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

	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		const focus = this.termWalker.step(reverse, stepNotJump, term, this.termTokens);
		if (focus) {
			this.termMarkers.raise(term, this.termTokens, getContainerBlock(focus));
		}
		return focus;
	}

	getShiftAndVisibilityObservers (terms: Array<MatchTerm>, hues: Array<number>) {
		const shiftObserver = new ResizeObserver(entries => {
			const styleRules: Array<StyleRuleInfo> = entries.flatMap(entry =>
				this.getStyleRules(this.method.highlightables.findAncestor(entry.target), true, terms, hues)
			);
			if (styleRules.length) {
				this.styleUpdate(styleRules);
			}
		});
		const visibilityObserver = new IntersectionObserver(entries => {
			let styleRules: Array<StyleRuleInfo> = [];
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					//console.log(entry.target, "intersecting");
					if (CACHE in entry.target) {
						this.elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						styleRules = styleRules.concat(
							this.getStyleRules(this.method.highlightables.findAncestor(entry.target), false, terms, hues)
						);
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (CACHE in entry.target) {
						this.method.tempRemoveDrawElement(entry.target);
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
