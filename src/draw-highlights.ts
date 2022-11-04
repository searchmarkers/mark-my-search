class PainterHighlights {
	static get inputProperties () {
		return [
			"--boxColor",
			"--selectors",
			"--boxes0", // TODO standardise to 2 digits
			"--boxes1",
			"--boxes2",
			"--boxes3",
			"--boxes4",
			"--boxes5",
			"--boxes6",
			"--boxes7",
			"--boxes8",
			"--boxes9",
			"--boxes10",
			"--boxes11",
			"--boxes12",
			"--boxes13",
			"--boxes14",
			"--boxes15",
			"--boxes16",
			"--boxes17",
			"--boxes18",
			"--boxes19",
			"--boxes20",
			"--boxes21",
			"--boxes22",
			"--boxes23",
			"--boxes24",
			"--boxes25",
			"--boxes26",
			"--boxes27",
			"--boxes28",
			"--boxes29",
			"--boxes30",
			"--boxes31",
		];
	}

	paint (
		ctx: CanvasRenderingContext2D,
		size: { width: number, height: number },
		properties: { get: (property: string) => { toString: () => string } },
	) {
		const boxes = Array(32).fill(0).flatMap((_, i) => {
			const boxesStringified = properties.get(`--boxes${i}`).toString();
			return boxesStringified ? JSON.parse(boxesStringified) : [] as Array<{ color: string, x: number, y: number, w: number, h: number }>;
		});
		boxes.forEach(box => {
			ctx.fillStyle = box.color;
			ctx.fillRect(box.x, box.y, box.w, box.h);
		});
	}
}

globalThis["registerPaint"]("highlights", PainterHighlights);
