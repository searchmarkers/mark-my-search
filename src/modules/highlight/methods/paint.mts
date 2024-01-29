import * as Method from "src/modules/highlight/method.mjs";
import * as FlowMonitor from "src/modules/highlight/flow-monitor.mjs";
const { EleID, EleClass } = await import("src/modules/common.mjs");

type TermSelectorStyles = Record<string, {
	hue: number
	cycle: number
}>

class PaintMethod implements Method.AbstractMethod {
	highlightables = new FlowMonitor.CSSPaintHighlightability();

	static paintModuleAdded = false;

	constructor () {
		if (!PaintMethod.paintModuleAdded) {
			CSS.paintWorklet?.addModule(chrome.runtime.getURL("/dist/paint.js"));
			PaintMethod.paintModuleAdded = true;
		}
	}

	getMiscCSS = () => "";

	getTermHighlightsCSS = () => "";

	getTermHighlightCSS (terms: MatchTerms, hues: number[]) {
		const styles: TermSelectorStyles = {};
		terms.forEach((term, i) => {
			styles[term.token] = {
				hue: hues[i % hues.length],
				cycle: Math.floor(i / hues.length),
			};
		});
		return `
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id] {
& [markmysearch-h_beneath] {
	background-color: transparent;
}
& {
	background-image: paint(markmysearch-highlights) !important;
	--markmysearch-styles: ${JSON.stringify(styles)};
}
& > :not([markmysearch-h_id]) {
	--markmysearch-styles: unset;
	--markmysearch-boxes: unset;
}
}`
		;
	}

	endHighlighting () {
		document.body.querySelectorAll("[markmysearch-h_beneath]").forEach(element => {
			element.removeAttribute("markmysearch-h_beneath");
		});
	}

	getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id], [markmysearch-h_beneath]");

	constructHighlightStyleRule = (highlightId: string, boxes: Array<Method.Box>) =>
		`body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${JSON.stringify(boxes)}; }`;
	
	tempReplaceContainers = () => undefined;

	tempRemoveDrawElement = () => undefined;
}

export { PaintMethod }
