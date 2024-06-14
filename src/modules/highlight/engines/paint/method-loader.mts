import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { PaintEngineMethod } from "/dist/modules/common.mjs";
import type { TermTokens } from "/dist/modules/match-term.mjs";
import { compatibility } from "/dist/modules/common.mjs";

const loadMethod = async (methodPreference: PaintEngineMethod, termTokens: TermTokens): Promise<AbstractMethod> => {
	if (methodPreference === "paint" && compatibility.highlight.paintEngine.paintMethod) {
		const { PaintMethod } = await import("/dist/modules/highlight/engines/paint/methods/paint.mjs");
		return new PaintMethod(termTokens);
	} else if (methodPreference === "element" && compatibility.highlight.paintEngine.elementMethod) {
		const { ElementMethod } = await import("/dist/modules/highlight/engines/paint/methods/element.mjs");
		return new ElementMethod(termTokens);
	} else {
		const { UrlMethod } = await import("/dist/modules/highlight/engines/paint/methods/url.mjs");
		return new UrlMethod(termTokens);
	}
};

export { loadMethod };
