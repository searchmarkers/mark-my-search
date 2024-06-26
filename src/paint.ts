import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { TermSelectorStyles } from "/dist/modules/highlight/engines/paint/methods/paint.mjs";

registerPaint("markmysearch-highlights", class {
	static get inputProperties () {
		return [
			"--markmysearch-styles",
			"--markmysearch-boxes",
		];
	}

	paint (
		ctx: PaintRenderingContext2D,
		geom: PaintSize,
		properties: StylePropertyMapReadOnly,
	) {
		const selectorStyles = JSON.parse(properties.get("--markmysearch-styles")?.toString() ?? "{}") as TermSelectorStyles;
		const boxes = JSON.parse(properties.get("--markmysearch-boxes")?.toString() ?? "[]") as Array<Box>;
		for (const box of boxes) {
			const style = selectorStyles[box.token];
			if (!style) {
				return;
			}
			ctx.strokeStyle = `hsl(${style.hue} 100% 10% / 0.4)`;
			ctx.strokeRect(box.x, box.y, box.width, box.height);
			const height = box.height / Math.floor((style.cycle + 3) / 2);
			if (style.cycle === 0) {
				// Special case: 1st cycle (only one with a single block of color) must begin with the lightness closer to 50%.
				style.cycle = -1;
			}
			for (let i = 0; i <= (style.cycle + 1) / 2; i++) {
				ctx.fillStyle = `hsl(${style.hue} 100% ${(i % 2 == style.cycle % 2) ? 98 : 60}% / 0.4)`;
				ctx.fillRect(box.x, box.y + height*i, box.width, height);
			}
		}
	}
});
