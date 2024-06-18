import type {
	AbstractEngine,
	HighlighterCSSInterface, HighlightingInterface, HighlighterCounterInterface, HighlighterWalkerInterface,
} from "/dist/modules/highlight/engine.mjs";
import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import type { Engine, PaintEngineMethod } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { compatibility } from "/dist/modules/common.mjs";

interface AbstractEngineManager
extends HighlighterCSSInterface, HighlightingInterface, HighlighterCounterInterface, HighlighterWalkerInterface {
	setEngine: (preference: Engine) => Promise<void>

	applyEngine: () => void

	removeEngine: () => void

	signalPaintEngineMethod: (preference: PaintEngineMethod) => void

	applyPaintEngineMethod: (preference: PaintEngineMethod) => Promise<void>

	setSpecialEngine: () => Promise<void>

	removeSpecialEngine: () => void
}

class EngineManager implements AbstractEngineManager {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #updateTermStatus: UpdateTermStatus;

	#highlighting: {
		terms: ReadonlyArray<MatchTerm>
		hues: ReadonlyArray<number>
	} | null = null;

	#engine: AbstractEngine | null = null;
	#paintEngineMethodClass: PaintEngineMethod = "paint";
	#specialEngine: AbstractSpecialEngine | null = null;

	constructor (
		updateTermStatus: UpdateTermStatus,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
		this.#updateTermStatus = updateTermStatus;
	}

	readonly getCSS = {
		misc: (): string => (
			this.#engine?.getCSS.misc() ?? ""
		),
		termHighlights: (): string => (
			this.#engine?.getCSS.termHighlights() ?? ""
		),
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number): string => (
			this.#engine?.getCSS.termHighlight(terms, hues, termIndex) ?? ""
		),
	};

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number): string {
		return this.#engine?.getTermBackgroundStyle(colorA, colorB, cycle) ?? "";
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.#highlighting = { terms, hues };
		this.#engine?.startHighlighting(terms, termsToHighlight, termsToPurge, hues);
		this.#specialEngine?.startHighlighting(terms, hues);
	}

	undoHighlights (terms?: readonly MatchTerm[] | undefined) {
		this.#engine?.undoHighlights(terms);
	}

	endHighlighting () {
		this.#highlighting = null;
		this.#engine?.endHighlighting();
		this.#specialEngine?.endHighlighting();
	}

	countMatches () {
		this.#engine?.countMatches();
	}

	readonly termOccurrences = {
		countBetter: (term: MatchTerm, termTokens: TermTokens): number => (
			this.#engine?.termOccurrences.countBetter(term, termTokens) ?? 0
		),
		countFaster: (term: MatchTerm, termTokens: TermTokens): number => (
			this.#engine?.termOccurrences.countFaster(term, termTokens) ?? 0
		),
		exists: (term: MatchTerm, termTokens: TermTokens): boolean => (
			this.#engine?.termOccurrences.exists(term, termTokens) ?? false
		),
	};
	
	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		return this.#engine?.stepToNextOccurrence(reverse, stepNotJump, term) ?? null;
	}

	async setEngine (preference: Engine) {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engine) {
			this.#engine.endHighlighting();
		}
		this.#engine = await this.constructEngine(compatibility.highlighting.engineToUse(preference));
	}

	applyEngine () {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engine) {
			this.#engine.startHighlighting(highlighting.terms, highlighting.terms, [], highlighting.hues);
		}
	}
	
	async constructEngine (engineClass: Engine): Promise<AbstractEngine> {
		switch (engineClass) {
		case "ELEMENT": {
			return new (await import("/dist/modules/highlight/engines/element.mjs")).ElementEngine(
				this.#updateTermStatus, this.#termTokens, this.#termPatterns,
			);
		} case "PAINT": {
			return new (await import("/dist/modules/highlight/engines/paint.mjs")).PaintEngine(
				await this.constructPaintEngineMethod(this.#paintEngineMethodClass),
				this.#updateTermStatus, this.#termTokens, this.#termPatterns,
			);
		} case "HIGHLIGHT": {
			return new (await import("/dist/modules/highlight/engines/highlight.mjs")).HighlightEngine(
				this.#updateTermStatus, this.#termTokens, this.#termPatterns,
			);
		}}
	}

	removeEngine () {
		if (this.#highlighting && this.#engine) {
			this.#engine.endHighlighting();
		}
		this.#engine = null;
	}

	signalPaintEngineMethod (preference: PaintEngineMethod) {
		this.#paintEngineMethodClass = compatibility.highlighting.paintEngineMethodToUse(preference);
	}

	async applyPaintEngineMethod (preference: PaintEngineMethod) {
		this.#paintEngineMethodClass = compatibility.highlighting.paintEngineMethodToUse(preference);
		if (this.#engine?.class === "PAINT") {
			await this.setEngine("PAINT");
		}
	}

	async constructPaintEngineMethod (methodClass: PaintEngineMethod): Promise<AbstractMethod> {
		switch (methodClass) {
		case "paint": {
			return new (await import("/dist/modules/highlight/engines/paint/methods/paint.mjs")).PaintMethod(
				this.#termTokens,
			);
		} case "url": {
			return new (await import("/dist/modules/highlight/engines/paint/methods/url.mjs")).UrlMethod(
				this.#termTokens,
			);
		} case "element": {
			return new (await import("/dist/modules/highlight/engines/paint/methods/element.mjs")).ElementMethod(
				this.#termTokens,
			);
		}}
	}

	async setSpecialEngine () {
		const highlighting = this.#highlighting;
		if (highlighting && this.#specialEngine) {
			this.#specialEngine.endHighlighting();
		}
		this.#specialEngine = await this.constructSpecialEngine();
		if (highlighting) {
			this.#specialEngine.startHighlighting(highlighting.terms, highlighting.hues);
		}
	}

	async constructSpecialEngine (): Promise<AbstractSpecialEngine> {
		return new (await import("/dist/modules/highlight/special-engines/paint.mjs")).PaintSpecialEngine(
			this.#termTokens, this.#termPatterns
		);
	}

	removeSpecialEngine () {
		if (this.#highlighting && this.#specialEngine) {
			this.#specialEngine.endHighlighting();
		}
		this.#specialEngine = null;
	}
}

export type { AbstractEngineManager };

export { EngineManager };
