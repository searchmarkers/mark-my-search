import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { Engine, RContainer } from "/dist/modules/common.mjs";

type Model = "tree-edit" | "tree-cache"

interface AbstractEngine extends Highlighter {
	readonly class: Engine
	readonly model: Model

	readonly terms: RContainer<ReadonlyArray<MatchTerm>>;
	readonly hues: RContainer<ReadonlyArray<number>>;

	readonly addHighlightingUpdatedListener: (listener: Generator) => void

	readonly getHighlightedElements: () => Iterable<HTMLElement>
}

interface Highlighter extends HighlighterCSSInterface, HighlightingInterface {}

interface HighlighterCSSInterface {
	readonly getCSS: EngineCSS

	readonly getTermBackgroundStyle: (colorA: string, colorB: string, cycle: number) => string
}

interface EngineCSS {
	readonly misc: () => string
	readonly termHighlights: () => string
	readonly termHighlight: (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		termIndex: number,
	) => string
}

interface HighlightingInterface {
	/**
	 * Removes previous highlighting, then highlights the document using the terms supplied.
	 * Disables then restarts continuous highlighting.
	 * @param terms Terms to be continuously found and highlighted within the DOM.
	 * @param termsToPurge Terms for which to remove previous highlights.
	 */
	readonly startHighlighting: (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => void

	readonly endHighlighting: () => void
}

export type {
	AbstractEngine,
	Highlighter,
	HighlighterCSSInterface, EngineCSS,
	HighlightingInterface,
};
