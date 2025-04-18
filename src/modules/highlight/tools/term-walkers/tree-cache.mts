/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermWalker } from "/dist/modules/highlight/tools/term-walker.d.mjs";
import * as Styles from "/dist/modules/highlight/tools/term-walker/common.mjs";
import type { BaseFlow } from "/dist/modules/highlight/common/matching.d.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";
import { EleID, EleClass, getNodeFinal, isVisible, elementsPurgeClass, focusClosest } from "/dist/modules/common.mjs";

type Flow = BaseFlow<false>

class TermWalker implements AbstractTermWalker {
	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));

	constructor (elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>) {
		this.#elementFlowsMap = elementFlowsMap;
		this.#styleManager.setStyle(Styles.mainCSS);
	}

	deactivate () {
		this.#styleManager.deactivate();
	}

	step (
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | null,
		nodeStart?: Node,
	): HTMLElement | null {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = getSelection()?.anchorNode;
		const nodeFocused = document.activeElement
			// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
			? (document.activeElement === document.body || document.activeElement.id === EleID.BAR)
				? null
				: document.activeElement
			: null;
		const nodeCurrent = nodeStart
			?? (nodeFocused
				? (nodeSelected ? (nodeFocused.contains(nodeSelected) ? nodeSelected : nodeFocused) : nodeFocused)
				: nodeSelected ?? nodeBegin
			);
		const walker = document.createTreeWalker(
			document.body,
			NodeFilter.SHOW_ELEMENT,
			(term
				// If a term has been passed, we are looking for elements with at least 1 occurrence of that term.
				? (element: HTMLElement) => (
					this.#elementFlowsMap.get(element)
						?.some(flow => flow.spans.some(span => span.term === term))
					&& isVisible(element)
				)
					? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
				// If NO term has been passed, we are looking for elements with any highlighting.
				: (element: HTMLElement) => (
					this.#elementFlowsMap.get(element)
						?.some(flow => flow.spans.length > 0)
					&& isVisible(element)
				)
					? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
			) as (node: Node) => number,
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused instanceof HTMLElement) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]();
		if (!(element instanceof HTMLElement)) {
			if (!nodeStart) {
				this.step(reverse, stepNotJump, term, nodeBegin);
			}
			return null;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		focusClosest(element, element => (this.#elementFlowsMap.get(element)?.length ?? 0) > 0);
		getSelection()?.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		return element;
	}

	cleanup () {}
}

export { TermWalker };
