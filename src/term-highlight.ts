type BrowserCommands = Array<chrome.commands.Command>
type TagName = HTMLElementTagName | Uppercase<HTMLElementTagName>
type HighlightTags = {
	reject: ReadonlySet<TagName>,
	flow: ReadonlySet<TagName>,
}
type TermHues = Array<number>
type ControlButtonName = keyof StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
type ControlButtonInfo = {
	buttonClass?: ElementClass
	path?: string
	label?: string
	containerId: ElementID
	onclick?: (control: HTMLElement) => void
	setUp?: (container: HTMLElement) => void
}
type ElementsHighlightBoxesInfo = Map<HTMLElement, Array<HighlightBoxInfo>>
type TermSelectorStyles = Record<string, TermStyle>
type RequestRefreshIndicators = Generator<undefined, never, unknown>
type ProduceEffectOnCommand = Generator<undefined, never, CommandInfo>
type GetNextHighlightClassName = Generator<string, never, unknown>

enum AtRuleID {
	FLASH = "flash",
	MARKER_ON = "marker-on",
	MARKER_OFF = "marker-off",
}

enum ElementClass {
	HIGHLIGHTS_SHOWN = "highlights-shown",
	BAR_HIDDEN = "bar-hidden",
	CONTROL = "control",
	CONTROL_PAD = "control-pad",
	CONTROL_CONTENT = "control-content",
	CONTROL_BUTTON = "control-button",
	CONTROL_REVEAL = "control-reveal",
	CONTROL_EDIT = "control-edit",
	PIN = "pin",
	BAR_CONTROL = "bar-control",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	DISABLED = "disabled",
	MATCH_REGEX = "match-regex",
	MATCH_CASE = "match-case",
	MATCH_STEM = "match-stem",
	MATCH_WHOLE = "match-whole",
	MATCH_DIACRITICS = "match-diacritics",
	PRIMARY = "primary",
	SECONDARY = "secondary",
	OVERRIDE_VISIBILITY = "override-visibility",
	OVERRIDE_FOCUS = "override-focus",
}

enum ElementID {
	STYLE = "style",
	STYLE_PAINT = "style-paint",
	BAR = "bar",
	BAR_OPTIONS = "bar-options",
	BAR_TERMS = "bar-terms",
	BAR_CONTROLS = "bar-controls",
	MARKER_GUTTER = "markers",
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface ControlsInfo {
	highlightsShown: boolean
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
	matchMode: MatchMode
}

interface HighlightBoxInfo {
	term: MatchTerm
	node: Text
	start: number
	end: number
}

interface HighlightBox {
	selector: string
	x: number
	y: number
	width: number
	height: number
}

interface TermStyle {
	hue: number
}

/**
 * Gets a selector for selecting by ID or class, or for CSS at-rules. Abbreviated due to prolific use.
 * __Always__ use for ID, class, and at-rule identifiers.
 * @param identifier The extension-level unique ID, class, or at-rule identifier.
 * @param argument An optional secondary component to the identifier.
 * @returns The selector string, being a constant selector prefix and both components joined by hyphens.
 */
const getSel = (identifier: ElementID | ElementClass | AtRuleID, argument?: string | number): string =>
	argument === undefined ? `markmysearch-${identifier}` : `markmysearch-${identifier}-${argument}`
;

/**
 * Fills a CSS stylesheet element to style all UI elements we insert.
 * @param terms Terms to account for and style.
 * @param hues Color hues for term styles to cycle through.
 */
const fillStylesheetContent = (terms: MatchTerms, hues: TermHues) => {
	const style = document.getElementById(getSel(ElementID.STYLE)) as HTMLStyleElement;
	const zIndexMax = 2**31 - 1;
	const makeImportant = (styleText: string): string =>
		styleText.replace(/;/g, " !important;"); // Prevent websites from overriding rules with !important;
	style.textContent = makeImportant(`
/* || Term Buttons and Input */
#${getSel(ElementID.BAR)} ::selection
	{ background: Highlight; color: HighlightText; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input
	{ width: 5em; padding: 0 2px 0 2px; margin-left: 4px; border: none; outline: revert;
	box-sizing: unset; font-family: revert; white-space: pre; color: #000; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled *,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)}),
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROL)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
	{ width: 0; padding: 0; margin: 0; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_REVEAL)} img
	{ width: 0.5em; }
#${getSel(ElementID.BAR)}
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: none; }
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: block; }
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)}
	{ display: none; }
/**/

/* || Term Matching Option Hints */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_REGEX)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ font-weight: bold; }
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_REGEX)}
.${getSel(ElementClass.CONTROL_CONTENT)}::before
	{ content: "(.*)"; margin-right: 2px; font-weight: bold; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-top: 0; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)}, .${getSel(ElementClass.MATCH_REGEX)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; }
#${getSel(ElementID.BAR_CONTROLS)}
.${getSel(ElementClass.BAR_CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ border-bottom: 3px solid #666; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 2px; border-inline: 2px solid hsl(0 0% 0% / 0.4); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_DIACRITICS)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ font-style: italic; }
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_DIACRITICS)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ border-left: 3px dashed black; }
/**/

/* || Bar */
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; top: 0; left: 0; z-index: ${zIndexMax};
	color-scheme: light; font-size: 14.6px; line-height: initial; user-select: none; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.BAR_HIDDEN)}
	{ display: none; }
#${getSel(ElementID.BAR)} *
	{ all: revert; font: revert; font-size: inherit; line-height: 120%; padding: 0; outline: none; }
#${getSel(ElementID.BAR)} img
	{ height: 1.1em; width: 1.1em; object-fit: cover; }
#${getSel(ElementID.BAR)} button
	{ display: flex; align-items: center; padding-inline: 4px; margin-block: 0; border: none; border-radius: inherit;
	background: none; color: hsl(0 0% 0%); cursor: pointer; letter-spacing: normal; transition: unset; }
#${getSel(ElementID.BAR)} > *
	{ display: inline; }
#${getSel(ElementID.BAR)} > * > *
	{ display: inline-block; vertical-align: top; margin-left: 0.5em; }
/**/

/* || Term Pulldown */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:is(:focus, :active),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}.${getSel(ElementClass.OVERRIDE_VISIBILITY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover) + .${getSel(ElementClass.OPTION_LIST)}
	{ display: flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:focus .${getSel(ElementClass.OPTION)}::first-letter
	{ text-decoration: underline; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ display: none; position: absolute; flex-direction: column; width: max-content; padding: 0; margin: 0; z-index: 1; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ display: block; padding-block: 2px; margin-left: 3px; font-size: small; background: hsl(0 0% 94% / 0.76);
	color: hsl(0 0% 6%); filter: grayscale(100%); width: 100%; text-align: left;
	border-width: 2px; border-color: hsl(0 0% 40% / 0.7); border-left-style: solid; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0 0% 100%); }
/**/

/* || Bar Controls */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}
	{ white-space: pre; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ display: flex; height: 1.3em; border-style: none; border-radius: 4px; box-shadow: 1px 1px 5px;
	background: hsl(0 0% 90% / 0.8); color: #000; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.DISABLED)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(0 0% 90% / 0.4); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:hover
	{ background: hsl(0 0% 65%); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:active
	{ background: hsl(0 0% 50%); }
#${getSel(ElementID.BAR)} > :not(#${getSel(ElementID.BAR_TERMS)})
> .${getSel(ElementClass.DISABLED)}:not(:focus-within, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
	{ display: none; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ display: flex; background: hsl(0 0% 80% / 0.6); }
/**/

/* || Term Scroll Markers */
#${getSel(ElementID.MARKER_GUTTER)}
	{ display: block; position: fixed; right: 0; top: 0; width: 0; height: 100%; z-index: ${zIndexMax}; }
#${getSel(ElementID.MARKER_GUTTER)} *
	{ width: 16px; height: 1px; position: absolute; right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
	padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.FOCUS)}
	{ padding-right: 16px; transition: unset; }
/**/

/* || Term Highlights */
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(AtRuleID.FLASH)} 1s; }
/**/
	`) + `
/* || Term Highlight */
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)} ~ body [highlight]
	{ background-image: paint(highlights) !important; --mms-styles: ${JSON.stringify((() => {
		const styles: TermSelectorStyles = {};
		terms.forEach((term, i) => {
			styles[term.selector] = { hue: hues[i % hues.length] };
		});
		return styles;
	})())}; }
/**/

/* || Transitions */
@keyframes ${getSel(AtRuleID.MARKER_ON)}
	{ from {} to { padding-right: 16px; }; }
@keyframes ${getSel(AtRuleID.MARKER_OFF)}
	{ from { padding-right: 16px; } to { padding-right: 0; }; }
@keyframes ${getSel(AtRuleID.FLASH)}
	{ from { background-color: hsl(0 0% 65% / 0.8); } to {}; }
	`;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		term.hue = hue;
		style.textContent += makeImportant(`
/* || Term Scroll Markers */
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue} 100% 44%); }
/**/

/* || Term Control Buttons */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(i, hues.length, `hsl(${hue} 70% 70% / 0.8)`, `hsl(${hue} 70% 88% / 0.8)`)}; }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.DISABLED)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(i, hues.length, `hsl(${hue} 70% 70% / 0.4)`, `hsl(${hue} 70% 88% / 0.4)`)}; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_BUTTON)}:hover:not(:disabled)
	{ background: hsl(${hue} 70% 80%); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_BUTTON)}:active:not(:disabled)
	{ background: hsl(${hue} 70% 70%); }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_PAD, i)}
.${getSel(ElementClass.TERM, term.selector)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(${hue} 100% 90%); }
/**/
		`);
	});
};

// TODO document, reorganise
const isIdxAboveStyleLevel = (idx: number, level: number, levelCount: number) =>
	idx >= levelCount * level
;

// TODO document, reorganise
const getBackgroundStyle = (idx: number, hueCount: number, colorA: string, colorB: string) =>
	isIdxAboveStyleLevel(idx, 1, hueCount)
		?  `repeating-linear-gradient(${
			isIdxAboveStyleLevel(idx, 3, hueCount)
				? isIdxAboveStyleLevel(idx, 4, hueCount) ? 0 : 90
				: isIdxAboveStyleLevel(idx, 2, hueCount) ? 45 : -45
		}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
		: colorA
;

// TODO document, reorganise
const getHighlightBackgroundStyle = (idx: number, hue: number, hueCount: number) =>
	getBackgroundStyle(idx, hueCount, `hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 84% / 0.4)`)
;

/**
 * Gets a selector string for the container block of an element.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @returns The container block selector corresponding to the highlight tags supplied.
 */
const getContainerBlockSelector = (highlightTags: HighlightTags) =>
	`:not(${Array.from(highlightTags.flow).join(", ")})`
;

/**
 * Gets the containing block of an element.
 * This is its closest ancestor which has no tag name counted as `flow` in a highlight tags object.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param element An element to find the first container block of (inclusive).
 * @param selector If supplied, a container block selector.
 * Normally generated by the appropriate function using the highlight tags supplied. This may be used for efficiency.
 * @returns The closest container block above the element (inclusive).
 */
const getContainerBlock = (element: HTMLElement, highlightTags: HighlightTags, selector = ""): HTMLElement =>
	// Always returns an element since "body" is not a flow tag.
	element.closest(selector ? selector : getContainerBlockSelector(highlightTags)) as HTMLElement
;

/**
 * Reverts the focusability of elements made temporarily focusable and marked as such using a class name.
 * Sets their `tabIndex` to -1.
 * @param root If supplied, an element to revert focusability under in the DOM tree (inclusive).
 */
const elementsRemakeUnfocusable = (root = document.body) => {
	if (!root.parentNode) {
		return;
	}
	root.parentNode.querySelectorAll(`.${getSel(ElementClass.FOCUS_REVERT)}`)
		.forEach((element: HTMLElement) => {
			element.tabIndex = -1;
			element.classList.remove(getSel(ElementClass.FOCUS_REVERT));
		});
};

/**
 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
 */
const jumpToTerm = (() => {
	/**
	 * Determines heuristically whether or not an element is visible. The element need not be currently scrolled into view.
	 * @param element An element.
	 * @returns `true` if visible, `false` otherwise.
	 */
	const isVisible = (element: HTMLElement) => // TODO improve
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& getComputedStyle(element).visibility !== "hidden"
	;

	/**
	 * Focuses an element, preventing immediate scroll-into-view and forcing visible focus where supported.
	 * @param element An element.
	 */
	const focusElement = (element: HTMLElement) =>
		element.focus({
			preventScroll: true,
			focusVisible: true, // Very sparse browser compatibility
		} as FocusOptions)
	;

	// TODO document
	const jumpToScrollMarker = (term: MatchTerm | undefined, container: HTMLElement) => {
		const scrollMarkerGutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		elementsPurgeClass(getSel(ElementClass.FOCUS), scrollMarkerGutter);
		// eslint-disable-next-line no-constant-condition
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getSel(ElementClass.TERM, term.selector)}` : ""}[top^="${
					Math.trunc(getElementYRelative(container) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(getSel(ElementClass.FOCUS));
				return true;
			}
			return false;
		});
	};

	// TODO document
	const selectNextElement = (reverse: boolean, walker: TreeWalker, walkSelectionFocusContainer: { accept: boolean },
		highlightTags: HighlightTags, elementToSelect?: HTMLElement,
	): { elementSelected: HTMLElement | null, container: HTMLElement | null } => {
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			let nodeToRemove: Node | null = null;
			if (!document.body.lastChild || document.body.lastChild.nodeType !== Node.TEXT_NODE) {
				nodeToRemove = document.createTextNode("");
				document.body.appendChild(nodeToRemove);
			}
			walker.currentNode = (reverse && document.body.lastChild)
				? document.body.lastChild
				: document.body;
			elementTerm = walker[nextNodeMethod]() as HTMLElement;
			if (nodeToRemove) {
				nodeToRemove.parentElement?.removeChild(nodeToRemove);
			}
			if (!elementTerm) {
				walkSelectionFocusContainer.accept = true;
				elementTerm = walker[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return { elementSelected: null, container: null };
				}
			}
		}
		const container = getContainerBlock(elementTerm.parentElement as HTMLElement, highlightTags);
		container.classList.add(getSel(ElementClass.FOCUS_CONTAINER));
		elementTerm.classList.add(getSel(ElementClass.FOCUS));
		elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
			.every(thisElement => getContainerBlock(thisElement.parentElement as HTMLElement, highlightTags) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(getSel(ElementClass.FOCUS_REVERT));
			elementToSelect.tabIndex = 0;
		}
		focusElement(elementToSelect);
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(getSel(ElementClass.REMOVE));
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			focusElement(elementToSelect);
		}
		if (document.activeElement === elementToSelect) {
			return { elementSelected: elementToSelect, container };
		}
		return selectNextElement(reverse, walker, walkSelectionFocusContainer, highlightTags, elementToSelect);
	};

	return (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? getSel(ElementClass.TERM, term.selector) : "";
		const focusBase = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		const selection = document.getSelection();
		const activeElement = document.activeElement;
		if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${getSel(ElementID.BAR)}`)) {
			(activeElement as HTMLInputElement).blur();
		}
		const selectionFocus = selection && (!activeElement
			|| activeElement === document.body || !document.body.contains(activeElement)
			|| activeElement === focusBase || activeElement.contains(focusContainer)
		)
			? selection.focusNode
			: activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(getSel(ElementClass.FOCUS));
			elementsPurgeClass(getSel(ElementClass.FOCUS_CONTAINER));
			elementsRemakeUnfocusable();
		}
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(
				selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
					? selectionFocus as HTMLElement
					: selectionFocus.parentElement,
				highlightTags)
			: undefined;
		const walkSelectionFocusContainer = { accept: false };
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(element, highlightTags) !== selectionFocusContainer || walkSelectionFocusContainer.accept)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const { elementSelected, container } = selectNextElement(reverse, walker, walkSelectionFocusContainer, highlightTags);
		if (!elementSelected || !container) {
			return;
		}
		elementSelected.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementSelected, 0, elementSelected, 0);
		}
		document.body.querySelectorAll(`.${getSel(ElementClass.REMOVE)}`).forEach((element: HTMLElement) => {
			element.remove();
		});
		jumpToScrollMarker(term, container);
	};
})();

/**
 * Creates an interactive term editing input. Inserts it into a term control.
 * @param terms Terms being controlled and highlighted.
 * @param controlPad The visible pad of the control. Contains the inline buttons and inputs.
 * @param idxCode The append term constant if the control is used to append a term,
 * or the index of a term if used to edit that term.
 * @param insertInput A function accepting the input element that inserts it into its term control.
 * @returns The input element created.
 */
const insertTermInput = (() => {
	/**
	 * Focuses and selects the text of a term control input. Note that focus causes a term input to be visible.
	 * @param control A term control element.
	 * @param shiftCaretRight If supplied, whether to shift the caret to the right or the left. If unsupplied, all text is selected.
	 */
	const selectInput = (control: HTMLElement, shiftCaretRight?: boolean) => {
		const input = control.querySelector("input");
		if (!input) {
			assert(false, "term input no select", "required element(s) not found", { control });
			return;
		}
		input.select();
		if (shiftCaretRight !== undefined) {
			const caretPosition = shiftCaretRight ? 0 : -1;
			input.setSelectionRange(caretPosition, caretPosition);
		}
	};

	/**
	 * Executes the change indicated by the current input text of a term control.
	 * Operates by sending a background message to this effect provided that the text was altered.
	 * @param term A term to attempt committing the control input text of.
	 * @param terms Terms being controlled and highlighted.
	 */
	const commit = (term: MatchTerm | undefined, terms: MatchTerms) => {
		const replaces = !!term; // Whether a commit in this control replaces an existing term or appends a new one.
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const inputValue = termInput.value;
		const idx = getTermIdxFromArray(term, terms);
		if (replaces && inputValue === "") {
			if (document.activeElement === termInput) {
				selectInput(getControl(undefined, idx + 1) as HTMLElement);
				return;
			}
			chrome.runtime.sendMessage({
				terms: terms.slice(0, idx).concat(terms.slice(idx + 1)),
				termChanged: term,
				termChangedIdx: TermChange.REMOVE,
			} as BackgroundMessage);
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			chrome.runtime.sendMessage({
				terms: terms.map((term, i) => i === idx ? termChanged : term),
				termChanged,
				termChangedIdx: idx,
				toggleAutoOverwritable: false,
			} as BackgroundMessage);
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue, getTermControlMatchModeFromClassList(control.classList), {
				allowStemOverride: true,
			});
			chrome.runtime.sendMessage({
				terms: terms.concat(termChanged),
				termChanged,
				termChangedIdx: TermChange.CREATE,
				toggleAutoOverwritable: false,
			} as BackgroundMessage);
		}
	};

	/**
	 * Shifts the control focus to another control if the caret is at the input end corresponding to the requested direction.
	 * A control is considered focused if its input is focused.
	 * @param term The term of the currently focused control.
	 * @param idxTarget The index of the target term control to shift to, if no shift direction is passed.
	 * @param shiftRight Whether to shift rightwards or leftwards, if no target index is passed.
	 * @param onBeforeShift A function to execute once the shift is confirmed but has not yet taken place.
	 * @param terms Terms being controlled and highlighted.
	 */
	const tryShiftTermFocus = (term: MatchTerm | undefined, idxTarget: number | undefined, shiftRight: boolean | undefined,
		onBeforeShift: () => void, terms: MatchTerms) => {
		const replaces = !!term; // Whether a commit in this control replaces an existing term or appends a new one.
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const idx = replaces ? getTermIdxFromArray(term, terms) : terms.length;
		shiftRight ??= (idxTarget ?? idx) > idx;
		if (termInput.selectionStart !== termInput.selectionEnd
			|| termInput.selectionStart !== (shiftRight ? termInput.value.length : 0)) {
			return;
		}
		onBeforeShift();
		idxTarget ??= Math.max(0, Math.min(shiftRight ? idx + 1 : idx - 1, terms.length));
		if (idx === idxTarget) {
			commit(term, terms);
			if (!replaces) {
				termInput.value = "";
			}
		} else {
			const controlTarget = getControl(undefined, idxTarget) as HTMLElement;
			selectInput(controlTarget, shiftRight);
		}
	};

	return (terms: MatchTerms, controlPad: HTMLElement, idxCode: TermChange.CREATE | number,
		insertInput: (termInput: HTMLInputElement) => void) => {
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement ?? controlPad;
		const controlEdit = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_EDIT))[0] as HTMLElement | undefined;
		const term = terms[idxCode] as MatchTerm | undefined;
		// Whether a commit in this control replaces an existing term or appends a new one.
		const replaces = idxCode !== TermChange.CREATE;
		const input = document.createElement("input");
		input.type = "text";
		const resetInput = (termText = controlContent.textContent as string) => {
			input.value = replaces ? termText : "";
		};
		input.addEventListener("focusin", () => {
			if (input.classList.contains(getSel(ElementClass.OVERRIDE_FOCUS))) {
				return; // Focus has been delegated to another element and will be on the input when this class is removed
			}
			resetInput();
			resetTermControlInputsVisibility();
			input.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
		});
		input.addEventListener("focusout", () => {
			if (!input.classList.contains(getSel(ElementClass.OVERRIDE_FOCUS))) {
				// Focus has been lost, not delegated to another element
				commit(term, terms);
			}
		});
		input.addEventListener("keyup", event => {
			if (event.key === "Tab") {
				selectInputTextAll(input);
			}
		});
		const show = (event: MouseEvent) => {
			event.preventDefault();
			input.select();
			selectInputTextAll(input);
		};
		const hide = () => {
			input.blur();
		};
		if (controlEdit) {
			controlEdit.onclick = event => {
				if (!input.classList.contains(getSel(ElementClass.OVERRIDE_VISIBILITY)) || getComputedStyle(input).width === "0") {
					show(event);
				} else {
					input.value = "";
					commit(term, terms);
					hide();
				}
			};
			controlEdit.oncontextmenu = event => {
				event.preventDefault();
				input.value = "";
				commit(term, terms);
				hide();
			};
			controlContent.oncontextmenu = show;
		} else if (!replaces) {
			const button = controlPad.querySelector("button") as HTMLButtonElement;
			button.onclick = show;
			button.oncontextmenu = show;
		}
		(new ResizeObserver(entries =>
			entries.forEach(entry => entry.contentRect.width === 0 ? hide() : undefined)
		)).observe(input);
		input.onkeydown = event => {
			switch (event.key) {
			case "Enter": {
				if (event.shiftKey) {
					hide();
					resetTermControlInputsVisibility();
				} else {
					commit(term, terms);
					resetInput(input.value);
				}
				return;
			}
			case "Escape": {
				resetInput();
				hide();
				resetTermControlInputsVisibility();
				return;
			}
			case "ArrowLeft":
			case "ArrowRight": {
				tryShiftTermFocus(term, undefined, event.key === "ArrowRight", () => event.preventDefault(), terms);
				return;
			}
			case "ArrowUp":
			case "ArrowDown": {
				tryShiftTermFocus(term, (event.key === "ArrowUp") ? 0 : terms.length, undefined, () => event.preventDefault(), terms);
				return;
			}
			case " ": {
				if (!event.shiftKey) {
					return;
				}
				event.preventDefault();
				openTermOptionMenu(term);
				return;
			}
			}
		};
		insertInput(input);
		return input;
	};
})();

/**
 * Gets the index of a term within an array of terms.
 * @param term A term to find.
 * @param terms Terms to search in.
 * @returns The append term constant index if not found, the term's index otherwise.
 */
const getTermIdxFromArray = (term: MatchTerm | undefined, terms: MatchTerms): TermChange.CREATE | number =>
	term ? terms.indexOf(term) : TermChange.CREATE
;

/**
 * Gets the control of a term or at an index.
 * @param term A term to identify the control by, if supplied.
 * @param idx An index to identify the control by, if supplied.
 * @returns The control matching `term` if supplied and `idx` is `undefined`,
 * OR the control matching `idx` if supplied and less than the number of terms,
 * OR the append term control otherwise.
 */
const getControl = (term?: MatchTerm, idx?: number): Element | null => {
	const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
	return (idx === undefined && term
		? barTerms.getElementsByClassName(getSel(ElementClass.TERM, term.selector))[0]
		: idx === undefined || idx >= barTerms.children.length
			? getControlAppendTerm()
			: Array.from(barTerms.children).at(idx ?? -1) ?? null
	);
};

/**
 * Gets the control for appending a new term.
 * @returns The control if present, `null` otherwise.
 */
const getControlAppendTerm = (): Element | null =>
	(document.getElementById(getSel(ElementID.BAR_CONTROLS)) as HTMLElement).firstElementChild
;

/**
 * Selects all of the text in an input. Does not affect focus.
 * Mainly a helper for mitigating a Chromium bug which causes `select()` for an input's initial focus to not select all text.
 * @param input An input element to select the text of.
 */
const selectInputTextAll = (input: HTMLInputElement) =>
	input.setSelectionRange(0, input.value.length)
;

/**
 * Updates the look of a term control to reflect whether or not it occurs within the document.
 * @param term A term to update the term control status for.
 */
const updateTermOccurringStatus = (term: MatchTerm) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	const hasOccurrences = document.body.querySelector("[highlight]");
	controlPad.classList[hasOccurrences ? "remove" : "add"](getSel(ElementClass.DISABLED));
};

/**
 * Updates the tooltip of a term control to reflect current highlighting or extension information as appropriate.
 * @param term A term to update the tooltip for.
 */
const updateTermTooltip = (() => {
	/**
	 * Gets the number of matches for a term in the document.
	 * @param term A term to get the occurrence count for.
	 * @returns The occurrence count for the term.
	 */
	const getOccurrenceCount = (term: MatchTerm) => { // TODO make accurate
		const occurrences = Array.from(document.body.querySelectorAll("[highlight]"));
		const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		return matches ? matches.length : 0;
	};

	return (term: MatchTerm) => {
		const controlPad = (getControl(term) as HTMLElement)
			.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
		const occurrenceCount = getOccurrenceCount(term);
		controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
			!occurrenceCount || !term.command ? ""
				: occurrenceCount === 1 ? `\nJump to: ${term.command} or ${term.commandReverse}`
					: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
		}`;
	};
})();

/**
 * Gets the term match type identifier for a match option.
 * @param text The text of a match option.
 * @returns The corresponding match type identifier string.
 */
const getTermOptionMatchType = (text: string): string => // TODO rework system to not rely on option text
	text.slice(0, text.includes(" ") ? text.indexOf(" ") : undefined).toLowerCase()
;

/**
 * Transforms the current text of a term match option to reflect whether or not it is currently enabled.
 * @param optionIsEnabled Indicates whether the option text should display enablement.
 * @param title Option text in an unknown previous state.
 * @returns The option text reflecting the given enablement.
 */
const getTermOptionText = (optionIsEnabled: boolean, title: string): string =>
	optionIsEnabled
		? title.includes("🗹") ? title : `${title} 🗹`
		: title.includes("🗹") ? title.slice(0, -2) : title
;

/**
 * Updates the class list of a control to reflect the matching options of its term.
 * @param mode An object of term matching mode flags.
 * @param classList The control element class list for a term.
 */
const updateTermControlMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList[mode.regex ? "add" : "remove"](getSel(ElementClass.MATCH_REGEX));
	classList[mode.case ? "add" : "remove"](getSel(ElementClass.MATCH_CASE));
	classList[mode.stem ? "add" : "remove"](getSel(ElementClass.MATCH_STEM));
	classList[mode.whole ? "add" : "remove"](getSel(ElementClass.MATCH_WHOLE));
	classList[mode.diacritics ? "add" : "remove"](getSel(ElementClass.MATCH_DIACRITICS));
};

/**
 * Gets the matching options of a term from the class list of its control.
 * @param classList The control element class list for a term.
 * @returns The matching options for a term.
 */
const getTermControlMatchModeFromClassList = (classList: DOMTokenList): MatchMode => ({
	regex: classList.contains(getSel(ElementClass.MATCH_REGEX)),
	case: classList.contains(getSel(ElementClass.MATCH_CASE)),
	stem: classList.contains(getSel(ElementClass.MATCH_STEM)),
	whole: classList.contains(getSel(ElementClass.MATCH_WHOLE)),
	diacritics: classList.contains(getSel(ElementClass.MATCH_DIACRITICS)),
});

/**
 * Refreshes the control of a term to reflect its current state.
 * @param term A term with an existing control.
 * @param idx The index of the term.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 */
const refreshTermControl = (term: MatchTerm, idx: number, highlightTags: HighlightTags) => {
	const control = getControl(undefined, idx) as HTMLElement;
	control.className = "";
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
	controlContent.textContent = term.phrase;
	// TODO make function
	Array.from(control.getElementsByClassName(getSel(ElementClass.OPTION))).forEach(option =>
		option.textContent = getTermOptionText(
			term.matchMode[getTermOptionMatchType(option.textContent as string)],
			option.textContent as string,
		),
	);
};

/**
 * Removes a term control element.
 * @param idx The index of an existing control to remove.
 */
const removeTermControl = (idx: number) => {
	(getControl(undefined, idx) as HTMLElement).remove();
};

/**
 * Creates an clickable element to toggle one of the matching options for a term.
 * @param term The term for which to create a matching option.
 * @param text Text content for the option, which is also used to determine the matching mode it controls.
 * @param onActivated A function, taking the identifier for the match option, to execute each time the option is activated.
 * @returns The resulting option element.
 */
const createTermOption = (term: MatchTerm, text: string,
	onActivated: (matchType: string) => void): HTMLButtonElement => {
	const matchType = getTermOptionMatchType(text);
	const option = document.createElement("button");
	option.type = "button";
	option.classList.add(getSel(ElementClass.OPTION));
	option.tabIndex = -1;
	option.textContent = getTermOptionText(term.matchMode[matchType], text);
	option.onmouseup = () => {
		if (!option.matches(":active")) {
			onActivated(matchType);
		}
	};
	option.onclick = () => onActivated(matchType);
	return option;
};

/**
 * Moves focus temporarily from a term input to a target element. Term inputs normally commit when unfocused,
 * but this method ensures it is considered a delegation of focus so will not cause changes to be committed.
 * Accordingly, focus is returned to the input once lost from the target.
 * @param input The term input from which to delegate focus.
 * @param target The element which will hold focus until returned to the input.
 */
const delegateFocusFromTermInput = (input: HTMLInputElement, target: HTMLElement) => {
	if (document.activeElement === input) {
		input.classList.add(getSel(ElementClass.OVERRIDE_FOCUS));
	}
	target.focus();
	if (input.classList.contains(getSel(ElementClass.OVERRIDE_FOCUS))) {
		const returnFocus = () => {
			target.removeEventListener("blur", returnFocus);
			input.focus();
			input.classList.remove(getSel(ElementClass.OVERRIDE_FOCUS));
		};
		target.addEventListener("blur", returnFocus);
	}
};

/**
 * Creates a menu structure containing clickable elements to individually toggle the matching options for a term.
 * @param term The term for which to create a menu.
 * @param terms Terms being controlled and highlighted.
 * @param onActivated A function, taking the identifier for a match option, to execute each time the option is activated.
 * @param controlsInfo Details of controls being inserted.
 * @returns The resulting menu element.
 */
const createTermOptionMenu = (
	term: MatchTerm,
	terms: MatchTerms,
	controlsInfo: ControlsInfo,
	onActivated = (matchType: string) => {
		const termUpdate = Object.assign({}, term);
		termUpdate.matchMode = Object.assign({}, termUpdate.matchMode);
		termUpdate.matchMode[matchType] = !termUpdate.matchMode[matchType];
		chrome.runtime.sendMessage({
			terms: terms.map(termCurrent => termCurrent === term ? termUpdate : termCurrent),
			termChanged: termUpdate,
			termChangedIdx: getTermIdxFromArray(term, terms),
		});
	},
): { optionList: HTMLElement, controlReveal: HTMLButtonElement } => {
	const termIsValid = terms.includes(term); // If virtual and used for appending terms, this will be `false`.
	const optionList = document.createElement("menu");
	optionList.classList.add(getSel(ElementClass.OPTION_LIST));
	optionList.appendChild(createTermOption(term, "Case Sensitive", onActivated));
	optionList.appendChild(createTermOption(term, "Whole Word", onActivated));
	optionList.appendChild(createTermOption(term, "Stem Word", onActivated));
	optionList.appendChild(createTermOption(term, "Diacritics", onActivated));
	optionList.appendChild(createTermOption(term, "Regex Mode", onActivated));
	const handleKeyEvent = (event: KeyboardEvent, executeResult = true) => {
		event.preventDefault();
		if (!executeResult) {
			return;
		}
		if (event.key === "Escape") {
			optionList.blur();
			return;
		} else if (event.key === " " || event.key.length !== 1) {
			return;
		}
		Array.from(optionList.querySelectorAll(`.${getSel(ElementClass.OPTION)}`)).some((option: HTMLButtonElement) => {
			if ((option.textContent ?? "").toLowerCase().startsWith(event.key)) {
				option.click();
				return true;
			}
			return false;
		});
		optionList.blur();
	};
	optionList.onkeydown = event => handleKeyEvent(event, false);
	optionList.onkeyup = event => handleKeyEvent(event);
	const controlReveal = document.createElement("button");
	controlReveal.type = "button";
	controlReveal.classList.add(getSel(ElementClass.CONTROL_BUTTON));
	controlReveal.classList.add(getSel(ElementClass.CONTROL_REVEAL));
	controlReveal.tabIndex = -1;
	controlReveal.disabled = !controlsInfo.barLook.showRevealIcon;
	controlReveal.addEventListener("click", () => {
		const input = controlReveal.parentElement ? controlReveal.parentElement.querySelector("input") : null;
		const willFocusInput = input ? input.getBoundingClientRect().width > 0 : false;
		resetTermControlInputsVisibility();
		if (input && willFocusInput) {
			input.focus();
		}
		openTermOptionMenu(termIsValid ? term : undefined);
	});
	const controlRevealToggle = document.createElement("img");
	controlRevealToggle.src = chrome.runtime.getURL("/icons/reveal.svg");
	controlReveal.appendChild(controlRevealToggle);
	return { optionList, controlReveal };
};

/**
 * Opens and focuses the menu of matching options for a term, allowing the user to toggle matching modes.
 * @param term The term for which to open a matching options menu.
 */
const openTermOptionMenu = (term: MatchTerm | undefined) => {
	const control = getControl(term);
	const input = control ? control.querySelector("input") : null;
	const optionList = control ? control.querySelector(`.${getSel(ElementClass.OPTION_LIST)}`) as HTMLElement | null : null;
	if (!input || !optionList) {
		assert(false, "term option menu no open", "required element(s) not found",
			{ term: (term ? term : "term appender") });
		return;
	}
	delegateFocusFromTermInput(input, optionList);
	optionList.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
	optionList.tabIndex = 0;
	optionList.focus();
	optionList.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
};

/**
 * Inserts an interactive term control element.
 * @param terms Terms being controlled and highlighted.
 * @param idx The index in `terms` of a term to assign.
 * @param command The string of a command to display as a shortcut hint for jumping to the next term.
 * @param commandReverse The string of a command to display as a shortcut hint for jumping to the previous term.
 * @param controlsInfo Details of controls inserted.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 */
const insertTermControl = (terms: MatchTerms, idx: number, command: string, commandReverse: string,
	controlsInfo: ControlsInfo, highlightTags: HighlightTags) => {
	const term = terms.at(idx) as MatchTerm;
	const { optionList, controlReveal } = createTermOptionMenu(term, terms, controlsInfo);
	const controlPad = document.createElement("div");
	controlPad.classList.add(getSel(ElementClass.CONTROL_PAD));
	controlPad.classList.add(getSel(ElementClass.DISABLED));
	controlPad.appendChild(controlReveal);
	const controlContent = document.createElement("button");
	controlContent.type = "button";
	controlContent.classList.add(getSel(ElementClass.CONTROL_BUTTON));
	controlContent.classList.add(getSel(ElementClass.CONTROL_CONTENT));
	controlContent.tabIndex = -1;
	controlContent.textContent = term.phrase;
	controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
	controlPad.appendChild(controlContent);
	const controlEdit = document.createElement("button");
	controlEdit.type = "button";
	controlEdit.classList.add(getSel(ElementClass.CONTROL_BUTTON));
	controlEdit.classList.add(getSel(ElementClass.CONTROL_EDIT));
	controlEdit.tabIndex = -1;
	controlEdit.disabled = !controlsInfo.barLook.showEditIcon;
	const controlEditChange = document.createElement("img");
	const controlEditRemove = document.createElement("img");
	controlEditChange.src = chrome.runtime.getURL("/icons/edit.svg");
	controlEditRemove.src = chrome.runtime.getURL("/icons/delete.svg");
	controlEditChange.classList.add(getSel(ElementClass.PRIMARY));
	controlEditRemove.classList.add(getSel(ElementClass.SECONDARY));
	controlEdit.appendChild(controlEditChange);
	controlEdit.appendChild(controlEditRemove);
	controlPad.appendChild(controlEdit);
	insertTermInput(terms, controlPad, idx, input => controlPad.insertBefore(input, controlEdit));
	term.command = command;
	term.commandReverse = commandReverse;
	const control = document.createElement("div");
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	control.appendChild(controlPad);
	control.appendChild(optionList);
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	(document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement).appendChild(control);
};

/**
 * Extracts assigned shortcut strings from browser commands.
 * @param commands Commands as returned by the browser.
 * @returns An object containing the extracted command shortcut strings.
 */
const getTermCommands = (commands: BrowserCommands): { down: Array<string>, up: Array<string> } => {
	const commandsDetail = commands.map(command => ({
		info: command.name ? parseCommand(command.name) : { type: CommandType.NONE },
		shortcut: command.shortcut ?? "",
	}));
	return {
		down: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

/**
 * Inserts constant bar controls into the toolbar.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param controlsInfo Details of controls to insert.
 * @param commands Browser commands to use in shortcut hints.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const insertControls = (() => {
	/**
	 * Inserts a control.
	 * @param terms Terms to be controlled and highlighted.
	 * @param barControlName A standard name for the control.
	 * @param hideWhenInactive Indicates whether to hide the control while not in interaction.
	 * @param controlsInfo Details of controls to insert.
	 */
	const insertControl = (() => {
		/**
		 * Inserts a control given control button details.
		 * @param barControlName A standard name for the control.
		 * @param info Details about the control button to create.
		 * @param hideWhenInactive Indicates whether to hide the control while not in interaction.
		 */
		const insertControlWithInfo = (barControlName: ControlButtonName, info: ControlButtonInfo,
			hideWhenInactive: boolean) => {
			const container = document.createElement("div");
			container.classList.add(getSel(ElementClass.BAR_CONTROL)); // TODO redundant? can use CSS to select partial class
			container.classList.add(getSel(ElementClass.BAR_CONTROL, barControlName));
			container.tabIndex = -1;
			const pad = document.createElement("div");
			pad.classList.add(getSel(ElementClass.CONTROL_PAD));
			pad.tabIndex = -1;
			const button = document.createElement("button");
			button.type = "button";
			button.tabIndex = -1;
			if (info.buttonClass) {
				button.classList.add(getSel(info.buttonClass));
			}
			if (info.path) {
				const image = document.createElement("img");
				image.src = chrome.runtime.getURL(info.path);
				button.appendChild(image);
			}
			if (info.label) {
				const text = document.createElement("div");
				text.tabIndex = -1;
				text.textContent = info.label;
				button.appendChild(text);
			}
			pad.appendChild(button);
			container.appendChild(pad);
			if (hideWhenInactive) {
				container.classList.add(getSel(ElementClass.DISABLED));
			}
			button.onclick = () => (info.onclick ?? (() => undefined))(container);
			if (info.setUp) {
				info.setUp(container);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(container);
		};

		return (terms: MatchTerms, barControlName: ControlButtonName, hideWhenInactive: boolean,
			controlsInfo: ControlsInfo) =>
			insertControlWithInfo(barControlName, ({
				disableTabResearch: {
					path: "/icons/close.svg",
					containerId: ElementID.BAR_OPTIONS,	
					onclick: () => chrome.runtime.sendMessage({
						disableTabResearch: true,
					} as BackgroundMessage),
				},
				performSearch: {
					path: "/icons/search.svg",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => chrome.runtime.sendMessage({
						performSearch: true,
					} as BackgroundMessage),
				},
				toggleHighlights: {
					path: "/icons/show.svg",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => chrome.runtime.sendMessage({
						toggleHighlightsOn: !controlsInfo.highlightsShown,
					} as BackgroundMessage),
				},
				appendTerm: {
					buttonClass: ElementClass.CONTROL_CONTENT,
					path: "/icons/create.svg",
					containerId: ElementID.BAR_CONTROLS,
					setUp: container => {
						const pad = container.querySelector(`.${getSel(ElementClass.CONTROL_PAD)}`) as HTMLElement;
						insertTermInput(terms, pad, TermChange.CREATE, input => pad.appendChild(input));
						updateTermControlMatchModeClassList(controlsInfo.matchMode, container.classList);
						const { optionList, controlReveal } = createTermOptionMenu(
							new MatchTerm("_", controlsInfo.matchMode),
							terms,
							controlsInfo,
							matchType => {
								const matchMode = getTermControlMatchModeFromClassList(container.classList);
								matchMode[matchType] = !matchMode[matchType];
								updateTermControlMatchModeClassList(matchMode, container.classList);
								Array.from(container.getElementsByClassName(getSel(ElementClass.OPTION))).forEach(option =>
									option.textContent = getTermOptionText(
										matchMode[getTermOptionMatchType(option.textContent as string)],
										option.textContent as string,
									),
								);
							},
						);
						pad.appendChild(controlReveal);
						container.appendChild(optionList);
					},
				},
				pinTerms: {
					buttonClass: ElementClass.PIN,
					path: "/icons/pin.svg",
					containerId: ElementID.BAR_CONTROLS,
					onclick: control => {
						control.remove();
						chrome.runtime.sendMessage({
							toggleAutoOverwritable: false,
						} as BackgroundMessage);
					},
				},
			} as Record<ControlButtonName, ControlButtonInfo>)[barControlName], hideWhenInactive)
		;
	})();

	return (terms: MatchTerms, controlsInfo: ControlsInfo, commands: BrowserCommands,
		highlightTags: HighlightTags, hues: TermHues) => {
		fillStylesheetContent(terms, hues);
		const bar = document.createElement("div");
		bar.id = getSel(ElementID.BAR);
		bar.ondragstart = event => event.preventDefault();
		bar.onmouseenter = () => {
			resetTermControlInputsVisibility();
			const controlInput = document.activeElement;
			if (controlInput && controlInput.tagName === "INPUT"
				&& controlInput.closest(`#${getSel(ElementID.BAR)}`)) {
				controlInput.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
			}
		};
		bar.onmouseleave = bar.onmouseenter;
		if (controlsInfo.highlightsShown) {
			bar.classList.add(getSel(ElementClass.HIGHLIGHTS_SHOWN));
		}
		const barOptions = document.createElement("span");
		barOptions.id = getSel(ElementID.BAR_OPTIONS);
		const barTerms = document.createElement("span");
		barTerms.id = getSel(ElementID.BAR_TERMS);
		const barControls = document.createElement("span");
		barControls.id = getSel(ElementID.BAR_CONTROLS);
		bar.appendChild(barOptions);
		bar.appendChild(barTerms);
		bar.appendChild(barControls);
		document.body.insertAdjacentElement("beforebegin", bar);
		Object.keys(controlsInfo.barControlsShown).forEach((barControlName: ControlButtonName) =>
			insertControl(terms, barControlName, !controlsInfo.barControlsShown[barControlName], controlsInfo));
		const termCommands = getTermCommands(commands);
		terms.forEach((term, i) => insertTermControl(terms, i, termCommands.down[i], termCommands.up[i],
			controlsInfo, highlightTags));
		const gutter = document.createElement("div");
		gutter.id = getSel(ElementID.MARKER_GUTTER);
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

/**
 * Empty the custom stylesheet, remove the control bar and marker gutter, and purge term focus class names.
 */
const removeControls = () => {
	const style = document.getElementById(getSel(ElementID.STYLE));
	if (!style || style.textContent === "") {
		return;
	}
	style.textContent = "";
	const stylePaint = document.getElementById(getSel(ElementID.STYLE_PAINT));
	if (!stylePaint) {
		return;
	}
	//stylePaint.textContent = "";
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar) {
		bar.remove();
	}
	if (gutter) {
		gutter.remove();
	}
	elementsPurgeClass(getSel(ElementClass.FOCUS_CONTAINER));
	elementsPurgeClass(getSel(ElementClass.FOCUS));
	elementsRemakeUnfocusable();
};

/**
 * Removes the visibility classes of all term control inputs, resetting their visibility.
 */
const resetTermControlInputsVisibility = () =>
	elementsPurgeClass(
		getSel(ElementClass.OVERRIDE_VISIBILITY),
		document.getElementById(getSel(ElementID.BAR)) as HTMLElement,
		"input",
		classList => !classList.contains(getSel(ElementClass.OVERRIDE_FOCUS)),
	)
;

/**
 * Gets the central y-position of the DOM rect of an element, relative to the document scroll container.
 * @param element An element
 * @returns The relative y-position.
 */
const getElementYRelative = (element: HTMLElement) =>
	(element.getBoundingClientRect().y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

/**
 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkers = (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) => {
	if (terms.length === 0) {
		return; // No terms results in an empty selector, which is not allowed.
	}
	terms = terms.slice(0, hues.length); // Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
	const containerBlockSelector = getContainerBlockSelector(highlightTags);
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
	const containersInfo: Array<{
		container: HTMLElement
		termsAdded: Set<string>
	}> = [];
	let markersHtml = "";
	document.body.querySelectorAll("[highlight]").forEach((element: HTMLElement) => {
		const container = getContainerBlock(element, highlightTags, containerBlockSelector);
		const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
		const yRelative = getElementYRelative(container);
		(JSON.parse(getComputedStyle(element).getPropertyValue("--mms-boxes").toString() || "[]") as Array<HighlightBox>)
			.map(box => box.selector)
			.filter(termSelector => terms.find(term => term.selector === termSelector))
			.forEach(termSelector => {
				let markerCss = `top: ${yRelative * 100}%;`;
				if (containerIdx !== -1) {
					if (containersInfo[containerIdx].container === container) {
						if (containersInfo[containerIdx].termsAdded.has(termSelector)) {
							return;
						} else {
							const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
							markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
							containersInfo[containerIdx].termsAdded.add(termSelector);
						}
					} else {
						containersInfo.splice(containerIdx);
						containersInfo.push({ container, termsAdded: new Set([ termSelector ]) });
					}
				} else {
					containersInfo.push({ container, termsAdded: new Set([ termSelector ]) });
				}
				markersHtml += `<div class="${
					getSel(ElementClass.TERM, termSelector)
				}" top="${yRelative}" style="${markerCss}"></div>`;
			});
	});
	gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
	gutter.innerHTML = markersHtml;
};

// TODO document
const getAncestorHighlightable = (node: Node) => {
	let ancestor = node.parentElement as HTMLElement;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const ancestorAboveAnchor = (ancestor as HTMLElement).closest("a")?.parentElement as HTMLElement;
		if (ancestorAboveAnchor) {
			ancestor = ancestorAboveAnchor;
		} else {
			break;
		}
	}
	return ancestor;
};

/**
 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
 * @param terms Terms to find, highlight, and mark.
 * @param root A node under which to find and highlight term occurrences.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators be regenerated.
 */
const highlightsGenerateForBranch = (() => {
	/**
	 * Highlights terms in a block of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 * @param nodes Consecutive text nodes to highlight inside.
	 */
	const highlightInBlock = (terms: MatchTerms, nodes: Array<Text>, elementsBoxesInfo: ElementsHighlightBoxesInfo) => {
		const textFlow = nodes.map(node => node.textContent).join("");
		for (const term of terms) {
			let i = 0;
			let node = nodes[0];
			let textStart = 0;
			let textEnd = node.length;
			const matches = textFlow.matchAll(term.pattern);
			for (const match of matches) {
				const highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					i++;
					node = nodes[i];
					textStart = textEnd;
					textEnd += node.length;
				}
				// eslint-disable-next-line no-constant-condition
				while (true) {
					const ancestor = getAncestorHighlightable(node);
					let boxesInfo = elementsBoxesInfo.get(ancestor);
					if (!boxesInfo) {
						boxesInfo = [];
						elementsBoxesInfo.set(ancestor, boxesInfo);
					}
					boxesInfo.push({
						term,
						node,
						start: highlightStart - textStart,
						end: Math.min(highlightEnd - textStart, node.length)
					});
					if (highlightEnd <= textEnd) {
						break;
					}
					i++;
					node = nodes[i];
					textStart = textEnd;
					textEnd += node.length;
				}
			}
		}
	};

	/**
	 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
	 * @param terms Terms to find and highlight.
	 * @param node A root node under which to match terms and insert highlights.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param nodes Consecutive text nodes to highlight inside.
	 */
	const insertHighlights = (
		terms: MatchTerms,
		node: Node,
		firstChildKey: "firstChild" | "lastChild",
		nextSiblingKey: "nextSibling" | "previousSibling",
		gatherOnlyToBreak: boolean,
		highlightTags: HighlightTags,
		nodes: Array<Text>,
		elementsBoxesInfo: ElementsHighlightBoxesInfo,
	) => {
		// TODO support for <iframe>?
		//console.log(gatherOnlyToBreak);
		do {
			if (node.nodeType === 3) {
				nodes.push(node as Text);
				//console.log(node);
			} else if ((node.nodeType === 1 || node.nodeType === 11)
				&& !highlightTags.reject.has((node as Element).tagName as TagName)
			) {
				//console.log("broken", node);
				const breaksFlow = !highlightTags.flow.has((node as Element).tagName as TagName);
				if (breaksFlow && (nodes.length || gatherOnlyToBreak)) {
					if (gatherOnlyToBreak) {
						return;
					}
					highlightInBlock(terms, nodes, elementsBoxesInfo);
					nodes.splice(0, nodes.length);
				}
				if (node[firstChildKey]) {
					insertHighlights(terms, node[firstChildKey] as ChildNode, firstChildKey, nextSiblingKey, gatherOnlyToBreak,
						highlightTags, nodes, elementsBoxesInfo);
					if (breaksFlow && nodes.length) {
						highlightInBlock(terms, nodes, elementsBoxesInfo);
						nodes.splice(0, nodes.length);
					}
				}
			}
			node = node[nextSiblingKey] as ChildNode; // May be null (checked by loop condition)
		} while (node);
	};

	return (terms: MatchTerms, root: Node,
		highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators,
		getNextHighlightClassName: GetNextHighlightClassName) => {
		const style = document.getElementById(getSel(ElementID.STYLE_PAINT)) as HTMLStyleElement;
		const range = document.createRange();
		const elementBoxesInfo: ElementsHighlightBoxesInfo = new Map;
		if (root.nodeType === Node.TEXT_NODE) {
			highlightInBlock(terms, [ root as Text ], elementBoxesInfo);
		} else if (root.firstChild) {
			const nodes: Array<Text> = [];
			//const breaksFlow = !highlightTags.flow.has((root as Element).tagName as TagName);
			let sibling = root.firstChild as Element;
			while ((sibling = sibling.parentElement as Element) && highlightTags.flow.has(sibling.tagName as TagName)) {
				insertHighlights(terms, sibling, "lastChild", "previousSibling", true, highlightTags, nodes, elementBoxesInfo);
			}
			nodes.reverse();
			insertHighlights(terms, root.firstChild as Node, "firstChild", "nextSibling", false, highlightTags, nodes, elementBoxesInfo);
			sibling = root.lastChild as Element;
			while ((sibling = sibling.parentElement as Element) && highlightTags.flow.has(sibling.tagName as TagName)) {
				insertHighlights(terms, sibling, "firstChild", "nextSibling", true, highlightTags, nodes, elementBoxesInfo);
			}
			if (nodes.length) {
				highlightInBlock(terms, nodes, elementBoxesInfo);
			}
		}
		const styleText = Array.from(elementBoxesInfo).map(([ element, boxesInfo ]) => {
			const highlightId = getNextHighlightClassName.next().value;
			let elementRects = Array.from(element.getClientRects());
			if (!elementRects.length) {
				elementRects = [ element.getBoundingClientRect() ];
			}
			const boxes = JSON.parse(
				getComputedStyle(element).getPropertyValue("--mms-boxes").toString() || "[]",
			) as Array<HighlightBox>;
			element.setAttribute("highlight", highlightId);
			return constructHighlightStyleRule(
				highlightId,
				boxes.filter(box => terms.every((term, i) =>
					box.selector !== getHighlightBackgroundStyle(i, term.hue, terms.length)
				)).concat(boxesInfo.map((boxInfo): HighlightBox => {
					range.setStart(boxInfo.node, boxInfo.start);
					range.setEnd(boxInfo.node, boxInfo.end);
					const textRects = Array.from(range.getClientRects());
					const textRectBounding = textRects[0] ?? range.getBoundingClientRect();
					let x = 0;
					let y = 0;
					for (const elementRect of elementRects) {
						if (elementRect.bottom > textRectBounding.top) {
							x += textRectBounding.x - elementRect.x;
							y = textRectBounding.y - elementRect.y;
							break;
						} else {
							x += elementRect.width;
						}
					}
					let textRectBottomLast = -1;
					let width = 0;
					for (const textRect of textRects) {
						if (textRect.top > textRectBottomLast) {
							textRectBottomLast = textRect.bottom;
							width += textRect.width;
						}
					}
					return {
						selector: boxInfo.term.selector,
						x,
						y,
						width: width || textRectBounding.width,
						height: textRectBounding.height,
					};
				})),
			);
		}).join("\n") + "\n";
		setTimeout(() => style.textContent += styleText);
		requestRefreshIndicators.next();
	};
})();

/**
 * Remove highlights for matches of terms.
 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const highlightsRemoveForBranch = (terms: MatchTerms = [], root: HTMLElement | DocumentFragment = document.body) => {
	const style = document.getElementById(getSel(ElementID.STYLE_PAINT));
	if (style) {
		const rules = (style.textContent as string).trimEnd().split("\n");
		for (const element of Array.from(root.querySelectorAll("[highlight]"))) {
			const highlightId = element.getAttribute("highlight") as string;
			const highlightIdSelector = `[highlight*=${highlightId}]`;
			const boxes = JSON.parse(
				getComputedStyle(element).getPropertyValue("--mms-boxes").toString() || "[]",
			) as Array<HighlightBox>;
			rules[rules.findIndex(rule => rule.includes(highlightIdSelector))] = terms.length ? constructHighlightStyleRule(
				highlightId,
				boxes.filter(box => terms.every(term => box.selector !== term.selector)),
			) : "";
		}
		style.textContent = rules.join("\n") + "\n";
	}
	if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
		root = (root as DocumentFragment).getRootNode() as HTMLElement;
		if (root.nodeType === Node.TEXT_NODE) {
			return;
		}
	}
	elementsPurgeClass(getSel(ElementClass.FOCUS_CONTAINER), root as HTMLElement);
	elementsPurgeClass(getSel(ElementClass.FOCUS), root as HTMLElement);
	elementsRemakeUnfocusable(root as HTMLElement);
};

// TODO document
const constructHighlightStyleRule = (highlightId: string, boxes: Array<HighlightBox>): string =>
	`body [highlight*=${highlightId}] { --mms-boxes: ${JSON.stringify(boxes)}; }`
;

/**
 * Remove all uses of a class name in elements under a root node in the DOM tree.
 * @param className A class name to purge.
 * @param root A root node under which to purge the class (non-inclusive).
 * @param selectorPrefix A prefix for the selector of elements to purge from. The base selector is the class name supplied.
 * @param predicate A function called for each element, the condition of which must be met in order to purge from that element.
 */
const elementsPurgeClass = (className: string, root: HTMLElement = document.body, selectorPrefix = "",
	predicate?: (classList: DOMTokenList) => boolean) =>
	root.querySelectorAll(`${selectorPrefix}.${className}`).forEach(predicate
		? element => predicate(element.classList) ? element.classList.remove(className) : undefined
		: element => element.classList.remove(className) // Predicate not called when not supplied, for efficiency (bulk purges)
	)
;

/**
 * Gets a mutation observer which listens to document changes and performs partial highlights where necessary.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators be regenerated.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param terms Terms to be continuously found and highlighted within the DOM.
 */
const getObserverNodeHighlighter = (() => {
	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param rejectSelector A selector string for ancestor tags to cause rejection.
	 * @param element An element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
		!element.closest(rejectSelector) && element.tagName !== "MMS-H"
	;

	return (requestRefreshIndicators: RequestRefreshIndicators, getNextHighlightClassName: GetNextHighlightClassName,
		highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				if ( mutation.target.parentElement && mutation.type === "characterData") {
					highlightsRemoveForBranch([], getAncestorHighlightable(mutation.target).parentElement as HTMLElement);
					highlightsGenerateForBranch(terms, mutation.target, highlightTags, requestRefreshIndicators,
						getNextHighlightClassName);
				}
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightElement(rejectSelector, node as Element)) {
						highlightsRemoveForBranch([], node as HTMLElement | DocumentFragment);
						highlightsGenerateForBranch(terms, node, highlightTags, requestRefreshIndicators,
							getNextHighlightClassName);
					}
				}
			}
			terms.forEach(term => updateTermOccurringStatus(term));
		});
	};
})();

/**
 * Starts a mutation observer for highlighting, listening for DOM mutations then selectively highlighting under affected nodes.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true,
	})
;

/**
 * Stops a mutation observer for highlighting, thus halting continuous highlighting.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const highlightInNodesOnMutationDisconnect = (observer: MutationObserver) =>
	observer.disconnect()
;

/**
 * Removes previous highlighting, then highlights the document using the terms supplied.
 * Disables then restarts continuous highlighting.
 * @param terms Terms to be continuously found and highlighted within the DOM.
 * @param termsToPurge Terms for which to remove previous highlights.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators be regenerated.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const beginHighlighting = (
	terms: MatchTerms, termsToPurge: MatchTerms,
	highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators, observer: MutationObserver,
	getNextHighlightClassName: GetNextHighlightClassName,
) => {
	highlightsRemoveForBranch(termsToPurge);
	highlightsGenerateForBranch(terms, document.body, highlightTags, requestRefreshIndicators,
		getNextHighlightClassName);
	terms.forEach(term => updateTermOccurringStatus(term));
	highlightInNodesOnMutation(observer);
};

/**
 * Extracts terms from the currently user-selected string.
 * @returns The extracted terms, split at some separator and some punctuation characters,
 * with some other punctuation characters removed.
 */
const getTermsFromSelection = () => {
	const selection = document.getSelection();
	const terms: MatchTerms = [];
	if (selection && selection.anchorNode) {
		const termsAll = selection.toString().split(/\r|\p{Zs}|\p{Po}|\p{Cc}/gu)
			// (carriage return) | Space Separators | Other Punctuation | Control
			.map(phrase => phrase.replace(/\p{Pc}|\p{Ps}|\p{Pe}|\p{Pi}|\p{Pf}/gu, ""))
			// Connector Punctuation | Open Punctuation | Close Punctuation | Initial Punctuation | Final Punctuation
			.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
		const termSelectors: Set<string> = new Set;
		termsAll.forEach(term => {
			if (!termSelectors.has(term.selector)) {
				termSelectors.add(term.selector);
				terms.push(term);
			}
		});
	}
	return terms;
};

(() => {
	/**
	 * Inserts the toolbar with term controls and begins continuously highlighting terms in the document.
	 * All controls necessary are first removed. Refreshes executed may be whole or partial according to requirements.
	 * @param terms Terms to highlight and display in the toolbar.
	 * @param controlsInfo Details of controls to insert.
	 * @param commands Browser commands to use in shortcut hints.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param hues Color hues for term styles to cycle through.
	 * @param observer An observer which selectively performs highlighting on observing changes.
	 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators be regenerated.
	 * @param termsUpdate An array of terms to which to update the existing terms, if change is necessary.
	 * @param termUpdate A new term to insert, a term to be removed, or a changed version of a term, if supplied.
	 * @param termToUpdateIdx The create term constant, the remove term constant, or the index of a term to update, if supplied.
	 * The argument type from these determines how the single term update is interpreted.
	 */
	const refreshTermControlsAndBeginHighlighting = (() => {
		/**
		 * Insert the toolbar and appropriate controls.
		 * @param terms Terms to highlight and display in the toolbar.
		 * @param controlsInfo Details of controls to insert.
		 * @param commands Browser commands to use in shortcut hints.
		 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
		 * @param hues Color hues for term styles to cycle through.
		 */
		const insertToolbar = (terms: MatchTerms, controlsInfo: ControlsInfo, commands: BrowserCommands,
			highlightTags: HighlightTags, hues: TermHues) => {
			const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
				&& document.activeElement.closest(`#${getSel(ElementID.BAR)}`);
			removeControls();
			insertControls(terms, controlsInfo, commands, highlightTags, hues);
			if (focusingControlAppend) {
				((getControl() as HTMLElement).querySelector("input") as HTMLInputElement).select();
			}
		};
	
		return (terms: MatchTerms,
			controlsInfo: ControlsInfo, commands: BrowserCommands,
			highlightTags: HighlightTags, hues: TermHues,
			observer: MutationObserver, requestRefreshIndicators: RequestRefreshIndicators,
			getNextHighlightClassName: GetNextHighlightClassName,
			termsUpdate?: MatchTerms, termUpdate?: MatchTerm,
			termToUpdateIdx?: TermChange.CREATE | TermChange.REMOVE | number,
		) => {
			const termsToHighlight: MatchTerms = [];
			const termsToPurge: MatchTerms = [];
			if (termsUpdate !== undefined && termToUpdateIdx !== undefined
				&& termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				if (termToUpdateIdx === TermChange.CREATE) {
					terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
					const termCommands = getTermCommands(commands);
					const idx = terms.length - 1;
					insertTermControl(terms, idx, termCommands.down[idx], termCommands.up[idx], controlsInfo, highlightTags);
					termsToHighlight.push(terms[idx]);
					termsToPurge.push(terms[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					termsToPurge.push(Object.assign({}, term));
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx, highlightTags);
					termsToHighlight.push(term);
				}
			} else if (termsUpdate !== undefined) {
				if (termToUpdateIdx === TermChange.REMOVE && termUpdate) {
					const termRemovedPreviousIdx = terms.findIndex(term => JSON.stringify(term) === JSON.stringify(termUpdate));
					if (assert(
						termRemovedPreviousIdx !== -1, "term not deleted", "not stored in this page", { term: termUpdate }
					)) {
						removeTermControl(termRemovedPreviousIdx);
						terms.splice(termRemovedPreviousIdx, 1);
						highlightsRemoveForBranch([ termUpdate ]);
						fillStylesheetContent(terms, hues);
						requestRefreshIndicators.next();
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
					insertToolbar(terms, controlsInfo, commands, highlightTags, hues);
				}
			} else {
				return;
			}
			fillStylesheetContent(terms, hues);
			beginHighlighting(
				termsToHighlight.length ? termsToHighlight : terms, termsToPurge,
				highlightTags, requestRefreshIndicators, observer,
				getNextHighlightClassName,
			);
		};
	})();

	/**
	 * Inserts a uniquely identified CSS stylesheet to perform all extension styling.
	 */
	const insertStyleElements = () => {
		if (!document.getElementById(getSel(ElementID.STYLE))) {
			const style = document.createElement("style");
			style.id = getSel(ElementID.STYLE);
			document.head.appendChild(style);
		}
		if (!document.getElementById(getSel(ElementID.STYLE_PAINT))) {
			const style = document.createElement("style");
			style.id = getSel(ElementID.STYLE_PAINT);
			document.head.appendChild(style);
		}
	};

	/**
	 * Returns a generator function to consume empty requests for reinserting term scrollbar markers.
	 * Request fulfillment may be variably delayed based on activity.
	 * @param terms Terms being highlighted and marked.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param hues Color hues for term styles to cycle through.
	 */
	const requestRefreshIndicatorsFn = function* (terms: MatchTerms,
		highlightTags: HighlightTags, hues: TermHues): RequestRefreshIndicators {
		const requestWaitDuration = 1000;
		const reschedulingDelayMax = 5000;
		const reschedulingRequestCountMargin = 1;
		let timeRequestAcceptedLast = 0;
		let requestCount = 0;
		const scheduleRefresh = () =>
			setTimeout(() => {
				const dateMs = Date.now();
				if (requestCount > reschedulingRequestCountMargin
					&& dateMs < timeRequestAcceptedLast + reschedulingDelayMax) {
					requestCount = 0;
					scheduleRefresh();
					return;
				}
				requestCount = 0;
				insertScrollMarkers(terms, highlightTags, hues);
				terms.forEach(term => updateTermTooltip(term));
			}, requestWaitDuration + 50); // Arbitrary small amount added to account for lag (preventing lost updates).
		while (true) {
			requestCount++;
			const dateMs = Date.now();
			if (dateMs > timeRequestAcceptedLast + requestWaitDuration) {
				timeRequestAcceptedLast = dateMs;
				scheduleRefresh();
			}
			yield;
		}
	};

	/**
	 * Returns a generator function to consume individual command objects and produce their desired effect.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param terms Terms being controlled, highlighted, and jumped to.
	 */
	const produceEffectOnCommandFn = function* (terms: MatchTerms,
		highlightTags: HighlightTags): ProduceEffectOnCommand {
		let selectModeFocus = false;
		let focusedIdx = 0;
		while (true) {
			const commandInfo: CommandInfo = yield;
			if (!commandInfo) {
				continue; // Requires an initial empty call before working (TODO solve this issue).
			}
			const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
			focusedIdx = getFocusedIdx(focusedIdx);
			switch (commandInfo.type) {
			case CommandType.TOGGLE_BAR: {
				const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
				bar.classList.toggle(getSel(ElementClass.BAR_HIDDEN));
				break;
			} case CommandType.TOGGLE_SELECT: {
				selectModeFocus = !selectModeFocus;
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				if (selectModeFocus) {
					jumpToTerm(highlightTags, commandInfo.reversed ?? false, terms[focusedIdx]);
				} else {
					jumpToTerm(highlightTags, commandInfo.reversed ?? false);
				}
				break;
			} case CommandType.FOCUS_TERM_INPUT: {
				const control = getControl(undefined, commandInfo.termIdx);
				const input = control ? control.querySelector("input") : null;
				if (!control || !input) {
					break;
				}
				const selection = getSelection();
				const focusReturnElement = document.activeElement;
				const selectionReturnRanges = selection
					? Array(selection.rangeCount).fill(null).map((v, i) => selection.getRangeAt(i))
					: null;
				control.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
				input.select();
				control.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
				selectInputTextAll(input);
				const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
				const returnSelection = (event: FocusEvent) => {
					if (event.relatedTarget) {
						setTimeout(() => {
							if (!document.activeElement || !document.activeElement.closest(`#${getSel(ElementID.BAR)}`)) {
								bar.removeEventListener("focusout", returnSelection);
							}
						});
						return; // Focus is being moved, not lost.
					}
					if (document.activeElement && document.activeElement.closest(`#${getSel(ElementID.BAR)}`)) {
						return;
					}
					bar.removeEventListener("focusout", returnSelection);
					if (focusReturnElement && focusReturnElement["focus"]) {
						(focusReturnElement as HTMLElement).focus({ preventScroll: true });
					}
					if (selection && selectionReturnRanges !== null) {
						selection.removeAllRanges();
						selectionReturnRanges.forEach(range => selection.addRange(range));
					}
				};
				bar.addEventListener("focusout", returnSelection);
				break;
			} case CommandType.SELECT_TERM: {
				const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
				barTerms.classList.remove(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				barTerms.classList.add(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				if (!selectModeFocus) {
					jumpToTerm(highlightTags, commandInfo.reversed as boolean, terms[focusedIdx]);
				}
				break;
			}}
		}
	};

	const getNextHighlightClassNameFn = function* (): GetNextHighlightClassName {
		let i = 0;
		while (true) {
			//yield getSel(ElementClass.TERM, i.toString());
			yield "b" + (i++).toString().padStart(8, "0");
		}
	};

	/**
	 * Gets a set of highlight tags in all forms reasonably required.
	 * @param tagsLower An array of tag names in their lowercase form.
	 * @returns The corresponding set of tag names in all forms necessary.
	 */
	const getHighlightTagsSet = (tagsLower: Array<HTMLElementTagName>) =>
		new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ])) as ReadonlySet<TagName>
	;

	return () => {
		window[WindowFlag.EXECUTION_UNNECESSARY] = true;
		CSS["paintWorklet"].addModule(chrome.runtime.getURL("/dist/draw-highlights.js"));
		const commands: BrowserCommands = [];
		const terms: MatchTerms = [];
		const hues: TermHues = [];
		const controlsInfo: ControlsInfo = {
			highlightsShown: false,
			barControlsShown: {
				disableTabResearch: true,
				performSearch: false,
				toggleHighlights: true,
				appendTerm: true,
				pinTerms: true,
			},
			barLook: {
				showEditIcon: true,
				showRevealIcon: true,
			},
			matchMode: {
				regex: false,
				case: false,
				stem: false,
				whole: false,
				diacritics: false,
			},
		};
		const highlightTags: HighlightTags = {
			reject: getHighlightTagsSet([ "meta", "style", "script", "noscript", "title" ]),
			flow: getHighlightTagsSet([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as HTMLElementTagName ]),
			// break: any other class of element
		};
		const requestRefreshIndicators = requestRefreshIndicatorsFn(terms, highlightTags, hues);
		const produceEffectOnCommand = produceEffectOnCommandFn(terms, highlightTags);
		const getNextHighlightClassName = getNextHighlightClassNameFn();
		const observer = getObserverNodeHighlighter(requestRefreshIndicators, getNextHighlightClassName,
			highlightTags, terms);
		produceEffectOnCommand.next(); // Requires an initial empty call before working (TODO otherwise mitigate).
		insertStyleElements();
		chrome.runtime.onMessage.addListener((message: HighlightMessage, sender,
			sendResponse: (response: HighlightDetails) => void) => {
			if (message.getDetails) {
				const details: HighlightDetails = {};
				if (message.getDetails.termsFromSelection) {
					details.terms = getTermsFromSelection();
				}
				if (message.getDetails.highlightsShown) {
					details.highlightsShown = controlsInfo.highlightsShown;
				}
				sendResponse(details);
			}
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			Object.entries(message.barControlsShown ?? {}).forEach(([ key, value ]) => {
				if (key !== "pinTerms") {
					controlsInfo.barControlsShown[key] = value;
				}
			});
			if (message.autoOverwritable !== undefined) {
				controlsInfo.barControlsShown.pinTerms = message.autoOverwritable;
			}
			Object.entries(message.barLook ?? {}).forEach(([ key, value ]) => {
				controlsInfo.barLook[key] = value;
			});
			if (message.highlightLook) {
				hues.splice(0);
				message.highlightLook.hues.forEach(hue => hues.push(hue));
			}
			if (message.matchMode) {
				Object.assign(controlsInfo.matchMode, message.matchMode);
			}
			if (message.toggleHighlightsOn !== undefined) {
				controlsInfo.highlightsShown = message.toggleHighlightsOn;
			}
			if (message.deactivate) {
				highlightInNodesOnMutationDisconnect(observer);
				terms.splice(0);
				removeControls();
				highlightsRemoveForBranch();
			}
			if (message.termUpdate
				|| (message.terms !== undefined && (
					!itemsMatch(terms, message.terms, (a, b) => a.phrase === b.phrase)
					|| (!terms.length && !document.getElementById(ElementID.BAR))
				))
			) {
				refreshTermControlsAndBeginHighlighting(
					terms, //
					controlsInfo, commands, //
					highlightTags, hues, //
					observer, requestRefreshIndicators, //
					getNextHighlightClassName, //
					message.terms, message.termUpdate, message.termToUpdateIdx, //
				);
			}
			if (message.command) {
				produceEffectOnCommand.next(message.command);
			}
			const bar = document.getElementById(getSel(ElementID.BAR));
			if (bar) {
				bar.classList[controlsInfo.highlightsShown ? "add" : "remove"](getSel(ElementClass.HIGHLIGHTS_SHOWN));
			}
			const pinSelector = `.${getSel(ElementClass.PIN)}`;
			if (!controlsInfo.barControlsShown.pinTerms
				&& document.querySelector(pinSelector)) {
				(document.querySelector(pinSelector) as HTMLElement).remove();
			}
			sendResponse({}); // Mitigates manifest V3 bug which otherwise logs an error message.
		});
	};
})()();
