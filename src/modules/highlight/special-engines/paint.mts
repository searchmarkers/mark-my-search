import type { AbstractSpecialEngine } from "/dist/modules/highlight/special-engine.mjs";
import type { BoxInfoBoxes, Box } from "/dist/modules/highlight/engines/paint.mjs";
import { UrlMethod } from "/dist/modules/highlight/engines/paint/methods/url.mjs";
import { type BaseFlow, type BaseBoxInfo, matchInText } from "/dist/modules/highlight/matcher.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass, getElementTagsSet } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false, BoxInfoBoxes>

type BoxInfo = BaseBoxInfo<false, BoxInfoBoxes>

const contextCSS = { hovered: ":hover", focused: ":focus" };

type HighlightContext = keyof typeof contextCSS

type StyleRulesInfo = Record<HighlightContext, string>

class PaintSpecialEngine implements AbstractSpecialEngine {
	readonly termTokens: TermTokens;
	readonly termPatterns: TermPatterns;

	readonly method: UrlMethod;
	terms: ReadonlyArray<MatchTerm> = [];
	hues: ReadonlyArray<number> = [];
	readonly styleRules: StyleRulesInfo = { hovered: "", focused: "" };

	readonly elementsInfo: Map<Element, {
		properties: Record<string, { get: () => unknown, set: (value: unknown) => unknown }>
	}> = new Map();

	constructor (termTokens: TermTokens, termPatterns: TermPatterns) {
		this.termTokens = termTokens;
		this.termPatterns = termPatterns;
		this.method = new UrlMethod(termTokens);
	}

	startHighlighting (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		// Clean up.
		this.endHighlighting();
		// MAIN
		this.terms = terms;
		this.hues = hues;
		this.insertHelperElements();
		window.addEventListener("focusin", this.onFocusIn);
		window.addEventListener("pointerover", this.onHover);
		window.addEventListener("input", this.onInput);
	}

	endHighlighting () {
		this.terms = [];
		window.removeEventListener("focusin", this.onFocusIn);
		window.removeEventListener("pointerover", this.onHover);
		window.removeEventListener("input", this.onInput);
		this.removeHelperElements();
	}

	handledTags: Array<keyof HTMLElementTagNameMap> = [ "input", "textarea" ];
	handledTagSelector = this.handledTags.join(", ");
	handledTagSet = getElementTagsSet(this.handledTags); // Handle <select> elements in future?
	handles = (element: Element) => this.handledTagSet.has(element.tagName);

	insertHelperElements () {
		const style = document.createElement("style");
		style.id = EleID.STYLE_PAINT_SPECIAL;
		document.head.appendChild(style);
		const elementContainer = document.createElement("div");
		elementContainer.id = EleID.ELEMENT_CONTAINER_SPECIAL;
		document.body.insertAdjacentElement("afterend", elementContainer);
	}

	removeHelperElements () {
		for (const element of document.querySelectorAll(
			`#${EleID.STYLE_PAINT_SPECIAL}, #${EleID.ELEMENT_CONTAINER_SPECIAL}`,
		)) {
			element.remove();
		}
	}

	getFlow (terms: ReadonlyArray<MatchTerm>, input: HTMLInputElement) {
		// TODO is this method needed? why not use a common matching function?
		const flow: Flow = {
			text: input.value,
			boxesInfo: [],
		};
		for (const term of terms) {
			for (const match of flow.text.matchAll(this.termPatterns.get(term))) if (match.index !== undefined) {
				flow.boxesInfo.push({
					term,
					start: match.index,
					end: match.index + match[0].length,
					boxes: [],
				});
			}
		}
	}

	onFocusIn = (event: FocusEvent) => {
		//console.log("focus in", event.target, event.relatedTarget);
		if (event.target) {
			if (this.handles(event.target as Element)) {
				this.highlight("focused", this.terms, this.hues);
			}
		} else if (event.relatedTarget) {
			if (this.handles(event.relatedTarget as Element)) {
				this.unhighlight("focused");
			}
		}
	};

	onHover = (event: PointerEvent) => {
		//console.log("mouse enter", event.target, event.relatedTarget);
		if (event.target) {
			if (this.handles(event.target as Element)) {
				this.highlight("hovered", this.terms, this.hues);
			}
		} else if (event.relatedTarget) {
			if (this.handles(event.relatedTarget as Element)) {
				this.unhighlight("hovered");
			}
		}
	};

	onInput = (event: Event) => {
		if (!event.target || !this.handles(event.target as Element)) {
			return;
		}
		//const element = event.target as Element;
		this.highlight("focused", this.terms, this.hues);
	};

	highlight (highlightCtx: HighlightContext, terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const element = document.querySelector(contextCSS[highlightCtx]);
		const value = (element as HTMLInputElement | null)?.value;
		if (value === undefined) {
			return;
		}
		this.styleUpdate({ [highlightCtx]: this.constructHighlightStyleRule(highlightCtx, terms, hues, value) });
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
		return `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body input${contextCSS[highlightCtx]} { background-image: ${
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
		const boxes = matchInText(terms, this.termPatterns, text).map((boxInfo): Box => {
			return {
				token: this.termTokens.get(boxInfo.term),
				x: boxInfo.start * 10,
				y: 0,
				width: (boxInfo.end - boxInfo.start) * 10,
				height: 20,
			};
		});
		return this.method.constructHighlightStyleRuleUrl(boxes, terms, hues);
	}

	styleUpdate (styleRules: Partial<StyleRulesInfo>) {
		const style = document.getElementById(EleID.STYLE_PAINT_SPECIAL) as HTMLStyleElement;
		for (const highlightContext of Object.keys(contextCSS) as Array<HighlightContext>) {
			const rule = styleRules[highlightContext];
			if (rule !== undefined) {
				this.styleRules[highlightContext] = rule;
			}
		}
		const styleContent = Object.values(this.styleRules).join("\n");
		if (styleContent !== style.textContent) {
			style.textContent = styleContent;
		}
	}
}

export {
	type Flow, type BoxInfo,
	PaintSpecialEngine,
};
