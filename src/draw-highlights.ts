class PainterHighlights {
	static get inputProperties () {
		return [
			"--boxes",
		];
	}

	paint (
		ctx: CanvasRenderingContext2D,
		size: { width: number, height: number },
		properties: { get: (property: string) => { toString: () => string } },
	) {
		const boxes = JSON.parse(properties.get("--boxes").toString()) as Array<HighlightBox>;
		//console.log(boxes);
		boxes.forEach(box => {
			ctx.strokeStyle = `hsl(${(box.color.match(/\d+/g) as RegExpMatchArray)[0]} 100% 10% / 0.4)`;
			ctx.strokeRect(box.x, box.y, box.width, box.height);
			ctx.fillStyle = box.color;
			ctx.fillRect(box.x, box.y, box.width, box.height);
		});
	}
}

globalThis["registerPaint"]("highlights", PainterHighlights);
