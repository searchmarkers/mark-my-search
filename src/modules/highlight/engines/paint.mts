import {
	type AbstractEngine, getContainerBlock, getMutationUpdates, getStyleUpdates,
} from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlighting.mjs";
import { type AbstractSpecialEngine, DummySpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import {
	type AbstractMethod, DummyMethod,
	getTermBackgroundStyle, styleRulesGetBoxesOwned,
} from "/dist/modules/highlight/engines/paint/method.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import type * as FlowMonitorTypes from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { StandardFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/standard.mjs";
import { StandardTermCounter } from "/dist/modules/highlight/models/tree-cache/term-counters/standard.mjs";
import { StandardTermWalker } from "/dist/modules/highlight/models/tree-cache/term-walkers/standard.mjs";
import { StandardTermMarker } from "/dist/modules/highlight/models/tree-cache/term-markers/standard.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { EleID, type TermHues } from "/dist/modules/common.mjs";

type TreeCache = {
	id: string
	styleRuleIdx: number
	isHighlightable: boolean
} & FlowMonitorTypes.TreeCache<Flow>

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

	method: AbstractMethod = new DummyMethod();

	flowMonitor: AbstractFlowMonitor = new FlowMonitor.DummyFlowMonitor();

	mutationUpdates = getMutationUpdates(() => this.flowMonitor.mutationObserver);

	elementsVisible: Set<Element> = new Set();
	shiftObserver: ResizeObserver | null = null;
	visibilityObserver: IntersectionObserver | null = null;
	styleUpdates = getStyleUpdates(this.elementsVisible, () => ({
		shiftObserver: this.shiftObserver,
		visibilityObserver: this.visibilityObserver,
	}));

	specialHighlighter: AbstractSpecialEngine = new DummySpecialEngine();

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
		this.requestRefreshIndicators = requestCallFn(() => (
			this.termMarkers.insert(terms, hues, Array.from(this.method.getHighlightedElements() as NodeListOf<HTMLElement>))
		), 200, 2000);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.method = method;
		this.flowMonitor = new StandardFlowMonitor(
			(element): TreeCache => ({
				id: highlightingId.next().value,
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightables.checkElement(element),
				flows: [],
			}),
			() => this.countMatches(),
			ancestor => {
				const ancestorHighlightable = this.method.highlightables.findAncestor(ancestor);
				this.styleUpdates.observe(ancestorHighlightable);
				const highlighting = ancestorHighlightable[FlowMonitor.CACHE] as TreeCache;
				if (highlighting.id === "") {
					highlighting.id = highlightingId.next().value;
					// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
					ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
				}
				this.method.highlightables.markElementsUpTo(ancestor);
			},
		);
		this.flowMonitor.initMutationUpdatesObserver(terms,
			elementsAdded => elementsAdded.forEach(element => this.cacheExtend(element)),
		);
		const { shiftObserver, visibilityObserver } = this.getShiftAndVisibilityObservers(terms);
		this.shiftObserver = shiftObserver;
		this.visibilityObserver = visibilityObserver;
		const highlightingId: Generator<string, never, unknown> = (function* () {
			let i = 0;
			while (true) {
				yield (i++).toString();
			}
		})();
		this.getMiscCSS = this.method.getMiscCSS;
		this.getTermHighlightsCSS = this.method.getTermHighlightsCSS;
		this.getTermHighlightCSS = this.method.getTermHighlightCSS;
		this.specialHighlighter = new PaintSpecialEngine();
	}

	// These are applied before construction, so we need to apply them in the constructor too.
	getMiscCSS = this.method.getMiscCSS;
	getTermHighlightsCSS = this.method.getTermHighlightsCSS;
	getTermHighlightCSS = this.method.getTermHighlightCSS;

	getTermBackgroundStyle = getTermBackgroundStyle;

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
		this.cacheExtend(document.body); // Ensure the *whole* document is set up for highlight-caching.
		this.flowMonitor.boxesInfoCalculate(terms, document.body);
		this.mutationUpdates.observe();
		this.styleUpdate(Array.from(new Set(
			Array.from(this.elementsVisible).map(element => this.method.highlightables.findAncestor(element))
		)).flatMap(ancestor => this.getStyleRules(ancestor, false, terms)));
		this.specialHighlighter.startHighlighting(terms);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.styleUpdates.disconnectAll();
		this.undoHighlights();
		document.querySelectorAll("*").forEach(element => {
			delete element[FlowMonitor.CACHE];
		});
		document.body.querySelectorAll("[markmysearch-h_id]").forEach(element => {
			element.removeAttribute("markmysearch-h_id");
		});
		this.method.endHighlighting();
		this.specialHighlighter.endHighlighting();
	}

	undoHighlights (terms?: Array<MatchTerm>) {
		this.boxesInfoRemoveForTerms(terms, document.body);
		this.termWalker.cleanup();
	}

	cacheExtend (element: Element, cacheApply = (element: Element) => {
		if (!element[FlowMonitor.CACHE]) {
			(element[FlowMonitor.CACHE] as TreeCache) = {
				id: "",
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightables.checkElement(element),
				flows: [],
			};
		}
	}) { if (!highlightTags.reject.has(element.tagName)) {
		cacheApply(element);
		for (const child of element.children) {
			this.cacheExtend(child);
		}
	} }
	
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
				const elementInfo = element[FlowMonitor.CACHE] as TreeCache;
				if (!elementInfo)
					return;
				elementInfo.flows.forEach(editFlow);
				Array.from(element.children).forEach(filterBoxesInfo);
			};
			filterBoxesInfo(element);
		}
	}

	getStyleRules (root: Element, recurse: boolean, terms: Array<MatchTerm>) {
		this.method.tempReplaceContainers(root, recurse);
		const styleRules: Array<StyleRuleInfo> = [];
		// 'root' must have [elementInfo].
		this.collectStyleRules(root, recurse, new Range(), styleRules, terms);
		return styleRules;
	}

	collectStyleRules (
		element: Element,
		recurse: boolean,
		range: Range,
		styleRules: Array<StyleRuleInfo>,
		terms: Array<MatchTerm>,
	) {
		const elementInfo = element[FlowMonitor.CACHE] as TreeCache;
		const boxes: Array<Box> = styleRulesGetBoxesOwned(element);
		if (boxes.length) {
			styleRules.push({
				rule: this.method.constructHighlightStyleRule(elementInfo.id, boxes, terms),
				element,
			});
		}
		if (recurse) {
			for (const child of element.children) if (child[FlowMonitor.CACHE]) {
				this.collectStyleRules(child, recurse, range, styleRules, terms);
			}
		}
	}
	
	styleUpdate (styleRules: Array<StyleRuleInfo>) {
		const styleSheet = (document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement).sheet as CSSStyleSheet;
		styleRules.forEach(({ rule, element }) => {
			const elementInfo = element[FlowMonitor.CACHE] as TreeCache;
			if (elementInfo.styleRuleIdx === -1) {
				elementInfo.styleRuleIdx = styleSheet.cssRules.length;
			} else {
				if (styleSheet.cssRules.item(elementInfo.styleRuleIdx)?.cssText === rule) {
					return;
				}
				styleSheet.deleteRule(elementInfo.styleRuleIdx);
			}
			styleSheet.insertRule(rule, elementInfo.styleRuleIdx);
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
			const styleRules: Array<StyleRuleInfo> = entries.flatMap(entry =>
				this.getStyleRules(this.method.highlightables.findAncestor(entry.target), true, terms)
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
					if (entry.target[FlowMonitor.CACHE]) {
						this.elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						styleRules = styleRules.concat(
							this.getStyleRules(this.method.highlightables.findAncestor(entry.target), false, terms)
						);
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (entry.target[FlowMonitor.CACHE]) {
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
