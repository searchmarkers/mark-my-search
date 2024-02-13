import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { PaintEngineMethod } from "/dist/modules/common.mjs";
import { compatibility } from "/dist/modules/common.mjs";

const loadMethod = async (methodPreference: PaintEngineMethod): Promise<AbstractMethod> => {
	if (methodPreference === "paint" && compatibility.highlight.paintEngine.paintMethod) {
		const { PaintMethod } = await import("/dist/modules/highlight/engines/paint/methods/paint.mjs");
		return new PaintMethod();
	} else if (methodPreference === "element" && compatibility.highlight.paintEngine.elementMethod) {
		const { ElementMethod } = await import("/dist/modules/highlight/engines/paint/methods/element.mjs");
		return new ElementMethod();
	} else {
		const { UrlMethod } = await import("/dist/modules/highlight/engines/paint/methods/url.mjs");
		return new UrlMethod();
	}
};

export { loadMethod };
