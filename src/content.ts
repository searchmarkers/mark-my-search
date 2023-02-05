type BrowserCommands = Array<chrome.commands.Command>
type HighlightTags = {
	reject: ReadonlySet<string>,
	flow: ReadonlySet<string>,
}
type TermHues = Array<number>
type ControlButtonName = keyof StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
type ControlButtonInfo = {
	controlClasses?: Array<ElementClass>
	buttonClass?: ElementClass
	path?: string
	label?: string
	containerId: ElementID
	onClick?: () => void
	setUp?: (container: HTMLElement) => void
}
type ElementInfo = {
	id: string
	styleRuleIdx: number
	isPaintable: boolean
	flows: Array<HighlightFlow>
}
type TermSelectorStyles = Record<string, TermStyle>
type TermCountCheck = () => void
type ProduceEffectOnCommand = Generator<undefined, never, CommandInfo>
type GetHighlightingID = Generator<string, never, unknown>
type KeepStyleUpdated = (element: Element) => void

enum AtRuleID {
	FLASH = "flash",
	MARKER_ON = "marker-on",
	MARKER_OFF = "marker-off",
}

enum ElementProperty {
	INFO = "markmysearchCache",
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
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	DISABLED = "disabled",
	COLLAPSED = "collapsed",
	UNCOLLAPSIBLE = "uncollapsible",
	MATCH_REGEX = "match-regex",
	MATCH_CASE = "match-case",
	MATCH_STEM = "match-stem",
	MATCH_WHOLE = "match-whole",
	MATCH_DIACRITICS = "match-diacritics",
	PRIMARY = "primary",
	SECONDARY = "secondary",
	OVERRIDE_VISIBILITY = "override-visibility",
	OVERRIDE_FOCUS = "override-focus",
	BAR_CONTROLS = "bar-controls",
}

enum ElementID {
	STYLE = "style",
	STYLE_PAINT = "style-paint",
	BAR = "bar",
	BAR_LEFT = "bar-left",
	BAR_TERMS = "bar-terms",
	BAR_RIGHT = "bar-right",
	MARKER_GUTTER = "markers",
	DRAW_CONTAINER = "draw-container",
	DRAW_ELEMENT = "draw",
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface ControlsInfo {
	paintReplaceByClassic: boolean
	pageModifyEnabled: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: MatchTerms
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
	matchMode: MatchMode
}

interface HighlightFlow {
	text: string
	nodeStart: Text
	nodeEnd: Text
	boxesInfo: Array<HighlightBoxInfo>
}

interface HighlightBoxInfo {
	term: MatchTerm
	node: Text
	start: number
	end: number
	boxes: Array<HighlightBox>
}

interface HighlightBox {
	selector: string
	x: number
	y: number
	width: number
	height: number
}

interface HighlightStyleRuleInfo {
	rule: string
	element: Element
}

interface TermStyle {
	hue: number
	cycle: number
}

/**
 * Whether the experimental `element()` CSS function should be used over the preferred `paint()` function (Painting API).
 * Painting is faster and simpler to implement, but is not supported by Firefox or Safari as of 2022-12-01.
 * Element backgrounds can be expensive but are hugely versatile for relatively low cost, and are supported only by Firefox.
 * This applies to the PAINT algorithm only, with no bearing on CLASSIC.
 */
const paintUsePaintingFallback = !CSS["paintWorklet"]?.addModule;
/**
 * Whether experimental browser technologies (namely paint/element) should be used over SVG rendering
 * when using the PAINT algorithm.
 */
const paintUseExperimental = window[WindowVariable.CONFIG_HARD].paintUseExperimental;

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
const fillStylesheetContent = (terms: MatchTerms, hues: TermHues, controlsInfo: ControlsInfo) => {
	const style = document.getElementById(getSel(ElementID.STYLE)) as HTMLStyleElement;
	const zIndexMin = -(2**31);
	const zIndexMax = 2**31 - 1;
	const makeImportant = (styleText: string): string =>
		styleText.replace(/;/g, " !important;"); // Prevent websites from overriding rules with !important;
	style.textContent = makeImportant(`
/* || Term Buttons and Input */
#${getSel(ElementID.BAR)} ::selection
	{ background: Highlight; color: HighlightText; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROLS)} .${getSel(ElementClass.CONTROL)} input
	{ width: 5em; padding: 0 2px 0 2px; margin-left: 4px; border: none; outline: revert;
	box-sizing: unset; font-family: revert; white-space: pre; color: hsl(0 0% 0%); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled *,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)}),
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROLS)} .${getSel(ElementClass.CONTROL)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROLS)} .${getSel(ElementClass.CONTROL)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
	{ width: 0; padding: 0; margin: 0; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_REVEAL)} img
	{ width: 0.5em; }
#${getSel(ElementID.BAR)}
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: none; }
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: block; }
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_FOCUS)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)}
	{ display: none; }
/**/

/* || Term Matching Option Hints */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_REGEX)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ font-weight: bold; }
#${getSel(ElementID.BAR_RIGHT)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_REGEX)}
.${getSel(ElementClass.CONTROL_CONTENT)}::before
	{ content: "(.*)"; margin-right: 2px; font-weight: bold; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_RIGHT)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-top: 0; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)}, .${getSel(ElementClass.MATCH_REGEX)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; text-decoration-skip-ink: none; }
#${getSel(ElementID.BAR_RIGHT)}
.${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ border-bottom: 3px solid hsl(0 0% 38%); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_RIGHT)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 2px; border-inline: 2px solid hsl(0 0% 0% / 0.4); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_DIACRITICS)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ font-style: italic; }
#${getSel(ElementID.BAR_RIGHT)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_DIACRITICS)}
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ border-left: 3px dashed black; }
/**/

/* || Bar */
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; top: 0; left: 0; z-index: ${zIndexMax};
	color-scheme: light; font-size: ${controlsInfo.barLook.fontSize}; line-height: initial; user-select: none; pointer-events: none; }
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
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL)}
	{ display: inline-block; vertical-align: top; margin-left: 0.5em; pointer-events: auto; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.COLLAPSED)} > * > *:not(.${getSel(ElementClass.UNCOLLAPSIBLE)})
	{ display: none; }
/**/

/* || Term Pulldown */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:is(:focus, :active),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}.${getSel(ElementClass.OVERRIDE_VISIBILITY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover)
+ .${getSel(ElementClass.OPTION_LIST)}
	{ display: flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:focus .${getSel(ElementClass.OPTION)}::first-letter
	{ text-decoration: underline; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ display: none; position: absolute; flex-direction: column; padding: 0; width: max-content; margin: 0 0 0 4px;
	z-index: 1; font-size: max(14px, 0.8em); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ display: block; padding-block: 2px; background: hsl(0 0% 94% / 0.76);
	color: hsl(0 0% 6%); filter: grayscale(100%); width: 100%; text-align: left;
	border-width: 2px; border-color: hsl(0 0% 40% / 0.7); border-left-style: solid; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0 0% 100%); }
/**/

/* || Bar Controls */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}
	{ white-space: pre; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ display: flex; height: 1.3em; background: hsl(0 0% 90% / ${controlsInfo.barLook.opacityControl}); color: hsl(0 0% 0%);
	border-style: none; border-radius: ${controlsInfo.barLook.borderRadius}; box-shadow: 1px 1px 5px; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.DISABLED)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(0 0% 90% / min(${controlsInfo.barLook.opacityControl}, 0.4)); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:hover
	{ background: hsl(0 0% 65%); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:active
	{ background: hsl(0 0% 50%); }
#${getSel(ElementID.BAR)} > :not(#${getSel(ElementID.BAR_TERMS)})
> .${getSel(ElementClass.DISABLED)}:not(:focus-within, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
	{ display: none; }
#${getSel(ElementID.BAR)}:not(.${getSel(ElementClass.DISABLED)}) #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ display: flex; background: hsl(0 0% 80% / min(${controlsInfo.barLook.opacityTerm}, 0.6)); }
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
${
	controlsInfo.paintReplaceByClassic
		? `
mms-h
	{ font: inherit; }
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(AtRuleID.FLASH)} 1s; }`
		: ""
}
/**/
	`) + `
${
	controlsInfo.paintReplaceByClassic || !paintUseExperimental
		? ""
		: paintUsePaintingFallback
			? `
#${getSel(ElementID.DRAW_CONTAINER)}
	{ position: fixed; width: 100%; height: 100%; z-index: ${zIndexMin}; }
#${getSel(ElementID.DRAW_CONTAINER)} > *
	{ position: fixed; width: 100%; height: 100%; }`
			: `/* || Term Highlight */
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body [markmysearch-h_id] [markmysearch-h_beneath]
	{ background-color: transparent; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)} ~ body [markmysearch-h_id]
	{ background-image: paint(markmysearch-highlights) !important; --markmysearch-styles: ${JSON.stringify((() => {
		const styles: TermSelectorStyles = {};
		terms.forEach((term, i) => {
			styles[term.selector] = {
				hue: hues[i % hues.length],
				cycle: Math.floor(i / hues.length),
			};
		});
		return styles;
	})())}; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body [markmysearch-h_id] > :not([markmysearch-h_id])
	{ --markmysearch-styles: unset; --markmysearch-boxes: unset; }
/**/`
}

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
		const cycle = Math.floor(i / hues.length);
		const isAboveStyleLevel = (level: number) => cycle >= level;
		const getBackgroundStylePaint = (colorA: string, colorB: string) => isAboveStyleLevel(1)
			? `linear-gradient(${Array(Math.floor(cycle/2 + 1.5) * 2).fill("").map((v, i) =>
				(Math.floor(i / 2) % 2 == cycle % 2 ? colorB : colorA) + `${Math.floor((i + 1) / 2)/(Math.floor((cycle + 1) / 2) + 1) * 100}%`
			)})`
			: colorA;
		const getBackgroundStyleClassic = (colorA: string, colorB: string) =>
			isAboveStyleLevel(1)
				? `repeating-linear-gradient(${
					isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
				}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
				: colorA;
		const getBackgroundStyle = controlsInfo.paintReplaceByClassic ? getBackgroundStyleClassic : getBackgroundStylePaint;
		term.hue = hue;
		style.textContent += makeImportant(`
/* || Term Highlights */
${controlsInfo.paintReplaceByClassic
		? `
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
#${getSel(ElementID.BAR)}
~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`)};
	border-radius: 2px; box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35); }`
		: paintUsePaintingFallback
			? `
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ #${getSel(ElementID.DRAW_CONTAINER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`)}; }`
			: ""
}
/**/

/* || Term Scroll Markers */
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue} 100% 44%); }
/**/

/* || Term Control Buttons */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(
		`hsl(${hue} 70% 70% / ${controlsInfo.barLook.opacityTerm})`,
		`hsl(${hue} 70% 88% / ${controlsInfo.barLook.opacityTerm})`,
	)}; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.DISABLED)}
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(
		`hsl(${hue} 70% 70% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
		`hsl(${hue} 70% 88% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
	)}; }
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

/**
 * Determines heuristically whether or not an element is visible. The element need not be currently scrolled into view.
 * @param element An element.
 * @returns `true` if visible, `false` otherwise.
 */
const isVisible = (element: HTMLElement) => // TODO improve correctness
	(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
	&& getComputedStyle(element).visibility !== "hidden"
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
 * Gets the node at the end of an element, in layout terms; aka. the last item of a pre-order depth-first search traversal.
 * @param node A container node.
 * @returns The final node of the container.
 */
const getNodeFinal = (node: Node): Node =>
	node.lastChild ? getNodeFinal(node.lastChild) : node
;

/*
TERM FOCUSING
Methods for or used in jumping or stepping to term occurrences in the document, or for cleaning up resulting changes.
*/

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const focusOnScrollMarkerPaint = (term: MatchTerm | undefined, container: HTMLElement) => {
	// Depends on scroll markers refreshed Paint implementation (TODO)
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const focusOnScrollMarker = (term: MatchTerm | undefined, container: HTMLElement, controlsInfo: ControlsInfo) =>
	focusOnScrollMarkerClassic(term, container)
;

/**
 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
 */
const focusOnTermPaint = (() => {
	const focusClosest = (element: HTMLElement, filter: (element: HTMLElement) => boolean) => {
		element.focus({ preventScroll: true });
		if (document.activeElement !== element) {
			if (filter(element)) {
				focusClosest(element.parentElement as HTMLElement, filter);
			} else if (document.activeElement) {
				(document.activeElement as HTMLElement).blur();
			}
		}
	};

	return (stepNotJump: boolean, controlsInfo: ControlsInfo, reverse: boolean, term?: MatchTerm, nodeStart?: Node) => {
		elementsPurgeClass(getSel(ElementClass.FOCUS_CONTAINER));
		const selection = document.getSelection() as Selection;
		const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = selection ? selection.anchorNode : null;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart
			?? (nodeFocused
				? (nodeSelected ? (nodeFocused.contains(nodeSelected) ? nodeSelected : nodeFocused) : nodeFocused)
				: nodeSelected ?? nodeBegin
			);
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element[ElementProperty.INFO] as ElementInfo | undefined)?.flows.some(flow =>
				term ? flow.boxesInfo.some(boxInfo => boxInfo.term.selector === term.selector) : flow.boxesInfo.length
			) && isVisible(element)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				focusOnTermPaint(stepNotJump, controlsInfo, reverse, term, nodeBegin);
			}
			return;
		}
		if (!stepNotJump) {
			element.classList.add(getSel(ElementClass.FOCUS_CONTAINER));
		}
		focusClosest(element, element =>
			element[ElementProperty.INFO] && !!(element[ElementProperty.INFO] as ElementInfo).flows
		);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		focusOnScrollMarker(term, element, controlsInfo);
	};
})();

const focusOnTermJump = (controlsInfo: ControlsInfo, highlightTags: HighlightTags, reverse: boolean,
	term: MatchTerm | undefined) =>
	controlsInfo.paintReplaceByClassic
		? focusOnTermJumpClassic(controlsInfo, highlightTags, reverse, term)
		: focusOnTermPaint(false, controlsInfo, reverse, term)
;

const focusOnTermStep = (controlsInfo: ControlsInfo, highlightTags: HighlightTags, reverse: boolean) =>
	controlsInfo.paintReplaceByClassic
		? focusOnTermStepClassic(controlsInfo, highlightTags, reverse)
		: focusOnTermPaint(true, controlsInfo, reverse)
;

/*
USER INTERFACE
Methods for inserting, updating, or removing parts of the user interface.
*/

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
		input.focus();
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
			messageSendBackground({
				terms: terms.slice(0, idx).concat(terms.slice(idx + 1)),
				termChanged: term,
				termChangedIdx: TermChange.REMOVE,
			});
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			messageSendBackground({
				terms: terms.map((term, i) => i === idx ? termChanged : term),
				termChanged,
				termChangedIdx: idx,
			});
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue, getTermControlMatchModeFromClassList(control.classList), {
				allowStemOverride: true,
			});
			messageSendBackground({
				terms: terms.concat(termChanged),
				termChanged,
				termChangedIdx: TermChange.CREATE,
			});
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
		// Inputs should not be focusable unless user has already focused bar. (0)
		if (!document.activeElement || !document.activeElement.closest(`#${getSel(ElementID.BAR)}`)) {
			input.tabIndex = -1;
		}
		const resetInput = (termText = controlContent.textContent as string) => {
			input.value = replaces ? termText : "";
		};
		input.addEventListener("focusin", () => {
			if (input.classList.contains(getSel(ElementClass.OVERRIDE_FOCUS))) {
				return; // Focus has been delegated to another element and will be on the input when this class is removed
			}
			resetInput();
			termControlInputsVisibilityReset();
			input.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
		});
		input.addEventListener("focusout", () => {
			if (!input.classList.contains(getSel(ElementClass.OVERRIDE_FOCUS))) {
				// Focus has been lost, not delegated to another element
				commit(term, terms);
			}
		});
		input.addEventListener("keyup", event => {
			// First focus of an input does not allow immediate full-text selection.
			if (event.key === "Tab") { // Simulate (delegated) if Tab was used to reach the input.
				selectInputTextAll(input);
			}
		});
		const show = (event: MouseEvent) => {
			event.preventDefault();
			input.focus();
			input.select();
			selectInputTextAll(input);
		};
		const hide = () => {
			input.blur();
		};
		if (controlEdit) {
			controlEdit.addEventListener("click", event => {
				if (!input.classList.contains(getSel(ElementClass.OVERRIDE_VISIBILITY)) || getComputedStyle(input).width === "0") {
					show(event);
				} else {
					input.value = "";
					commit(term, terms);
					hide();
				}
			});
			controlEdit.addEventListener("contextmenu", event => {
				event.preventDefault();
				input.value = "";
				commit(term, terms);
				hide();
			});
			controlContent.addEventListener("contextmenu", show);
		} else if (!replaces) {
			const button = controlPad.querySelector("button") as HTMLButtonElement;
			button.addEventListener("click", show);
			button.addEventListener("contextmenu", show);
		}
		(new ResizeObserver(entries =>
			entries.forEach(entry => entry.contentRect.width === 0 ? hide() : undefined)
		)).observe(input);
		input.addEventListener("keydown", event => {
			switch (event.key) {
			case "Enter": {
				if (event.shiftKey) {
					hide();
					termControlInputsVisibilityReset();
				} else {
					commit(term, terms);
					resetInput(input.value);
				}
				return;
			}
			case "Escape": {
				resetInput();
				hide();
				termControlInputsVisibilityReset();
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
		});
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
			: Array.from(barTerms.children)[idx ?? (barTerms.childElementCount - 1)] ?? null
	);
};

/**
 * Gets the control for appending a new term.
 * @returns The control if present, `null` otherwise.
 */
const getControlAppendTerm = (): Element | null =>
	(document.getElementById(getSel(ElementID.BAR_RIGHT)) as HTMLElement).firstElementChild
;

/**
 * Selects all of the text in an input. Does not affect focus.
 * Mainly a helper for mitigating a Chromium bug which causes `select()` for an input's initial focus to not select all text.
 * @param input An input element to select the text of.
 */
const selectInputTextAll = (input: HTMLInputElement) =>
	input.setSelectionRange(0, input.value.length)
;

const getHighlightFlows = (element: Element): Array<HighlightFlow> =>
	(element[ElementProperty.INFO] as ElementInfo).flows.concat((() => {
		let flows: Array<HighlightFlow> = [];
		for (let i = 0; i < element.children.length; i++) {
			if ((element.children.item(i) as Element)[ElementProperty.INFO]) {
				flows = flows.concat(getHighlightFlows((element.children.item(i) as Element)).flat());
			}
		}
		return flows;
	})())
;

/**
 * Gets the number of matches for a term in the document.
 * @param term A term to get the occurrence count for.
 * @returns The occurrence count for the term.
 */
const getTermOccurrenceCount = (term: MatchTerm, controlsInfo: ControlsInfo): number => controlsInfo.paintReplaceByClassic
	? (() => { // Increasingly inaccurate as highlights elements are more often split.
		const occurrences = Array.from(document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)));
		const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		return matches ? matches.length : 0;
	})()
	: getHighlightFlows(document.body)
		.map(flow => flow.boxesInfo.filter(boxInfo => boxInfo.term.selector === term.selector).length)
		.reduce((a, b) => a + b, 0)
;

/**
 * Updates the look of a term control to reflect whether or not it occurs within the document.
 * @param term A term to update the term control status for.
 */
const updateTermOccurringStatus = (term: MatchTerm, controlsInfo: ControlsInfo) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	controlPad.classList.toggle(getSel(ElementClass.DISABLED), !getTermOccurrenceCount(term, controlsInfo));
};

/**
 * Updates the tooltip of a term control to reflect current highlighting or extension information as appropriate.
 * @param term A term to update the tooltip for.
 */
const updateTermTooltip = (term: MatchTerm, controlsInfo: ControlsInfo) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	const controlContent = controlPad
		.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	const occurrenceCount = getTermOccurrenceCount(term, controlsInfo);
	controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !term.command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${term.command} or ${term.commandReverse}`
				: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
	}`;
};

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
	classList.toggle(getSel(ElementClass.MATCH_REGEX), mode.regex);
	classList.toggle(getSel(ElementClass.MATCH_CASE), mode.case);
	classList.toggle(getSel(ElementClass.MATCH_STEM), mode.stem);
	classList.toggle(getSel(ElementClass.MATCH_WHOLE), mode.whole);
	classList.toggle(getSel(ElementClass.MATCH_DIACRITICS), mode.diacritics);
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
const refreshTermControl = (term: MatchTerm, idx: number, highlightTags: HighlightTags, controlsInfo: ControlsInfo) => {
	const control = getControl(undefined, idx) as HTMLElement;
	control.className = "";
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	controlContent.onclick = () => // Overrides previous event handler in case of new term.
		focusOnTermJump(controlsInfo, highlightTags, false, term);
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
	option.addEventListener("mouseup", () => {
		if (!option.matches(":active")) {
			onActivated(matchType);
		}
	});
	option.addEventListener("click", () => onActivated(matchType));
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
		messageSendBackground({
			terms: terms.map(termCurrent => termCurrent === term ? termUpdate : termCurrent),
			termChanged: termUpdate,
			termChangedIdx: getTermIdxFromArray(term, terms),
		});
	},
): { optionList: HTMLElement, controlReveal: HTMLButtonElement } => {
	const termIsValid = terms.includes(term); // If virtual and used for appending terms, this will be `false`.
	const optionList = document.createElement("span");
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
	optionList.addEventListener("keydown", event => handleKeyEvent(event, false));
	optionList.addEventListener("keyup", event => handleKeyEvent(event));
	const controlReveal = document.createElement("button");
	controlReveal.type = "button";
	controlReveal.classList.add(getSel(ElementClass.CONTROL_BUTTON));
	controlReveal.classList.add(getSel(ElementClass.CONTROL_REVEAL));
	controlReveal.tabIndex = -1;
	controlReveal.disabled = !controlsInfo.barLook.showRevealIcon;
	controlReveal.addEventListener("click", () => {
		const input = controlReveal.parentElement ? controlReveal.parentElement.querySelector("input") : null;
		const willFocusInput = input ? input.getBoundingClientRect().width > 0 : false;
		termControlInputsVisibilityReset();
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
	const term = terms[idx >= 0 ? idx : (terms.length + idx)] as MatchTerm;
	const { optionList, controlReveal } = createTermOptionMenu(term, terms, controlsInfo);
	const controlPad = document.createElement("span");
	controlPad.classList.add(getSel(ElementClass.CONTROL_PAD));
	controlPad.classList.add(getSel(ElementClass.DISABLED));
	controlPad.appendChild(controlReveal);
	const controlContent = document.createElement("button");
	controlContent.type = "button";
	controlContent.classList.add(getSel(ElementClass.CONTROL_BUTTON));
	controlContent.classList.add(getSel(ElementClass.CONTROL_CONTENT));
	controlContent.tabIndex = -1;
	controlContent.textContent = term.phrase;
	controlContent.onclick = () => // Hack: archaic event handler property for overriding.
		focusOnTermJump(controlsInfo, highlightTags, false, term);
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
	const control = document.createElement("span");
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

const controlGetClass = (controlName: ControlButtonName) =>
	getSel(ElementClass.CONTROL, controlName)
;

const controlVisibilityUpdate = (controlName: ControlButtonName, controlsInfo: ControlsInfo, terms: MatchTerms) => {
	const control = document.querySelector(`#${getSel(ElementID.BAR)} .${controlGetClass(controlName)}`);
	if (control) {
		const value = controlsInfo.barControlsShown[controlName];
		const shown = controlName === "replaceTerms"
			? (value && !controlsInfo.termsOnHold.every(termOnHold => terms.find(term => term.phrase === termOnHold.phrase)))
			: value;
		control.classList.toggle(getSel(ElementClass.DISABLED), !shown);
	}
};

/**
 * Inserts constant bar controls into the toolbar.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param controlsInfo Details of controls to insert.
 * @param commands Browser commands to use in shortcut hints.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const controlsInsert = (() => {
	/**
	 * Inserts a control.
	 * @param terms Terms to be controlled and highlighted.
	 * @param barControlName A standard name for the control.
	 * @param hideWhenInactive Indicates whether to hide the control while not in interaction.
	 * @param controlsInfo Details of controls to insert.
	 */
	const controlInsert = (() => {
		/**
		 * Inserts a control given control button details.
		 * @param controlName A standard name for the control.
		 * @param info Details about the control button to create.
		 * @param hideWhenInactive Indicates whether to hide the control while not in interaction.
		 */
		const controlInsertWithInfo = (controlName: ControlButtonName, info: ControlButtonInfo,
			hideWhenInactive: boolean) => {
			const control = document.createElement("span");
			control.classList.add(getSel(ElementClass.CONTROL), controlGetClass(controlName));
			(info.controlClasses ?? []).forEach(elementClass =>
				control.classList.add(getSel(elementClass))
			);
			control.tabIndex = -1;
			const pad = document.createElement("span");
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
				const text = document.createElement("span");
				text.tabIndex = -1;
				text.textContent = info.label;
				button.appendChild(text);
			}
			pad.appendChild(button);
			control.appendChild(pad);
			if (hideWhenInactive) {
				control.classList.add(getSel(ElementClass.DISABLED));
			}
			if (info.onClick) {
				button.addEventListener("click", info.onClick);
			}
			if (info.setUp) {
				info.setUp(control);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(control);
		};

		return (terms: MatchTerms, controlName: ControlButtonName, hideWhenInactive: boolean,
			controlsInfo: ControlsInfo) => {
			controlInsertWithInfo(controlName, ({
				toggleBarCollapsed: {
					controlClasses: [ ElementClass.UNCOLLAPSIBLE ],
					path: "/icons/arrow.svg",
					containerId: ElementID.BAR_LEFT,
					onClick: () => {
						controlsInfo.barCollapsed = !controlsInfo.barCollapsed;
						messageSendBackground({
							toggleBarCollapsedOn: controlsInfo.barCollapsed,
						});
						const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
						bar.classList.toggle(getSel(ElementClass.COLLAPSED), controlsInfo.barCollapsed);
					},
				},
				disableTabResearch: {
					path: "/icons/close.svg",
					containerId: ElementID.BAR_LEFT,	
					onClick: () => messageSendBackground({
						disableTabResearch: true,
					}),
				},
				performSearch: {
					path: "/icons/search.svg",
					containerId: ElementID.BAR_LEFT,
					onClick: () => messageSendBackground({
						performSearch: true,
					}),
				},
				toggleHighlights: {
					path: "/icons/show.svg",
					containerId: ElementID.BAR_LEFT,
					onClick: () => messageSendBackground({
						toggleHighlightsOn: !controlsInfo.highlightsShown,
					}),
				},
				appendTerm: {
					buttonClass: ElementClass.CONTROL_CONTENT,
					path: "/icons/create.svg",
					containerId: ElementID.BAR_RIGHT,
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
				replaceTerms: {
					path: "/icons/refresh.svg",
					containerId: ElementID.BAR_RIGHT,
					onClick: () => {
						messageSendBackground({
							terms: controlsInfo.termsOnHold,
						});
					},
				},
			} as Record<ControlButtonName, ControlButtonInfo>)[controlName], hideWhenInactive);
			controlVisibilityUpdate(controlName, controlsInfo, terms);
		};
	})();

	return (terms: MatchTerms, controlsInfo: ControlsInfo, commands: BrowserCommands,
		highlightTags: HighlightTags, hues: TermHues, produceEffectOnCommand: ProduceEffectOnCommand) => {
		fillStylesheetContent(terms, hues, controlsInfo);
		const bar = document.createElement("div");
		bar.id = getSel(ElementID.BAR);
		bar.addEventListener("dragstart", event => event.preventDefault());
		const fixVisibility = () => {
			termControlInputsVisibilityReset();
			const controlInput = document.activeElement;
			if (controlInput && controlInput.tagName === "INPUT"
				&& controlInput.closest(`#${getSel(ElementID.BAR)}`)) {
				controlInput.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
			}
		};
		bar.addEventListener("mouseenter", fixVisibility);
		bar.addEventListener("mouseleave", fixVisibility);
		// Inputs should not be focusable unless user has already focused bar. (1)
		const inputsSetFocusable = (focusable: boolean) => {
			bar.querySelectorAll("input").forEach(input => {
				if (focusable) {
					input.removeAttribute("tabindex");
				} else {
					input.tabIndex = -1;
				}
			});
		};
		bar.addEventListener("focusin", () => {
			inputsSetFocusable(true);
		});
		bar.addEventListener("focusout", event => {
			// Only if focus is not moving (and has not already moved) somewhere else within the bar.
			if (!bar.contains(event.relatedTarget as Node) && !bar.contains(document.activeElement)) {
				inputsSetFocusable(false);
			}
		});
		window.addEventListener("keydown", event => {
			if (event.key === "Tab") {
				const controlInput = document.activeElement as HTMLInputElement | null;
				if (!controlInput || !bar.contains(controlInput)) {
					return;
				}
				const control = controlInput.closest(`.${getSel(ElementClass.CONTROL)}`);
				if (!control || !(event.shiftKey
					? control === (document.getElementById(getSel(ElementID.BAR_TERMS)) as Element).firstElementChild
					: control === getControlAppendTerm())) {
					return;
				}
				event.preventDefault();
				if (!event.shiftKey && controlInput.value.length) { // Force term-append to commit (add new term) then regain focus.
					controlInput.blur();
					// TODO ensure focus+selection is restored by a cleaner method
					produceEffectOnCommand.next({ type: CommandType.FOCUS_TERM_INPUT });
				} else {
					controlInput.blur();
				}
			}
		});
		if (controlsInfo.highlightsShown) {
			bar.classList.add(getSel(ElementClass.HIGHLIGHTS_SHOWN));
		}
		if (!controlsInfo.pageModifyEnabled) {
			bar.classList.add(getSel(ElementClass.DISABLED));
		}
		const barLeft = document.createElement("span");
		barLeft.id = getSel(ElementID.BAR_LEFT);
		barLeft.classList.add(getSel(ElementClass.BAR_CONTROLS));
		const barTerms = document.createElement("span");
		barTerms.id = getSel(ElementID.BAR_TERMS);
		const barRight = document.createElement("span");
		barRight.id = getSel(ElementID.BAR_RIGHT);
		barRight.classList.add(getSel(ElementClass.BAR_CONTROLS));
		bar.appendChild(barLeft);
		bar.appendChild(barTerms);
		bar.appendChild(barRight);
		document.body.insertAdjacentElement("beforebegin", bar);
		Object.keys(controlsInfo.barControlsShown).forEach((barControlName: ControlButtonName) => {
			controlInsert(terms, barControlName, !controlsInfo.barControlsShown[barControlName], controlsInfo);
		});
		const termCommands = getTermCommands(commands);
		terms.forEach((term, i) => insertTermControl(terms, i, termCommands.down[i], termCommands.up[i],
			controlsInfo, highlightTags));
		const gutter = document.createElement("div");
		gutter.id = getSel(ElementID.MARKER_GUTTER);
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

/**
 * Remove the control bar and marker gutter and purge term focus class names.
 */
const removeControls = () => {
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar) {
		if (document.activeElement && bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
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
const termControlInputsVisibilityReset = () =>
	elementsPurgeClass(
		getSel(ElementClass.OVERRIDE_VISIBILITY),
		document.getElementById(getSel(ElementID.BAR)) as HTMLElement,
		"input",
		classList => !classList.contains(getSel(ElementClass.OVERRIDE_FOCUS)),
	)
;

/*
HIGHLIGHTING - UTILITY
Methods for general use in highlighting calculations.
*/

/**
 * Gets the central y-position of the DOM rect of an element, relative to the document scroll container.
 * @param element An element
 * @returns The relative y-position.
 */
const getElementYRelative = (element: HTMLElement) =>
	(element.getBoundingClientRect().y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

// TODO document
const getAncestorHighlightable: (node: Node) => HTMLElement = !paintUseExperimental || paintUsePaintingFallback
	? node => node.parentElement as HTMLElement
	: node => {
		let ancestor = node.parentElement as HTMLElement;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const ancestorUnhighlightable = (ancestor as HTMLElement).closest("a");
			if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
				ancestor = ancestorUnhighlightable.parentElement;
			} else {
				break;
			}
		}
		return ancestor;
	}
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

/*
HIGHLIGHTING - SCROLL MARKERS
Methods for handling scrollbar highlight-flow position markers.
*/

/**
 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkersPaint = (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) => {
	if (terms.length === 0) {
		return; // Efficient escape in case of no possible markers to be inserted.
	}
	// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
	const termSelectorsAllowed = new Set(terms.slice(0, hues.length).map(term => term.selector));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
	let markersHtml = "";
	document.body.querySelectorAll("[markmysearch-h_id]").forEach((element: HTMLElement) => {
		const termSelectors: Set<string> = new Set((element[ElementProperty.INFO] as ElementInfo).flows
			.flatMap(flow => flow.boxesInfo
				.map(boxInfo => boxInfo.term.selector)
				.filter(termSelector => termSelectorsAllowed.has(termSelector))
			)
		);
		const yRelative = getElementYRelative(element);
		// TODO use single marker with custom style
		markersHtml += Array.from(termSelectors).map((termSelector, i) => `<div class="${
			getSel(ElementClass.TERM, termSelector)
		}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`);
	});
	gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
	gutter.innerHTML = markersHtml;
};

/*
HIGHLIGHTING - MAIN
Methods for calculating and interpreting highlighting caches, as well as managing associated styling and attributes.
*/

const cacheExtend = (element: Element, highlightTags: HighlightTags, cacheModify = (element: Element) => {
	if (!element[ElementProperty.INFO]) {
		element[ElementProperty.INFO] = {
			id: "",
			styleRuleIdx: -1,
			isPaintable: !element.closest("a"),
			flows: [],
		} as ElementInfo;
	}
}) => {
	if (!highlightTags.reject.has(element.tagName)) {
		cacheModify(element);
		Array.from(element.children).forEach(child => cacheExtend(child, highlightTags));
	}
};

const highlightingAttributesCleanup = (root: Element) => {
	root.querySelectorAll("[markmysearch-h_id]").forEach(element => {
		element.removeAttribute("markmysearch-h_id");
	});
	root.querySelectorAll("[markmysearch-h_beneath]").forEach(element => {
		element.removeAttribute("markmysearch-h_beneath");
	});
};

const markElementsUpToHighlightable: (element: Element) => void = paintUsePaintingFallback
	? () => undefined
	: element => {
		if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
			element.setAttribute("markmysearch-h_beneath", "");
			markElementsUpToHighlightable(element.parentElement as Element);
		}
	}
;

/** TODO update documentation
 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
 * @param node A root node under which to match terms and insert highlights.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param textFlow Consecutive text nodes to highlight inside.
 */
const getTextFlows = (
	node: Node,
	firstChildKey: "firstChild" | "lastChild",
	nextSiblingKey: "nextSibling" | "previousSibling",
	highlightTags: HighlightTags,
	textFlows: Array<Array<Text>> = [ [] ],
	textFlow: Array<Text> = textFlows[0],
): Array<Array<Text>> => {
	// TODO support for <iframe>?
	do {
		if (node.nodeType === Node.TEXT_NODE) {
			textFlow.push(node as Text);
		} else if ((node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
			&& !highlightTags.reject.has((node as Element).tagName)) {
			const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
			if (breaksFlow && (textFlow.length || textFlows.length === 1)) { // Ensure the first flow is always the one before a break.
				textFlow = [];
				textFlows.push(textFlow);
			}
			if (node[firstChildKey]) {
				getTextFlows(node[firstChildKey] as ChildNode, firstChildKey, nextSiblingKey, highlightTags, textFlows, textFlow);
				textFlow = textFlows[textFlows.length - 1];
				if (breaksFlow && textFlow.length) {
					textFlow = [];
					textFlows.push(textFlow);
				}
			}
		}
		node = node[nextSiblingKey] as ChildNode; // May be null (checked by loop condition).
	} while (node);
	return textFlows;
};

const flowsRemove = (element: Element, highlightTags: HighlightTags) => {
	if (highlightTags.reject.has(element.tagName)) {
		return;
	}
	if (element[ElementProperty.INFO]) {
		(element[ElementProperty.INFO] as ElementInfo).flows = [];
	}
	Array.from(element.children).forEach(child => flowsRemove(child, highlightTags));
};

/** TODO update documentation
 * Highlights terms in a 'flow' of consecutive text nodes.
 * @param terms Terms to find and highlight.
 * @param textFlow Consecutive text nodes to highlight inside.
 */
const flowCacheWithBoxesInfo = (terms: MatchTerms, textFlow: Array<Text>,
	getHighlightingId: GetHighlightingID, keepStyleUpdated: KeepStyleUpdated) => {
	const flow: HighlightFlow = {
		text: textFlow.map(node => node.textContent).join(""),
		nodeStart: textFlow[0],
		nodeEnd: textFlow[textFlow.length - 1],
		boxesInfo: [],
	};
	const getAncestorCommon = (ancestor: Element, node: Node): Element =>
		ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as Element, node);
	const ancestor = getAncestorCommon(flow.nodeStart.parentElement as Element, flow.nodeEnd);
	(ancestor[ElementProperty.INFO] as ElementInfo).flows.push(flow);
	for (const term of terms) {
		let i = 0;
		let node = textFlow[0];
		let textStart = 0;
		let textEnd = node.length;
		const matches = flow.text.matchAll(term.pattern);
		for (const match of matches) {
			const highlightStart = match.index as number;
			const highlightEnd = highlightStart + match[0].length;
			while (textEnd <= highlightStart) {
				i++;
				node = textFlow[i];
				textStart = textEnd;
				textEnd += node.length;
			}
			// eslint-disable-next-line no-constant-condition
			while (true) {
				flow.boxesInfo.push({
					term,
					node,
					start: Math.max(0, highlightStart - textStart),
					end: Math.min(highlightEnd - textStart, node.length),
					boxes: [],
				});
				if (highlightEnd <= textEnd) {
					break;
				}
				i++;
				node = textFlow[i];
				textStart = textEnd;
				textEnd += node.length;
			}
		}
	}
	if (flow.boxesInfo.length) {
		const ancestorHighlightable = getAncestorHighlightable(ancestor.firstChild as Node);
		keepStyleUpdated(ancestorHighlightable);
		if ((ancestorHighlightable[ElementProperty.INFO] as ElementInfo).id === "") {
			const highlighting = ancestorHighlightable[ElementProperty.INFO] as ElementInfo;
			highlighting.id = getHighlightingId.next().value;
			ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
		}
		markElementsUpToHighlightable(ancestor);
	}
};

const boxesInfoCalculate = (terms: MatchTerms, flowOwner: Element, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	keepStyleUpdated: KeepStyleUpdated) => {
	if (!flowOwner.firstChild) {
		return;
	}
	const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
	const textFlows = getTextFlows(flowOwner.firstChild, "firstChild", "nextSibling", highlightTags);
	flowsRemove(flowOwner, highlightTags);
	textFlows // The first flow is always before the first break, and the last after the last. Either may be empty.
		.slice((breaksFlow && textFlows[0].length) ? 0 : 1, (breaksFlow && textFlows[textFlows.length - 1].length) ? undefined : -1)
		.forEach(textFlow => flowCacheWithBoxesInfo(terms, textFlow, getHighlightingId, keepStyleUpdated));
	termCountCheck(); // Major performance hit when using very small delay or small delay maximum for debounce.
};

const boxesInfoCalculateForFlowOwners = (terms: MatchTerms, node: Node, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	keepStyleUpdated: KeepStyleUpdated) => {
	// Text flows may have been disrupted at `node`, so flows which include it must be recalculated and possibly split.
	// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
	const parent = node.parentElement;
	if (!parent) {
		return;
	}
	if (highlightTags.flow.has(parent.tagName)) {
		// The parent may include non self-contained flows.
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
		walker.currentNode = node;
		let breakFirst: Element | null = walker.previousNode() as Element;
		while (breakFirst && highlightTags.flow.has(breakFirst.tagName)) {
			breakFirst = breakFirst !== parent ? walker.previousNode() as Element : null;
		}
		walker.currentNode = node.nextSibling ?? node;
		let breakLast: Element | null = node.nextSibling ? walker.nextNode() as Element : null;
		while (breakLast && highlightTags.flow.has(breakLast.tagName)) {
			breakLast = parent.contains(breakLast) ? walker.nextNode() as Element : null;
		}
		if (breakFirst && breakLast) {
			// The flow containing the node starts and ends within the parent, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated. See below.
			boxesInfoCalculate(terms, parent, highlightTags,
				termCountCheck, getHighlightingId, keepStyleUpdated);
		} else {
			// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
			boxesInfoCalculateForFlowOwners(terms, parent, highlightTags,
				termCountCheck, getHighlightingId, keepStyleUpdated);
		}
	} else {
		// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
		// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
		// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
		// or end inside elements which do not contain and are not contained by a given element. Will not implement.
		boxesInfoCalculate(terms, parent, highlightTags,
			termCountCheck, getHighlightingId, keepStyleUpdated);
	}
};

const boxesInfoCalculateForFlowOwnersFromContent = (terms: MatchTerms, element: Element, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	keepStyleUpdated: KeepStyleUpdated) => {
	// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
	// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
	if (highlightTags.flow.has(element.tagName)) {
		// The element may include non self-contained flows.
		boxesInfoCalculateForFlowOwners(terms, element, highlightTags,
			termCountCheck, getHighlightingId, keepStyleUpdated);
	} else {
		// The element can only include self-contained flows, so flows need only be recalculated below the element.
		boxesInfoCalculate(terms, element, highlightTags,
			termCountCheck, getHighlightingId, keepStyleUpdated);
	}
};

/** TODO update documentation
 * FIXME this is a cut-down and adapted legacy function which may not function correctly or efficiently
 * Remove highlights for matches of terms.
 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const boxesInfoRemoveForTerms = (terms: MatchTerms = [], root: HTMLElement | DocumentFragment = document.body) => {
	for (const element of Array.from(root.querySelectorAll("[markmysearch-h_id]"))) {
		const filterBoxesInfo = (element: Element) => {
			const elementInfo = element[ElementProperty.INFO] as ElementInfo;
			if (!elementInfo) {
				return;
			}
			elementInfo.flows.forEach(flow => {
				flow.boxesInfo = flow.boxesInfo.filter(boxInfo => terms.every(term => term.selector !== boxInfo.term.selector));
			});
			Array.from(element.children).forEach(child => filterBoxesInfo(child));
		};
		filterBoxesInfo(element);
	}
};

// TODO document
const constructHighlightStyleRule: (highlightId: string, boxes: Array<HighlightBox>, terms: MatchTerms) => string = paintUseExperimental
	? paintUsePaintingFallback
		? highlightId =>
			`body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
				getSel(ElementID.DRAW_ELEMENT, highlightId)
			}) no-repeat !important; }`
		: (highlightId, boxes) =>
			`body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${
				JSON.stringify(boxes)
			}; }`
	: (highlightId, boxes, terms) =>
		`#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)} ~ body [markmysearch-h_id="${highlightId}"] { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
			boxes.map(box =>
				`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${(
					terms.find(term => term.selector === box.selector) as MatchTerm).hue
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E") !important; }`
;

const getStyleRules: (root: Element, recurse: boolean, terms: MatchTerms) => Array<HighlightStyleRuleInfo> = (() => {
	const calculateBoxes = (owner: Element, element: Element, range: Range): Array<HighlightBox> => {
		const elementInfo = element[ElementProperty.INFO] as ElementInfo;
		if (!elementInfo || elementInfo.flows.every(flow => flow.boxesInfo.length === 0)) {
			return [];
		}
		let ownerRects = Array.from(owner.getClientRects());
		if (!ownerRects.length) {
			ownerRects = [ owner.getBoundingClientRect() ];
		}
		elementInfo.flows.forEach(flow => {
			flow.boxesInfo.forEach(boxInfo => {
				boxInfo.boxes.splice(0, boxInfo.boxes.length);
				range.setStart(boxInfo.node, boxInfo.start);
				range.setEnd(boxInfo.node, boxInfo.end);
				const textRects = range.getClientRects();
				for (let i = 0; i < textRects.length; i++) {
					const textRect = textRects.item(i) as DOMRect;
					if (i !== 0
						&& textRect.x === (textRects.item(i - 1) as DOMRect).x
						&& textRect.y === (textRects.item(i - 1) as DOMRect).y) {
						continue;
					}
					let x = 0;
					let y = 0;
					for (const ownerRect of ownerRects) {
						if (ownerRect.bottom > textRect.top) {
							x += textRect.x - ownerRect.x;
							y = textRect.y - ownerRect.y;
							break;
						} else {
							x += ownerRect.width;
						}
					}
					boxInfo.boxes.push({
						selector: boxInfo.term.selector,
						x: Math.round(x),
						y: Math.round(y),
						width: Math.round(textRect.width),
						height: Math.round(textRect.height),
					});
				}
			});
		});
		return elementInfo.flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes));
	};

	const getBoxesOwned = (owner: Element, element: Element, range: Range): Array<HighlightBox> =>
		calculateBoxes(owner, element, range).concat(Array.from(element.children).flatMap(child =>
			(child[ElementProperty.INFO] ? !(child[ElementProperty.INFO] as ElementInfo).isPaintable : false)
				? getBoxesOwned(owner, child, range) : []
		))
	;

	const collectStyleRules = (element: Element, recurse: boolean,
		range: Range, styleRules: Array<HighlightStyleRuleInfo>, terms: MatchTerms) => {
		const elementInfo = element[ElementProperty.INFO] as ElementInfo;
		const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
		if (boxes.length) {
			styleRules.push({
				rule: constructHighlightStyleRule(elementInfo.id, boxes, terms),
				element,
			});
		}
		(recurse ? Array.from(element.children) as Array<HTMLElement> : []).forEach(child => {
			if (child[ElementProperty.INFO]) {
				collectStyleRules(child, recurse, range, styleRules, terms);
			}
		});
	};

	const collectElements = (element: Element, recurse: boolean, range: Range, containers: Array<Element>) => {
		const elementInfo = element[ElementProperty.INFO] as ElementInfo;
		const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
		if (boxes.length) {
			const container = paintUseExperimental
				? document.createElement("div")
				: document.createElementNS("http://www.w3.org/2000/svg", "svg");
			container.id = getSel(ElementID.DRAW_ELEMENT, elementInfo.id);
			boxes.forEach(box => {
				const element = document.createElement("div");
				element.style.position = "absolute";
				element.style.left = box.x.toString() + "px";
				element.style.top = box.y.toString() + "px";
				element.style.width = box.width.toString() + "px";
				element.style.height = box.height.toString() + "px";
				element.classList.add(getSel(ElementClass.TERM, box.selector));
				container.appendChild(element);
			});
			const boxRightmost = boxes.reduce((box, boxCurrent) => box && (box.x + box.width > boxCurrent.x + boxCurrent.width) ? box : boxCurrent);
			const boxDownmost = boxes.reduce((box, boxCurrent) => box && (box.y + box.height > boxCurrent.y + boxCurrent.height) ? box : boxCurrent);
			container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
			container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
			containers.push(container);
		}
		(recurse ? Array.from(element.children) as Array<HTMLElement> : []).forEach(child => {
			if (child[ElementProperty.INFO]) {
				collectElements(child, recurse, range, containers);
			}
		});
	};

	return paintUseExperimental && paintUsePaintingFallback
		? (root, recurse, terms) => {
			const containers: Array<Element> = [];
			collectElements(root, recurse, document.createRange(), containers);
			const parent = document.getElementById(getSel(ElementID.DRAW_CONTAINER)) as Element;
			containers.forEach(container => {
				const containerExisting = document.getElementById(container.id);
				if (containerExisting) {
					containerExisting.remove();
				}
				parent.appendChild(container);
			});
			const styleRules: Array<HighlightStyleRuleInfo> = [];
			// 'root' must have [elementInfo].
			collectStyleRules(root, recurse, document.createRange(), styleRules, terms);
			return styleRules;
		}
		: (root, recurse, terms) => {
			const styleRules: Array<HighlightStyleRuleInfo> = [];
			// 'root' must have [elementInfo].
			collectStyleRules(root, recurse, document.createRange(), styleRules, terms);
			return styleRules;
		};
})();

const styleUpdate = (styleRules: Array<HighlightStyleRuleInfo>) => {
	const styleSheet = (document.getElementById(getSel(ElementID.STYLE_PAINT)) as HTMLStyleElement)
		.sheet as CSSStyleSheet;
	styleRules.forEach(({ rule, element }) => {
		const elementInfo = element[ElementProperty.INFO] as ElementInfo;
		if (elementInfo.styleRuleIdx === -1) {
			elementInfo.styleRuleIdx = styleSheet.cssRules.length;
		} else {
			if (styleSheet.cssRules.item(elementInfo.styleRuleIdx)?.cssText === rule) {
				return;
			}
			styleSheet.deleteRule(elementInfo.styleRuleIdx);
		}
		styleSheet.insertRule(rule, elementInfo.styleRuleIdx);
	});
};

/*
LEGACY
Obsolete versions of methods to support the classic highlighting algorithm.
*/

interface UnbrokenNodeListItem {
	value: Text
	next: UnbrokenNodeListItem | null
}

/**
 * Singly linked list implementation for efficient highlight matching of node DOM 'flow' groups.
 */
class UnbrokenNodeList {
	first: UnbrokenNodeListItem | null;
	last: UnbrokenNodeListItem | null;

	push (value: Text) {
		if (this.last) {
			this.last.next = { value, next: null };
			this.last = this.last.next;
		} else {
			this.first = { value, next: null };
			this.last = this.first;
		}
	}

	insertAfter (itemBefore: UnbrokenNodeListItem | null, value: Text | null) {
		if (value) {
			if (itemBefore) {
				itemBefore.next = { next: itemBefore.next, value };
			} else {
				this.first = { next: this.first, value };
			}
		}
	}

	getText () {
		let text = "";
		let current = this.first;
		do {
			text += (current as UnbrokenNodeListItem).value.textContent;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as UnbrokenNodeListItem).next);
		return text;
	}

	clear () {
		this.first = null;
		this.last = null;
	}

	*[Symbol.iterator] () {
		let current = this.first;
		do {
			yield current as UnbrokenNodeListItem;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as UnbrokenNodeListItem).next);
	}
}

/**
 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
 * @param terms Terms to find, highlight, and mark.
 * @param rootNode A node under which to find and highlight term occurrences.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators be regenerated.
 */
const generateTermHighlightsUnderNode = (() => {
	/**
	 * Highlights a term matched in a text node.
	 * @param term The term matched.
	 * @param textEndNode The text node to highlight inside.
	 * @param start The first character index of the match within the text node.
	 * @param end The last character index of the match within the text node.
	 * @param nodeItems The singly linked list of consecutive text nodes being internally highlighted.
	 * @param nodeItemPrevious The previous item in the text node list.
	 * @returns The new previous item (the item just highlighted).
	 */
	const highlightInsideNode = (term: MatchTerm, textEndNode: Node, start: number, end: number,
		nodeItems: UnbrokenNodeList, nodeItemPrevious: UnbrokenNodeListItem | null): UnbrokenNodeListItem => {
		// TODO add strategy for mitigating damage (caused by programmatic changes by the website)
		const text = textEndNode.textContent as string;
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mms-h");
		highlight.classList.add(getSel(ElementClass.TERM, term.selector));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		(textEndNode.parentNode as Node).insertBefore(highlight, textEndNode);
		nodeItems.insertAfter(nodeItemPrevious, highlight.firstChild as Text);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			(highlight.parentNode as Node).insertBefore(textStartNode, highlight);
			nodeItems.insertAfter(nodeItemPrevious, textStartNode);
			return ((nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem)
				.next as UnbrokenNodeListItem;
		}
		return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem;
	};

	/**
	 * Highlights terms in a block of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 */
	const highlightInBlock = (terms: MatchTerms, nodeItems: UnbrokenNodeList) => {
		const textFlow = nodeItems.getText();
		for (const term of terms) {
			let nodeItemPrevious: UnbrokenNodeListItem | null = null;
			let nodeItem: UnbrokenNodeListItem | null = nodeItems.first as UnbrokenNodeListItem;
			let textStart = 0;
			let textEnd = nodeItem.value.length;
			const matches = textFlow.matchAll(term.pattern);
			for (const match of matches) {
				let highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
				// eslint-disable-next-line no-constant-condition
				while (true) {
					nodeItemPrevious = highlightInsideNode(
						term,
						nodeItem.value,
						highlightStart - textStart,
						Math.min(highlightEnd - textStart, textEnd),
						nodeItems,
						nodeItemPrevious,
					);
					highlightStart = textEnd;
					textStart = highlightEnd;
					if (highlightEnd <= textEnd) {
						break;
					}
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
			}
		}
	};

	/**
	 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
	 * @param terms Terms to find and highlight.
	 * @param node A root node under which to match terms and insert highlights.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 * @param visitSiblings Whether to visit the siblings of the root node.
	 */
	const insertHighlights = (terms: MatchTerms, node: Node, highlightTags: HighlightTags,
		nodeItems = new UnbrokenNodeList, visitSiblings = true) => {
		// TODO support for <iframe>?
		do {
			switch (node.nodeType) {
			case Node.ELEMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE: {
				if (!highlightTags.reject.has((node as Element).tagName)) {
					const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
					if (breaksFlow && nodeItems.first) {
						highlightInBlock(terms, nodeItems);
						nodeItems.clear();
					}
					if (node.firstChild) {
						insertHighlights(terms, node.firstChild, highlightTags, nodeItems);
						if (breaksFlow && nodeItems.first) {
							highlightInBlock(terms, nodeItems);
							nodeItems.clear();
						}
					}
				}
				break;
			} case Node.TEXT_NODE: {
				nodeItems.push(node as Text);
				break;
			}}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
		} while (node && visitSiblings);
	};

	return (terms: MatchTerms, rootNode: Node,
		highlightTags: HighlightTags, termCountCheck: TermCountCheck) => {
		if (rootNode.nodeType === Node.TEXT_NODE) {
			const nodeItems = new UnbrokenNodeList;
			nodeItems.push(rootNode as Text);
			highlightInBlock(terms, nodeItems);
		} else {
			insertHighlights(terms, rootNode, highlightTags, new UnbrokenNodeList, false);
		}
		termCountCheck();
	};
})();

/**
 * Revert all direct DOM tree changes under a root node introduced by the extension.
 * Circumstantial and non-direct alterations may remain.
 * @param classNames Class names of the highlights to remove. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const restoreNodes = (classNames: Array<string> = [], root: HTMLElement | DocumentFragment = document.body) => {
	const highlights = Array.from(root.querySelectorAll(classNames.length ? `mms-h.${classNames.join(", mms-h.")}` : "mms-h"))
		.reverse();
	for (const highlight of Array.from(highlights)) {
		highlight.outerHTML = highlight.innerHTML;
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

/**
 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkersClassic = (() => {
	/**
	 * Extracts the selector of a term from its prefixed class name form.
	 * @param highlightClassName The single class name of a term highlight.
	 * @returns The corresponding term selector.
	 */
	const getTermSelector = (highlightClassName: string) =>
		highlightClassName.slice(getSel(ElementClass.TERM).length + 1)
	;

	return (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) => {
		if (terms.length === 0) {
			return; // No terms results in an empty selector, which is not allowed.
		}
		const regexMatchTermSelector = new RegExp(`\\b${getSel(ElementClass.TERM)}(?:-\\w+)+\\b`);
		const containerBlockSelector = getContainerBlockSelector(highlightTags);
		const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement
			termsAdded: Set<string>
		}> = [];
		let markersHtml = "";
		document.body.querySelectorAll(terms
			.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
			.map(term => `mms-h.${getSel(ElementClass.TERM, term.selector)}`)
			.join(", ")
		).forEach((highlight: HTMLElement) => {
			const container = getContainerBlock(highlight, highlightTags, containerBlockSelector);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const yRelative = getElementYRelative(container);
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermSelector(className))) {
						return;
					} else {
						const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(getTermSelector(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		});
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	};
})();

// TODO document
const focusOnScrollMarkerClassic = (term: MatchTerm | undefined, container: HTMLElement) => {
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

/**
 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
 */
const focusOnTermJumpClassic = (() => {
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

	return (controlsInfo: ControlsInfo, highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
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
		focusOnScrollMarker(term, container, controlsInfo);
	};
})();

const focusOnTermStepClassic = (() => {
	const getSiblingHighlightFinal = (highlight: HTMLElement, node: Node,
		nextSiblingMethod: "nextSibling" | "previousSibling"): HTMLElement =>
		node[nextSiblingMethod]
			? (node[nextSiblingMethod] as Node).nodeType === Node.ELEMENT_NODE
				? (node[nextSiblingMethod] as HTMLElement).tagName === "MMS-H"
					? getSiblingHighlightFinal(node[nextSiblingMethod] as HTMLElement, node[nextSiblingMethod] as HTMLElement,
						nextSiblingMethod)
					: highlight
				: (node[nextSiblingMethod] as Node).nodeType === Node.TEXT_NODE
					? (node[nextSiblingMethod] as Text).textContent === ""
						? getSiblingHighlightFinal(highlight, node[nextSiblingMethod] as Text, nextSiblingMethod)
						: highlight
					: highlight
			: highlight
	;

	const getTopLevelHighlight = (element: HTMLElement) =>
		(element.parentElement as HTMLElement).closest("mms-h")
			? getTopLevelHighlight((element.parentElement as HTMLElement).closest("mms-h") as HTMLElement)
			: element
	;

	const stepToElement = (controlsInfo: ControlsInfo, highlightTags: HighlightTags, element: HTMLElement) => {
		element = getTopLevelHighlight(element);
		const elementFirst = getSiblingHighlightFinal(element, element, "previousSibling");
		const elementLast = getSiblingHighlightFinal(element, element, "nextSibling");
		(getSelection() as Selection).setBaseAndExtent(elementFirst, 0, elementLast, elementLast.childNodes.length);
		element.scrollIntoView({ block: "center" });
		focusOnScrollMarker(undefined, getContainerBlock(element, highlightTags), controlsInfo);
	};

	return (controlsInfo: ControlsInfo, highlightTags: HighlightTags, reversed: boolean, nodeStart?: Node) => {
		elementsPurgeClass(getSel(ElementClass.FOCUS_CONTAINER));
		elementsPurgeClass(getSel(ElementClass.FOCUS));
		const selection = getSelection();
		const bar = document.getElementById(getSel(ElementID.BAR));
		if (!selection || !bar) {
			return;
		}
		if (document.activeElement && bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
		const nodeBegin = reversed ? getNodeFinal(document.body) : document.body;
		const nodeSelected = reversed ? selection.anchorNode : selection.focusNode;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart ?? (nodeSelected
			? nodeSelected
			: nodeFocused ?? nodeBegin);
		if (document.activeElement) {
			(document.activeElement as HTMLElement).blur();
		}
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element.parentElement as Element).closest("mms-h")
				? NodeFilter.FILTER_REJECT
				: (element.tagName === "MMS-H" && isVisible(element)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const element = walker[reversed ? "previousNode" : "nextNode"]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				focusOnTermStepClassic(controlsInfo, highlightTags, reversed, nodeBegin);
			}
			return;
		}
		stepToElement(controlsInfo, highlightTags, element);
	};
})();

/**
 * Removes previous highlighting, then highlights the document using the terms supplied.
 * Disables then restarts continuous highlighting.
 * @param terms Terms to be continuously found and highlighted within the DOM.
 * @param termsToPurge Terms for which to remove previous highlights.
 * @param pageModifyEnabled Indicates whether to modify page content.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param termCountCheck A generator function for requesting that term occurrence count indicators be regenerated.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const beginHighlighting = (
	terms: MatchTerms, termsToPurge: MatchTerms,
	controlsInfo: ControlsInfo,
	highlightTags: HighlightTags, termCountCheck: TermCountCheck, observer: MutationObserver,
) => {
	highlightInNodesOnMutationDisconnect(observer);
	if (termsToPurge.length) {
		restoreNodes(termsToPurge.map(term => getSel(ElementClass.TERM, term.selector)));
	}
	generateTermHighlightsUnderNode(terms, document.body, highlightTags, termCountCheck);
	terms.forEach(term => updateTermOccurringStatus(term, controlsInfo));
	highlightInNodesOnMutation(observer);
};

// TODO document
const focusReturnToDocument = (): boolean => {
	const activeElement = document.activeElement;
	if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${getSel(ElementID.BAR)}`)) {
		(activeElement as HTMLInputElement).blur();
		return true;
	}
	return false;
};

/*
ADMINISTRATION
Methods for managing the various content components of the highlighter and its UI.
*/

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

	return (termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
		keepStyleUpdated: KeepStyleUpdated,
		highlightTags: HighlightTags, terms: MatchTerms, controlsInfo: ControlsInfo) => {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		return new MutationObserver(mutations => {
			if (controlsInfo.paintReplaceByClassic) {
				for (const mutation of mutations) {
					for (const node of Array.from(mutation.addedNodes)) {
						if ((node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
							&& canHighlightElement(rejectSelector, node as Element)) {
							restoreNodes([], node as HTMLElement | DocumentFragment);
							generateTermHighlightsUnderNode(terms, node, highlightTags, termCountCheck);
						}
					}
				}
			} else {
				for (const mutation of mutations) {
					for (const node of Array.from(mutation.addedNodes)) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							cacheExtend(node as Element, highlightTags);
						}
					}
					if (mutation.target.parentElement && mutation.type === "characterData") {
						boxesInfoCalculateForFlowOwnersFromContent(terms, mutation.target.parentElement, highlightTags,
							termCountCheck, getHighlightingId, keepStyleUpdated);
					}
					for (const node of Array.from(mutation.addedNodes)) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (canHighlightElement(rejectSelector, node as Element)) {
								boxesInfoCalculateForFlowOwnersFromContent(terms, node as Element, highlightTags,
									termCountCheck, getHighlightingId, keepStyleUpdated);
							}
						} else if (node.nodeType === Node.TEXT_NODE) {
							boxesInfoCalculateForFlowOwners(terms, node, highlightTags,
								termCountCheck, getHighlightingId, keepStyleUpdated);
						}
					}
				}
			}
		});
	};
})();

/**
 * Starts a mutation observer for highlighting, listening for DOM mutations then selectively highlighting under affected nodes.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const highlightInNodesOnMutation = (observer: MutationObserver) => {
	observer.observe(document.body, {
		subtree: true,
		childList: true,
		characterData: true,
	});
};

/**
 * Stops a mutation observer for highlighting, thus halting continuous highlighting.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const highlightInNodesOnMutationDisconnect = (observer: MutationObserver) =>
	observer.disconnect()
;

/**
 * Extracts terms from the currently user-selected string.
 * @returns The extracted terms, split at some separator and some punctuation characters,
 * with some other punctuation characters removed.
 */
const getTermsFromSelection = () => {
	const selection = getSelection();
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
			highlightTags: HighlightTags, hues: TermHues, produceEffectOnCommand: ProduceEffectOnCommand) => {
			const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
				&& document.activeElement.closest(`#${getSel(ElementID.BAR)}`);
			removeControls();
			controlsInsert(terms, controlsInfo, commands, highlightTags, hues, produceEffectOnCommand);
			if (focusingControlAppend) {
				const input = (getControl() as HTMLElement).querySelector("input") as HTMLInputElement;
				input.focus();
				input.select();
			}
		};
	
		return (terms: MatchTerms,
			controlsInfo: ControlsInfo, commands: BrowserCommands,
			highlightTags: HighlightTags, hues: TermHues,
			observer: MutationObserver, termCountCheck: TermCountCheck,
			produceEffectOnCommand: ProduceEffectOnCommand,
			getHighlightingId: GetHighlightingID,
			keepStyleUpdated: KeepStyleUpdated, elementsVisible: Set<Element>,
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
				} else {
					const term = terms[termToUpdateIdx];
					termsToPurge.push(Object.assign({}, term));
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx, highlightTags, controlsInfo);
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
						boxesInfoRemoveForTerms([ termUpdate ]);
						fillStylesheetContent(terms, hues, controlsInfo);
						termCountCheck();
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
					insertToolbar(terms, controlsInfo, commands, highlightTags, hues, produceEffectOnCommand);
				}
			} else {
				return;
			}
			fillStylesheetContent(terms, hues, controlsInfo);
			if (!controlsInfo.pageModifyEnabled) {
				const bar = document.getElementById(getSel(ElementID.BAR)) as Element;
				bar.classList.add(getSel(ElementClass.DISABLED));
				return;
			}
			if (controlsInfo.paintReplaceByClassic) {
				beginHighlighting(
					termsToHighlight.length ? termsToHighlight : terms, termsToPurge,
					controlsInfo, highlightTags, termCountCheck, observer,
				);
			} else {
				cacheExtend(document.body, highlightTags);
				boxesInfoRemoveForTerms(termsToPurge);
				boxesInfoCalculate(terms, document.body, highlightTags,
					termCountCheck, getHighlightingId, keepStyleUpdated);
				highlightInNodesOnMutation(observer);
				setTimeout(() => {
					styleUpdate(Array.from(new Set(
						Array.from(elementsVisible).map(element => getAncestorHighlightable(element.firstChild as Node))
					)).flatMap(ancestor => getStyleRules(ancestor, false, terms)));
					terms.forEach(term => updateTermOccurringStatus(term, controlsInfo));
				});
			}
		};
	})();

	/**
	 * Inserts a uniquely identified CSS stylesheet to perform all extension styling.
	 */
	const styleElementsInsert = () => {
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
		if (!document.getElementById(getSel(ElementID.DRAW_CONTAINER))) {
			const container = document.createElement("div");
			container.id = getSel(ElementID.DRAW_CONTAINER);
			document.body.insertAdjacentElement("afterend", container);
		}
	};

	const styleElementsCleanup = () => {
		const style = document.getElementById(getSel(ElementID.STYLE));
		if (style && style.textContent !== "") {
			style.textContent = "";
		}
		const stylePaint = document.getElementById(getSel(ElementID.STYLE_PAINT)) as HTMLStyleElement | null;
		if (stylePaint && stylePaint.sheet) {
			while (stylePaint.sheet.cssRules.length) {
				stylePaint.sheet.deleteRule(0);
			}
		}
	};

	/**
	 * Returns a generator function to consume empty requests for reinserting term scrollbar markers.
	 * Request fulfillment may be variably delayed based on activity.
	 */
	const requestCallFn = function* (call: () => void, requestWaitDuration: number, reschedulingDelayMax: number) {
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
				call();
			}, requestWaitDuration + 20); // Arbitrary small amount added to account for lag (preventing lost updates).
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
	const produceEffectOnCommandFn = function* (
		terms: MatchTerms, highlightTags: HighlightTags, controlsInfo: ControlsInfo
	): ProduceEffectOnCommand {
		let selectModeFocus = false;
		let focusedIdx = 0;
		const focusReturnInfo: { element: HTMLElement | null, selectionRanges: Array<Range> | null } = {
			element: null,
			selectionRanges: null,
		};
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
			} case CommandType.REPLACE_TERMS: {
				messageSendBackground({
					terms: controlsInfo.termsOnHold,
				});
				break;
			} case CommandType.STEP_GLOBAL: {
				if (focusReturnToDocument()) {
					break;
				}
				focusOnTermStep(controlsInfo, highlightTags, commandInfo.reversed ?? false);
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				focusReturnToDocument();
				focusOnTermJump(controlsInfo, highlightTags, commandInfo.reversed ?? false,
					selectModeFocus ? terms[focusedIdx] : undefined);
				break;
			} case CommandType.FOCUS_TERM_INPUT: {
				const control = getControl(undefined, commandInfo.termIdx);
				const input = control ? control.querySelector("input") : null;
				if (!control || !input) {
					break;
				}
				const selection = getSelection() as Selection;
				const activeElementOriginal = document.activeElement as HTMLElement;
				const selectionRangesOriginal = Array(selection.rangeCount).fill(null).map((v, i) => selection.getRangeAt(i));
				control.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
				input.focus();
				input.select();
				control.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
				selectInputTextAll(input);
				if (activeElementOriginal && activeElementOriginal.closest(`#${getSel(ElementID.BAR)}`)) {
					break; // Focus was already in bar, so focus return should not be updated.
				}
				focusReturnInfo.element = activeElementOriginal;
				focusReturnInfo.selectionRanges = selectionRangesOriginal;
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
					if (focusReturnInfo.element) {
						focusReturnInfo.element.focus({ preventScroll: true });
					}
					if (focusReturnInfo.selectionRanges) {
						selection.removeAllRanges();
						focusReturnInfo.selectionRanges.forEach(range => selection.addRange(range));
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
					focusOnTermJump(controlsInfo, highlightTags, commandInfo.reversed as boolean,
						terms[focusedIdx]);
				}
				break;
			}}
		}
	};

	const getHighlightingIdFn = function* (): GetHighlightingID {
		let i = 0;
		while (true) {
			yield (i++).toString();
		}
	};

	/**
	 * Gets a set of highlight tags in all forms reasonably required.
	 * @param tagsLower An array of tag names in their lowercase form.
	 * @returns The corresponding set of tag names in all forms necessary.
	 */
	const getHighlightTagsSet = (tagsLower: Array<keyof HTMLElementTagNameMap>) =>
		new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ]))
	;

	return () => {
		window[WindowVariable.SCRIPTS_LOADED] = true;
		if (!paintUsePaintingFallback) {
			(CSS["paintWorklet"] as PaintWorkletType).addModule(chrome.runtime.getURL("/dist/paint.js"));
		}
		const commands: BrowserCommands = [];
		const terms: MatchTerms = [];
		const hues: TermHues = [];
		const controlsInfo: ControlsInfo = { // Unless otherwise indicated, the values assigned here are arbitrary and to be overriden.
			paintReplaceByClassic: false, // Currently has an effect.
			pageModifyEnabled: true, // Currently has an effect.
			highlightsShown: false,
			barCollapsed: false,
			termsOnHold: [],
			barControlsShown: {
				toggleBarCollapsed: false,
				disableTabResearch: false,
				performSearch: false,
				toggleHighlights: false,
				appendTerm: false,
				replaceTerms: false,
			},
			barLook: {
				showEditIcon: false,
				showRevealIcon: false,
				fontSize: "",
				opacityControl: 0,
				opacityTerm: 0,
				borderRadius: "",
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
			reject: getHighlightTagsSet([ "meta", "style", "script", "noscript", "title", "textarea" ]),
			flow: getHighlightTagsSet([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as keyof HTMLElementTagNameMap ]),
			// break: any other class of element
		};
		const requestRefreshIndicators = requestCallFn(
			controlsInfo.paintReplaceByClassic
				? () => insertScrollMarkersClassic(terms, highlightTags, hues)
				: () => insertScrollMarkersPaint(terms, highlightTags, hues),
			controlsInfo.paintReplaceByClassic ? 1000 : 150, controlsInfo.paintReplaceByClassic ? 5000 : 2000);
		const requestRefreshTermControls = requestCallFn(() => {
			terms.forEach(term => {
				updateTermTooltip(term, controlsInfo);
				updateTermOccurringStatus(term, controlsInfo);
			});
		}, controlsInfo.paintReplaceByClassic ? 50 : 150, controlsInfo.paintReplaceByClassic ? 500 : 2000);
		const termCountCheck = () => {
			requestRefreshIndicators.next();
			requestRefreshTermControls.next();
		};
		const elementsVisible: Set<Element> = new Set;
		const { keepStyleUpdated, stopObserving }: { keepStyleUpdated: KeepStyleUpdated, stopObserving: () => void } = (() => {
			const shiftObserver = new ResizeObserver(paintUseExperimental
				? entries => entries.forEach(entry => {
					if (entry.target[ElementProperty.INFO]) {
						styleUpdate(getStyleRules(getAncestorHighlightable(entry.target.firstChild as Node), false, terms));
					}
				})
				: entries => {
					let styleRules: Array<HighlightStyleRuleInfo> = [];
					entries.forEach(entry => {
						if (entry.target[ElementProperty.INFO]) {
							styleRules = styleRules.concat(getStyleRules(getAncestorHighlightable(entry.target.firstChild as Node), false, terms));
						}
					});
					if (styleRules.length) {
						styleUpdate(styleRules);
					}
				}
			);
			const visibilityObserver = new IntersectionObserver(entries => {
				let styleRules: Array<HighlightStyleRuleInfo> = [];
				entries.forEach(entry => {
					if (entry.isIntersecting) {
						if (entry.target[ElementProperty.INFO]) {
							elementsVisible.add(entry.target);
							shiftObserver.observe(entry.target);
							styleRules = styleRules.concat(getStyleRules(getAncestorHighlightable(entry.target.firstChild as Node), false, terms));
						}
					} else {
						if (paintUsePaintingFallback && entry.target[ElementProperty.INFO]) {
							//(document.getElementById(getSel(ElementID.DRAW_ELEMENT, (entry.target[ElementProperty.INFO] as ElementInfo).id)) as HTMLElement).remove();
						}
						elementsVisible.delete(entry.target);
						shiftObserver.unobserve(entry.target);
					}
				});
				if (styleRules.length) {
					styleUpdate(styleRules);
				}
			}, { rootMargin: "400px" });
			return {
				keepStyleUpdated: element => visibilityObserver.observe(element),
				stopObserving: () => {
					elementsVisible.clear();
					shiftObserver.disconnect();
					visibilityObserver.disconnect();
				},
			};
		})();
		const produceEffectOnCommand = produceEffectOnCommandFn(terms, highlightTags, controlsInfo);
		const getHighlightingId = getHighlightingIdFn();
		const observer = getObserverNodeHighlighter(termCountCheck, getHighlightingId,
			keepStyleUpdated, highlightTags, terms, controlsInfo);
		produceEffectOnCommand.next(); // Requires an initial empty call before working (TODO otherwise mitigate).
		styleElementsInsert();
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
			if (message.useClassicHighlighting !== undefined) {
				controlsInfo.paintReplaceByClassic = message.useClassicHighlighting;
			}
			if (message.enablePageModify !== undefined && controlsInfo.pageModifyEnabled !== message.enablePageModify) {
				controlsInfo.pageModifyEnabled = message.enablePageModify;
				if (!controlsInfo.pageModifyEnabled) {
					stopObserving();
				}
			}
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			Object.entries(message.barControlsShown ?? {}).forEach(([ controlName, value ]: [ ControlButtonName, boolean ]) => {
				controlsInfo.barControlsShown[controlName] = value;
				controlVisibilityUpdate(controlName, controlsInfo, terms);
			});
			Object.entries(message.barLook ?? {}).forEach(([ key, value ]) => {
				controlsInfo.barLook[key] = value;
			});
			if (message.highlightMethod) {
				hues.splice(0);
				message.highlightMethod.hues.forEach(hue => hues.push(hue));
			}
			if (message.matchMode) {
				Object.assign(controlsInfo.matchMode, message.matchMode);
			}
			if (message.toggleHighlightsOn !== undefined) {
				controlsInfo.highlightsShown = message.toggleHighlightsOn;
			}
			if (message.toggleBarCollapsedOn !== undefined) {
				controlsInfo.barCollapsed = message.toggleBarCollapsedOn;
			}
			if (message.termsOnHold) {
				controlsInfo.termsOnHold = message.termsOnHold;
			}
			if (message.deactivate) {
				highlightInNodesOnMutationDisconnect(observer);
				stopObserving();
				terms.splice(0);
				removeControls();
				restoreNodes();
				styleElementsCleanup();
				document.querySelectorAll("*").forEach(element => {
					element[ElementProperty.INFO] = undefined;
				});
				highlightingAttributesCleanup(document.body);
			}
			if (message.termUpdate || (message.terms !== undefined && (
				!itemsMatch(terms, message.terms, (a, b) => a.phrase === b.phrase)
				|| (!terms.length && !document.getElementById(ElementID.BAR))
			))) {
				refreshTermControlsAndBeginHighlighting(
					terms, //
					controlsInfo, commands, //
					highlightTags, hues, //
					observer, termCountCheck, //
					produceEffectOnCommand, //
					getHighlightingId, //
					keepStyleUpdated, elementsVisible, //
					message.terms, message.termUpdate, message.termToUpdateIdx, //
				);
				controlVisibilityUpdate("replaceTerms", controlsInfo, terms);
			}
			if (message.command) {
				produceEffectOnCommand.next(message.command);
			}
			const bar = document.getElementById(getSel(ElementID.BAR));
			if (bar) {
				bar.classList.toggle(getSel(ElementClass.HIGHLIGHTS_SHOWN), controlsInfo.highlightsShown);
				bar.classList.toggle(getSel(ElementClass.COLLAPSED), controlsInfo.barCollapsed);
			}
			sendResponse({}); // Mitigates manifest V3 bug which otherwise logs an error message.
		});
	};
})()();
