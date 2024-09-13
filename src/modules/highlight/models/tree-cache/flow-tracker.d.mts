/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { FlowMutationObserver } from "/dist/modules/highlight/common/flow-mutations.d.mjs";
import type { BaseFlow, BaseSpan } from "/dist/modules/highlight/common/matching.d.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true>

type Span = BaseSpan<true>

/**
 * Interface for the core utility of the tree-cache highlighting engines.
 * 
 * Implementers are responsible for:
 * 
 * - determining "flows"* of text and matching within them, producing highlighting "spans"*;
 * - maintaining an element-flows map* containing this information;
 * - firing the appropriate registered listeners when highlighting changes;
 * - responding to document mutations to ensure that highlighting is always up-to-date.
 * 
 * Footnotes:
 * - *{@link getElementFlowsMap}
 */
interface AbstractFlowTracker extends FlowMutationObserver {
	/**
	 * @returns
	 * The element-flows map used by the FlowTracker to hold highlighting information,
	 * updated as the document changes or when one of the highlighting methods is called.
	 * 
	 * Notes:
	 * - A *flow* represents a segment of text which may cross multiple element boundaries.
	 * - Each element is a *flow owner*, although the map will never contain *all* flow owners.
	 * - Each flow contains highlighting *spans* (ranges within the text, where every range matches one term).
	 * - Every element with at least one flow containing spans is a *span owner*.
	 */
	readonly getElementFlowsMap: () => AllReadonly<Map<HTMLElement, Array<Flow>>>

	/**
	 * Sets the listener for gain of highlight spans in an unhighlighted element.
	 * 
	 * Implementation notes:
	 * - There is **no guarantee** of the order in which listeners are called.
	 */
	readonly setNewSpanOwnerListener: (
		listener: (
			/** The new owner of text flows which together contain 1+ highlight spans. */
			flowOwner: HTMLElement,
		) => void,
	) => void

	/**
	 * Sets the listener for gain of 1+ highlight spans in an element.
	 * 
	 * Implementation notes:
	 * - There is **no guarantee** that the spans-created argument contains only new spans.
	 * - There is **no guarantee** of the order in which listeners are called,
	 * *except that* for a given flow-owner, spans-created is always called after spans-removed
	 * (although either one may be called alone).
	 */
	readonly setSpansCreatedListener: (
		listener: (
			/** The owner of text flows which together contain 1+ new highlight spans (and any already present). */
			flowOwner: HTMLElement,
			/** Spans created in text flows of the element. */
			spansCreated: AllReadonly<Array<Span>>,
		) => void,
	) => void

	/**
	 * Sets the listener for loss of 1+ highlight spans in an element.
	 * 
	 * Implementation notes:
	 * - Spans in the spans-removed argument may be passed as spans-created immediately afterwards.
	 * - There is **no guarantee** of the order in which listeners are called,
	 * *except that* for a given flow-owner, spans-created is always called after spans-removed
	 * (although either one may be called alone).
	 */
	readonly setSpansRemovedListener: (
		listener: (
			/** The owner of text flows which together contain some number of highlight spans. */
			flowOwner: HTMLElement,
			/** Spans removed from text flows of the element. */
			spansRemoved: AllReadonly<Array<Span>>,
		) => void,
	) => void

	/**
	 * Sets the listener for loss of all highlight spans in an element.
	 * 
	 * Implementation notes:
	 * - There is **no guarantee** of the order in which listeners are called.
	 */
	readonly setNonSpanOwnerListener: (
		listener: (
			/** The owner of text flows which together used to contain highlight spans. */
			flowOwner: HTMLElement,
		) => void,
	) => void

	/**
	 * Adds a listener for changes in highlighting.
	 */
	readonly addHighlightingUpdatedListener: (listener: () => void) => void

	/**
	 * Generates highlighting information for all text flows below the given element.
	 * @param terms The terms to highlight. Highlighting is removed for all terms not included.
	 */
	readonly generateHighlightSpansFor: (terms: ReadonlyArray<MatchTerm>) => void

	/**
	 * Removes highlighting information in all text flows.
	 */
	readonly removeHighlightSpans: () => void

	/**
	 * Removes highlighting information for specific terms in all text flows.
	 * @param terms The terms for which to remove highlighting.
	 */
	readonly removeHighlightSpansFor: (terms: ReadonlyArray<MatchTerm>) => void
}

export type {
	Flow, Span,
	AbstractFlowTracker,
};
