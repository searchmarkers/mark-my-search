import type { AbstractEngine } from "src/modules/highlight/engine.mjs";
const { HighlighterProcess } = await import("src/modules/highlight/engine.mjs");
type HighlighterProcessItem = (typeof HighlighterProcess)[keyof typeof HighlighterProcess]
const { getMutationUpdates, getStyleUpdates } = await import("src/modules/highlight/engine.mjs");
const { highlightTags } = await import("src/modules/highlight/highlighting.mjs");
import type { AbstractSpecialEngine } from "src/modules/highlight/special-engine.mjs";
const { DummySpecialEngine } = await import("src/modules/highlight/special-engine.mjs");
const { PaintSpecialEngine } = await import("src/modules/highlight/special-engines/paint.mjs");
import type { TreeCache, Flow, Box, AbstractMethod } from "src/modules/highlight/method.mjs";
const {
	getTermBackgroundStyle, styleRulesGetBoxesOwned,
	DummyMethod,
} = await import("src/modules/highlight/method.mjs");
const { PaintMethod } = await import("src/modules/highlight/methods/paint.mjs");
const { ElementMethod } = await import("src/modules/highlight/methods/element.mjs");
const { UrlMethod } = await import("src/modules/highlight/methods/url.mjs");
import type { AbstractFlowMonitor } from "src/modules/highlight/flow-monitor.mjs";
const FlowMonitor = await import("src/modules/highlight/flow-monitor.mjs");
const { StandardFlowMonitor } = await import("src/modules/highlight/flow-monitors/standard.mjs");
import type { TermHues } from "src/modules/common.mjs"
const {
	EleID, EleClass,
	getNodeFinal, isVisible, getElementYRelative, elementsPurgeClass,
	getTermClass
} = await import("src/modules/common.mjs");

type StyleRuleInfo = {
	rule: string
	element: Element
}

class PaintEngine implements AbstractEngine {
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
	constructor (terms: MatchTerms, methodPreference: PaintEngineMethod) {
		if (methodPreference === PaintEngineMethod.PAINT && compatibility.highlight.paintEngine.paintMethod) {
			this.method = new PaintMethod();
		} else if (methodPreference === PaintEngineMethod.ELEMENT && compatibility.highlight.paintEngine.elementMethod) {
			this.method = new ElementMethod();
		} else {
			this.method = new UrlMethod();
		}
		this.flowMonitor = new StandardFlowMonitor(
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
			(element): TreeCache => ({
				id: highlightingId.next().value,
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightables.checkElement(element),
				flows: [],
			}),
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

	getRequestWaitDuration (process: HighlighterProcessItem) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 200;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 50;
	} }

	getRequestReschedulingDelayMax (process: HighlighterProcessItem) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 2000;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 500;
	} }
	
	insertScrollMarkers (terms: MatchTerms, hues: TermHues) {
		if (terms.length === 0) {
			return; // Efficient escape in case of no possible markers to be inserted.
		}
		// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
		const termsAllowed = new Set(terms.slice(0, hues.length));
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		let markersHtml = "";
		this.method.getHighlightedElements().forEach((element: HTMLElement) => {
			const terms = (element[FlowMonitor.CACHE] as TreeCache | undefined)?.flows.flatMap(flow => flow.boxesInfo
				.map(boxInfo => boxInfo.term)
				.filter(term => termsAllowed.has(term))
			) ?? [];
			const yRelative = getElementYRelative(element);
			// TODO use single marker with custom style
			markersHtml += terms.map((term, i) => `<div class="${
				getTermClass(term.token)
			}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`);
		});
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
	
	focusClosest (element: HTMLElement, filter: (element: HTMLElement) => boolean) {
		element.focus({ preventScroll: true });
		if (document.activeElement !== element) {
			if (filter(element)) {
				this.focusClosest(element.parentElement as HTMLElement, filter);
			} else if (document.activeElement) {
				(document.activeElement as HTMLElement).blur();
			}
		}
	}

	/**
	 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	focusNextTerm (reverse: boolean, stepNotJump: boolean, term?: MatchTerm, nodeStart?: Node) {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		const selection = document.getSelection() as Selection;
		const bar = document.getElementById(EleID.BAR) as HTMLElement;
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = selection ? selection.anchorNode : null;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart
			?? (nodeFocused
				? (nodeSelected ? (nodeFocused.contains(nodeSelected) ? nodeSelected : nodeFocused) : nodeFocused)
				: nodeSelected ?? nodeBegin
			);
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element[FlowMonitor.CACHE] as TreeCache | undefined)?.flows.some(flow =>
				term ? flow.boxesInfo.some(boxInfo => boxInfo.term.token === term.token) : flow.boxesInfo.length
			) && isVisible(element)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				this.focusNextTerm(reverse, stepNotJump, term, nodeBegin);
			}
			return;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		this.focusClosest(element, element =>
			element[FlowMonitor.CACHE] && !!(element[FlowMonitor.CACHE] as TreeCache).flows
		);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		this.raiseScrollMarker(term, element);
	}

	startHighlighting (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
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

	undoHighlights (terms?: MatchTerms, root: HTMLElement | DocumentFragment = document.body) {
		this.boxesInfoRemoveForTerms(terms, root);
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
	boxesInfoRemoveForTerms (terms?: MatchTerms, root: HTMLElement | DocumentFragment = document.body) {
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

	getStyleRules (root: Element, recurse: boolean, terms: MatchTerms) {
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
		terms: MatchTerms,
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

	getTermOccurrenceCount (term: MatchTerm, checkExistsOnly = false) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(FlowMonitor.CACHE in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let count = 0;
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (!element) {
				break;
			}
			(element[FlowMonitor.CACHE] as TreeCache).flows.forEach(flow => {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			});
			if (checkExistsOnly && count > 0) {
				return 1;
			}
		}
		return count;
	}

	getShiftAndVisibilityObservers (terms: MatchTerms) {
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

export { PaintEngine };
