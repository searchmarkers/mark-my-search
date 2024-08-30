import type { AbstractEngine } from "/dist/modules/highlight/engine.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Model = "tree-edit"

interface AbstractTreeEditEngine extends AbstractEngine {
	readonly model: Model

	readonly getHighlightedElementsForTerms: (terms: ReadonlyArray<MatchTerm>) => Iterable<HTMLElement>
}

export type {
	AbstractTreeEditEngine,
};
