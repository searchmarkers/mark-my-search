import type { AbstractTermMarker } from "/dist/modules/highlight/models/term-marker.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import {
	EleID, EleClass,
	getElementYRelative, elementsPurgeClass,
	type TermHues, getTermClass, getTermClassToken,
} from "/dist/modules/common.mjs";

class TermMarker implements AbstractTermMarker {
	insert (terms: Array<MatchTerm>, termTokens: TermTokens, hues: TermHues, highlightedElements: Iterable<HTMLElement>) {
		if (terms.length === 0) {
			return; // No terms results in an empty selector, which is not allowed.
		}
		const regexMatchTermSelector = new RegExp(`\\b${EleClass.TERM}(?:-\\w+)+\\b`);
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement
			termsAdded: Set<string>
		}> = [];
		let markersHtml = "";
		for (const highlight of highlightedElements) {
			const container = getContainerBlock(highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const yRelative = getElementYRelative(container);
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermClassToken(className))) {
						continue;
					} else {
						const termsAddedCount = containersInfo[containerIdx].termsAdded.size;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(getTermClassToken(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermClassToken(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermClassToken(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		}
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	raise (term: MatchTerm | null, termTokens: TermTokens, container: HTMLElement) {
		const scrollMarkerGutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		elementsPurgeClass(EleClass.FOCUS, scrollMarkerGutter);
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getTermClass(term, termTokens)}` : ""}[top^="${
					Math.trunc(getElementYRelative(container) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(EleClass.FOCUS);
				return true;
			}
			return false;
		});
	}
}

export { TermMarker };
