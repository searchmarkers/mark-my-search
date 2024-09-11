/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { TermTokenStyles } from "/dist/modules/highlight/engines/paint/methods/paint.mjs";

registerPaint("markmysearch-highlights", class {
	static get inputProperties () {
		return [
			"--markmysearch-styles",
			"--markmysearch-boxes",
		];
	}

	paint (
		context: PaintRenderingContext2D,
		size: PaintSize,
		properties: StylePropertyMapReadOnly,
	) {
		// Using `<string | undefined> || <string>` instead of `<string | undefined> ?? <string>`
		// means that the empty string (a falsy value) will also shortcut to the right-hand-side.
		// This is important because properties.get() could return a CSSUnparsedValue which
		// evaluates to the empty string, which is not valid JSON. This happens regularly during
		// normal operation, and after investigation seems to be a quirk of CSS.
		const termTokenStyles = JSON.parse(
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			properties.get("--markmysearch-styles")?.toString() || "{}"
		) as TermTokenStyles;
		const boxes = JSON.parse(
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			properties.get("--markmysearch-boxes")?.toString() || "[]"
		) as Array<Box>;
		for (const box of boxes) {
			const style = termTokenStyles[box.token];
			if (!style) {
				continue;
			}
			context.strokeStyle = `hsl(${style.hue} 100% 10% / 0.4)`;
			context.strokeRect(box.x, box.y, box.width, box.height);
			const height = box.height / Math.floor((style.cycle + 3) / 2);
			if (style.cycle === 0) {
				// Special case: 1st cycle (only one with a single block of color) must begin with the lightness closer to 50%.
				style.cycle = -1;
			}
			for (let i = 0; i <= (style.cycle + 1) / 2; i++) {
				context.fillStyle = `hsl(${style.hue} 100% ${(i % 2 == style.cycle % 2) ? 98 : 60}% / 0.4)`;
				context.fillRect(box.x, box.y + height*i, box.width, height);
			}
		}
	}
});
