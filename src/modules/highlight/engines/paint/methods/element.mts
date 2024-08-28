import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type { HighlightingStyleObserver, Flow, Span, Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import type { AllReadonly } from "/dist/modules/common.mjs";
import { Z_INDEX_MIN, EleID, EleClass, getTermClass, getTermTokenClass } from "/dist/modules/common.mjs";

class ElementMethod implements AbstractMethod {
	readonly #termTokens: TermTokens;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;
	readonly #spanBoxesMap: AllReadonly<Map<Span, Array<Box>>>;
	readonly #elementHighlightingIdMap: AllReadonly<Map<HTMLElement, number>>;

	readonly #elementDrawContainerMap = new Map<HTMLElement, HTMLElement>();

	constructor (
		termTokens: TermTokens,
		elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>,
		spanBoxesMap: Map<Readonly<Span>, Array<Readonly<Box>>>,
		elementHighlightingIdMap: AllReadonly<Map<HTMLElement, number>>,
		styleObserver: HighlightingStyleObserver,
	) {
		this.#termTokens = termTokens;
		this.#elementFlowsMap = elementFlowsMap;
		this.#spanBoxesMap = spanBoxesMap;
		this.#elementHighlightingIdMap = elementHighlightingIdMap;
		const newlyStyledElements = new Set<HTMLElement>();
		const newlyUnstyledElements = new Set<HTMLElement>();
		styleObserver.addHighlightingStyleRuleChangedListener(element => {
			newlyStyledElements.add(element);
		});
		styleObserver.addHighlightingStyleRuleDeletedListener(element => {
			newlyUnstyledElements.add(element);
		});
		styleObserver.addHighlightingAppliedListener(() => {
			const parent = document.getElementById(EleID.DRAW_CONTAINER)!;
			for (const element of newlyUnstyledElements) {
				this.#elementDrawContainerMap.get(element)?.remove();
				this.#elementDrawContainerMap.delete(element);
			}
			for (const element of newlyStyledElements) {
				this.#elementDrawContainerMap.get(element)?.remove();
				this.#elementDrawContainerMap.delete(element);
				const container = this.getDrawElementContainer(element);
				if (container === null) {
					continue;
				}
				this.#elementDrawContainerMap.set(element, container);
				parent.appendChild(container);
			}
		});
	}

	readonly getCSS: EngineCSS = {
		misc: () => {
			return (`
#${EleID.DRAW_CONTAINER} {
& {
	position: fixed;
	width: 100%;
	height: 100%;
	top: 100%;
	z-index: ${Z_INDEX_MIN};
}
& > * {
	position: fixed;
	width: 100%;
	height: 100%;
}
}

#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${EleClass.TERM} {
outline: 2px solid hsl(0 0% 0% / 0.1);
outline-offset: -2px;
border-radius: 2px;
}`
			);
		},
		termHighlights: () => "",
		termHighlight: (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number) => {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			const selector = `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${
				getTermClass(term, this.#termTokens)
			}`;
			const backgroundStyle = TermCSS.getHorizontalStyle(
				`hsl(${hue} 100% 60% / 0.4)`,
				`hsl(${hue} 100% 88% / 0.4)`,
				cycle,
			);
			return`${selector} { background: ${backgroundStyle}; }`;
		},
	};

	constructHighlightStyleRule (highlightingId: number) {
		return `body [markmysearch-h_id="${highlightingId}"] { background-image: -moz-element(#${
			EleID.DRAW_ELEMENT + "-" + highlightingId.toString()
		}) !important; background-repeat: no-repeat !important; }`;
	}

	getDrawElementContainer (element: HTMLElement): HTMLElement | null {
		const highlightingId = this.#elementHighlightingIdMap.get(element);
		if (highlightingId === undefined) {
			return null;
		}
		const boxes: ReadonlyArray<Box> = getBoxesOwned(
			element,
			false,
			this.#elementFlowsMap,
			this.#spanBoxesMap,
			null,
			this.#termTokens,
		);
		if (boxes.length === 0) {
			return null;
		}
		const container = document.createElement("div");
		container.id = EleID.DRAW_ELEMENT + "-" + highlightingId.toString();
		let boxRightmost = boxes[0];
		let boxDownmost = boxes[0];
		for (const box of boxes) {
			if (box.x + box.width > boxRightmost.x + boxRightmost.width) {
				boxRightmost = box;
			}
			if (box.y + box.height > boxDownmost.y + boxDownmost.height) {
				boxDownmost = box;
			}
			const drawElement = document.createElement("div");
			drawElement.style.position = "absolute"; // Should it be "fixed"? Should it be applied in a stylesheet?
			drawElement.style.left = box.x.toString() + "px";
			drawElement.style.top = box.y.toString() + "px";
			drawElement.style.width = box.width.toString() + "px";
			drawElement.style.height = box.height.toString() + "px";
			drawElement.classList.add(EleClass.TERM, getTermTokenClass(box.token));
			container.appendChild(drawElement);
		}
		container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
		container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
		return container;
	}
}

export { ElementMethod };
