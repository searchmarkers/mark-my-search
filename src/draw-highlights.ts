class PainterHighlights {
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
			ctx.fillStyle = `hsl(${style.hue} 100% 60% / 0.4)`;
			ctx.fillRect(box.x, style.cycle === 2 ? (box.y + box.height/2) : box.y, box.width, style.cycle === 0 ? box.height : (box.height / 2));
			if (style.cycle !== 0) {
				ctx.fillStyle = `hsl(${style.hue} 100% 92% / 0.4)`;
				ctx.fillRect(box.x, style.cycle === 2 ? box.y : (box.y + box.height/2), box.width, box.height / 2);
			}
		});
	}
}

globalThis["registerPaint"]("markmysearch-highlights", PainterHighlights);
