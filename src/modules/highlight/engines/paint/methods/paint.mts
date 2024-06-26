import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box, CachingElement, CachingHTMLElement } from "/dist/modules/highlight/engines/paint.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

type TermSelectorStyles = Record<string, {
	hue: number
	cycle: number
}>

class PaintMethod implements AbstractMethod {
	readonly termTokens: TermTokens;

	static paintModuleAdded = false;

	constructor (termTokens: TermTokens) {
		this.termTokens = termTokens;
		if (!PaintMethod.paintModuleAdded) {
			CSS.paintWorklet?.addModule(chrome.runtime.getURL("/dist/paint.js"));
			PaintMethod.paintModuleAdded = true;
		}
	}

	isElementHighlightable (element: Element) {
		return !element.closest("a");
	}

	findHighlightableAncestor (element: CachingElement): CachingElement {
		let ancestor = element;
		while (true) {
			// Anchors cannot (yet) be highlighted directly inside, due to security concerns with CSS Paint.
			const ancestorUnhighlightable = ancestor.closest("a");
			if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
				ancestor = ancestorUnhighlightable.parentElement;
			} else {
				break;
			}
		}
		return ancestor;
	}

	markElementsUpToHighlightable (element: Element) {
		if (!element.hasAttribute("markmysearch-h_id")
			&& !element.hasAttribute("markmysearch-h_beneath")
		) {
			element.setAttribute("markmysearch-h_beneath", "");
			this.markElementsUpToHighlightable(element.parentElement as Element);
		}
	}

	readonly getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) => {
			const styles: TermSelectorStyles = {};
			for (let i = 0; i < terms.length; i++) {
				styles[this.termTokens.get(terms[i])] = {
					hue: hues[i % hues.length],
					cycle: Math.floor(i / hues.length),
				};
			}
			return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id] {
& [markmysearch-h_beneath] {
	background-color: transparent;
}
& {
	background-image: paint(markmysearch-highlights);
	--markmysearch-styles: ${JSON.stringify(styles)};
}
& > :not([markmysearch-h_id]) {
	--markmysearch-styles: unset;
	--markmysearch-boxes: unset;
}
}`
			);
		},
	};

	endHighlighting () {
		for (const element of document.body.querySelectorAll("[markmysearch-h_beneath]")) {
			element.removeAttribute("markmysearch-h_beneath");
		}
	}

	getHighlightedElements () {
		return document.body.querySelectorAll(
			"[markmysearch-h_id], [markmysearch-h_beneath]",
		) as NodeListOf<CachingHTMLElement<true>>;
	}

	constructHighlightStyleRule (highlightId: string, boxes: Array<Box>) {
		return `body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${JSON.stringify(boxes)}; }`;
	}
	
	tempReplaceContainers () {}

	tempRemoveDrawElement () {}
}

export { type TermSelectorStyles, PaintMethod };
