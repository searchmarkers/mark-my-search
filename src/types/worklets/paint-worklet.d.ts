interface WorkletGlobalScope { }

interface PaintInstanceConstructor {
	new(): {
		paint(ctx: PaintRenderingContext2D, geom: PaintSize, properties: StylePropertyMapReadOnly): void;
	};
}

declare class PaintWorkletGlobalScope implements WorkletGlobalScope {
	registerPaint(name: string, paintCtor: PaintInstanceConstructor): void
	readonly devicePixelRatio: number;
}

declare function registerPaint(name: string, paintCtor: PaintInstanceConstructor): void

interface PaintRenderingContext2DSettings {
	alpha?: boolean;
}

declare interface PaintRenderingContext2D { }

interface PaintRenderingContext2D extends CanvasState { }

interface PaintRenderingContext2D extends CanvasTransform { }

interface PaintRenderingContext2D extends CanvasCompositing { }

interface PaintRenderingContext2D extends CanvasImageSmoothing { }

interface PaintRenderingContext2D extends CanvasFillStrokeStyles { }

interface PaintRenderingContext2D extends CanvasShadowStyles { }

interface PaintRenderingContext2D extends CanvasRect { }

interface PaintRenderingContext2D extends CanvasDrawPath { }

interface PaintRenderingContext2D extends CanvasDrawImage { }

interface PaintRenderingContext2D extends CanvasPathDrawingStyles { }

interface PaintRenderingContext2D extends CanvasPath { }

declare class PaintSize {
	readonly width: number;
	readonly height: number;
}
