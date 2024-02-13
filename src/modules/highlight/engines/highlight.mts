import type { AbstractEngine, EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { StandardFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/standard.mjs";
import { StandardTermCounter } from "/dist/modules/highlight/models/tree-cache/term-counters/standard.mjs";
import { StandardTermWalker } from "/dist/modules/highlight/models/tree-cache/term-walkers/standard.mjs";
import { StandardTermMarker } from "/dist/modules/highlight/models/tree-cache/term-markers/standard.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import { getMutationUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { EleID, EleClass, type TermHues } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true, BoxInfoRange>

type BoxInfo = BaseBoxInfo<true, BoxInfoRange>

type BoxInfoRange = { range: AbstractRange }

const getName = (termToken: string) => "markmysearch-" + termToken;

class ExtendedHighlight {
	highlight: Highlight;
	boxInfoRanges: Map<BoxInfo, AbstractRange> = new Map();

	constructor (...initialRanges: Array<AbstractRange>) {
		this.highlight = new Highlight(...initialRanges);
	}

	add (value: AbstractRange, boxInfo: BoxInfo) {
		this.boxInfoRanges.set(boxInfo, value);
		return this.highlight.add(value);
	}

	has (value: AbstractRange) {
		return this.highlight.has(value);
	}

	delete (value: AbstractRange) {
		const result = Array.from(this.boxInfoRanges.entries()).find(({ 1: range }) => range === value);
		if (!result) {
			return this.highlight.delete(value);
		}
		return this.boxInfoRanges.delete(result[0]);
	}

	getByBoxInfo (boxInfo: BoxInfo) {
		return this.boxInfoRanges.get(boxInfo);
	}

	deleteByBoxInfo (boxInfo: BoxInfo) {
		const range = this.boxInfoRanges.get(boxInfo);
		if (!range) {
			return false;
		}
		this.boxInfoRanges.delete(boxInfo);
		return this.highlight.delete(range);
	}

	hasByBoxInfo (boxInfo: BoxInfo) {
		return this.boxInfoRanges.has(boxInfo);
	}
}

class ExtendedHighlightRegistry {
	registry = CSS.highlights as HighlightRegistry;
	map: Map<string, ExtendedHighlight> = new Map();

	get size () {
		return this.map.size;
	}

	set (termToken: string, value: ExtendedHighlight) {
		this.map.set(termToken, value);
		return this.registry.set(getName(termToken), value.highlight);
	}

	get (termToken: string) {
		return this.map.get(termToken);
	}

	has (termToken: string) {
		return this.map.has(termToken);
	}

	delete (termToken: string) {
		this.registry.delete(getName(termToken));
		return this.map.delete(termToken);
	}

	clear () {
		for (const termToken of this.map.keys()) {
			this.registry.delete(getName(termToken));
		}
		return this.map.clear();
	}
}

class HighlightEngine implements AbstractEngine {
	termOccurrences = new StandardTermCounter();
	termWalker = new StandardTermWalker();
	termMarkers = new StandardTermMarker();

	flowMonitor?: AbstractFlowMonitor;

	mutationUpdates = getMutationUpdates(() => this.flowMonitor?.mutationObserver);

	specialHighlighter?: AbstractSpecialEngine;

	highlights = new ExtendedHighlightRegistry();
	highlightedElements: Set<HTMLElement> = new Set();
	
	constructor (
		terms: Array<MatchTerm>,
		hues: TermHues,
		updateTermStatus: UpdateTermStatus,
	) {
		this.requestRefreshIndicators = requestCallFn(() => (
			this.termMarkers.insert(terms, hues, Array.from(this.highlightedElements))
		), 200, 2000);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.flowMonitor = new StandardFlowMonitor<Flow>(
			() => ({ flows: [] }),
			() => this.countMatches(),
			undefined,
			element => {
				this.highlightedElements.add(element as unknown as HTMLElement);
				for (const flow of element[CACHE].flows) {
					for (const boxInfo of flow.boxesInfo) {
						this.highlights.get(boxInfo.term.token)?.add(new StaticRange({
							startContainer: boxInfo.node,
							startOffset: boxInfo.start,
							endContainer: boxInfo.node,
							endOffset: boxInfo.end,
						}), boxInfo);
					}
				}
			},
			element => {
				this.highlightedElements.delete(element as unknown as HTMLElement);
				for (const flow of element[CACHE].flows) {
					for (const boxInfo of flow.boxesInfo) {
						this.highlights.get(boxInfo.term.token)?.deleteByBoxInfo(boxInfo);
					}
				}
			},
		);
		this.flowMonitor.initMutationUpdatesObserver(terms);
		this.specialHighlighter = new PaintSpecialEngine();
	}

	getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const cycle = Math.floor(termIndex / hues.length);
			return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${getName(term.token)}) {
	background-color: hsl(${hue} 70% 70% / 0.7);
	color: black;
	/* text-decoration to indicate cycle */
}`
			);
		},
	};

	getTermBackgroundStyle = TermCSS.getFlatStyle;

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
		termsToPurge.forEach(term => this.highlights.delete(term.token));
		this.mutationUpdates.disconnect();
		// MAIN
		terms.forEach(term => this.highlights.set(term.token, new ExtendedHighlight()));
		this.flowMonitor?.boxesInfoCalculate(terms, document.body);
		this.mutationUpdates.observe();
		this.specialHighlighter?.startHighlighting(terms);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.undoHighlights();
		document.querySelectorAll("*").forEach(element => {
			delete element[CACHE];
		});
		this.specialHighlighter?.endHighlighting();
	}

	undoHighlights (terms?: Array<MatchTerm>) {
		if (terms) {
			terms.forEach(term => this.highlights.delete(term.token));
		} else {
			this.highlights.clear();
		}
	}

	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term?: MatchTerm | undefined): HTMLElement | null {
		const focus = this.termWalker.step(reverse, stepNotJump, term);
		if (focus) {
			this.termMarkers.raise(term, getContainerBlock(focus));
		}
		return focus;
	}
}

export {
	type Flow, type BoxInfo,
	HighlightEngine,
};
