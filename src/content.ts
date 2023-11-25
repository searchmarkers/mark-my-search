type BrowserCommands = Array<chrome.commands.Command>
type HighlightTags = {
	reject: ReadonlySet<string>,
	flow: ReadonlySet<string>,
}
type TermHues = Array<number>
type ControlButtonName = keyof ConfigBarControlsShown
type ControlButtonInfo = {
	controlClasses?: Array<EleClass>
	buttonClasses?: Array<EleClass>
	path?: string
	pathSecondary?: string
	label?: string
	containerId: EleID
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
type MutationUpdates = { observe: () => void, disconnect: () => void }
type StyleUpdates = { observe: (element: Element) => void, disconnectAll: () => void }

enum AtRuleID {
	FLASH = "markmysearch__flash",
	MARKER_ON = "markmysearch__marker_on",
	MARKER_OFF = "markmysearch__marker_off",
}

enum EleProperty {
	INFO = "markmysearch__cache",
}

enum EleClass {
	HIGHLIGHTS_SHOWN = "mms__highlights_shown",
	BAR_HIDDEN = "mms__bar_hidden",
	CONTROL = "mms__control",
	CONTROL_PAD = "mms__control_pad",
	CONTROL_INPUT = "mms__control_input",
	CONTROL_CONTENT = "mms__control_content",
	CONTROL_BUTTON = "mms__control_button",
	CONTROL_REVEAL = "mms__control_reveal",
	CONTROL_EDIT = "mms__control_edit",
	OPTION_LIST = "mms__options",
	OPTION = "mms__option",
	TERM = "mms__term",
	FOCUS = "mms__focus",
	FOCUS_CONTAINER = "mms__focus_contain",
	FOCUS_REVERT = "mms__focus_revert",
	REMOVE = "mms__remove",
	DISABLED = "mms__disabled",
	WAS_FOCUSED = "mms__was_focused",
	MENU_OPEN = "mms__menu_open",
	MENU_JUST_CLOSED_BY_BUTTON = "mms__menu_just_closed",
	OPENED_MENU = "mms__opened_menu",
	COLLAPSED = "mms__collapsed",
	UNCOLLAPSIBLE = "mms__collapsed_impossible",
	MATCH_REGEX = "mms__match_regex",
	MATCH_CASE = "mms__match_case",
	MATCH_STEM = "mms__match_stem",
	MATCH_WHOLE = "mms__match_whole",
	MATCH_DIACRITICS = "mms__match_diacritics",
	PRIMARY = "mms__primary",
	SECONDARY = "mms__secondary",
	BAR_CONTROLS = "mms__bar_controls",
}

enum EleID {
	STYLE = "markmysearch__style",
	STYLE_PAINT = "markmysearch__style_paint",
	BAR = "markmysearch__bar",
	BAR_LEFT = "markmysearch__bar_left",
	BAR_TERMS = "markmysearch__bar_terms",
	BAR_RIGHT = "markmysearch__bar_right",
	MARKER_GUTTER = "markmysearch__markers",
	DRAW_CONTAINER = "markmysearch__draw_container",
	DRAW_ELEMENT = "markmysearch__draw",
	INPUT = "markmysearch__input",
}

const ELEMENT_IS_KNOWN = "markmysearch__known";

const HIGHLIGHT_TAG = "mms-h";
const HIGHLIGHT_TAG_UPPER = "MMS-H";

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
	[ConfigKey.BAR_CONTROLS_SHOWN]: ConfigBarControlsShown
	[ConfigKey.BAR_LOOK]: ConfigBarLook
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
	token: string
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
const paintUseExperimental = true;//window[WindowVariable.CONFIG_HARD].paintUseExperimental;

/**
 * Returns a generator function, the generator of which consumes empty requests for calling the specified function.
 * Request fulfillment is variably delayed based on activity.
 * @param call The function to be intermittently called.
 * @param waitDuration Return the time to wait after the last request, before fulfilling it.
 * @param reschedulingDelayMax Return the maximum total delay time between requests and fulfillment.
 */
const requestCallFn = function* (
	call: () => void,
	waitDuration: () => number,
	reschedulingDelayMax: () => number,
) {
	const reschedulingRequestCountMargin = 1;
	let timeRequestAcceptedLast = 0;
	let requestCount = 0;
	const scheduleRefresh = () =>
		setTimeout(() => {
			const dateMs = Date.now();
			if (requestCount > reschedulingRequestCountMargin
				&& dateMs < timeRequestAcceptedLast + reschedulingDelayMax()) {
				requestCount = 0;
				scheduleRefresh();
				return;
			}
			requestCount = 0;
			call();
		}, waitDuration() + 20); // Arbitrary small amount added to account for lag (preventing lost updates).
	while (true) {
		requestCount++;
		const dateMs = Date.now();
		if (dateMs > timeRequestAcceptedLast + waitDuration()) {
			timeRequestAcceptedLast = dateMs;
			scheduleRefresh();
		}
		yield;
	}
};

let messageHandleHighlightGlobal: (
	message: HighlightMessage,
	sender: chrome.runtime.MessageSender | null,
	sendResponse: (response: HighlightMessageResponse) => void,
) => void = () => undefined;

const termsSet = async (terms: MatchTerms) => {
	messageHandleHighlightGlobal({ terms: terms.slice() }, null, () => undefined);
	await messageSendBackground({ terms });
};

const getTermClass = (termToken: string): string => EleClass.TERM + "-" + termToken;

const getTermToken = (termClass: string) => termClass.slice(EleClass.TERM.length + 1);

const getControlPadClass = (index: number) => EleClass.CONTROL_PAD + "-" + index.toString();

const getMatchModeOptionClass = (matchType: keyof MatchMode) => EleClass.OPTION + "-" + matchType;

const getInputIdSequential = () => EleID.INPUT + "-" + getIdSequential.next().value.toString();

const getElementDrawId = (highlightId: string) => EleID.DRAW_ELEMENT + "-" + highlightId;

/**
 * Fills a CSS stylesheet element to style all UI elements we insert.
 * @param terms Terms to account for and style.
 * @param hues Color hues for term styles to cycle through.
 */
const fillStylesheetContent = (terms: MatchTerms, hues: TermHues, controlsInfo: ControlsInfo) => {
	const style = document.getElementById(EleID.STYLE) as HTMLStyleElement;
	const zIndexMin = -(2**31);
	const zIndexMax = 2**31 - 1;
	const makeImportant = (styleText: string): string =>
		styleText.replace(/;/g, " !important;"); // Prevent websites from overriding rules with !important;
	style.textContent = makeImportant(`
/* || Term Buttons and Input */

#${EleID.BAR} {
	& ::selection {
		background: Highlight;
		color: HighlightText;
	}
	& .${EleClass.CONTROL_PAD} .${EleClass.CONTROL_EDIT} {
		.${EleClass.PRIMARY} {
			display: block;
		}
		.${EleClass.SECONDARY} {
			display: none;
		}
	}
	& .${EleClass.CONTROL_PAD} button:disabled,
	& .${EleClass.CONTROL_PAD} button:disabled *,
	& .${EleClass.CONTROL_INPUT} {
		width: 0;
		padding: 0;
		margin: 0;
	}
	& .${EleClass.CONTROL_INPUT} {
		border: none;
		outline: revert;
		box-sizing: unset;
		font-family: revert;
		white-space: pre;
		color: hsl(0 0% 0%);
	}
	&:active .${EleClass.CONTROL_INPUT}.${EleClass.WAS_FOCUSED},
	& .${EleClass.CONTROL_INPUT}:is(:focus, .${EleClass.OPENED_MENU}) {
		width: 5em;
		padding: 0 2px 0 2px;
		margin-inline: 3px;
		& + .${EleClass.CONTROL_EDIT} {
			& .${EleClass.PRIMARY} {
				display: none;
			}
			& .${EleClass.SECONDARY} {
				display: block;
			}
		}
	}
	&.${EleClass.COLLAPSED} .${controlGetClass("toggleBarCollapsed")} .${EleClass.PRIMARY},
	&:not(.${EleClass.COLLAPSED}) .${controlGetClass("toggleBarCollapsed")} .${EleClass.SECONDARY} {
		display: none;
	}
	& .${EleClass.CONTROL_REVEAL} img {
		width: 0.5em;
	}
}

/**/

/* || Term Matching Option Hints */

#${EleID.BAR_TERMS} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_REGEX} .${EleClass.CONTROL_CONTENT} {
			font-weight: bold;
		}
		&:not(.${EleClass.MATCH_DIACRITICS}) .${EleClass.CONTROL_CONTENT} {
			font-style: italic;
		}
	}
}

#${EleID.BAR_TERMS},
#${EleID.BAR_RIGHT} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_CASE} .${EleClass.CONTROL_CONTENT} {
			padding-top: 0;
			border-top: 2px dashed black;
		}
		&.${EleClass.MATCH_WHOLE} .${EleClass.CONTROL_CONTENT} {
			padding-inline: 2px;
			border-inline: 2px solid hsl(0 0% 0% / 0.4);
		}
	}
}

#${EleID.BAR_RIGHT} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_REGEX} .${EleClass.CONTROL_CONTENT}::before {
			content: "(.*)";
			margin-right: 2px;
			font-weight: bold;
		}
		&:not(.${EleClass.MATCH_STEM}) .${EleClass.CONTROL_CONTENT} {
			border-bottom: 3px solid hsl(0 0% 38%);
		}
		&:not(.${EleClass.MATCH_DIACRITICS}) .${EleClass.CONTROL_CONTENT} {
			border-left: 3px dashed black;
		}
	}
}

#${EleID.BAR_TERMS} .${EleClass.CONTROL}:not(.${EleClass.MATCH_STEM},
.${EleClass.MATCH_REGEX}) .${EleClass.CONTROL_CONTENT} {
	text-decoration: underline;
	text-decoration-skip-ink: none;
}

/**/

/* || Bar */

#${EleID.BAR} {
	& {
		all: revert;
		position: fixed;
		top: 0;
		left: 0;
		z-index: ${zIndexMax};
		color-scheme: light;
		font-size: ${controlsInfo.barLook.fontSize};
		line-height: initial;
		user-select: none;
		pointer-events: none;
	}
	&.${EleClass.BAR_HIDDEN} {
		display: none;
	}
	& * {
		all: revert;
		font: revert;
		font-family: sans-serif;
		font-size: inherit;
		line-height: 120%;
		padding: 0;
	}
	& :not(input) {
		outline: none;
	}
	& img {
		height: 1.1em;
		width: 1.1em;
		object-fit: cover;
	}
	& button {
		display: flex;
		align-items: center;
		padding-inline: 4px;
		margin-block: 0;
		border: none;
		border-radius: inherit;
		background: none;
		color: hsl(0 0% 0%);
		cursor: pointer;
		letter-spacing: normal;
		transition: unset;
	}
	& > * {
		display: inline;
	}
	& .${EleClass.CONTROL} {
		display: inline-block;
		vertical-align: top;
		margin-left: 0.5em;
		pointer-events: auto;
	}
	&.${EleClass.COLLAPSED} > * > *:not(.${EleClass.UNCOLLAPSIBLE}) {
		display: none;
	}
}

/**/

/* || Term Pulldown */

#${EleID.BAR} {
	& .${EleClass.CONTROL}:active .${EleClass.CONTROL_PAD}:not(:hover) ~ .${EleClass.OPTION_LIST},
	& .${EleClass.MENU_OPEN} .${EleClass.OPTION_LIST} {
		display: flex;
	}
	& .${EleClass.OPTION_LIST}:focus-within .${EleClass.OPTION}::first-letter {
		text-decoration: underline;
	}
	& .${EleClass.OPTION_LIST} {
		display: none;
		position: absolute;
		flex-direction: column;
		padding: 0;
		width: max-content;
		margin: 0 0 0 4px;
		z-index: 1;
		font-size: max(14px, 0.84em) /* Make the font size a proportion of the overall font size, down to 14px */;
	}
	& .${EleClass.OPTION} {
		& {
			display: flex;
			padding-block: 3px;
			background: hsl(0 0% 94% / 0.76);
			color: hsl(0 0% 6%);
			width: 100%;
			text-align: left;
			border-width: 2px;
			border-color: hsl(0 0% 40% / 0.7);
			border-left-style: solid;
		}
		& input[type='checkbox'] {
			margin-block: 0;
			margin-inline: 4px;
			width: 1em;
		}
		&:hover {
			background: hsl(0 0% 100%);
		}
	}
}

/**/

/* || Bar Controls */

#${EleID.BAR_TERMS} .${EleClass.CONTROL} {
	white-space: pre;
}

#${EleID.BAR} {
	& .${EleClass.CONTROL} {
		& .${EleClass.CONTROL_PAD} {
			display: flex;
			height: 1.3em;
			background: hsl(0 0% 90% / ${controlsInfo.barLook.opacityControl});
			color: hsl(0 0% 0%);
			border-style: none;
			border-radius: ${controlsInfo.barLook.borderRadius};
			box-shadow: 1px 1px 5px;
		}
		&.${EleClass.MENU_OPEN} .${EleClass.CONTROL_REVEAL} {
			background: hsl(0 0% 100% / 0.6);
		}
		& .${EleClass.CONTROL_BUTTON}:not(:disabled) {
			&:hover {
				background: hsl(0 0% 65%);
			}
			&:active {
				background: hsl(0 0% 50%);
			}
		}
	}
	&.${EleClass.DISABLED} .${EleClass.CONTROL} .${EleClass.CONTROL_PAD} {
		background: hsl(0 0% 90% / min(${controlsInfo.barLook.opacityControl}, 0.4));
	}
	&:not(.${EleClass.DISABLED}) #${EleID.BAR_TERMS} .${EleClass.CONTROL} .${EleClass.CONTROL_PAD}.${EleClass.DISABLED} {
		display: flex;
		background: hsl(0 0% 80% / min(${controlsInfo.barLook.opacityTerm}, 0.6));
	}
	& > :not(#${EleID.BAR_TERMS}) > .${EleClass.DISABLED}:not(:focus-within) {
		display: none;
	}
}

/**/

/* || Scroll Markers */

#${EleID.MARKER_GUTTER} {
	& {
		display: block;
		position: fixed;
		right: 0;
		top: 0;
		width: 0;
		height: 100%;
		z-index: ${zIndexMax};
	}
	& * {
		width: 16px;
		height: 1px;
		position: absolute;
		right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
		padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
	& .${EleClass.FOCUS} {
		padding-right: 16px;
		transition: unset;
	}
}

/**/

/* || Term Highlights */

.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}
${controlsInfo.paintReplaceByClassic ? `
${HIGHLIGHT_TAG} {
	font: inherit;
	border-radius: 2px;
	visibility: visible;
}
.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}` : ""}

/**/`) + `
${
	controlsInfo.paintReplaceByClassic || !paintUseExperimental
		? ""
		: paintUsePaintingFallback
			? `

#${EleID.DRAW_CONTAINER} {
	& {
		position: fixed;
		width: 100%;
		height: 100%;
		top: 100%;
		z-index: ${zIndexMin};
	}
	& > * {
		position: fixed;
		width: 100%;
		height: 100%;
	}
}`
			: `

/* || Term Highlight */

#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id] {
	& [markmysearch-h_beneath] {
		background-color: transparent;
	}
	& {
		background-image: paint(markmysearch-highlights) !important; --markmysearch-styles: ${
	JSON.stringify((() => {
		const styles: TermSelectorStyles = {};
		terms.forEach((term, i) => {
			styles[term.token] = {
				hue: hues[i % hues.length],
				cycle: Math.floor(i / hues.length),
			};
		});
		return styles;
	})())};
	}
	& > :not([markmysearch-h_id]) {
		--markmysearch-styles: unset;
		--markmysearch-boxes: unset;
	}
}

/**/`
}
${
	(!controlsInfo.paintReplaceByClassic && paintUseExperimental && paintUsePaintingFallback)
		? `

#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${EleClass.TERM} {
	outline: 2px solid hsl(0 0% 0% / 0.1);
	outline-offset: -2px;
	border-radius: 2px;
}`
		: ""
}

/* || Transitions */

@keyframes ${AtRuleID.MARKER_ON} {
	from {} to { padding-right: 16px; };
}
@keyframes ${AtRuleID.MARKER_OFF} {
	from { padding-right: 16px; } to { padding-right: 0; };
}
@keyframes ${AtRuleID.FLASH} {
	from { background-color: hsl(0 0% 65% / 0.8); } to {};
}

/**/

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
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ${HIGHLIGHT_TAG}.${getTermClass(term.token)},
#${EleID.BAR} ~ body .${EleClass.FOCUS_CONTAINER} ${HIGHLIGHT_TAG}.${getTermClass(term.token)} {
	background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`)};
	box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35);
}` : (paintUseExperimental && paintUsePaintingFallback) ? `
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${getTermClass(term.token)} {
	background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`)};
}` : ""
}

/**/

/* || Term Scroll Markers */

#${EleID.MARKER_GUTTER} .${getTermClass(term.token)} {
	background: hsl(${hue} 100% 44%);
}

/**/

/* || Term Control Buttons */

#${EleID.BAR_TERMS} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
	background: ${getBackgroundStyle(
		`hsl(${hue} 70% 70% / ${controlsInfo.barLook.opacityTerm})`,
		`hsl(${hue} 70% 88% / ${controlsInfo.barLook.opacityTerm})`,
	)};
}

#${EleID.BAR}.${EleClass.DISABLED} #${EleID.BAR_TERMS} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
	background: ${getBackgroundStyle(
		`hsl(${hue} 70% 70% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
		`hsl(${hue} 70% 88% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
	)};
}

#${EleID.BAR_TERMS} {
	& .${getTermClass(term.token)} .${EleClass.CONTROL_BUTTON}:not(:disabled) {
		&:hover {
			background: hsl(${hue} 70% 80%);
		}
		&:active {
			background: hsl(${hue} 70% 70%);
		}
	}
	&.${getControlPadClass(i)} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
		background: hsl(${hue} 100% 90%);
	}
}

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
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
const elementsRemakeUnfocusable = (root: HTMLElement | DocumentFragment = document.body) => {
	if (!root.parentNode) {
		return;
	}
	root.parentNode.querySelectorAll(`.${EleClass.FOCUS_REVERT}`)
		.forEach((element: HTMLElement) => {
			element.tabIndex = -1;
			element.classList.remove(EleClass.FOCUS_REVERT);
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
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		const selection = document.getSelection() as Selection;
		const bar = document.getElementById(EleID.BAR) as HTMLElement;
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
			(element[EleProperty.INFO] as ElementInfo | undefined)?.flows.some(flow =>
				term ? flow.boxesInfo.some(boxInfo => boxInfo.term.token === term.token) : flow.boxesInfo.length
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
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		focusClosest(element, element =>
			element[EleProperty.INFO] && !!(element[EleProperty.INFO] as ElementInfo).flows
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
			assert(false, "term input not selected", "required element(s) not found", { control });
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
	const commit = (term: MatchTerm | undefined, terms: MatchTerms, inputValue?: string) => {
		const replaces = !!term; // Whether a commit in this control replaces an existing term or appends a new one.
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		inputValue = inputValue ?? termInput.value;
		const idx = getTermIndexFromArray(term, terms);
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		if (replaces && inputValue === "") {
			if (document.activeElement === termInput) {
				selectInput(getControl(undefined, idx + 1) as HTMLElement);
				return;
			}
			termsSet(terms.slice(0, idx).concat(terms.slice(idx + 1)));
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			termsSet(terms.map((term, i) => i === idx ? termChanged : term));
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue, getTermControlMatchModeFromClassList(control.classList), {
				allowStemOverride: true,
			});
			termsSet(terms.concat(termChanged));
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
		const idx = replaces ? getTermIndexFromArray(term, terms) : terms.length;
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
			.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement ?? controlPad;
		const controlEdit = controlPad
			.getElementsByClassName(EleClass.CONTROL_EDIT)[0] as HTMLElement | undefined;
		const term = terms[idxCode] as MatchTerm | undefined;
		// Whether a commit in this control replaces an existing term or appends a new one.
		const replaces = idxCode !== TermChange.CREATE;
		const input = document.createElement("input");
		input.type = "text";
		input.classList.add(EleClass.CONTROL_INPUT);
		// Inputs should not be focusable unless user has already focused bar. (0)
		if (!document.activeElement || !document.activeElement.closest(`#${EleID.BAR}`)) {
			input.tabIndex = -1;
		}
		const resetInput = (termText = controlContent.textContent as string) => {
			input.value = replaces ? termText : "";
		};
		const show = (event: MouseEvent) => {
			event.preventDefault();
			input.focus();
			input.select();
			if (document.getSelection()?.toString() === input.value) {
				setTimeout(() => {
					input.select();
				});
			}
		};
		const hide = () => input.blur();
		if (controlEdit) {
			controlEdit.addEventListener("click", event => {
				if (inputSize) { // Input is shown; currently a delete button.
					input.value = "";
					commit(term, terms);
					hide();
				} else { // Input is hidden; currently an edit button.
					show(event);
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
			if (event.key === "Tab") {
				return; // Must be caught by the bar to be handled independently.
			}
			event.stopPropagation();
			switch (event.key) {
			case "Enter": {
				if (event.shiftKey) {
					hide();
				} else {
					const inputValue = input.value;
					resetInput(inputValue);
					commit(term, terms, inputValue);
				}
				return;
			}
			case "Escape": {
				resetInput();
				hide();
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
				input.classList.add(EleClass.OPENED_MENU);
				openTermOptionList(term);
				return;
			}}
		});
		input.addEventListener("keyup", event => {
			event.stopPropagation();
			if (event.key === "Tab") {
				input.select();
			}
		});
		// Potential future improvement to mitigate cross-browser quirk where the first time an input is focused, it cannot be selected.
		//input.addEventListener("focusin", () => {
		//	setTimeout(() => {
		//		input.select();
		//	});
		//});
		input.addEventListener("focusout", event => {
			const newFocus = event.relatedTarget as Element | null;
			if (newFocus?.closest(`#${EleID.BAR}`)) {
				input.classList.add(EleClass.WAS_FOCUSED);
			}
		});
		let inputSize = 0;
		new ResizeObserver(entries => {
			const inputSizeNew = entries[0]?.contentBoxSize[0]?.inlineSize ?? 0;
			if (inputSizeNew !== inputSize) {
				if (inputSizeNew) {
					resetInput();
				} else {
					commit(term, terms);
				}
			}
			inputSize = inputSizeNew;
		}).observe(input);
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
const getTermIndexFromArray = (term: MatchTerm | undefined, terms: MatchTerms): TermChange.CREATE | number =>
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
	const barTerms = document.getElementById(EleID.BAR_TERMS) as HTMLElement;
	return (idx === undefined && term
		? barTerms.getElementsByClassName(getTermClass(term.token))[0]
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
	(document.getElementById(EleID.BAR_RIGHT) as HTMLElement).firstElementChild
;

/**
 * Gets the number of matches for a term in the document.
 * @param term A term to get the occurrence count for.
 * @returns The occurrence count for the term.
 */
const getTermOccurrenceCount = (
	term: MatchTerm,
	controlsInfo: ControlsInfo,
	checkExistsOnly = false,
): number => controlsInfo.paintReplaceByClassic
	? (() => { // Increasingly inaccurate as highlights elements are more often split.
		const occurrences = Array.from(document.body.getElementsByClassName(getTermClass(term.token)));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length; // Poor and changeable heuristic, but so far the most reliable efficient method.
	})()
	: ((): number => {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(EleProperty.INFO in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let count = 0;
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (!element) {
				break;
			}
			(element[EleProperty.INFO] as ElementInfo).flows.forEach(flow => {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			});
			if (checkExistsOnly && count > 0) {
				return 1;
			}
		}
		return count;
	})()
;

/**
 * Updates the look of a term control to reflect whether or not it occurs within the document.
 * @param term A term to update the term control status for.
 */
const updateTermOccurringStatus = (term: MatchTerm, controlsInfo: ControlsInfo) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
	controlPad.classList.toggle(EleClass.DISABLED, !getTermOccurrenceCount(term, controlsInfo, true));
};

/**
 * Updates the tooltip of a term control to reflect current highlighting or extension information as appropriate.
 * @param term A term to update the tooltip for.
 */
const updateTermTooltip = (term: MatchTerm, controlsInfo: ControlsInfo) => {
	const controlPad = (getControl(term) as HTMLElement)
		.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
	const controlContent = controlPad
		.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
	const occurrenceCount = getTermOccurrenceCount(term, controlsInfo);
	controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !term.command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${term.command} or ${term.commandReverse}`
				: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
	}`;
};

/**
 * Updates the class list of a control to reflect the matching options of its term.
 * @param mode An object of term matching mode flags.
 * @param classList The control element class list for a term.
 */
const updateTermControlMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList.toggle(EleClass.MATCH_REGEX, mode.regex);
	classList.toggle(EleClass.MATCH_CASE, mode.case);
	classList.toggle(EleClass.MATCH_STEM, mode.stem);
	classList.toggle(EleClass.MATCH_WHOLE, mode.whole);
	classList.toggle(EleClass.MATCH_DIACRITICS, mode.diacritics);
};

/**
 * Gets the matching options of a term from the class list of its control.
 * @param classList The control element class list for the term.
 * @returns The matching options for the term.
 */
const getTermControlMatchModeFromClassList = (classList: DOMTokenList): MatchMode => ({
	regex: classList.contains(EleClass.MATCH_REGEX),
	case: classList.contains(EleClass.MATCH_CASE),
	stem: classList.contains(EleClass.MATCH_STEM),
	whole: classList.contains(EleClass.MATCH_WHOLE),
	diacritics: classList.contains(EleClass.MATCH_DIACRITICS),
});

/**
 * Refreshes the control of a term to reflect its current state.
 * @param term A term with an existing control.
 * @param idx The index of the term.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 */
const refreshTermControl = (term: MatchTerm, idx: number, highlightTags: HighlightTags, controlsInfo: ControlsInfo) => {
	const control = getControl(undefined, idx) as HTMLElement;
	control.classList.remove(Array.from(control.classList).find(className => className.startsWith(getTermClass(""))) ?? "-");
	control.classList.add(getTermClass(term.token));
	control.classList.add(EleClass.CONTROL, getTermClass(term.token));
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
	controlContent.onclick = event => // Overrides previous event handler in case of new term.
		focusOnTermJump(controlsInfo, highlightTags, event.shiftKey, term);
	controlContent.textContent = term.phrase;
};

/**
 * Removes a term control element.
 * @param idx The index of an existing control to remove.
 */
const removeTermControl = (idx: number) => {
	(getControl(undefined, idx) as HTMLElement).remove();
};

/**
 * Creates a clickable element to toggle one of the matching options for a term.
 * @param matchMode The match mode object to use.
 * @param matchType The match type of this option.
 * @param text Text content for the option, which is also used to determine the matching mode it controls.
 * @param onActivated A function, taking the identifier for the match option, to execute each time the option is activated.
 * @returns The resulting option element.
 */
const createTermOption = (
	matchMode: MatchMode,
	matchType: keyof MatchMode,
	text: string,
	onActivated: (matchType: string, checked: boolean) => void,
) => {
	const option = document.createElement("label");
	option.classList.add(EleClass.OPTION, getMatchModeOptionClass(matchType));
	const id = getInputIdSequential();
	option.htmlFor = id;
	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.id = id;
	checkbox.checked = matchMode[matchType];
	checkbox.tabIndex = -1;
	checkbox.addEventListener("click", () => {
		onActivated(matchType, checkbox.checked);
	});
	checkbox.addEventListener("keydown", event => {
		if (event.key === " ") {
			checkbox.click(); // Why is this not happening by default anyway?
			event.preventDefault();
		}
	});
	const label = document.createElement("span");
	label.textContent = text;
	option.addEventListener("mousedown", event => {
		event.preventDefault(); // Prevent the menu from perceiving a loss in focus (and closing) the second time an option is clicked.
	});
	option.addEventListener("mouseup", () => {
		if (!option.closest(`.${EleClass.MENU_OPEN}`)) { // So that the user can "pulldown" the menu and release over an option.
			checkbox.click();
		}
	});
	option.appendChild(checkbox);
	option.appendChild(label);
	return {
		optionElement: option,
		toggle: () => {
			checkbox.click();
		},
		makeFocusable: (focusable: boolean) => {
			if (focusable) {
				checkbox.removeAttribute("tabindex");
			} else {
				checkbox.tabIndex = -1;
			}
		},
	};
};

/**
 * Creates a menu structure containing clickable elements to individually toggle the matching options for a term.
 * @param term The term for which to create a menu.
 * @param matchMode The match mode object to use.
 * @param controlsInfo Details of controls being inserted.
 * @param onActivated A function, taking the identifier for a match option, to execute each time the option is activated.
 * @returns The resulting menu element.
 */
const createTermOptionList = (
	term: MatchTerm | undefined,
	matchMode: MatchMode,
	controlsInfo: ControlsInfo,
	onActivated: (matchType: string, checked: boolean) => void,
): { optionList: HTMLElement, controlReveal: HTMLButtonElement } => {
	const optionList = document.createElement("span");
	optionList.classList.add(EleClass.OPTION_LIST);
	const options = (() => {
		const options: Array<{ matchType: keyof MatchMode, title: string }> = [
			{ matchType: "case", title: "Case Sensitive" },
			{ matchType: "whole", title: "Whole Word" },
			{ matchType: "stem", title: "Stem Word" },
			{ matchType: "diacritics", title: "Diacritics Sensitive" },
			{ matchType: "regex", title: "Regex Mode" },
		];
		return options.map(({ matchType, title }) => {
			const { optionElement, toggle, makeFocusable } = createTermOption(matchMode, matchType, title, onActivated);
			optionList.appendChild(optionElement);
			return {
				matchType,
				title,
				toggle,
				makeFocusable,
			};
		});
	})();
	const closeList = (moveFocus: boolean) => {
		const input = document.querySelector(`#${EleID.BAR} .${EleClass.OPENED_MENU}`) as HTMLElement | null;
		if (input) {
			if (moveFocus) {
				input.focus();
			}
		} else if (moveFocus) {
			const focus = document.activeElement as HTMLElement | null;
			if (optionList.contains(focus)) {
				focus?.blur();
			}
		}
		getControl(term)?.classList.remove(EleClass.MENU_OPEN);
	};
	const stopKeyEvent = (event: KeyboardEvent) => {
		event.stopPropagation();
		if (event.key === "Tab") {
			return;
		}
		event.preventDefault();
	};
	const handleKeyEvent = (event: KeyboardEvent) => {
		stopKeyEvent(event);
		if (event.key === "Escape") {
			closeList(true);
		} else if (event.key.startsWith("Arrow")) {
			if (event.key === "ArrowUp" || event.key === "ArrowDown") {
				const down = event.key === "ArrowDown";
				const checkboxes = Array.from(optionList.querySelectorAll("input[type='checkbox']")) as Array<HTMLInputElement>;
				let idx = checkboxes.findIndex(checkbox => checkbox === document.activeElement);
				if (idx === -1) {
					idx = down ? 0 : (checkboxes.length - 1);
				} else {
					idx = (idx + (down ? 1 : -1) + checkboxes.length) % checkboxes.length;
				}
				checkboxes[idx].focus();
			} else {
				// TODO move to the menu of the next term
			}
		} else if (/\b\w\b/.test(event.key)) {
			options.some(option => {
				if (option.title.toLowerCase().startsWith(event.key)) {
					option.toggle();
					return true;
				}
				return false;
			});
			closeList(true);
		}
	};
	optionList.addEventListener("keydown", handleKeyEvent);
	optionList.addEventListener("keyup", stopKeyEvent);
	const forgetOpenedMenu = () => {
		document.querySelectorAll(`#${EleID.BAR} .${EleClass.OPENED_MENU}`).forEach(input => {
			input.classList.remove(EleClass.OPENED_MENU);
		});
	};
	optionList.addEventListener("focusin", () => {
		options.forEach(option => option.makeFocusable(true));
	});
	optionList.addEventListener("focusout", event => {
		optionList.removeAttribute("tabindex");
		const newFocus = event.relatedTarget as Element | null;
		if (optionList.contains(newFocus)) {
			return;
		}
		options.forEach(option => option.makeFocusable(false));
		if (newFocus?.classList.contains(EleClass.CONTROL_REVEAL)) {
			closeList(false);
		} else {
			closeList(true);
			forgetOpenedMenu();
		}
	});
	const controlReveal = document.createElement("button");
	controlReveal.type = "button";
	controlReveal.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_REVEAL);
	controlReveal.tabIndex = -1;
	controlReveal.disabled = !controlsInfo.barLook.showRevealIcon;
	controlReveal.addEventListener("mousedown", () => {
		const control = getControl(term);
		// If menu was open, it is about to be "just closed" because the mousedown will close it.
		// If menu was closed, remove "just closed" class if present.
		control?.classList.toggle(
			EleClass.MENU_JUST_CLOSED_BY_BUTTON, // *just closed "by button"* because this class is only applied here.
			control.classList.contains(EleClass.MENU_OPEN),
		);
		closeList(true);
		forgetOpenedMenu();
	});
	controlReveal.addEventListener("click", () => {
		if (controlReveal.closest(`.${EleClass.MENU_JUST_CLOSED_BY_BUTTON}`)) {
			return;
		}
		const input = document.querySelector(`#${EleID.BAR} .${EleClass.WAS_FOCUSED}`) as HTMLElement | null;
		input?.classList.add(EleClass.OPENED_MENU);
		openTermOptionList(term);
	});
	const controlRevealToggle = document.createElement("img");
	controlRevealToggle.src = chrome.runtime.getURL("/icons/reveal.svg");
	controlRevealToggle.draggable = false;
	controlReveal.appendChild(controlRevealToggle);
	return { optionList, controlReveal };
};

/**
 * Opens and focuses the menu of matching options for a term, allowing the user to toggle matching modes.
 * @param term The term for which to open a matching options menu.
 */
const openTermOptionList = (term: MatchTerm | undefined) => {
	const control = getControl(term);
	const input = control?.querySelector("input");
	const optionList = control?.querySelector(`.${EleClass.OPTION_LIST}`) as HTMLElement | null;
	if (!control || !input || !optionList) {
		assert(false, "term option menu not opened", "required element(s) not found",
			{ term: (term ? term : "term appender") });
		return;
	}
	control.classList.add(EleClass.MENU_OPEN);
	optionList.tabIndex = 0;
	optionList.focus();
};

/**
 * Inserts an interactive term control element.
 * @param terms Terms being controlled and highlighted.
 * @param idx The index in `terms` of a term to assign.
 * @param command The string of a command to display as a shortcut hint for jumping to the next term.
 * @param commandReverse The string of a command to display as a shortcut hint for jumping to the previous term.
 * @param controlsInfo Details of controls inserted.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 */
const insertTermControl = (
	terms: MatchTerms,
	idx: number,
	command: string,
	commandReverse: string,
	controlsInfo: ControlsInfo,
	highlightTags: HighlightTags,
) => {
	const term = terms[idx >= 0 ? idx : (terms.length + idx)] as MatchTerm;
	const { optionList, controlReveal } = createTermOptionList(term,
		term.matchMode,
		controlsInfo,
		(matchType: string, checked: boolean) => {
			const termUpdate = Object.assign({}, term);
			termUpdate.matchMode = Object.assign({}, termUpdate.matchMode);
			termUpdate.matchMode[matchType] = checked;
			termsSet(terms.map(termCurrent => termCurrent === term ? termUpdate : termCurrent));
		},
	);
	const controlPad = document.createElement("span");
	controlPad.classList.add(EleClass.CONTROL_PAD, EleClass.DISABLED);
	controlPad.appendChild(controlReveal);
	const controlContent = document.createElement("button");
	controlContent.type = "button";
	controlContent.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT);
	controlContent.tabIndex = -1;
	controlContent.textContent = term.phrase;
	controlContent.onclick = () => { // Hack: event handler property used so that the listener is not duplicated.
		focusOnTermJump(controlsInfo, highlightTags, false, term);
	};
	controlContent.addEventListener("mouseover", () => { // FIXME this is not screenreader friendly.
		updateTermTooltip(term, controlsInfo);
	});
	controlPad.appendChild(controlContent);
	const controlEdit = document.createElement("button");
	controlEdit.type = "button";
	controlEdit.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_EDIT);
	controlEdit.tabIndex = -1;
	controlEdit.disabled = !controlsInfo.barLook.showEditIcon;
	const controlEditChange = document.createElement("img");
	controlEditChange.classList.add(EleClass.PRIMARY);
	controlEditChange.src = chrome.runtime.getURL("/icons/edit.svg");
	controlEditChange.draggable = false;
	const controlEditRemove = document.createElement("img");
	controlEditRemove.classList.add(EleClass.SECONDARY);
	controlEditRemove.src = chrome.runtime.getURL("/icons/delete.svg");
	controlEditRemove.draggable = false;
	controlEdit.append(controlEditChange, controlEditRemove);
	controlPad.appendChild(controlEdit);
	insertTermInput(terms, controlPad, idx, input => controlPad.insertBefore(input, controlEdit));
	term.command = command;
	term.commandReverse = commandReverse;
	const control = document.createElement("span");
	control.classList.add(EleClass.CONTROL, getTermClass(term.token));
	control.appendChild(controlPad);
	control.appendChild(optionList);
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	(document.getElementById(EleID.BAR_TERMS) as HTMLElement).appendChild(control);
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
	EleClass.CONTROL + "-" + controlName
;

const controlVisibilityUpdate = (controlName: ControlButtonName, controlsInfo: ControlsInfo, terms: MatchTerms) => {
	const control = document.querySelector(`#${EleID.BAR} .${controlGetClass(controlName)}`);
	if (control) {
		const value = controlsInfo.barControlsShown[controlName];
		const shown = controlName === "replaceTerms"
			? (value && controlsInfo.termsOnHold.length > 0 && (
				controlsInfo.termsOnHold.length !== terms.length
				|| !controlsInfo.termsOnHold.every(termOnHold => terms.find(term => term.phrase === termOnHold.phrase))
			))
			: value;
		control.classList.toggle(EleClass.DISABLED, !shown);
	}
};

/**
 * Inserts constant bar controls into the toolbar.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param controlsInfo Details of controls to insert.
 * @param commands Browser commands to use in shortcut hints.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
			control.classList.add(EleClass.CONTROL, controlGetClass(controlName));
			(info.controlClasses ?? []).forEach(elementClass =>
				control.classList.add(elementClass)
			);
			control.tabIndex = -1;
			const pad = document.createElement("span");
			pad.classList.add(EleClass.CONTROL_PAD);
			pad.tabIndex = -1;
			const button = document.createElement("button");
			button.type = "button";
			button.classList.add(EleClass.CONTROL_BUTTON);
			button.tabIndex = -1;
			if (info.buttonClasses) {
				info.buttonClasses.forEach(className => {
					button.classList.add(className);
				});
			}
			if (info.path) {
				const image = document.createElement("img");
				if (info.pathSecondary) {
					image.classList.add(EleClass.PRIMARY);
				}
				image.src = chrome.runtime.getURL(info.path);
				image.draggable = false;
				button.appendChild(image);
			}
			if (info.pathSecondary) {
				// TODO make function
				const image = document.createElement("img");
				image.classList.add(EleClass.SECONDARY);
				image.src = chrome.runtime.getURL(info.pathSecondary);
				image.draggable = false;
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
				control.classList.add(EleClass.DISABLED);
			}
			if (info.onClick) {
				button.addEventListener("click", info.onClick);
			}
			if (info.setUp) {
				info.setUp(control);
			}
			(document.getElementById(info.containerId) as HTMLElement).appendChild(control);
		};

		return (terms: MatchTerms, controlName: ControlButtonName, hideWhenInactive: boolean,
			controlsInfo: ControlsInfo) => {
			controlInsertWithInfo(controlName, ({
				toggleBarCollapsed: {
					controlClasses: [ EleClass.UNCOLLAPSIBLE ],
					path: "/icons/arrow.svg",
					pathSecondary: "/icons/mms.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => {
						controlsInfo.barCollapsed = !controlsInfo.barCollapsed;
						messageSendBackground({
							toggle: {
								barCollapsedOn: controlsInfo.barCollapsed,
							},
						});
						const bar = document.getElementById(EleID.BAR) as HTMLElement;
						bar.classList.toggle(EleClass.COLLAPSED, controlsInfo.barCollapsed);
					},
				},
				disableTabResearch: {
					path: "/icons/close.svg",
					containerId: EleID.BAR_LEFT,	
					onClick: () => messageSendBackground({
						deactivateTabResearch: true,
					}),
				},
				performSearch: {
					path: "/icons/search.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => messageSendBackground({
						performSearch: true,
					}),
				},
				toggleHighlights: {
					path: "/icons/show.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => messageSendBackground({
						toggle: {
							highlightsShownOn: !controlsInfo.highlightsShown,
						},
					}),
				},
				appendTerm: {
					buttonClasses: [ EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT ],
					path: "/icons/create.svg",
					containerId: EleID.BAR_RIGHT,
					setUp: container => {
						const pad = container.querySelector(`.${EleClass.CONTROL_PAD}`) as HTMLElement;
						insertTermInput(terms, pad, TermChange.CREATE, input => pad.appendChild(input));
						updateTermControlMatchModeClassList(controlsInfo.matchMode, container.classList);
						const { optionList, controlReveal } = createTermOptionList(
							undefined,
							controlsInfo.matchMode,
							controlsInfo,
							(matchType, checked) => {
								const matchMode = getTermControlMatchModeFromClassList(container.classList);
								matchMode[matchType] = checked;
								updateTermControlMatchModeClassList(matchMode, container.classList);
							},
						);
						pad.appendChild(controlReveal);
						container.appendChild(optionList);
					},
				},
				replaceTerms: {
					path: "/icons/refresh.svg",
					containerId: EleID.BAR_RIGHT,
					onClick: () => {
						termsSet(controlsInfo.termsOnHold);
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
		bar.id = EleID.BAR;
		// Inputs should not be focusable unless user has already focused bar. (1)
		const inputsSetFocusable = (focusable: boolean) => {
			bar.querySelectorAll(`input.${EleClass.CONTROL_INPUT}`).forEach((input: HTMLElement) => {
				if (focusable) {
					input.removeAttribute("tabindex");
				} else {
					input.tabIndex = -1;
				}
			});
		};
		// Attempt to forcibly prevent website code from receiving certain events when the bar has focus.
		// Works if the website has used event properties; swaps the website-assigned functions with `undefined`.
		const documentEventProperties: Record<string, ((e: KeyboardEvent) => unknown) | undefined> = {
			onkeydown: undefined,
			onkeyup: undefined,
			onkeypress: undefined,
		};
		bar.addEventListener("focusin", () => {
			inputsSetFocusable(true);
			Object.keys(documentEventProperties).forEach(property => {
				documentEventProperties[property] = document[property];
				document[property] = (e: KeyboardEvent) => e.cancelBubble = true;
			});
		});
		bar.addEventListener("focusout", event => {
			// Only if focus is not moving (and has not already moved) somewhere else within the bar.
			if (!bar.contains(event.relatedTarget as Node) && !bar.contains(document.activeElement)) {
				inputsSetFocusable(false);
			}
			Object.keys(documentEventProperties).forEach(property => {
				document[property] = documentEventProperties[property];
			});
		});
		const updateInputsFocused = () => {
			// Causes the last focused input to be forgotten, as long as the user is not currently interacting with the bar.
			// If the user is interacting with the bar, the information may be needed for restoring (or preparing to restore) focus.
			if (!document.querySelector(`#${EleID.BAR}:active`)) {
				bar.querySelectorAll(`.${EleClass.WAS_FOCUSED}`).forEach(input => {
					input.classList.remove(EleClass.WAS_FOCUSED);
				});
			}
		};
		bar.addEventListener("mousedown", updateInputsFocused);
		bar.addEventListener("mouseup", updateInputsFocused);
		bar.addEventListener("contextmenu", event => {
			event.preventDefault();
		});
		bar.addEventListener("keydown", event => {
			if (event.key === "Tab") { // This is the only key that will take effect in term inputs; the rest are blocked automatically.
				event.stopPropagation();
				const controlInput = document.activeElement as HTMLInputElement | null;
				if (!controlInput || !bar.contains(controlInput)) {
					return;
				}
				const control = controlInput.closest(`.${EleClass.CONTROL}`);
				const barTerms = document.getElementById(EleID.BAR_TERMS) as Element;
				if (control && !event.shiftKey && control === barTerms.lastElementChild) {
					// Special case to specifically focus the term append input, in case the button is hidden.
					event.preventDefault();
					produceEffectOnCommand.next({ type: CommandType.FOCUS_TERM_INPUT });
					return;
				}
				if (!control || !(event.shiftKey
					? control === barTerms.firstElementChild
					: control === getControlAppendTerm())
				) {
					return;
				}
				event.preventDefault();
				if (!event.shiftKey && controlInput.value.length) {
					// Force term-append to commit (add new term) then regain focus.
					controlInput.blur();
					// Use focus-term-input command to ensure that focus+selection will later be restored.
					// TODO ensure focus+selection is restored by a cleaner method
					produceEffectOnCommand.next({ type: CommandType.FOCUS_TERM_INPUT });
				} else {
					// Ensure proper return of focus+selection.
					controlInput.blur();
				}
			}
		});
		if (controlsInfo.highlightsShown) {
			bar.classList.add(EleClass.HIGHLIGHTS_SHOWN);
		}
		if (!controlsInfo.pageModifyEnabled) {
			bar.classList.add(EleClass.DISABLED);
		}
		const barLeft = document.createElement("span");
		barLeft.id = EleID.BAR_LEFT;
		barLeft.classList.add(EleClass.BAR_CONTROLS);
		const barTerms = document.createElement("span");
		barTerms.id = EleID.BAR_TERMS;
		const barRight = document.createElement("span");
		barRight.id = EleID.BAR_RIGHT;
		barRight.classList.add(EleClass.BAR_CONTROLS);
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
		gutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

/**
 * Removes the control bar and scroll gutter.
 */
const controlsRemove = () => {
	const bar = document.getElementById(EleID.BAR);
	const gutter = document.getElementById(EleID.MARKER_GUTTER);
	if (bar) {
		if (document.activeElement && bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur(); // Allow focus+selection to be properly restored.
		}
		bar.remove();
	}
	if (gutter) {
		gutter.remove();
	}
};

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
const elementsPurgeClass = (
	className: string,
	root: HTMLElement | DocumentFragment = document.body,
	selectorPrefix = "",
	predicate?: (classList: DOMTokenList) => boolean
) =>
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
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkersPaint = (terms: MatchTerms, hues: TermHues) => {
	if (terms.length === 0) {
		return; // Efficient escape in case of no possible markers to be inserted.
	}
	// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
	const termsAllowed = new Set(terms.slice(0, hues.length));
	const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
	let markersHtml = "";
	document.body.querySelectorAll(
		"[markmysearch-h_id]" + ((paintUseExperimental && !paintUsePaintingFallback) ? ", [markmysearch-h_beneath]" : "")
	).forEach((element: HTMLElement) => {
		const terms = (element[EleProperty.INFO] as ElementInfo | undefined)?.flows.flatMap(flow => flow.boxesInfo
			.map(boxInfo => boxInfo.term)
			.filter(term => termsAllowed.has(term))
		) ?? [];
		const yRelative = getElementYRelative(element);
		// TODO use single marker with custom style
		markersHtml += terms.map((term, i) => `<div class="${
			getTermClass(term.token)
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
	if (!element[EleProperty.INFO]) {
		element[EleProperty.INFO] = {
			id: "",
			styleRuleIdx: -1,
			isPaintable: (paintUseExperimental && !paintUsePaintingFallback) ? !element.closest("a") : true,
			flows: [],
		} as ElementInfo;
	}
}) => {
	if (!highlightTags.reject.has(element.tagName)) {
		cacheModify(element);
		Array.from(element.children).forEach(child => cacheExtend(child, highlightTags));
	}
};

/**
 * Reverts all DOM changes made by the PAINT algorithm, under a given root.
 * @param root The root element under which changes are reverted, __not included__.
 */
const highlightingAttributesCleanup = (root: Element) => {
	root.querySelectorAll("[markmysearch-h_id]").forEach(element => {
		element.removeAttribute("markmysearch-h_id");
		delete element["markmysearch-h_id"];
	});
	root.querySelectorAll("[markmysearch-h_beneath]").forEach(element => {
		element.removeAttribute("markmysearch-h_beneath");
	});
};

/**
 * From the element specified (included) to its highest ancestor element (not included),
 * mark each as _an element beneath a highlightable one_ (which could e.g. have a background that obscures highlights).
 * This allows them to be selected in CSS.
 * @param element The lowest descendant to be marked of the highlightable element.
 */
const markElementsUpToHighlightable: (element: Element) => void = paintUsePaintingFallback
	? () => undefined
	: element => {
		if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
			element.setAttribute("markmysearch-h_beneath", "");
			markElementsUpToHighlightable(element.parentElement as Element);
		}
	}
;

/**
 * Gets an array of all flows from the node provided to its last OR first sibling,
 * where a 'flow' is an array of text nodes considered to flow into each other in the document.
 * For example, a paragraph will _ideally_ be considered a flow, but in fact may not be heuristically detected as such.
 * @param node The node from which flows are collected, up to the last descendant of its last sibling.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 * @param textFlows __Only supplied in recursion.__ Holds the flows gathered so far.
 * @param textFlow __Only supplied in recursion.__ Points to the last flow in `textFlows`.
 */
const getTextFlows = (
	node: Node,
	highlightTags: HighlightTags,
	textFlows: Array<Array<Text>> = [ [] ],
	textFlow: Array<Text> = textFlows[0],
): Array<Array<Text>> => {
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
			if (node.firstChild) {
				getTextFlows(node.firstChild, highlightTags, textFlows, textFlow);
				textFlow = textFlows[textFlows.length - 1];
				if (breaksFlow && textFlow.length) {
					textFlow = [];
					textFlows.push(textFlow);
				}
			}
		}
		node = node.nextSibling as ChildNode; // May be null (checked by loop condition).
	} while (node);
	return textFlows;
};

/**
 * Removes the flows cache from all descendant elements.
 * @param element The ancestor below which to forget flows.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 */
const flowsRemove = (element: Element, highlightTags: HighlightTags) => {
	if (highlightTags.reject.has(element.tagName)) {
		return;
	}
	if (element[EleProperty.INFO]) {
		(element[EleProperty.INFO] as ElementInfo).flows = [];
	}
	Array.from(element.children).forEach(child => flowsRemove(child, highlightTags));
};

/**
 * TODO document
 * @param terms Terms to find and highlight.
 * @param textFlow Consecutive text nodes to highlight inside.
 */
const flowCacheWithBoxesInfo = (terms: MatchTerms, textFlow: Array<Text>,
	getHighlightingId: GetHighlightingID, styleUpdates: StyleUpdates) => {
	const flow: HighlightFlow = {
		text: textFlow.map(node => node.textContent).join(""),
		nodeStart: textFlow[0],
		nodeEnd: textFlow[textFlow.length - 1],
		boxesInfo: [],
	};
	const getAncestorCommon = (ancestor: Element, node: Node): Element =>
		ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as Element, node);
	const ancestor = getAncestorCommon(flow.nodeStart.parentElement as Element, flow.nodeEnd);
	if (ancestor[EleProperty.INFO]) {
		(ancestor[EleProperty.INFO] as ElementInfo).flows.push(flow);
	} else {
		// This condition should be impossible, but since in rare cases (typically when running before "document_idle")
		// mutation observers may not always fire, it must be accounted for.
		console.warn("Aborting highlight box-info caching: Element has no cache.", ancestor);
		return;
	}
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
				node = textFlow[++i];
				textStart = textEnd;
				textEnd += node.length;
			}
			(node.parentElement as Element).setAttribute("markmysearch-h_beneath", ""); // TODO optimise?
			if ((node.parentElement as Element)["markmysearch-h_id"]
				&& !(node.parentElement as Element).hasAttribute("markmysearch-h_id")
			) {
				(node.parentElement as Element).setAttribute("markmysearch-h_id",
					(node.parentElement as Element)["markmysearch-h_id"]);
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
				node = textFlow[++i];
				textStart = textEnd;
				textEnd += node.length;
			}
		}
	}
	if (flow.boxesInfo.length) {
		const ancestorHighlightable = getAncestorHighlightable(ancestor.firstChild as Node);
		styleUpdates.observe(ancestorHighlightable);
		if ((ancestorHighlightable[EleProperty.INFO] as ElementInfo).id === "") {
			const highlighting = ancestorHighlightable[EleProperty.INFO] as ElementInfo;
			highlighting.id = getHighlightingId.next().value;
			ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
			ancestorHighlightable["markmysearch-h_id"] = highlighting.id;
		}
		markElementsUpToHighlightable(ancestor);
	}
};

const boxesInfoCalculate = (terms: MatchTerms, flowOwner: Element, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	styleUpdates: StyleUpdates) => {
	if (!flowOwner.firstChild) {
		return;
	}
	const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
	const textFlows = getTextFlows(flowOwner.firstChild, highlightTags);
	flowsRemove(flowOwner, highlightTags);
	textFlows // The first flow is always before the first break, and the last after the last. Either may be empty.
		.slice((breaksFlow && textFlows[0].length) ? 0 : 1, (breaksFlow && textFlows[textFlows.length - 1].length) ? undefined : -1)
		.forEach(textFlow => flowCacheWithBoxesInfo(terms, textFlow, getHighlightingId, styleUpdates));
	termCountCheck(); // Major performance hit when using very small delay or small delay maximum for debounce.
};

const boxesInfoCalculateForFlowOwners = (terms: MatchTerms, node: Node, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	styleUpdates: StyleUpdates) => {
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
				termCountCheck, getHighlightingId, styleUpdates);
		} else {
			// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
			boxesInfoCalculateForFlowOwners(terms, parent, highlightTags,
				termCountCheck, getHighlightingId, styleUpdates);
		}
	} else {
		// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
		// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
		// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
		// or end inside elements which do not contain and are not contained by a given element. Will not implement.
		boxesInfoCalculate(terms, parent, highlightTags,
			termCountCheck, getHighlightingId, styleUpdates);
	}
};

const boxesInfoCalculateForFlowOwnersFromContent = (terms: MatchTerms, element: Element, highlightTags: HighlightTags,
	termCountCheck: TermCountCheck, getHighlightingId: GetHighlightingID,
	styleUpdates: StyleUpdates) => {
	// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
	// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
	if (highlightTags.flow.has(element.tagName)) {
		// The element may include non self-contained flows.
		boxesInfoCalculateForFlowOwners(terms, element, highlightTags,
			termCountCheck, getHighlightingId, styleUpdates);
	} else {
		// The element can only include self-contained flows, so flows need only be recalculated below the element.
		boxesInfoCalculate(terms, element, highlightTags,
			termCountCheck, getHighlightingId, styleUpdates);
	}
};

/** TODO update documentation
 * FIXME this is a cut-down and adapted legacy function which may not function efficiently or fully correctly.
 * Remove highlights for matches of terms.
 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const boxesInfoRemoveForTerms = (terms: MatchTerms = [], root: HTMLElement | DocumentFragment = document.body) => {
	for (const element of Array.from(root.querySelectorAll("[markmysearch-h_id]"))) {
		const filterBoxesInfo = (element: Element) => {
			const elementInfo = element[EleProperty.INFO] as ElementInfo;
			if (!elementInfo) {
				return;
			}
			elementInfo.flows.forEach(flow => {
				flow.boxesInfo = flow.boxesInfo.filter(boxInfo => terms.every(term => term.token !== boxInfo.term.token));
			});
			Array.from(element.children).forEach(child => filterBoxesInfo(child));
		};
		filterBoxesInfo(element);
	}
};

/**
 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
 */
const constructHighlightStyleRule: (highlightId: string, boxes: Array<HighlightBox>, terms: MatchTerms) => string =
paintUseExperimental
	? paintUsePaintingFallback
		? highlightId =>
			`body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
				getElementDrawId(highlightId)
			}) !important; background-repeat: no-repeat !important; }`
		: (highlightId, boxes) =>
			`body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${
				JSON.stringify(boxes)
			}; }`
	: (highlightId, boxes, terms) =>
		`#${
			EleID.BAR
		}.${
			EleClass.HIGHLIGHTS_SHOWN
		} ~ body [markmysearch-h_id="${
			highlightId
		}"] { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
			boxes.map(box =>
				`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${(
					terms.find(term => term.token === box.token) as MatchTerm).hue
				} 100% 50% / 0.4)'/%3E`
			).join("")
		}%3C/svg%3E") !important; }`
;

const getStyleRules: (root: Element, recurse: boolean, terms: MatchTerms) => Array<HighlightStyleRuleInfo> = (() => {
	const calculateBoxes = (owner: Element, element: Element, range: Range): Array<HighlightBox> => {
		const elementInfo = element[EleProperty.INFO] as ElementInfo;
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
						token: boxInfo.term.token,
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
			(child[EleProperty.INFO] ? !(child[EleProperty.INFO] as ElementInfo).isPaintable : false)
				? getBoxesOwned(owner, child, range) : []
		))
	;

	const collectStyleRules = (element: Element, recurse: boolean,
		range: Range, styleRules: Array<HighlightStyleRuleInfo>, terms: MatchTerms) => {
		const elementInfo = element[EleProperty.INFO] as ElementInfo;
		const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
		if (boxes.length) {
			styleRules.push({
				rule: constructHighlightStyleRule(elementInfo.id, boxes, terms),
				element,
			});
		}
		(recurse ? Array.from(element.children) as Array<HTMLElement> : []).forEach(child => {
			if (child[EleProperty.INFO]) {
				collectStyleRules(child, recurse, range, styleRules, terms);
			}
		});
	};

	const collectElements = (element: Element, recurse: boolean, range: Range, containers: Array<Element>) => {
		const elementInfo = element[EleProperty.INFO] as ElementInfo;
		const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
		if (boxes.length) {
			const container = document.createElement("div");
			container.id = getElementDrawId(elementInfo.id);
			boxes.forEach(box => {
				const element = document.createElement("div");
				element.style.position = "absolute";
				element.style.left = box.x.toString() + "px";
				element.style.top = box.y.toString() + "px";
				element.style.width = box.width.toString() + "px";
				element.style.height = box.height.toString() + "px";
				element.classList.add(EleClass.TERM, getTermClass(box.token));
				container.appendChild(element);
			});
			const boxRightmost = boxes.reduce((box, boxCurrent) =>
				box && (box.x + box.width > boxCurrent.x + boxCurrent.width) ? box : boxCurrent
			);
			const boxDownmost = boxes.reduce((box, boxCurrent) =>
				box && (box.y + box.height > boxCurrent.y + boxCurrent.height) ? box : boxCurrent
			);
			container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
			container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
			containers.push(container);
		}
		(recurse ? Array.from(element.children) as Array<HTMLElement> : []).forEach(child => {
			if (child[EleProperty.INFO]) {
				collectElements(child, recurse, range, containers);
			}
		});
	};

	return paintUseExperimental && paintUsePaintingFallback
		? (root, recurse, terms) => {
			const containers: Array<Element> = [];
			collectElements(root, recurse, document.createRange(), containers);
			const parent = document.getElementById(EleID.DRAW_CONTAINER) as Element;
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
	const styleSheet = (document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement)
		.sheet as CSSStyleSheet;
	styleRules.forEach(({ rule, element }) => {
		const elementInfo = element[EleProperty.INFO] as ElementInfo;
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

	insertAfter (itemBefore: UnbrokenNodeListItem | null, value: Text): UnbrokenNodeListItem {
		if (itemBefore) {
			itemBefore.next = { next: itemBefore.next, value };
			return itemBefore.next;
		} else {
			this.first = { next: this.first, value };
			return this.first;
		}
	}

	remove (itemBefore: UnbrokenNodeListItem | null) {
		if (!itemBefore) {
			this.first = this.first?.next ?? null;
			return;
		}
		if (this.last === itemBefore.next) {
			this.last = itemBefore;
		}
		itemBefore.next = itemBefore.next?.next ?? null;
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
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 * @param termCountCheck A function for requesting that term occurrence count indicators be regenerated.
 */
const generateTermHighlightsUnderNode = (() => {
	/**
	 * Highlights a term matched in a text node.
	 * @param term The term matched.
	 * @param textAfterNode The text node to highlight inside.
	 * @param start The first character index of the match within the text node.
	 * @param end The last character index of the match within the text node.
	 * @param nodeItems The singly linked list of consecutive text nodes being internally highlighted.
	 * @param nodeItemPrevious The previous item in the text node list.
	 * @returns The new previous item (the item just highlighted).
	 */
	const highlightInsideNode = (
		term: MatchTerm,
		textAfterNode: Node,
		start: number,
		end: number,
		nodeItems: UnbrokenNodeList,
		nodeItemPrevious: UnbrokenNodeListItem | null,
	): UnbrokenNodeListItem => {
		// This is necessarily a destructive strategy. Occasional damage to the webpage and its functionality is unavoidable.
		const text = textAfterNode.textContent ?? "";
		if (text.length === 0) {
			textAfterNode.parentElement?.removeChild(textAfterNode);
			return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem;
		}
		const parent = textAfterNode.parentNode as Node;
		const textEndNode = document.createTextNode(text.substring(start, end));
		const highlight = document.createElement(HIGHLIGHT_TAG);
		highlight.classList.add(getTermClass(term.token));
		highlight.appendChild(textEndNode);
		textAfterNode.textContent = text.substring(end);
		parent.insertBefore(highlight, textAfterNode);
		parent[ELEMENT_IS_KNOWN] = true;
		const textEndNodeItem = nodeItems.insertAfter(nodeItemPrevious, textEndNode);
		if (start > 0) {
			const textStartNode = document.createTextNode(text.substring(0, start));
			parent.insertBefore(textStartNode, highlight);
			nodeItems.insertAfter(nodeItemPrevious, textStartNode);
		}
		return textEndNodeItem;
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
					// TODO join together nodes where possible
					// TODO investigate why, under some circumstances, new empty highlight elements keep being produced
					// - (to observe, remove the code that deletes empty nodes during restoration)
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
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 * @param visitSiblings Whether to visit the siblings of the root node.
	 */
	const insertHighlights = (
		terms: MatchTerms,
		node: Node,
		highlightTags: HighlightTags,
		nodeItems = new UnbrokenNodeList,
		visitSiblings = true,
	) => {
		// TODO support for <iframe>?
		do {
			switch (node.nodeType) {
			case Node.ELEMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE: {
				if (highlightTags.reject.has((node as Element).tagName)) {
					break;
				}
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
				break;
			} case Node.TEXT_NODE: {
				nodeItems.push(node as Text);
				break;
			}}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
		} while (node && visitSiblings);
	};

	return (
		terms: MatchTerms,
		rootNode: Node,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) => {
		if (rootNode.nodeType === Node.TEXT_NODE) {
			const nodeItems = new UnbrokenNodeList;
			nodeItems.push(rootNode as Text);
			highlightInBlock(terms, nodeItems);
		} else {
			const nodeItems = new UnbrokenNodeList;
			insertHighlights(terms, rootNode, highlightTags, nodeItems, false);
			if (nodeItems.first) {
				highlightInBlock(terms, nodeItems);
			}
		}
		termCountCheck();
	};
})();

/**
 * Revert all direct DOM tree changes introduced by the extension, under a root node.
 * Circumstantial and non-direct alterations may remain.
 * @param classNames Class names of the highlights to remove. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const elementsRestore = (classNames: Array<string> = [], root: HTMLElement | DocumentFragment = document.body) => {
	const highlights = Array.from(root.querySelectorAll(
		classNames.length ? `${HIGHLIGHT_TAG}.${classNames.join(`, ${HIGHLIGHT_TAG}.`)}` : HIGHLIGHT_TAG
	)).reverse();
	// TODO attempt to join text nodes back together
	for (const highlight of Array.from(highlights)) {
		highlight.outerHTML = highlight.innerHTML;
	}
	if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
		root = (root as DocumentFragment).getRootNode() as HTMLElement;
		if (root.nodeType === Node.TEXT_NODE) {
			return;
		}
	}
	elementsPurgeClass(EleClass.FOCUS_CONTAINER, root);
	elementsPurgeClass(EleClass.FOCUS, root);
	elementsRemakeUnfocusable(root);
};

/**
 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkersClassic = (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) => {
	if (terms.length === 0) {
		return; // No terms results in an empty selector, which is not allowed.
	}
	const regexMatchTermSelector = new RegExp(`\\b${EleClass.TERM}(?:-\\w+)+\\b`);
	const containerBlockSelector = getContainerBlockSelector(highlightTags);
	const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
	const containersInfo: Array<{
		container: HTMLElement
		termsAdded: Set<string>
	}> = [];
	let markersHtml = "";
	document.body.querySelectorAll(terms
		.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
		.map(term => `${HIGHLIGHT_TAG}.${getTermClass(term.token)}`)
		.join(", ")
	).forEach((highlight: HTMLElement) => {
		const container = getContainerBlock(highlight, highlightTags, containerBlockSelector);
		const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
		const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
		const yRelative = getElementYRelative(container);
		let markerCss = `top: ${yRelative * 100}%;`;
		if (containerIdx !== -1) {
			if (containersInfo[containerIdx].container === container) {
				if (containersInfo[containerIdx].termsAdded.has(getTermToken(className))) {
					return;
				} else {
					const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
					markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
					containersInfo[containerIdx].termsAdded.add(getTermToken(className));
				}
			} else {
				containersInfo.splice(containerIdx);
				containersInfo.push({ container, termsAdded: new Set([ getTermToken(className) ]) });
			}
		} else {
			containersInfo.push({ container, termsAdded: new Set([ getTermToken(className) ]) });
		}
		markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
	});
	gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
	gutter.innerHTML = markersHtml;
};

// TODO document
const focusOnScrollMarkerClassic = (term: MatchTerm | undefined, container: HTMLElement) => {
	const scrollMarkerGutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
	elementsPurgeClass(EleClass.FOCUS, scrollMarkerGutter);
	// eslint-disable-next-line no-constant-condition
	[6, 5, 4, 3, 2].some(precisionFactor => {
		const precision = 10**precisionFactor;
		const scrollMarker = scrollMarkerGutter.querySelector(
			`${term ? `.${getTermClass(term.token)}` : ""}[top^="${
				Math.trunc(getElementYRelative(container) * precision) / precision
			}"]`
		) as HTMLElement | null;
		if (scrollMarker) {
			scrollMarker.classList.add(EleClass.FOCUS);
			return true;
		}
		return false;
	});
};

/**
 * Scrolls to and focuses the next block containing an occurrence of a term in the document, from the current selection position.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
		container.classList.add(EleClass.FOCUS_CONTAINER);
		elementTerm.classList.add(EleClass.FOCUS);
		elementToSelect = Array.from(container.getElementsByTagName(HIGHLIGHT_TAG))
			.every(thisElement => getContainerBlock(thisElement.parentElement as HTMLElement, highlightTags) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(EleClass.FOCUS_REVERT);
			elementToSelect.tabIndex = 0;
		}
		focusElement(elementToSelect);
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(EleClass.REMOVE);
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
		const termSelector = term ? getTermClass(term.token) : undefined;
		const focusBase = document.body
			.getElementsByClassName(EleClass.FOCUS)[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(EleClass.FOCUS_CONTAINER)[0] as HTMLElement;
		const selection = document.getSelection();
		const activeElement = document.activeElement;
		if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${EleID.BAR}`)) {
			(activeElement as HTMLInputElement).blur();
		}
		const selectionFocus = selection && (!activeElement
			|| activeElement === document.body || !document.body.contains(activeElement)
			|| activeElement === focusBase || activeElement.contains(focusContainer)
		)
			? selection.focusNode
			: activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(EleClass.FOCUS);
			elementsPurgeClass(EleClass.FOCUS_CONTAINER);
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
			element.tagName === HIGHLIGHT_TAG_UPPER
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
		document.body.querySelectorAll(`.${EleClass.REMOVE}`).forEach((element: HTMLElement) => {
			element.remove();
		});
		focusOnScrollMarker(term, container, controlsInfo);
	};
})();

/**
 * Scrolls to and focuses the next occurrence of a term in the document, from the current selection position.
 * @param controlsInfo Details of toolbar controls.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 * @param reversed Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
 * @param nodeStart __Only supplied in recursion.__ Specifies a node at which to begin scanning.
 */
const focusOnTermStepClassic = (() => {
	const getSiblingHighlightFinal = (highlight: HTMLElement, node: Node,
		nextSiblingMethod: "nextSibling" | "previousSibling"): HTMLElement =>
		node[nextSiblingMethod]
			? (node[nextSiblingMethod] as Node).nodeType === Node.ELEMENT_NODE
				? (node[nextSiblingMethod] as HTMLElement).tagName === HIGHLIGHT_TAG_UPPER
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

	const getTopLevelHighlight = (element: Element) => {
		const closestHighlight = (element.parentElement as Element).closest(HIGHLIGHT_TAG);
		return closestHighlight ? getTopLevelHighlight(closestHighlight) : element;
	};

	const stepToElement = (controlsInfo: ControlsInfo, highlightTags: HighlightTags, element: HTMLElement) => {
		element = getTopLevelHighlight(element);
		const elementFirst = getSiblingHighlightFinal(element, element, "previousSibling");
		const elementLast = getSiblingHighlightFinal(element, element, "nextSibling");
		(getSelection() as Selection).setBaseAndExtent(elementFirst, 0, elementLast, elementLast.childNodes.length);
		element.scrollIntoView({ block: "center" });
		focusOnScrollMarker(undefined, getContainerBlock(element, highlightTags), controlsInfo);
	};

	return (controlsInfo: ControlsInfo, highlightTags: HighlightTags, reversed: boolean, nodeStart?: Node) => {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		elementsPurgeClass(EleClass.FOCUS);
		const selection = getSelection();
		const bar = document.getElementById(EleID.BAR);
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
			(element.parentElement as Element).closest(HIGHLIGHT_TAG)
				? NodeFilter.FILTER_REJECT
				: (element.tagName === HIGHLIGHT_TAG_UPPER && isVisible(element))
					? NodeFilter.FILTER_ACCEPT
					: NodeFilter.FILTER_SKIP
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
 * @param controlsInfo Details of controls to insert.
 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
 * @param termCountCheck A function for requesting that term occurrence count indicators be regenerated.
 * @param mutationUpdates An observer which selectively performs highlighting on observing changes.
 */
const beginHighlighting = (
	terms: MatchTerms,
	termsToPurge: MatchTerms,
	controlsInfo: ControlsInfo,
	highlightTags: HighlightTags,
	termCountCheck: TermCountCheck,
	mutationUpdates: MutationUpdates,
) => {
	mutationUpdates.disconnect();
	if (termsToPurge.length) {
		elementsRestore(termsToPurge.map(term => getTermClass(term.token)));
	}
	generateTermHighlightsUnderNode(terms, document.body, highlightTags, termCountCheck);
	terms.forEach(term => updateTermOccurringStatus(term, controlsInfo));
	mutationUpdates.observe();
};

/**
 * Safely removes focus from the toolbar, returning it to the current document.
 * @returns `true` if focus was changed (i.e. it was in the toolbar), `false` otherwise.
 */
const focusReturnToDocument = (): boolean => {
	const activeElement = document.activeElement;
	if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${EleID.BAR}`)) {
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
 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
 * TODO document params
 */
const mutationUpdatesGet = (() => {
	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param rejectSelector A selector string for ancestor tags to cause rejection.
	 * @param element An element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
		!element.closest(rejectSelector) && element.tagName !== HIGHLIGHT_TAG_UPPER
	;

	return (
		termCountCheck: TermCountCheck,
		getHighlightingId: GetHighlightingID,
		styleUpdates: StyleUpdates,
		highlightTags: HighlightTags,
		terms: MatchTerms,
		controlsInfo: ControlsInfo,
	): MutationUpdates => {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		const mutationUpdates = {
			observe: () => observer.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
			}),
			disconnect: () => observer.disconnect(),
		};
		const observer = (controlsInfo.paintReplaceByClassic ? () => {
			const elements: Set<HTMLElement> = new Set;
			let periodDateLast = 0;
			let periodHighlightCount = 0;
			let throttling = false;
			let highlightIsPending = false;
			const highlightElements = () => {
				highlightIsPending = false;
				for (const element of elements) {
					elementsRestore([], element);
					generateTermHighlightsUnderNode(terms, element, highlightTags, termCountCheck);
				}
				periodHighlightCount += elements.size;
				elements.clear();
			};
			const highlightElementsLimited = () => {
				const periodInterval = Date.now() - periodDateLast;
				if (periodInterval > 400) {
					const periodHighlightRate = periodHighlightCount / periodInterval; // Highlight calls per millisecond.
					//console.log(periodHighlightCount, periodInterval, periodHighlightRate);
					throttling = periodHighlightRate > 0.006;
					periodDateLast = Date.now();
					periodHighlightCount = 0;
				}
				if (throttling || highlightIsPending) {
					if (!highlightIsPending) {
						highlightIsPending = true;
						setTimeout(highlightElements, 100);
					}
				} else {
					highlightElements();
				}
			};
			return new MutationObserver(mutations => {
				//mutationUpdates.disconnect();
				const elementsKnown: Set<HTMLElement> = new Set;
				for (const mutation of mutations) {
					const element = mutation.target.nodeType === Node.TEXT_NODE
						? mutation.target.parentElement as HTMLElement
						: mutation.target as HTMLElement;
					if (element) {
						if (element[ELEMENT_IS_KNOWN]) {
							elementsKnown.add(element);
						} else if ((mutation.type === "childList" || !element.querySelector(HIGHLIGHT_TAG))
							&& canHighlightElement(rejectSelector, element)) {
							elements.add(element);
						}
					}
				}
				for (const element of elementsKnown) {
					delete element[ELEMENT_IS_KNOWN];
				}
				if (elementsKnown.size) {
					//mutationUpdates.observe();
					return;
				}
				for (const element of elements) {
					for (const elementOther of elements) {
						if (elementOther !== element && element.contains(elementOther)) {
							elements.delete(elementOther);
						}
					}
				}
				highlightElementsLimited();
				//mutationUpdates.observe();
			});
		} : () => {
			return new MutationObserver(mutations => {
				// TODO optimise as above
				const elements: Set<HTMLElement> = new Set;
				for (const mutation of mutations) {
					for (const node of Array.from(mutation.addedNodes)) {
						if (node.nodeType === Node.ELEMENT_NODE && canHighlightElement(rejectSelector, node as Element)) {
							cacheExtend(node as Element, highlightTags);
						}
					}
					if (mutation.type === "characterData"
						&& mutation.target.parentElement && canHighlightElement(rejectSelector, mutation.target.parentElement)) {
						elements.add(mutation.target.parentElement);
					}
					for (const node of Array.from(mutation.addedNodes)) {
						if (node.nodeType === Node.ELEMENT_NODE) {
							if (canHighlightElement(rejectSelector, node as Element)) {
								elements.add(node as HTMLElement);
							}
						} else if (node.nodeType === Node.TEXT_NODE
							&& canHighlightElement(rejectSelector, node.parentElement as Element)) {
							// Previously used `boxesInfoCalculateForFlowOwners()` on `node`.
							elements.add(node.parentElement as HTMLElement);
						}
					}
				}
				for (const element of elements) {
					boxesInfoCalculateForFlowOwnersFromContent(terms, element, highlightTags,
						termCountCheck, getHighlightingId, styleUpdates);
				}
			});
		})();
		return mutationUpdates;
	};
})();

const styleUpdatesGet = (elementsVisible: Set<Element>, terms: MatchTerms): StyleUpdates => {
	const shiftObserver = new ResizeObserver(entries => {
		const styleRules: Array<HighlightStyleRuleInfo> = entries.flatMap(entry =>
			getStyleRules(getAncestorHighlightable(entry.target.firstChild as Node), true, terms)
		);
		if (styleRules.length) {
			styleUpdate(styleRules);
		}
	});
	const visibilityObserver = new IntersectionObserver(entries => {
		let styleRules: Array<HighlightStyleRuleInfo> = [];
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				//console.log(entry.target, "intersecting");
				if (entry.target[EleProperty.INFO]) {
					elementsVisible.add(entry.target);
					shiftObserver.observe(entry.target);
					styleRules = styleRules.concat(getStyleRules(getAncestorHighlightable(entry.target.firstChild as Node), false, terms));
				}
			} else {
				//console.log(entry.target, "not intersecting");
				if (paintUsePaintingFallback && entry.target[EleProperty.INFO]) {
					document.getElementById(getElementDrawId((entry.target[EleProperty.INFO] as ElementInfo).id))?.remove();
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
		observe: element => visibilityObserver.observe(element),
		disconnectAll: () => {
			elementsVisible.clear();
			shiftObserver.disconnect();
			visibilityObserver.disconnect();
		},
	};
};

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
			.map(phrase => phrase.replace(/\p{Ps}|\p{Pe}|\p{Pi}|\p{Pf}/gu, ""))
			// Open Punctuation | Close Punctuation | Initial Punctuation | Final Punctuation
			.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
		const termSelectors: Set<string> = new Set;
		termsAll.forEach(term => {
			if (!termSelectors.has(term.token)) {
				termSelectors.add(term.token);
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
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param hues Color hues for term styles to cycle through.
	 * @param mutationUpdates
	 * @param produceEffectOnCommand
	 * @param getHighlightingId
	 * @param styleUpdates
	 * @param elementsVisible
	 * @param termsUpdate An array of terms to which to update the existing terms, if change is necessary.
	 */
	const refreshTermControlsAndBeginHighlighting = (() => {
		/**
		 * Insert the toolbar and appropriate controls.
		 * @param terms Terms to highlight and display in the toolbar.
		 * @param controlsInfo Details of controls to insert.
		 * @param commands Browser commands to use in shortcut hints.
		 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
		 * @param hues Color hues for term styles to cycle through.
		 * @param produceEffectOnCommand
		 */
		const insertToolbar = (terms: MatchTerms, controlsInfo: ControlsInfo, commands: BrowserCommands,
			highlightTags: HighlightTags, hues: TermHues, produceEffectOnCommand: ProduceEffectOnCommand) => {
			const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
				&& document.activeElement.closest(`#${EleID.BAR}`);
			controlsRemove();
			controlsInsert(terms, controlsInfo, commands, highlightTags, hues, produceEffectOnCommand);
			if (focusingControlAppend) {
				const input = (getControl() as HTMLElement).querySelector("input") as HTMLInputElement;
				input.focus();
				input.select();
			}
		};
	
		return (terms: MatchTerms,
			controlsInfo: ControlsInfo,
			commands: BrowserCommands,
			highlightTags: HighlightTags,
			hues: TermHues,
			mutationUpdates: MutationUpdates,
			termCountCheck: TermCountCheck,
			produceEffectOnCommand: ProduceEffectOnCommand,
			getHighlightingId: GetHighlightingID,
			styleUpdates: StyleUpdates,
			elementsVisible: Set<Element>,
			termsUpdate?: MatchTerms,
		) => {
			// TODO fix this abomination of a function
			let termUpdate: MatchTerm | undefined = undefined;
			let termToUpdateIdx: TermChange.CREATE | TermChange.REMOVE | number | undefined = undefined;
			if (termsUpdate && termsUpdate.length < terms.length && (terms.length === 1 || termEquals(termsUpdate[termsUpdate.length - 1], terms[terms.length - 2]))) {
				termToUpdateIdx = TermChange.REMOVE;
				termUpdate = terms[terms.length - 1];
			} else if (termsUpdate && termsUpdate.length > terms.length && (termsUpdate.length === 1 || termEquals(termsUpdate[termsUpdate.length - 2], terms[terms.length - 1]))) {
				termToUpdateIdx = TermChange.CREATE;
				termUpdate = termsUpdate[termsUpdate.length - 1];
			} else if (termsUpdate) {
				const termsCopy = terms.slice();
				const termsUpdateCopy = termsUpdate?.slice();
				let i = 0;
				while (termsUpdateCopy.length && termsCopy.length) {
					if (termEquals(termsUpdateCopy[0], termsCopy[0])) {
						termsUpdateCopy.splice(0, 1);
						termsCopy.splice(0, 1);
						i++;
					} else {
						if (termEquals(termsUpdateCopy[0], termsCopy[1])) {
							// Term deleted at current index.
							termToUpdateIdx = TermChange.REMOVE;
							termUpdate = termsCopy[0];
							termsCopy.splice(0, 1);
							i++;
						} else if (termEquals(termsUpdateCopy[1], termsCopy[0])) {
							// Term created at current index.
							termToUpdateIdx = TermChange.CREATE;
							termUpdate = termsUpdateCopy[0];
							termsUpdateCopy.splice(0, 1);
						} else if (termEquals(termsUpdateCopy[1], termsCopy[1])) {
							// Term changed at current index.
							termToUpdateIdx = i;
							termUpdate = termsUpdateCopy[0];
							termsUpdateCopy.splice(0, 1);
							termsCopy.splice(0, 1);
							i++;
						}
						break;
					}
				}
			}
			const termsToHighlight: MatchTerms = [];
			const termsToPurge: MatchTerms = [];
			if (document.getElementById(EleID.BAR)) {
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
							boxesInfoRemoveForTerms([ terms[termRemovedPreviousIdx] ]);
							elementsRestore([ getTermClass(terms[termRemovedPreviousIdx].token) ]);
							terms.splice(termRemovedPreviousIdx, 1);
							fillStylesheetContent(terms, hues, controlsInfo);
							termCountCheck();
							return;
						}
					} else {
						terms.splice(0);
						termsUpdate.forEach(term => {
							terms.push(new MatchTerm(term.phrase, term.matchMode));
						});
						elementsRestore();
						insertToolbar(terms, controlsInfo, commands, highlightTags, hues, produceEffectOnCommand);
					}
				} else {
					return;
				}
			} else if (termsUpdate) {
				terms.splice(0);
				termsUpdate.forEach(term => {
					terms.push(new MatchTerm(term.phrase, term.matchMode));
				});
				elementsRestore();
				insertToolbar(terms, controlsInfo, commands, highlightTags, hues, produceEffectOnCommand);
			} else {
				return;
			}
			fillStylesheetContent(terms, hues, controlsInfo);
			if (!controlsInfo.pageModifyEnabled) {
				const bar = document.getElementById(EleID.BAR) as Element;
				bar.classList.add(EleClass.DISABLED);
				return;
			}
			if (controlsInfo.paintReplaceByClassic) {
				setTimeout(() => {
					beginHighlighting(
						termsToHighlight.length ? termsToHighlight : terms, termsToPurge,
						controlsInfo, highlightTags, termCountCheck, mutationUpdates,
					);
				});
			} else {
				cacheExtend(document.body, highlightTags);
				boxesInfoRemoveForTerms(termsToPurge);
				boxesInfoCalculate(terms, document.body, highlightTags,
					termCountCheck, getHighlightingId, styleUpdates);
				mutationUpdates.observe();
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
		if (!document.getElementById(EleID.STYLE)) {
			const style = document.createElement("style");
			style.id = EleID.STYLE;
			document.head.appendChild(style);
		}
		if (!document.getElementById(EleID.STYLE_PAINT)) {
			const style = document.createElement("style");
			style.id = EleID.STYLE_PAINT;
			document.head.appendChild(style);
		}
		if (!document.getElementById(EleID.DRAW_CONTAINER)) {
			const container = document.createElement("div");
			container.id = EleID.DRAW_CONTAINER;
			document.body.insertAdjacentElement("afterend", container);
		}
	};

	const styleElementsCleanup = () => {
		const style = document.getElementById(EleID.STYLE);
		if (style && style.textContent !== "") {
			style.textContent = "";
		}
		const stylePaint = document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement | null;
		if (stylePaint && stylePaint.sheet) {
			while (stylePaint.sheet.cssRules.length) {
				stylePaint.sheet.deleteRule(0);
			}
		}
	};

	/**
	 * Returns a generator function to consume individual command objects and produce their desired effect.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
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
				const bar = document.getElementById(EleID.BAR) as HTMLElement;
				bar.classList.toggle(EleClass.BAR_HIDDEN);
				break;
			} case CommandType.TOGGLE_SELECT: {
				selectModeFocus = !selectModeFocus;
				break;
			} case CommandType.REPLACE_TERMS: {
				termsSet(controlsInfo.termsOnHold);
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
				input.focus();
				input.select();
				if (activeElementOriginal && activeElementOriginal.closest(`#${EleID.BAR}`)) {
					break; // Focus was already in bar, so focus return should not be updated.
				}
				focusReturnInfo.element = activeElementOriginal;
				focusReturnInfo.selectionRanges = selectionRangesOriginal;
				const bar = document.getElementById(EleID.BAR) as HTMLElement;
				const returnSelection = (event: FocusEvent) => {
					if (event.relatedTarget) {
						setTimeout(() => {
							if (!document.activeElement || !document.activeElement.closest(`#${EleID.BAR}`)) {
								bar.removeEventListener("focusout", returnSelection);
							}
						});
						return; // Focus is being moved, not lost.
					}
					if (document.activeElement && document.activeElement.closest(`#${EleID.BAR}`)) {
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
				const barTerms = document.getElementById(EleID.BAR_TERMS) as HTMLElement;
				barTerms.classList.remove(getControlPadClass(focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				barTerms.classList.add(getControlPadClass(focusedIdx));
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

	const onWindowMouseUp = () => {
		if (document.activeElement && document.activeElement.classList.contains(EleClass.CONTROL_REVEAL)) {
			(document.querySelector(`#${EleID.BAR} .${EleClass.WAS_FOCUSED}`) as HTMLElement | null)?.focus();
		}
	};

	return () => {
		if (!paintUsePaintingFallback) {
			(CSS["paintWorklet"] as PaintWorkletType).addModule(chrome.runtime.getURL("/dist/paint.js"));
		}
		// Can't remove controls because a script may be left behind from the last install, and start producing unhandled errors. FIXME
		//controlsRemove();
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
				HIGHLIGHT_TAG as keyof HTMLElementTagNameMap ]),
			// break: any other class of element
		};
		const termCountCheck = (() => {
			const requestRefreshIndicators = requestCallFn(() => controlsInfo.paintReplaceByClassic
				? insertScrollMarkersClassic(terms, highlightTags, hues)
				: insertScrollMarkersPaint(terms, hues),
			() => controlsInfo.paintReplaceByClassic ? 50 : 200, () => controlsInfo.paintReplaceByClassic ? 500 : 2000);
			const requestRefreshTermControls = requestCallFn(() => {
				terms.forEach(term => {
					updateTermOccurringStatus(term, controlsInfo);
				});
			}, () => controlsInfo.paintReplaceByClassic ? 50 : 50, () => controlsInfo.paintReplaceByClassic ? 500 : 500);
			return () => {
				requestRefreshIndicators.next();
				requestRefreshTermControls.next();
			};
		})();
		const elementsVisible: Set<Element> = new Set;
		const styleUpdates = styleUpdatesGet(elementsVisible, terms);
		const produceEffectOnCommand = produceEffectOnCommandFn(terms, highlightTags, controlsInfo);
		const getHighlightingId = getHighlightingIdFn();
		const mutationUpdates = mutationUpdatesGet(termCountCheck, getHighlightingId,
			styleUpdates, highlightTags, terms, controlsInfo);
		produceEffectOnCommand.next(); // Requires an initial empty call before working (TODO otherwise mitigate).
		const getDetails = (request: HighlightDetailsRequest) => ({
			terms: request.termsFromSelection ? getTermsFromSelection() : undefined,
			highlightsShown: request.highlightsShown ? controlsInfo.highlightsShown : undefined,
		});
		const messageHandleHighlight = (
			message: HighlightMessage,
			sender: chrome.runtime.MessageSender,
			sendResponse: (response: HighlightMessageResponse) => void,
		) => {
			styleElementsInsert();
			if (message.getDetails) {
				sendResponse(getDetails(message.getDetails));
			}
			if (message.useClassicHighlighting !== undefined) {
				controlsInfo.paintReplaceByClassic = message.useClassicHighlighting;
				Object.assign(
					mutationUpdates,
					mutationUpdatesGet(termCountCheck, getHighlightingId,
						styleUpdates, highlightTags, terms, controlsInfo),
				);
			}
			if (message.enablePageModify !== undefined && controlsInfo.pageModifyEnabled !== message.enablePageModify) {
				controlsInfo.pageModifyEnabled = message.enablePageModify;
				if (!controlsInfo.pageModifyEnabled) {
					styleUpdates.disconnectAll();
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
				window.removeEventListener("mouseup", onWindowMouseUp);
				mutationUpdates.disconnect();
				styleUpdates.disconnectAll();
				terms.splice(0);
				controlsRemove();
				elementsRestore();
				styleElementsCleanup();
				document.querySelectorAll("*").forEach(element => {
					delete element[EleProperty.INFO];
				});
				highlightingAttributesCleanup(document.body);
			}
			if (message.terms !== undefined &&
				(!itemsMatch(terms, message.terms, termEquals) || (!terms.length && !document.getElementById(EleID.BAR)))
			) {
				window.addEventListener("mouseup", onWindowMouseUp);
				refreshTermControlsAndBeginHighlighting(
					terms, //
					controlsInfo, commands, //
					highlightTags, hues, //
					mutationUpdates, termCountCheck, //
					produceEffectOnCommand, //
					getHighlightingId, //
					styleUpdates, elementsVisible, //
					message.terms, //
				);
			}
			(message.commands ?? []).forEach(command => {
				produceEffectOnCommand.next(command);
			});
			controlVisibilityUpdate("replaceTerms", controlsInfo, terms);
			const bar = document.getElementById(EleID.BAR);
			if (bar) {
				bar.classList.toggle(EleClass.HIGHLIGHTS_SHOWN, controlsInfo.highlightsShown);
				bar.classList.toggle(EleClass.COLLAPSED, controlsInfo.barCollapsed);
			}
		};
		(() => {
			const messageQueue: Array<{
				message: HighlightMessage,
				sender: chrome.runtime.MessageSender,
				sendResponse: (response: HighlightMessageResponse) => void,
			}> = [];
			const messageHandleHighlightUninitialized: typeof messageHandleHighlight = (message, sender, sendResponse) => {
				if (message.getDetails) {
					sendResponse(getDetails(message.getDetails));
					delete message.getDetails;
				}
				if (!Object.keys(message).length) {
					return;
				}
				messageQueue.unshift({ message, sender, sendResponse });
				if (messageQueue.length === 1) {
					messageSendBackground({
						initializationGet: true,
					}).then(message => {
						if (!message) {
							assert(false, "not initialized, so highlighting remains inactive", "no init response was received");
							return;
						}
						const initialize = () => {
							chrome.runtime.onMessage.removeListener(messageHandleHighlightUninitialized);
							chrome.runtime.onMessage.addListener(messageHandleHighlight);
							messageHandleHighlight(message, sender, sendResponse);
							messageQueue.forEach(messageInfo => {
								messageHandleHighlight(messageInfo.message, messageInfo.sender, messageInfo.sendResponse);
							});
						};
						if (document.body) {
							initialize();
						} else {
							const observer = new MutationObserver(() => {
								if (document.body) {
									observer.disconnect();
									initialize();
								}
							});
							observer.observe(document.documentElement, { childList: true });
						}
					});
				}
			};
			chrome.runtime.onMessage.addListener(messageHandleHighlightUninitialized);
		})();
		messageHandleHighlightGlobal = messageHandleHighlight;
	};
})()();
