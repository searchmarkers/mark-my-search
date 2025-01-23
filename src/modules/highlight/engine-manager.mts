/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractEngineManager } from "/dist/modules/highlight/engine-manager.d.mjs";
import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.d.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/tools/term-counter.d.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/tools/term-walker.d.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/tools/term-marker.d.mjs";
import type { AbstractTreeEditEngine } from "/dist/modules/highlight/models/tree-edit.mjs";
import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.d.mjs";
import { getContainerBlock } from "/dist/modules/highlight/common/container-blocks.mjs";
import type { Engine, PaintEngineMethod } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import { compatibility } from "/dist/modules/common.mjs";

type EngineData = Readonly<{
	engine: AbstractTreeEditEngine | AbstractTreeCacheEngine
	termCounter?: AbstractTermCounter
	termWalker?: AbstractTermWalker
	termMarker?: AbstractTermMarker
}>

class EngineManager implements AbstractEngineManager {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #highlightingUpdatedListeners = new Set<() => void>();

	#highlighting: {
		terms: ReadonlyArray<MatchTerm>
		hues: ReadonlyArray<number>
	} | null = null;

	#engineData: EngineData | null = null;
	#paintEngineMethodClass: PaintEngineMethod = "paint";
	#specialEngine: AbstractSpecialEngine | null = null;

	constructor (
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
	}

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number): string {
		return this.#engineData?.engine.getTermBackgroundStyle(colorA, colorB, cycle) ?? "";
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.#highlighting = { terms, hues };
		this.#engineData?.engine.startHighlighting(terms, hues);
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
		this.deactivateEngine();
		this.#engineData = await this.constructAndLinkEngineData(compatibility.highlighting.engineToUse(preference));
	}

	applyEngine () {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engineData) {
			this.#engineData.engine.startHighlighting(highlighting.terms, highlighting.hues);
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
				engine.addHighlightingUpdatedListener(requestCallFn(
					() => {
						// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
						const termsAllowed = terms.current.slice(0, hues.current.length);
						termMarker.insert(termsAllowed, hues.current, engine.getHighlightedElementsForTerms(termsAllowed));
					},
					50, 500,
				));
				break;
			} case "tree-cache": {
				engine.addHighlightingUpdatedListener(requestCallFn(
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
		engine.addHighlightingUpdatedListener(() => {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		});
		return engineData;
	}

	async constructEngineData (engineClass: Engine): Promise<EngineData> {
		switch (engineClass) {
		case "ELEMENT": {
			const [ { ElementEngine }, { TermCounter }, { TermWalker }, { TermMarker } ] = await Promise.all([
				import("/dist/modules/highlight/engines/element.mjs"),
				import("/dist/modules/highlight/tools/term-counters/tree-edit.mjs"),
				import("/dist/modules/highlight/tools/term-walkers/tree-edit.mjs"),
				import("/dist/modules/highlight/tools/term-markers/tree-edit.mjs"),
			]);
			const engine = new ElementEngine(this.#termTokens, this.#termPatterns);
			return {
				engine,
				termCounter: new TermCounter(this.#termTokens),
				termWalker: new TermWalker(this.#termTokens),
				termMarker: new TermMarker(this.#termTokens),
			};
		} case "PAINT": {
			const [ { PaintEngine }, { TermCounter }, { TermWalker }, { TermMarker } ] = await Promise.all([
				import("/dist/modules/highlight/engines/paint.mjs"),
				import("/dist/modules/highlight/tools/term-counters/tree-cache.mjs"),
				import("/dist/modules/highlight/tools/term-walkers/tree-cache.mjs"),
				import("/dist/modules/highlight/tools/term-markers/tree-cache.mjs"),
			]);
			const engine = new PaintEngine(
				await PaintEngine.getMethodModule(this.#paintEngineMethodClass),
				this.#termTokens, this.#termPatterns,
			);
			return {
				engine,
				termCounter: new TermCounter(engine.getElementFlowsMap()),
				termWalker: new TermWalker(engine.getElementFlowsMap()),
				termMarker: new TermMarker(this.#termTokens, engine.getElementFlowsMap()),
			};
		} case "HIGHLIGHT": {
			const [ { HighlightEngine }, { TermCounter }, { TermWalker }, { TermMarker } ] = await Promise.all([
				import("/dist/modules/highlight/engines/highlight.mjs"),
				import("/dist/modules/highlight/tools/term-counters/tree-cache.mjs"),
				import("/dist/modules/highlight/tools/term-walkers/tree-cache.mjs"),
				import("/dist/modules/highlight/tools/term-markers/tree-cache.mjs"),
			]);
			const engine = new HighlightEngine(this.#termTokens, this.#termPatterns);
			return {
				engine,
				termCounter: new TermCounter(engine.getElementFlowsMap()),
				termWalker: new TermWalker(engine.getElementFlowsMap()),
				termMarker: new TermMarker(this.#termTokens, engine.getElementFlowsMap()),
			};
		}}
	}

	removeEngine () {
		this.deactivateEngine();
		this.#engineData = null;
	}

	deactivateEngine () {
		const engineData = this.#engineData;
		if (!engineData) {
			return;
		}
		engineData.termWalker?.deactivate();
		engineData.termMarker?.deactivate();
		engineData.engine.deactivate();
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

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export type { AbstractEngineManager };

export { EngineManager };
