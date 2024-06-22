import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.mjs";
import type { TreeCache, CachingHTMLElement } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import { CACHE } from "/dist/modules/highlight/models/tree-cache/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { FlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/flow-monitor.mjs";
import type { BaseFlow, BaseBoxInfo } from "/dist/modules/highlight/matcher.mjs";
import { getMutationUpdates } from "/dist/modules/highlight/page-updates.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID, EleClass, createContainer } from "/dist/modules/common.mjs";

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

type HighlightStyle = {
	opacity: number
	lineThickness: number
	lineStyle: "dotted" | "dashed" | "solid" | "double" | "wavy"
	textColor?: string
}

class HighlightEngine implements AbstractTreeCacheEngine {
	readonly class = "HIGHLIGHT";
	readonly model = "tree-cache";

	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly flowMonitor: AbstractFlowMonitor;

	readonly mutationUpdates: ReturnType<typeof getMutationUpdates>;

	readonly highlights = new ExtendedHighlightRegistry();
	readonly highlightedElements: Set<CachingHTMLElement<Flow>> = new Set();

	readonly terms = createContainer<ReadonlyArray<MatchTerm>>([]);
	readonly hues = createContainer<ReadonlyArray<number>>([]);
	
	static readonly hueCycleStyles: Array<HighlightStyle> = [
		{ opacity: 0.7, lineThickness: 0, lineStyle: "solid", textColor: "black" },
		{ opacity: 0.4, lineThickness: 2, lineStyle: "dotted" },
		{ opacity: 0.4 ,lineThickness: 2, lineStyle: "dashed" },
		{ opacity: 0.4, lineThickness: 2, lineStyle: "solid" },
		{ opacity: 0.2, lineThickness: 3, lineStyle: "dotted" },
		{ opacity: 0.2,lineThickness: 3, lineStyle: "dashed" },
		{ opacity: 0.2, lineThickness: 3, lineStyle: "solid" },
		{ opacity: 0.5, lineThickness: 1, lineStyle: "wavy" },
	];

	constructor (
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.flowMonitor = new FlowMonitor<Flow, TreeCache<Flow>>(
			this.terms,
			termPatterns,
			this.highlightingUpdatedListeners,
			{
				createElementCache: () => ({ flows: [] }),
				onBoxesInfoPopulated: element => {
					this.highlightedElements.add(element);
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
				onBoxesInfoRemoved: element => {
					this.highlightedElements.delete(element);
					for (const flow of element[CACHE].flows) {
						for (const boxInfo of flow.boxesInfo) {
							this.highlights.get(this.termTokens.get(boxInfo.term))?.deleteByBoxInfo(boxInfo);
						}
					}
				},
			},
		);
		this.mutationUpdates = getMutationUpdates(this.flowMonitor.mutationObserver);
	}

	readonly getCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			const {
				opacity,
				lineThickness,
				lineStyle,
				textColor,
			} = HighlightEngine.hueCycleStyles[Math.min(cycle, HighlightEngine.hueCycleStyles.length - 1)];
			return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${getName(this.termTokens.get(term))}) {
	background-color: hsl(${hue} 70% 70% / ${opacity});
	${textColor ? `color: ${textColor};` : ""}
	${lineThickness ? `text-decoration: ${lineThickness}px hsl(${hue} 100% 35%) ${lineStyle} underline;` : ""}
	${lineThickness ? `text-decoration-skip-ink: none;` : ""}
}`
			);
		},
	};

	readonly getTermBackgroundStyle = TermCSS.getFlatStyle;

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.undoHighlights(termsToPurge);
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		for (const term of terms) {
			this.highlights.set(this.termTokens.get(term), new ExtendedHighlight());
		}
		this.flowMonitor.generateBoxesInfo(terms, this.termPatterns, document.body);
		this.mutationUpdates.observe();
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.undoHighlights();
	}

	undoHighlights (terms?: ReadonlyArray<MatchTerm>) {
		this.flowMonitor.removeBoxesInfo(terms);
		if (terms) {
			for (const term of terms) {
				this.highlights.delete(this.termTokens.get(term));
			}
		} else {
			this.highlights.clear();
		}
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.highlightedElements;
	}

	readonly highlightingUpdatedListeners = new Set<Generator>();

	registerHighlightingUpdatedListener (listener: Generator) {
		this.highlightingUpdatedListeners.add(listener);
	}
}

export {
	type Flow, type BoxInfo,
	HighlightEngine,
};
