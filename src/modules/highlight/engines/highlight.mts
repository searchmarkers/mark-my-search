/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.d.mjs";
import type { AbstractFlowTracker, Flow, Span } from "/dist/modules/highlight/models/tree-cache/flow-tracker.d.mjs";
import { FlowTracker } from "/dist/modules/highlight/models/tree-cache/flow-tracker.mjs";
import TermCSS from "/dist/modules/highlight/common/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, EleClass, createContainer, type AllReadonly } from "/dist/modules/common.mjs";

type HighlightStyle = Readonly<{
	opacity: number
	lineThickness: number
	lineStyle: "dotted" | "dashed" | "solid" | "double" | "wavy"
	textColor?: string
}>

class HighlightEngine implements AbstractTreeCacheEngine {
	readonly class = "HIGHLIGHT";
	readonly model = "tree-cache";

	readonly #termTokens: TermTokens;

	readonly #flowTracker: AbstractFlowTracker;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	readonly #highlights = new ExtendedHighlightRegistry();

	readonly #termStyleManagerMap = new Map<MatchTerm, StyleManager<Record<never, never>>>();

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
		this.#termTokens = termTokens;
		this.#flowTracker = new FlowTracker(this.terms, termPatterns);
		this.#flowTracker.setSpansCreatedListener((flowOwner, spansCreated) => {
			for (const span of spansCreated) {
				this.#highlights.get(this.#termTokens.get(span.term))?.add(new StaticRange({
					startContainer: span.node,
					startOffset: span.start,
					endContainer: span.node,
					endOffset: span.end,
				}), span);
			}
		});
		this.#flowTracker.setSpansRemovedListener((flowOwner, spansRemoved) => {
			for (const span of spansRemoved) {
				this.#highlights.get(this.#termTokens.get(span.term))?.deleteBySpan(span);
			}
		});
		this.#elementFlowsMap = this.#flowTracker.getElementFlowsMap();
	}

	deactivate () {
		this.endHighlighting();
	}

	readonly getTermBackgroundStyle = TermCSS.getFlatStyle;

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		// Clean up.
		this.#flowTracker.unobserveMutations();
		this.undoHighlights(termsToPurge);
		this.removeTermStyles();
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		this.addTermStyles(terms, hues);
		for (const term of terms) {
			this.#highlights.set(this.#termTokens.get(term), new ExtendedHighlight());
		}
		this.#flowTracker.generateHighlightSpansFor(terms, document.body);
		this.#flowTracker.observeMutations();
	}

	endHighlighting () {
		this.#flowTracker.unobserveMutations();
		this.undoHighlights();
		this.removeTermStyles();
	}

	undoHighlights (terms?: ReadonlyArray<MatchTerm>) {
		this.#flowTracker.removeHighlightSpansFor(terms);
		if (terms) {
			for (const term of terms) {
				this.#highlights.delete(this.#termTokens.get(term));
			}
		} else {
			this.#highlights.clear();
		}
	}

	addTermStyles (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		for (let i = 0; i < terms.length; i++) {
			const styleManager = new StyleManager(new HTMLStylesheet(document.head));
			styleManager.setStyle(this.getTermCSS(terms, hues, i));
			this.#termStyleManagerMap.set(terms[i], styleManager);
		}
	}

	removeTermStyles () {
		for (const styleManager of this.#termStyleManagerMap.values()) {
			styleManager.deactivate();
		}
		this.#termStyleManagerMap.clear();
	}

	getTermCSS (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number) {
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
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${getName(this.#termTokens.get(term))}) {
	background-color: hsl(${hue} 70% 70% / ${opacity}) !important;
	${textColor ? `color: ${textColor} !important;` : ""}
	${lineThickness ? `text-decoration: ${lineThickness}px hsl(${hue} 100% 35%) ${lineStyle} underline !important;` : ""}
	${lineThickness ? `text-decoration-skip-ink: none !important;` : ""}
}
`
		);
	}

	getElementFlowsMap (): AllReadonly<Map<HTMLElement, Array<Flow>>> {
		return this.#elementFlowsMap;
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.#elementFlowsMap.keys();
	}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#flowTracker.addHighlightingUpdatedListener(listener);
	}
}

class ExtendedHighlightRegistry {
	readonly registry = CSS.highlights;
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

const getName = (termToken: string) => "markmysearch-" + termToken;

export {
	type Flow, type Span,
	HighlightEngine,
};
