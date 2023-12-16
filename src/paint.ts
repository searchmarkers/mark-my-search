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
		const selectorStyles = JSON.parse(properties.get("--markmysearch-styles")?.toString() || "{}") as TermSelectorStyles;
		const boxes = JSON.parse(properties.get("--markmysearch-boxes")?.toString() || "[]") as Array<Paint.Box>;
		boxes.forEach(box => {
			const style = selectorStyles[box.token];
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
