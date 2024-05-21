import type { AbstractEngine, EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import { PaintSpecialEngine } from "/dist/modules/highlight/special-engines/paint.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { StandardFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/standard.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/models/term-counter.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/models/term-walker.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import { StandardTermCounter } from "/dist/modules/highlight/models/tree-cache/term-counters/standard.mjs";
import { StandardTermWalker } from "/dist/modules/highlight/models/tree-cache/term-walkers/standard.mjs";
import { StandardTermMarker } from "/dist/modules/highlight/models/tree-cache/term-markers/standard.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import { getMutationUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { EleID, EleClass, type TermHues } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true, BoxInfoRange>

type BoxInfo = BaseBoxInfo<true, BoxInfoRange>

type BoxInfoRange = { range: AbstractRange }

const getName = (termToken: string) => "markmysearch-" + termToken;

class ExtendedHighlight {
	readonly highlight: Highlight;
	readonly boxInfoRanges: Map<BoxInfo, AbstractRange> = new Map();

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
	readonly registry = CSS.highlights as HighlightRegistry;
	readonly map: Map<string, ExtendedHighlight> = new Map();

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
	readonly termOccurrences: AbstractTermCounter = new StandardTermCounter();
	readonly termWalker: AbstractTermWalker = new StandardTermWalker();
	readonly termMarkers: AbstractTermMarker = new StandardTermMarker();

	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly flowMonitor: AbstractFlowMonitor;

	readonly mutationUpdates: ReturnType<typeof getMutationUpdates>;

	readonly specialHighlighter: AbstractSpecialEngine;

	readonly highlights = new ExtendedHighlightRegistry();
	readonly highlightedElements: Set<HTMLElement> = new Set();

	constructor (
		terms: Array<MatchTerm>,
		hues: TermHues,
		updateTermStatus: UpdateTermStatus,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.requestRefreshIndicators = requestCallFn(() => (
			this.termMarkers.insert(terms, termTokens, hues, Array.from(this.highlightedElements))
		), 200, 2000);
		this.requestRefreshTermControls = requestCallFn(() => (
			terms.forEach(term => updateTermStatus(term))
		), 50, 500);
		this.flowMonitor = new StandardFlowMonitor<Flow>(
			terms,
			termPatterns,
			() => ({ flows: [] }),
			() => this.countMatches(),
			undefined,
			element => {
				this.highlightedElements.add(element as unknown as HTMLElement);
				for (const flow of element[CACHE].flows) {
					for (const boxInfo of flow.boxesInfo) {
						this.highlights.get(this.termTokens.get(boxInfo.term))?.add(new StaticRange({
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
						this.highlights.get(this.termTokens.get(boxInfo.term))?.deleteByBoxInfo(boxInfo);
					}
				}
			},
		);
		this.mutationUpdates = getMutationUpdates(this.flowMonitor.mutationObserver);
		this.specialHighlighter = new PaintSpecialEngine(this.termTokens, this.termPatterns);
	}

	readonly getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: (terms: Array<MatchTerm>, hues: Array<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const cycle = Math.floor(termIndex / hues.length);
			return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${getName(this.termTokens.get(term))}) {
	background-color: hsl(${hue} 70% 70% / 0.7);
	color: black;
	/* text-decoration to indicate cycle */
}`
			);
		},
	};

	readonly getTermBackgroundStyle = TermCSS.getFlatStyle;

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
		this.undoHighlights(termsToPurge);
		// MAIN
		terms.forEach(term => this.highlights.set(this.termTokens.get(term), new ExtendedHighlight()));
		this.flowMonitor.generateBoxesInfo(terms, this.termPatterns, document.body);
		this.mutationUpdates.observe();
		this.specialHighlighter.startHighlighting(terms, hues);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.undoHighlights();
		this.specialHighlighter.endHighlighting();
		this.termWalker.cleanup();
	}

	undoHighlights (terms?: Array<MatchTerm>) {
		this.flowMonitor.removeBoxesInfo(terms);
		if (terms) {
			terms.forEach(term => this.highlights.delete(this.termTokens.get(term)));
		} else {
			this.highlights.clear();
		}
	}

	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		const focus = this.termWalker.step(reverse, stepNotJump, term, this.termTokens);
		if (focus) {
			this.termMarkers.raise(term, this.termTokens, getContainerBlock(focus));
		}
		return focus;
	}
}

export {
	type Flow, type BoxInfo,
	HighlightEngine,
};
