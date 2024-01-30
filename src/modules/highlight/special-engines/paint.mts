import type { AbstractSpecialEngine } from "src/modules/highlight/special-engine.mjs";
import type { BoxInfoBoxes, Box } from "src/modules/highlight/engines/paint/method.mjs";
const { UrlMethod } = await import("src/modules/highlight/engines/paint/methods/url.mjs");
import type { BaseFlow, BaseBoxInfo } from "src/modules/highlight/matcher.mjs";
const { matchInText } = await import("src/modules/highlight/matcher.mjs");
const { EleID, EleClass, getElementTagsSet } = await import("src/modules/common.mjs");

type Flow = BaseFlow<false, BoxInfoBoxes>

type BoxInfo = BaseBoxInfo<false, BoxInfoBoxes>

const contextCSS = { hovered: ":hover", focused: ":focus" };

type HighlightContext = keyof typeof contextCSS

type StyleRulesInfo = Record<HighlightContext, string>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PaintSpecialEngine implements AbstractSpecialEngine {
	method = new UrlMethod();
	terms: MatchTerms = [];
	styleRules: StyleRulesInfo = { hovered: "", focused: "" };

	elementsInfo: Map<Element, {
		properties: Record<string, { get: () => unknown, set: (value: unknown) => unknown }>
	}> = new Map();

	startHighlighting (terms: MatchTerms) {
		// Clean up.
		this.endHighlighting();
		// MAIN
		this.terms = terms;
		this.insertHelperElements();
		window.addEventListener("focusin", this.onFocusIn);
		window.addEventListener("mouseover", this.onHover);
		window.addEventListener("input", this.onInput);
	}

	endHighlighting () {
		this.terms = [];
		window.removeEventListener("focusin", this.onFocusIn);
		window.removeEventListener("mouseover", this.onHover);
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
		document.querySelectorAll(
			`#${EleID.STYLE_PAINT_SPECIAL}, #${EleID.ELEMENT_CONTAINER_SPECIAL}`
		).forEach(Element.prototype.remove);
	}

	getFlow (terms: MatchTerms, input: HTMLInputElement) {
		const flow: Flow = {
			text: input.value,
			boxesInfo: [],
		};
		for (const term of terms) {
			for (const match of flow.text.matchAll(term.pattern)) {
				flow.boxesInfo.push({
					term,
					start: match.index as number,
					end: (match.index as number) + match[0].length,
					boxes: [],
				});
			}
		}
	}

	onFocusIn = (event: FocusEvent) => {
		//console.log("focus in", event.target, event.relatedTarget);
		if (event.target) {
			if (this.handles(event.target as Element)) {
				this.highlight("focused", this.terms);
			}
		} else if (event.relatedTarget) {
			if (this.handles(event.relatedTarget as Element)) {
				this.unhighlight("focused");
			}
		}
	};

	onHover = (event: MouseEvent) => {
		//console.log("mouse enter", event.target, event.relatedTarget);
		if (event.target) {
			if (this.handles(event.target as Element)) {
				this.highlight("hovered", this.terms);
			}
		} else if (event.relatedTarget) {
			if (this.handles(event.relatedTarget as Element)) {
				this.unhighlight("hovered");
			}
		}
	};

	onInput = (event: InputEvent) => {
		if (!event.target || !this.handles(event.target as Element)) {
			return;
		}
		//const element = event.target as Element;
		this.highlight("focused", this.terms);
	};

	highlight (highlightCtx: HighlightContext, terms: MatchTerms) {
		const element = document.querySelector(contextCSS[highlightCtx]);
		const value = (element as HTMLInputElement | null)?.value;
		if (value === undefined) {
			return;
		}
		this.styleUpdate({ [highlightCtx]: this.constructHighlightStyleRule(highlightCtx, terms, value) });
	}

	unhighlight (highlightCtx: HighlightContext) {
		this.styleUpdate({ [highlightCtx]: "" });
	}

	constructHighlightStyleRule = (highlightCtx: HighlightContext, terms: MatchTerms, text: string) =>
		`#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body input${contextCSS[highlightCtx]} { background-image: ${
			this.constructHighlightStyleRuleUrl(terms, text)
		} !important; background-repeat: no-repeat !important; }`;

	constructHighlightStyleRuleUrl (terms: MatchTerms, text: string) {
		if (!terms.length) {
			return "url()";
		}
		const boxes = matchInText(terms, text).map((boxInfo): Box => {
			return {
				token: boxInfo.term.token,
				x: boxInfo.start * 10,
				y: 0,
				width: (boxInfo.end - boxInfo.start) * 10,
				height: 20,
			};
		});
		return this.method.constructHighlightStyleRuleUrl(boxes, terms);
	}

	styleUpdate (styleRules: Partial<StyleRulesInfo>) {
		const style = document.getElementById(EleID.STYLE_PAINT_SPECIAL) as HTMLStyleElement;
		Object.keys(contextCSS).forEach(highlightContext => {
			const rule = styleRules[highlightContext];
			if (rule !== undefined) {
				this.styleRules[highlightContext] = rule;
			}
		});
		const styleContent = Object.values(this.styleRules).join("\n");
		if (styleContent !== style.textContent) {
			style.textContent = styleContent;
		}
	}
}

export { PaintSpecialEngine };
