import type { HighlighterCounterInterface, HighlighterWalkerInterface } from "/dist/modules/highlight/model.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/term-counter.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/term-walker.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/term-marker.mjs";
import type { AbstractTreeEditEngine } from "/dist/modules/highlight/models/tree-edit.mjs";
import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import type { Engine, PaintEngineMethod } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import type { UpdateTermStatus } from "/dist/content.mjs";
import { compatibility } from "/dist/modules/common.mjs";

interface AbstractEngineManager extends Highlighter, HighlighterCounterInterface, HighlighterWalkerInterface {
	setEngine: (preference: Engine) => Promise<void>

	applyEngine: () => void

	removeEngine: () => void

	signalPaintEngineMethod: (preference: PaintEngineMethod) => void

	applyPaintEngineMethod: (preference: PaintEngineMethod) => Promise<void>

	setSpecialEngine: () => Promise<void>

	removeSpecialEngine: () => void
}

type EngineData = Readonly<{
	engine: AbstractTreeEditEngine | AbstractTreeCacheEngine
	termCounter?: AbstractTermCounter
	termWalker?: AbstractTermWalker
	termMarker?: AbstractTermMarker
}>

class EngineManager implements AbstractEngineManager {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #updateTermStatus: UpdateTermStatus;

	#highlighting: {
		terms: ReadonlyArray<MatchTerm>
		hues: ReadonlyArray<number>
	} | null = null;

	#engineData: EngineData | null = null;
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
			this.#engineData?.engine.getCSS.misc() ?? ""
		),
		termHighlights: (): string => (
			this.#engineData?.engine.getCSS.termHighlights() ?? ""
		),
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number): string => (
			this.#engineData?.engine.getCSS.termHighlight(terms, hues, termIndex) ?? ""
		),
	};

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number): string {
		return this.#engineData?.engine.getTermBackgroundStyle(colorA, colorB, cycle) ?? "";
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.#highlighting = { terms, hues };
		this.#engineData?.engine.startHighlighting(terms, termsToHighlight, termsToPurge, hues);
		this.#specialEngine?.startHighlighting(terms, hues);
	}

	endHighlighting () {
		this.#highlighting = null;
		if (this.#engineData) {
			const engineData = this.#engineData;
			engineData.engine.endHighlighting();
			engineData.termWalker?.cleanup();
		}
		this.#specialEngine?.endHighlighting();
	}

	readonly termCounter = {
		countBetter: (term: MatchTerm): number => (
			this.#engineData?.termCounter?.countBetter(term) ?? 0
		),
		countFaster: (term: MatchTerm): number => (
			this.#engineData?.termCounter?.countFaster(term) ?? 0
		),
		exists: (term: MatchTerm): boolean => (
			this.#engineData?.termCounter?.exists(term) ?? false
		),
	};
	
	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		const focus = this.#engineData?.termWalker?.step(reverse, stepNotJump, term);
		if (focus) {
			this.#engineData?.termMarker?.raise(term, getContainerBlock(focus));
		}
		return focus ?? null;
	}

	async setEngine (preference: Engine) {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engineData) {
			this.#engineData.engine.endHighlighting();
		}
		this.#engineData = await this.constructAndLinkEngineData(compatibility.highlighting.engineToUse(preference));
	}

	applyEngine () {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engineData) {
			this.#engineData.engine.startHighlighting(highlighting.terms, highlighting.terms, [], highlighting.hues);
		}
	}

	async constructAndLinkEngineData (engineClass: Engine): Promise<EngineData> {
		const engineData = await this.constructEngineData(engineClass);
		const engine = engineData.engine;
		const terms = engine.terms;
		const hues = engine.hues;
		if (engineData.termMarker) {
			const termMarker = engineData.termMarker;
			switch (engine.model) {
			case "tree-edit": {
				engine.registerHighlightingUpdatedListener(requestCallFn(
					() => {
						// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
						const termsAllowed = terms.current.slice(0, hues.current.length);
						termMarker.insert(termsAllowed, hues.current, engine.getHighlightedElementsForTerms(termsAllowed));
					},
					50, 500,
				));
				break;
			} case "tree-cache": {
				engine.registerHighlightingUpdatedListener(requestCallFn(
					() => {
						// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
						const termsAllowed = terms.current.slice(0, hues.current.length);
						termMarker.insert(termsAllowed, hues.current, engine.getHighlightedElements());
					},
					200, 2000,
				));
				break;
			}}
		}
		engine.registerHighlightingUpdatedListener(requestCallFn(
			() => {
				for (const term of terms.current) {
					this.#updateTermStatus(term);
				}
			},
			50, 500,
		));
		return engineData;
	}

	async constructEngineData (engineClass: Engine): Promise<EngineData> {
		switch (engineClass) {
		case "ELEMENT": {
			const [ EngineF, TermCounterF, TermWalkerF, TermMarkerF ] = await Promise.all([
				import("/dist/modules/highlight/engines/element.mjs"),
				import("/dist/modules/highlight/models/tree-edit/term-counters/term-counter.mjs"),
				import("/dist/modules/highlight/models/tree-edit/term-walkers/term-walker.mjs"),
				import("/dist/modules/highlight/models/tree-edit/term-markers/term-marker.mjs"),
			]);
			return {
				engine: new EngineF.ElementEngine(this.#termTokens, this.#termPatterns),
				termCounter: new TermCounterF.TermCounter(this.#termTokens),
				termWalker: new TermWalkerF.TermWalker(this.#termTokens),
				termMarker: new TermMarkerF.TermMarker(this.#termTokens),
			};
		} case "PAINT": {
			const [ EngineF, Method, TermCounterF, TermWalkerF, TermMarkerF ] = await Promise.all([
				import("/dist/modules/highlight/engines/paint.mjs"),
				this.constructPaintEngineMethod(this.#paintEngineMethodClass),
				import("/dist/modules/highlight/models/tree-cache/term-counters/term-counter.mjs"),
				import("/dist/modules/highlight/models/tree-cache/term-walkers/term-walker.mjs"),
				import("/dist/modules/highlight/models/tree-cache/term-markers/term-marker.mjs"),
			]);
			return {
				engine: new EngineF.PaintEngine(Method, this.#termTokens, this.#termPatterns),
				termCounter: new TermCounterF.TermCounter(),
				termWalker: new TermWalkerF.TermWalker(),
				termMarker: new TermMarkerF.TermMarker(this.#termTokens),
			};
		} case "HIGHLIGHT": {
			const [ EngineF, TermCounterF, TermWalkerF, TermMarkerF ] = await Promise.all([
				import("/dist/modules/highlight/engines/highlight.mjs"),
				import("/dist/modules/highlight/models/tree-cache/term-counters/term-counter.mjs"),
				import("/dist/modules/highlight/models/tree-cache/term-walkers/term-walker.mjs"),
				import("/dist/modules/highlight/models/tree-cache/term-markers/term-marker.mjs"),
			]);
			return {
				engine: new EngineF.HighlightEngine(this.#termTokens, this.#termPatterns),
				termCounter: new TermCounterF.TermCounter(),
				termWalker: new TermWalkerF.TermWalker(),
				termMarker: new TermMarkerF.TermMarker(this.#termTokens),
			};
		}}
	}

	removeEngine () {
		if (this.#highlighting && this.#engineData) {
			this.#engineData.engine.endHighlighting();
		}
		this.#engineData = null;
	}

	signalPaintEngineMethod (preference: PaintEngineMethod) {
		this.#paintEngineMethodClass = compatibility.highlighting.paintEngineMethodToUse(preference);
	}

	async applyPaintEngineMethod (preference: PaintEngineMethod) {
		this.#paintEngineMethodClass = compatibility.highlighting.paintEngineMethodToUse(preference);
		if (this.#engineData?.engine.class === "PAINT") {
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
