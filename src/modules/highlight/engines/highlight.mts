import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.mjs";
import type { AbstractFlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { FlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/flow-monitor.mjs";
import type { BaseFlow, BaseSpan } from "/dist/modules/highlight/matcher.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID, EleClass, createContainer, type AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true>

type Span = BaseSpan<true>

const getName = (termToken: string) => "markmysearch-" + termToken;

class ExtendedHighlight {
	readonly highlight: Highlight;
	readonly spanRangeMap = new Map<Span, AbstractRange>();

	constructor (...initialRanges: Array<AbstractRange>) {
		this.highlight = new Highlight(...initialRanges);
	}

	add (value: AbstractRange, span: Span) {
		this.spanRangeMap.set(span, value);
		return this.highlight.add(value);
	}

	has (value: AbstractRange) {
		return this.highlight.has(value);
	}

	delete (value: AbstractRange) {
		const result = Array.from(this.spanRangeMap.entries()).find(({ 1: range }) => range === value);
		if (!result) {
			return this.highlight.delete(value);
		}
		return this.spanRangeMap.delete(result[0]);
	}

	getBySpan (span: Span) {
		return this.spanRangeMap.get(span);
	}

	deleteBySpan (span: Span) {
		const range = this.spanRangeMap.get(span);
		if (!range) {
			return false;
		}
		this.spanRangeMap.delete(span);
		return this.highlight.delete(range);
	}

	hasBySpan (span: Span) {
		return this.spanRangeMap.has(span);
	}
}

class ExtendedHighlightRegistry {
	readonly registry = CSS.highlights!;
	readonly map = new Map<string, ExtendedHighlight>();

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

interface HighlightStyle {
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

	readonly elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	readonly highlights = new ExtendedHighlightRegistry();

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
		this.flowMonitor = new FlowMonitor(this.terms, termPatterns);
		this.flowMonitor.setSpansCreatedListener((flowOwner, spansCreated) => {
			for (const span of spansCreated) {
				this.highlights.get(this.termTokens.get(span.term))?.add(new StaticRange({
					startContainer: span.node,
					startOffset: span.start,
					endContainer: span.node,
					endOffset: span.end,
				}), span);
			}
		});
		this.flowMonitor.setSpansRemovedListener((flowOwner, spansRemoved) => {
			for (const span of spansRemoved) {
				this.highlights.get(this.termTokens.get(span.term))?.deleteBySpan(span);
			}
		});
		this.elementFlowsMap = this.flowMonitor.getElementFlowsMap();
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
		this.flowMonitor.unobserveMutations();
		this.undoHighlights(termsToPurge);
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		for (const term of terms) {
			this.highlights.set(this.termTokens.get(term), new ExtendedHighlight());
		}
		this.flowMonitor.generateHighlightSpansFor(terms, document.body);
		this.flowMonitor.observeMutations();
	}

	endHighlighting () {
		this.flowMonitor.unobserveMutations();
		this.undoHighlights();
	}

	undoHighlights (terms?: ReadonlyArray<MatchTerm>) {
		this.flowMonitor.removeHighlightSpansFor(terms);
		if (terms) {
			for (const term of terms) {
				this.highlights.delete(this.termTokens.get(term));
			}
		} else {
			this.highlights.clear();
		}
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.elementFlowsMap.keys();
	}

	readonly highlightingUpdatedListeners = new Set<Generator>();

	addHighlightingUpdatedListener (listener: Generator) {
		this.highlightingUpdatedListeners.add(listener);
	}
}

export {
	type Flow, type Span,
	HighlightEngine,
};
