/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

type TermSelectorStyles = Record<string, {
	hue: number
	cycle: number
}>

class PaintMethod implements AbstractMethod {
	readonly #termTokens: TermTokens;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));

	static #paintModuleAdded = false;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
		if (!PaintMethod.#paintModuleAdded) {
			CSS.paintWorklet?.addModule(chrome.runtime.getURL("/dist/paint.js"));
			PaintMethod.#paintModuleAdded = true;
		}
	}

	deactivate () {
		this.endHighlighting();
		this.#styleManager.deactivate();
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.#styleManager.setStyle(this.getTermsCSS(terms, hues));
	}

	endHighlighting () {}

	getTermsCSS (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const styles: TermSelectorStyles = {};
		for (let i = 0; i < terms.length; i++) {
			styles[this.#termTokens.get(terms[i])] = {
				hue: hues[i % hues.length],
				cycle: Math.floor(i / hues.length),
			};
		}
		return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id] {
	& [markmysearch-h_beneath] {
		background-color: transparent !important;
	}
	& {
		background-image: paint(markmysearch-highlights) !important;
		--markmysearch-styles: ${JSON.stringify(styles)};
	}
	& > :not([markmysearch-h_id]) {
		--markmysearch-styles: unset;
		--markmysearch-boxes: unset;
	}
}`
		);
	}

	readonly highlightables: Highlightables = {
		isElementHighlightable (element: HTMLElement) {
			return !element.closest("a");
		},

		findHighlightableAncestor (element: HTMLElement): HTMLElement {
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
		},
	};

	constructHighlightStyleRule (highlightingId: number, boxes: ReadonlyArray<Box>) {
		return `body [markmysearch-h_id="${highlightingId}"] { --markmysearch-boxes: ${
			JSON.stringify(boxes)
		}; }`;
	}
}

export { type TermSelectorStyles, PaintMethod };
