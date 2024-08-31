import type { FlowMutationObserver } from "/dist/modules/highlight/flow-mutation-observer.mjs";
import type { BaseFlow, BaseSpan } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";

type Flow = BaseFlow<true>

type Span = BaseSpan<true>

/**
 * Interface for the core utility of the tree-cache highlighting engines.
 * 
 * Implementers are responsible for:
 * 
 * - determining "flows" of text and matching within them, producing highlighting "boxes" information;
 * - maintaining a cache of [TODO]
 */
interface AbstractFlowTracker extends FlowMutationObserver {
	readonly getElementFlowsMap: () => AllReadonly<Map<HTMLElement, Array<Flow>>>

	/** Sets the listener for gain of highlight spans in an unhighlighted element. */
	readonly setNewSpanOwnerListener: (
		listener: (
			/** The new owner of text flows which together contain 1+ highlight spans. */
			flowOwner: HTMLElement,
		) => void,
	) => void

	/** Sets the listener for gain of 1+ highlight spans in an element. */
	readonly setSpansCreatedListener: (
		listener: (
			/** The owner of text flows which together contain 1+ new highlight spans (and any already present). */
			flowOwner: HTMLElement,
			/** Spans created in text flows of the element. */
			spansCreated: AllReadonly<Array<Span>>,
		) => void,
	) => void

	/** Sets the listener for loss of 1+ highlight spans in an element. */
	readonly setSpansRemovedListener: (
		listener: (
			/** The owner of text flows which together contain some number of highlight spans. */
			flowOwner: HTMLElement,
			/** Spans removed from text flows of the element. */
			spansRemoved: AllReadonly<Array<Span>>,
		) => void,
	) => void

	/** Sets the listener for loss of all highlight spans in an element. */
	readonly setNonSpanOwnerListener: (
		listener: (
			/** The owner of text flows which together used to contain highlight spans. */
			flowOwner: HTMLElement,
		) => void,
	) => void

	/** Adds a listener for changes in highlighting. */
	readonly addHighlightingUpdatedListener: (listener: Generator) => void

	/**
	 * Generates highlighting information for all text flows below the given element.
	 * @param terms The terms to highlight. Highlighting is removed for all terms not included.
	 * @param root The highest element below which to generate highlight spans for flows.
	 * This is assumed to be a flow-breaking element; an element at whose boundaries text flows start and end.
	 * Otherwise the function would need to look above the element, since the boundary flows would extend outside.
	 */
	readonly generateHighlightSpansFor: (
		terms: ReadonlyArray<MatchTerm>,
		root: HTMLElement,
	) => void

	/**
	 * Removes highlighting information for all text flows below the given element.
	 * @param terms The terms for which to remove highlighting. If undefined, all highlighting information is removed.
	 * @param root The element below which to remove flow highlighting.
	 */
	readonly removeHighlightSpansFor: (
		terms?: ReadonlyArray<MatchTerm>,
		root?: HTMLElement,
	) => void
}

export type {
	Flow, Span,
	AbstractFlowTracker,
};
