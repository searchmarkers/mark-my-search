/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.d.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import { SvgUrlMethod } from "/dist/modules/highlight/engines/paint/methods/svg-url.mjs";
import { type BaseFlow, type BaseSpan } from "/dist/modules/highlight/common/matching.d.mjs";
import { matchInText } from "/dist/modules/highlight/common/matching.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, EleClass, getElementTagsSet } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

type Span = BaseSpan<false>

const contextCSS = { hovered: ":hover", focused: ":focus" };

type HighlightContext = keyof typeof contextCSS

type StyleRulesInfo = Record<HighlightContext, string>

class PaintSpecialEngine implements AbstractSpecialEngine {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #method: SvgUrlMethod;
	readonly #styleRules: StyleRulesInfo = { hovered: "", focused: "" };

	//readonly #elementsInfo = new Map<HTMLElement, {
	//	properties: Record<string, { get: () => unknown, set: (value: unknown) => unknown }>
	//}>();

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #elementContainer: HTMLElement;

	#terms: ReadonlyArray<MatchTerm> = [];
	#hues: ReadonlyArray<number> = [];

	constructor (termTokens: TermTokens, termPatterns: TermPatterns) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
		this.#method = new SvgUrlMethod(termTokens);
		this.#elementContainer = document.createElement("div");
		document.body.insertAdjacentElement("afterend", this.#elementContainer);
	}

	deactivate () {
		this.endHighlighting();
		this.#styleManager.deactivate();
		this.#elementContainer.remove();
	}

	startHighlighting (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		// Clean up.
		this.endHighlighting();
		// MAIN
		this.#terms = terms;
		this.#hues = hues;
		window.addEventListener("focusin", this.onFocusIn);
		window.addEventListener("pointerover", this.onHover);
		window.addEventListener("input", this.onInput);
	}

	endHighlighting () {
		this.#terms = [];
		window.removeEventListener("focusin", this.onFocusIn);
		window.removeEventListener("pointerover", this.onHover);
		window.removeEventListener("input", this.onInput);
	}

	handledTags: Array<keyof HTMLElementTagNameMap> = [ "input", "textarea" ];
	handledTagSelector = this.handledTags.join(", ");
	handledTagSet = getElementTagsSet(this.handledTags); // Handle <select> elements in future?
	handles = (element: HTMLElement) => this.handledTagSet.has(element.tagName);

	getFlow (terms: ReadonlyArray<MatchTerm>, input: HTMLInputElement) {
		// TODO is this method needed? why not use a common matching function?
		const flow: Flow = {
			text: input.value,
			spans: [],
		};
		for (const term of terms) {
			for (const match of flow.text.matchAll(this.#termPatterns.get(term))) if (match.index !== undefined) {
				flow.spans.push({
					term,
					start: match.index,
					end: match.index + match[0].length,
				});
			}
		}
	}

	onFocusIn = (event: FocusEvent) => {
		//console.log("focus in", event.target, event.relatedTarget);
		if (event.target instanceof HTMLElement) {
			if (this.handles(event.target)) {
				this.highlight("focused", this.#terms, this.#hues);
			}
		} else if (event.relatedTarget instanceof HTMLElement) {
			if (this.handles(event.relatedTarget)) {
				this.unhighlight("focused");
			}
		}
	};

	onHover = (event: PointerEvent) => {
		//console.log("mouse enter", event.target, event.relatedTarget);
		if (event.target instanceof HTMLElement) {
			if (this.handles(event.target)) {
				this.highlight("hovered", this.#terms, this.#hues);
			}
		} else if (event.relatedTarget instanceof HTMLElement) {
			if (this.handles(event.relatedTarget)) {
				this.unhighlight("hovered");
			}
		}
	};

	onInput = (event: Event) => {
		if (!(event.target instanceof HTMLElement) || !this.handles(event.target)) {
			return;
		}
		this.highlight("focused", this.#terms, this.#hues);
	};

	highlight (highlightCtx: HighlightContext, terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const element = document.querySelector(contextCSS[highlightCtx]);
		if (!(element instanceof HTMLInputElement)) {
			return;
		}
		this.styleUpdate({ [highlightCtx]: this.constructHighlightStyleRule(highlightCtx, terms, hues, element.value) });
	}

	unhighlight (highlightCtx: HighlightContext) {
		this.styleUpdate({ [highlightCtx]: "" });
	}

	constructHighlightStyleRule (
		highlightCtx: HighlightContext,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		text: string,
	): string {
		return `#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ body input${
			contextCSS[highlightCtx]
		} { background-image: ${
			this.constructHighlightStyleRuleUrl(terms, hues, text)
		} !important; background-repeat: no-repeat !important; }`;
	}

	constructHighlightStyleRuleUrl (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		text: string,
	): string {
		if (!terms.length) {
			return "url()";
		}
		const boxes = matchInText(terms, this.#termPatterns, text).map((span): Box => {
			return {
				token: this.#termTokens.get(span.term),
				x: span.start * 10,
				y: 0,
				width: (span.end - span.start) * 10,
				height: 20,
			};
		});
		return this.#method.constructHighlightStyleRuleUrl(boxes, terms, hues);
	}

	styleUpdate (styleRules: Partial<StyleRulesInfo>) {
		for (const highlightContext of Object.keys(contextCSS) as Array<HighlightContext>) {
			const rule = styleRules[highlightContext];
			if (rule !== undefined) {
				this.#styleRules[highlightContext] = rule;
			}
		}
		this.#styleManager.setStyle(Object.values(this.#styleRules).join("\n"));
	}
}

export {
	type Flow, type Span,
	PaintSpecialEngine,
};
