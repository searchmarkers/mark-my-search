import { type AbstractEngine, getMutationUpdates } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlighting.mjs";
import { type AbstractSpecialEngine, DummySpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import type { AbstractFlowMonitor, TreeCache } from "/dist/modules/highlight/flow-monitor.mjs";
import * as FlowMonitor from "/dist/modules/highlight/flow-monitor.mjs";
import { StandardFlowMonitor } from "/dist/modules/highlight/flow-monitors/standard.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true, BoxInfoRange>

type BoxInfo = BaseBoxInfo<true, BoxInfoRange>

type BoxInfoRange = { range: AbstractRange }

const getName = (termToken: string) => "markmysearch-" + termToken;

class HighlightEngine implements AbstractEngine {
	flowMonitor: AbstractFlowMonitor = new FlowMonitor.DummyFlowMonitor();

	mutationUpdates = getMutationUpdates(() => this.flowMonitor.mutationObserver);

	specialHighlighter: AbstractSpecialEngine = new DummySpecialEngine();

	highlights = (() => {
		const highlights = CSS.highlights as HighlightRegistry;
		const map: HighlightRegistry = new Map();
		return {
			set: (termToken: string, value: Highlight) => {
				highlights.set(getName(termToken), value);
				return map.set(termToken, value);
			},
			get: (termToken: string) => map.get(termToken),
			has: (termToken: string) => map.has(termToken),
			delete: (termToken: string) => {
				highlights.delete(getName(termToken));
				return map.delete(termToken);
			},
			clear: () => {
				for (const termToken of map.keys()) {
					highlights.delete(getName(termToken));
				}
				return map.clear();
			}
		};
	})();
	
	constructor (terms: Array<MatchTerm>) {
		this.flowMonitor = new StandardFlowMonitor(
			() => undefined,
			() => ({ flows: [] }),
			boxesInfo => {
				for (const boxInfo of boxesInfo) {
					const highlight = this.highlights.get(boxInfo.term.token);
					if (!highlight)
						continue;
					highlight.add(new StaticRange({
						startContainer: boxInfo.node,
						startOffset: boxInfo.start,
						endContainer: boxInfo.node,
						endOffset: boxInfo.end,
					}));
				}
			},
		);
		this.flowMonitor.initMutationUpdatesObserver(terms,
			elementsAdded => elementsAdded.forEach(element => this.cacheExtend(element))
		);
		this.specialHighlighter = new PaintSpecialEngine();
	}

	getMiscCSS () {
		return "";
	}

	getTermHighlightsCSS () {
		return "";
	}

	getTermHighlightCSS (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const cycle = Math.floor(termIndex / hues.length);
		return `
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${getName(term.token)}) {
	background-color: hsl(${hue} 70% 70%);
	color: black;
	/* text-decoration to indicate cycle */
}`
		;
	}

	getTermBackgroundStyle = TermCSS.getFlatStyle;

	getRequestWaitDuration () {
		return 50;
	}

	getRequestReschedulingDelayMax () {
		return 500;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	insertScrollMarkers (terms: Array<MatchTerm>, hues: TermHues) {
		//
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		//
	}

	startHighlighting (
		terms: Array<MatchTerm>,
		termsToHighlight: Array<MatchTerm>,
		termsToPurge: Array<MatchTerm>,
	) {
		// Clean up.
		termsToPurge.forEach(term => this.highlights.delete(term.token));
		this.mutationUpdates.disconnect();
		// MAIN
		terms.forEach(term => this.highlights.set(term.token, new Highlight()));
		this.cacheExtend(document.body); // Ensure the *whole* document is set up for highlight-caching.
		this.flowMonitor.boxesInfoCalculate(terms, document.body);
		this.mutationUpdates.observe();
		this.specialHighlighter.startHighlighting(terms);
	}

	endHighlighting () {
		this.highlights.clear();
		this.specialHighlighter.endHighlighting();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	undoHighlights (terms?: Array<MatchTerm> | undefined, root: HTMLElement | DocumentFragment = document.body) {
		terms?.forEach(term => this.highlights.delete(term.token));
	}

	cacheExtend (element: Element, cacheApply = (element: Element) => {
		if (!element[FlowMonitor.CACHE]) {
			(element[FlowMonitor.CACHE] as TreeCache) = {
				flows: [],
			};
		}
	}) { if (!highlightTags.reject.has(element.tagName)) {
		cacheApply(element);
		for (const child of element.children) {
			this.cacheExtend(child);
		}
	} }

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	focusNextTerm (reverse: boolean, stepNotJump: boolean, term?: MatchTerm) {
		//
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getTermOccurrenceCount (term: MatchTerm, checkExistsOnly = false) {
		return 0;
	}
}

export { HighlightEngine };
