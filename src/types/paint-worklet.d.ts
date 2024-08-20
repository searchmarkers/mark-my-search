declare namespace CSS {
	const paintWorklet: Worklet | undefined;
}

type PaintInstanceConstructor = new () => {
	paint (ctx: PaintRenderingContext2D, geom: PaintSize, properties: StylePropertyMapReadOnly): void
}

declare class PaintWorkletGlobalScope /*implements WorkletGlobalScope*/ {
	registerPaint(name: string, paintCtor: PaintInstanceConstructor): void
	readonly devicePixelRatio: number;
}

declare function registerPaint(name: string, paintCtor: PaintInstanceConstructor): void

interface PaintRenderingContext2DSettings {
	alpha?: boolean;
}

declare interface PaintRenderingContext2D extends
CanvasState,
CanvasTransform,
CanvasCompositing,
CanvasImageSmoothing,
CanvasFillStrokeStyles,
CanvasShadowStyles,
CanvasRect,
CanvasDrawPath,
CanvasDrawImage,
CanvasPathDrawingStyles,
CanvasPath {}

declare class PaintSize {
	readonly width: number;
	readonly height: number;
}
