/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

type PaintWorkletType = {
	devicePixelRatio: number
	registerPaint: (name: string, classRef: unknown) => void
	addModule: (moduleURL: string, options?: { credentials: "omit" | "same-origin" | "include" }) => void
}

(globalThis as unknown as PaintWorkletType).registerPaint("markmysearch-highlights", class {
	static get inputProperties () {
		return [
			"--markmysearch-styles",
			"--markmysearch-boxes",
		];
	}

	paint (
		ctx: CanvasRenderingContext2D,
		size: { width: number, height: number },
		properties: { get: (property: string) => { toString: () => string } },
	) {
		const selectorStyles = JSON.parse(properties.get("--markmysearch-styles").toString() || "{}") as TermSelectorStyles;
		const boxes = JSON.parse(properties.get("--markmysearch-boxes").toString() || "[]") as Array<HighlightBox>;
		boxes.forEach(box => {
			const style = selectorStyles[box.selector];
			if (!style) {
				return;
			}
			ctx.strokeStyle = `hsl(${style.hue} 100% 10% / 0.4)`;
			ctx.strokeRect(box.x, box.y, box.width, box.height);
			const height = box.height / Math.floor((style.cycle + 3) / 2);
			// Special case: 1st cycle (only one with a single block of color) must begin with hue 60.
			style.cycle = style.cycle === 0 ? -1 : style.cycle;
			for (let i = 0; i <= (style.cycle + 1) / 2; i++) {
				ctx.fillStyle = `hsl(${style.hue} 100% ${(i % 2 == style.cycle % 2) ? 98 : 60}% / 0.4)`;
				ctx.fillRect(box.x, box.y + height*i, box.width, height);
			}
		});
	}
});
