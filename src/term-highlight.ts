type BrowserCommands = Array<chrome.commands.Command>
type TagName = HTMLElementTagName | Uppercase<HTMLElementTagName>
type HighlightTags = {
	reject: ReadonlySet<TagName>,
	flow: ReadonlySet<TagName>,
}
type TermHues = Array<number>
type ControlButtonName = keyof StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
type ControlButtonInfo = {
	path?: string
	label?: string
	containerId: ElementID
	onclick?: () => void
	setUp?: (container: HTMLElement) => void
}
type RequestRefreshIndicators = Generator<undefined, never, unknown>
type ProduceEffectOnCommand = Generator<undefined, never, CommandInfo>

enum AtRuleIdent {
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
	CONTROL_EDIT = "control-edit",
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
	PRIMARY = "primary",
	SECONDARY = "secondary",
	OVERRIDE_VISIBILITY = "override-visibility",
}

enum ElementID {
	STYLE = "style",
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
	pageModifyEnabled: boolean
	highlightsShown: boolean
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
	matchMode: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS]
}

interface UnbrokenNodeListItem {
	value: Text
	next: UnbrokenNodeListItem | null
}

// Singly linked list implementation for efficient highlight matching of node DOM 'flow' groups
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
 * Gets a selector for selecting by ID or class, or for CSS at-rules. Abbreviated due to prolific use.
 * __Always__ use for ID, class, and at-rule identifiers.
 * @param identifier The extension-level unique ID, class, or at-rule identifier.
 * @param argument An optional secondary component to the identifier.
 * @returns The selector string, being a constant selector prefix and both components joined by hyphens.
 */
const getSel = (identifier: ElementID | ElementClass | AtRuleIdent, argument?: string | number): string =>
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
	style.textContent = `
/* TODO reorganise and rename */
/* TERM INPUT & BUTTONS */
#${getSel(ElementID.BAR)} ::selection
	{ background: Highlight; color: HighlightText; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input
	{ width: 5em; padding: 0 2px 0 2px !important; margin-left: 4px; border: none !important; outline: revert;
	box-sizing: unset !important; font-family: revert !important; white-space: pre; color: #000 !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)}),
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROL)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
	{ width: 0; padding: 0 !important; margin: 0; }
#${getSel(ElementID.BAR)}
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: block; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus, .${getSel(ElementClass.OVERRIDE_VISIBILITY)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)}
	{ display: none; }
/**/

/* TERM MATCH MODES STYLE */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_REGEX)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ font-weight: bold; }
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_REGEX)}
.${getSel(ElementClass.CONTROL_PAD)} button::before
	{ content: "(.*)"; margin-right: 2px; font-weight: bold; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_CASE)}
.${getSel(ElementClass.CONTROL_PAD)} button
	{ padding-top: 0 !important; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)}, .${getSel(ElementClass.MATCH_REGEX)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; }
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_PAD)} button
	{ border-bottom: 3px solid #666; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_CONTENT)},
#${getSel(ElementID.BAR_CONTROLS)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.MATCH_WHOLE)}
.${getSel(ElementClass.CONTROL_PAD)} button
	{ padding-inline: 2px !important; border-inline: 2px solid hsl(0 0% 0% / 0.4); }
/**/

/* BAR */
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light; font-size: 14.6px; line-height: initial; user-select: none; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.BAR_HIDDEN)}
	{ display: none; }
#${getSel(ElementID.BAR)} *
	{ all: revert; font: revert; font-size: inherit; line-height: 120%; padding: 0; outline: none; }
#${getSel(ElementID.BAR)} img
	{ height: 1.1em; width: 1.1em; }
#${getSel(ElementID.BAR)} button
	{ display: flex; align-items: center; padding-inline: 4px; margin-block: 0; border: none; border-radius: inherit;
	background: none; color: #000 !important; cursor: pointer; letter-spacing: normal; transition: unset; }
#${getSel(ElementID.BAR)} > *
	{ display: inline; }
#${getSel(ElementID.BAR)} > * > *
	{ display: inline-block; vertical-align: top; margin-left: 0.5em; }
/**/

/* TERM PULLDOWN */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:focus,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}.${getSel(ElementClass.OVERRIDE_VISIBILITY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover) + .${getSel(ElementClass.OPTION_LIST)}
	{ display: flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}:focus .${getSel(ElementClass.OPTION)}::first-letter
	{ text-decoration: underline; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ display: none; position: absolute; flex-direction: column; width: max-content; padding: 0; margin: 0; z-index: 1; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ display: block; padding-block: 2px; margin-left: 3px; font-size: small; background: hsl(0 0% 75%) !important; filter: grayscale(100%);
	width: 100%; text-align: left; color: #111 !important;
	border-color: hsl(0 0% 50%) !important; border-bottom-width: 1px !important;
	border-style: none none solid solid !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0 0% 90%) !important; }
/**/

/* BAR CONTROLS */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}
	{ white-space: pre; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ display: flex; height: 1.3em; border-style: none; border-radius: 4px; box-shadow: 1px 1px 5px;
	background: hsl(0 0% 90% / 0.8) !important; color: #000 !important; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.DISABLED)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(0 0% 90% / 0.4) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:hover
	{ background: hsl(0 0% 65%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:active
	{ background: hsl(0 0% 50%) !important; }
#${getSel(ElementID.BAR)} > :not(#${getSel(ElementID.BAR_TERMS)}) > .${getSel(ElementClass.DISABLED)}
	{ display: none; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ display: flex; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ background: hsl(0 0% 80% / 0.6) !important; }
/**/

/* TERM SCROLL MARKERS */
@keyframes ${getSel(AtRuleIdent.MARKER_ON)}
	{ from {} to { padding-right: 16px; }; }
@keyframes ${getSel(AtRuleIdent.MARKER_OFF)}
	{ from { padding-right: 16px; } to { padding-right: 0; }; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ display: block; position: fixed; right: 0; top: 0; width: 0; height: 100%; z-index: ${zIndexMax}; }
#${getSel(ElementID.MARKER_GUTTER)} *
	{ width: 16px; top: 0; height: 1px; position: absolute; right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
	padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.FOCUS)}
	{ padding-right: 16px; transition: unset; }
/**/

/* TERM HIGHLIGHTS */
@keyframes ${getSel(AtRuleIdent.FLASH)}
	{ from { background-color: hsl(0 0% 65% / 0.8); } to {}; }
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(AtRuleIdent.FLASH)} 1s; }
/**/
	`;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const isAboveStyleLevel = (level: number) => i >= hues.length * level;
		const getBackgroundStyle = (colorA: string, colorB: string) =>
			isAboveStyleLevel(1)
				?  `repeating-linear-gradient(${
					isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
				}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
				: colorA;
		style.textContent += `
/* TERM HIGHLIGHTS */
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
#${getSel(ElementID.BAR)}
~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 84% / 0.4)`)} !important;
	border-radius: 2px !important; box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35) !important; }
/**/

/* TERM MARKERS */
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue} 100% 44%); }
/**/

/* TERM BUTTONS */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 70% 70% / 0.8)`, `hsl(${hue} 70% 88% / 0.8)`)} !important; }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.DISABLED)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 70% 70% / 0.4)`, `hsl(${hue} 70% 88% / 0.4)`)} !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:hover,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:hover:not(:disabled)
	{ background: hsl(${hue} 70% 80%) !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:active,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:active:not(:disabled)
	{ background: hsl(${hue} 70% 70%) !important; }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_PAD, i)}
.${getSel(ElementClass.TERM, term.selector)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(${hue} 100% 90%) !important; }
/**/
		`;
	});
};

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
const revertElementsUnfocusable = (root = document.body) => {
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

	const focusElement = (element: HTMLElement) =>
		element.focus({
			preventScroll: true,
			focusVisible: true, // Very sparse browser compatibility
		} as FocusOptions)
	;

	return (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? getSel(ElementClass.TERM, term.selector) : "";
		const focusBase = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		const selection = document.getSelection();
		const selectionFocus = selection && (!document.activeElement
			|| document.activeElement === document.body || !document.body.contains(document.activeElement)
			|| document.activeElement === focusBase || document.activeElement.contains(focusContainer))
			? selection.focusNode
			: document.activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(getSel(ElementClass.FOCUS));
			purgeClass(getSel(ElementClass.FOCUS_CONTAINER));
			revertElementsUnfocusable();
		}
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(
				selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
					? selectionFocus as HTMLElement
					: selectionFocus.parentElement,
				highlightTags)
			: undefined;
		const acceptInSelectionFocusContainer = { value: false };
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(element, highlightTags) !== selectionFocusContainer || acceptInSelectionFocusContainer.value)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			walker.currentNode = reverse && document.body.lastElementChild ? document.body.lastElementChild : document.body;
			elementTerm = walker[nextNodeMethod]() as HTMLElement;
			if (!elementTerm) {
				acceptInSelectionFocusContainer.value = true;
				elementTerm = walker[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return;
				}
			}
		}
		const container = getContainerBlock(elementTerm.parentElement as HTMLElement, highlightTags);
		container.classList.add(getSel(ElementClass.FOCUS_CONTAINER));
		elementTerm.classList.add(getSel(ElementClass.FOCUS));
		let elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
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
		elementToSelect.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
		}
		Array.from(document.body.getElementsByClassName(getSel(ElementClass.REMOVE)))
			.forEach((element: HTMLElement) => {
				element.remove();
			})
		;
		const scrollMarkerGutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		purgeClass(getSel(ElementClass.FOCUS), scrollMarkerGutter);
		// eslint-disable-next-line no-constant-condition
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getSel(ElementClass.TERM, term.selector)}` : ""}[top^="${
					Math.trunc(getRectYRelative(container.getBoundingClientRect()) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(getSel(ElementClass.FOCUS));
				return true;
			}
			return false;
		});
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
		const input = control.querySelector("input") as HTMLInputElement;
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
		const idx = getTermIdx(term, terms);
		if (replaces && inputValue === "") {
			if (document.activeElement === termInput) {
				selectInput(getControl(undefined, idx + 1) as HTMLElement);
				return;
			}
			chrome.runtime.sendMessage({
				terms: terms.slice(0, idx).concat(terms.slice(idx + 1)),
				termChanged: term,
				termChangedIdx: TermChange.REMOVE,
			});
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			chrome.runtime.sendMessage({
				terms: terms.map((term, i) => i === idx ? termChanged : term),
				termChanged,
				termChangedIdx: idx,
			});
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue, getTermControlMatchModeFromClassList(control.classList), {
				allowStemOverride: true,
			});
			chrome.runtime.sendMessage({
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
	 * @param shiftRight Whether to shift rightwards or leftwards.
	 * @param onBeforeShift A function to execute once the shift is confirmed but 
	 * @param terms Terms being controlled and highlighted.
	 */
	const tryShiftTermFocus = (term: MatchTerm | undefined, idxTarget: number | undefined, shiftRight: boolean | undefined,
		onBeforeShift: () => void, terms: MatchTerms) => {
		const replaces = !!term; // Whether a commit in this control replaces an existing term or appends a new one.
		const control = getControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const idx = replaces ? getTermIdx(term, terms) : terms.length;
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
		input.classList.add(getSel(ElementClass.DISABLED));
		const resetInput = (termText = controlContent.textContent as string) => {
			input.value = replaces ? termText : "";
		};
		input.onfocus = () => {
			input.addEventListener("keyup", (event) => {
				if (event.key === "Tab") {
					selectInputTextAll(input);
				}
			});
			input.classList.remove(getSel(ElementClass.DISABLED));
			resetInput();
			resetTermControlInputsVisibility();
			input.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
		};
		input.onblur = () => {
			commit(term, terms);
			input.classList.add(getSel(ElementClass.DISABLED));
		};
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
				const control = controlPad.parentElement as HTMLElement;
				const optionList = control.querySelector(`.${getSel(ElementClass.OPTION_LIST)}`) as HTMLElement;
				optionList.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
				optionList.tabIndex = 0;
				optionList.focus();
				optionList.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
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
const getTermIdx = (term: MatchTerm | undefined, terms: MatchTerms): TermChange.CREATE | number =>
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
 * Mainly a helper for mitigating a Chromium bug which causes `select()` during the initial focus to not select all text.
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
	const hasOccurrences = document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)).length !== 0;
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
		const occurrences = Array.from(document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)));
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
	text.slice(0, text.indexOf(" ")).toLowerCase()
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
 * Updates the class list of a term control to reflect the term's matching modes.
 * @param mode An object of term matching mode flags.
 * @param classList The control element class list for a term.
 */
const updateTermControlMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList[mode.regex ? "add" : "remove"](getSel(ElementClass.MATCH_REGEX));
	classList[mode.case ? "add" : "remove"](getSel(ElementClass.MATCH_CASE));
	classList[mode.stem ? "add" : "remove"](getSel(ElementClass.MATCH_STEM));
	classList[mode.whole ? "add" : "remove"](getSel(ElementClass.MATCH_WHOLE));
};

// TODO document
const getTermControlMatchModeFromClassList = (classList: DOMTokenList): MatchMode => ({
	regex: classList.contains(getSel(ElementClass.MATCH_REGEX)),
	case: classList.contains(getSel(ElementClass.MATCH_CASE)),
	stem: classList.contains(getSel(ElementClass.MATCH_STEM)),
	whole: classList.contains(getSel(ElementClass.MATCH_WHOLE)),
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
 * Creates an element for a term matching option.
 * @param terms Terms being controlled and highlighted.
 * @param term A term for which to create the option.
 * @param text Text content for the option, which is also used to determine the matching mode it controls.
 * @returns The resulting option element.
 */
const createTermOption = (term: MatchTerm, terms: MatchTerms, text: string,
	onActivated: (matchType: string) => void): HTMLButtonElement => {
	const matchType = getTermOptionMatchType(text);
	const option = document.createElement("button");
	option.type = "button";
	option.classList.add(getSel(ElementClass.OPTION));
	option.tabIndex = -1;
	option.textContent = getTermOptionText(term.matchMode[matchType], text);
	option.onmouseup = () => onActivated(matchType);
	option.onclick = () => onActivated(matchType);
	return option;
};

// TODO document
const createTermOptionMenu = (
	term: MatchTerm,
	terms: MatchTerms,
	focusReturnElement: HTMLElement,
	onActivated = (matchType: string) => {
		const termUpdate = Object.assign({}, term);
		termUpdate.matchMode = Object.assign({}, termUpdate.matchMode);
		termUpdate.matchMode[matchType] = !termUpdate.matchMode[matchType];
		chrome.runtime.sendMessage({
			terms: terms.map(termCurrent => termCurrent === term ? termUpdate : termCurrent),
			termChanged: termUpdate,
			termChangedIdx: getTermIdx(term, terms),
		});
	},
) => {
	const menu = document.createElement("menu");
	menu.classList.add(getSel(ElementClass.OPTION_LIST));
	menu.appendChild(createTermOption(term, terms, "Case Sensitive", onActivated));
	menu.appendChild(createTermOption(term, terms, "Stem Word", onActivated));
	menu.appendChild(createTermOption(term, terms, "Whole Word", onActivated));
	menu.appendChild(createTermOption(term, terms, "Regex Mode", onActivated));
	const handleKeyEvent = (event: KeyboardEvent, executeResult = true) => {
		event.preventDefault();
		if (!executeResult) {
			return;
		}
		if (event.key === "Escape") {
			focusReturnElement.focus();
		}
		if (event.key === " " || event.key.length !== 1) {
			return;
		}
		menu.querySelectorAll(`.${getSel(ElementClass.OPTION)}`).forEach((option: HTMLButtonElement) => {
			if ((option.textContent ?? "").toLowerCase().startsWith(event.key)) {
				option.click();
			}
		});
		focusReturnElement.focus();
	};
	menu.onkeydown = event => handleKeyEvent(event, false);
	menu.onkeyup = event => handleKeyEvent(event);
	return menu;
};

/**
 * Inserts an interactive term control element.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param terms Terms being controlled and highlighted.
 * @param idx The index in `terms` of a term to assign.
 * @param command The string of a command to display as a shortcut hint for jumping to the next term.
 * @param commandReverse The string of a command to display as a shortcut hint for jumping to the previous term.
 * @param controlsInfo Details of controls inserted.
 */
const insertTermControl = (terms: MatchTerms, idx: number, command: string, commandReverse: string,
	controlsInfo: ControlsInfo, highlightTags: HighlightTags) => {
	const term = terms.at(idx) as MatchTerm;
	const controlPad = document.createElement("div");
	controlPad.classList.add(getSel(ElementClass.CONTROL_PAD));
	controlPad.classList.add(getSel(ElementClass.DISABLED));
	const controlContent = document.createElement("button");
	controlContent.type = "button";
	controlContent.classList.add(getSel(ElementClass.CONTROL_CONTENT));
	controlContent.tabIndex = -1;
	controlContent.textContent = term.phrase;
	controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
	controlPad.appendChild(controlContent);
	const controlEdit = document.createElement("button");
	controlEdit.type = "button";
	controlEdit.classList.add(getSel(ElementClass.CONTROL_EDIT));
	if (!controlsInfo.barLook.showEditIcon) {
		controlEdit.disabled = true;
	}
	controlEdit.tabIndex = -1;
	const controlEditChange = document.createElement("img");
	const controlEditRemove = document.createElement("img");
	controlEditChange.src = chrome.runtime.getURL("/icons/edit.svg");
	controlEditRemove.src = chrome.runtime.getURL("/icons/delete.svg");
	controlEditChange.classList.add(getSel(ElementClass.PRIMARY));
	controlEditRemove.classList.add(getSel(ElementClass.SECONDARY));
	controlEdit.appendChild(controlEditChange);
	controlEdit.appendChild(controlEditRemove);
	controlPad.appendChild(controlEdit);
	const termInput = insertTermInput(terms, controlPad, idx, input => controlPad.insertBefore(input, controlEdit));
	term.command = command;
	term.commandReverse = commandReverse;
	const control = document.createElement("div");
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	control.appendChild(controlPad);
	control.appendChild(createTermOptionMenu(term, terms, termInput));
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
			button.onclick = info.onclick ?? null;
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
				appendTerm: {
					path: "/icons/create.svg",
					containerId: ElementID.BAR_CONTROLS,
					setUp: container => {
						const pad = container.querySelector(`.${getSel(ElementClass.CONTROL_PAD)}`) as HTMLElement;
						const termInput = insertTermInput(terms, pad, TermChange.CREATE, input => pad.appendChild(input));
						updateTermControlMatchModeClassList(controlsInfo.matchMode, container.classList);
						container.appendChild(createTermOptionMenu(
							new MatchTerm("_", controlsInfo.matchMode),
							terms,
							termInput,
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
						));
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
		if (!controlsInfo.pageModifyEnabled) {
			bar.classList.add(getSel(ElementClass.DISABLED));
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
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar) {
		bar.remove();
	}
	if (gutter) {
		gutter.remove();
	}
	purgeClass(getSel(ElementClass.FOCUS_CONTAINER));
	purgeClass(getSel(ElementClass.FOCUS));
	revertElementsUnfocusable();
};

/**
 * Removes the visibility classes of all term control inputs, reseting their visibility.
 */
const resetTermControlInputsVisibility = () =>
	purgeClass(
		getSel(ElementClass.OVERRIDE_VISIBILITY),
		document.getElementById(getSel(ElementID.BAR)) as HTMLElement,
		"input",
	)
;

/**
 * Gets the central y-position of a DOM rect relative to the document scroll container.
 * @param rect A DOM rect.
 * @returns The relative y-position.
 */
const getRectYRelative = (rect: DOMRect) =>
	(rect.y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

/**
 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param hues Color hues for term styles to cycle through.
 */
const insertScrollMarkers = (() => {
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
			return; // No terms results in an empty selector, which is not allowed
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
			const yRelative = getRectYRelative(container.getBoundingClientRect());
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
		// Generates and inserts HTML directly in order to increase performance, rather than appending individual elements.
		gutter.insertAdjacentHTML("afterbegin", markersHtml);
	};
})();

/**
 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
 * @param terms Terms to find, highlight, and mark.
 * @param rootNode A node under which to find and highlight term occurrences.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators are regenerated.
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
	 * @param node A node under which to match terms and insert highlights.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 */
	const insertHighlights = (terms: MatchTerms, node: Node, highlightTags: HighlightTags,
		nodeItems = new UnbrokenNodeList, visitSiblings = true) => {
		// TODO support for <iframe>?
		do {
			switch (node.nodeType) {
			case (1): // Node.ELEMENT_NODE
			case (11): { // Node.DOCUMENT_FRAGMENT_NODE
				if (!highlightTags.reject.has((node as Element).tagName as TagName)) {
					const breaksFlow = !highlightTags.flow.has((node as Element).tagName as TagName);
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
			} case (3): { // Node.TEXT_NODE
				nodeItems.push(node as Text);
				break;
			}}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
		} while (node && visitSiblings);
	};

	return (terms: MatchTerms, rootNode: Node,
		highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators) => {
		if (rootNode.nodeType === Node.TEXT_NODE) {
			const nodeItems = new UnbrokenNodeList;
			nodeItems.push(rootNode as Text);
			highlightInBlock(terms, nodeItems);
		} else {
			insertHighlights(terms, rootNode, highlightTags, new UnbrokenNodeList, false);
		}
		requestRefreshIndicators.next();
	};
})();

/**
 * Remove all uses of a class name in elements under a root node in the DOM tree.
 * @param className A class name to purge.
 * @param root A root node under which to purge the class (non-inclusive).
 * @param selectorPrefix A prefix for the selector of elements to purge from. The base selector is the class name supplied.
 */
const purgeClass = (className: string, root: HTMLElement = document.body, selectorPrefix = "") =>
	root.querySelectorAll(`${selectorPrefix}.${className}`).forEach(element => element.classList.remove(className))
;

/**
 * Revert all direct DOM tree changes under a root node introduced by the extension.
 * Circumstantial and non-direct alterations may remain.
 * @param classNames Class names of the highlights to remove. If left empty, all highlights are removed.
 * @param root A root node under which to remove highlights.
 */
const restoreNodes = (classNames: Array<string> = [], root: HTMLElement | DocumentFragment = document.body) => {
	const highlights = root.querySelectorAll(classNames.length ? `mms-h.${classNames.join(", mms-h.")}` : "mms-h");
	for (const highlight of Array.from(highlights)) {
		// Direct assignation to `outerHTML` prevents the mutation observer from triggering excess highlighting
		highlight.outerHTML = highlight.innerHTML;
	}
	if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
		root = (root as DocumentFragment).getRootNode() as HTMLElement;
		if (root.nodeType === Node.TEXT_NODE) {
			return;
		}
	}
	purgeClass(getSel(ElementClass.FOCUS_CONTAINER), root as HTMLElement);
	purgeClass(getSel(ElementClass.FOCUS), root as HTMLElement);
	revertElementsUnfocusable(root as HTMLElement);
};

/**
 * Gets a mutation observer which listens to document changes and performs partial highlights where necessary.
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

	return (requestRefreshIndicators: RequestRefreshIndicators, highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightElement(rejectSelector, node as Element)) {
						restoreNodes([], node as HTMLElement | DocumentFragment);
						generateTermHighlightsUnderNode(terms, node, highlightTags, requestRefreshIndicators);
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
	observer.observe(document.body, { childList: true, subtree: true })
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
 * @param disable Indicates whether to skip all highlighting and remove the controls,
 * thus visibly and functionally deactivating the extension within the page.
 * @param termsFromSelection Indicates whether to skip all highlighting,
 * sending a message to the background script containing details of terms from the current selection.
 * This flag causes a later highlighting message with possibly different terms to be received,
 * so highlighting in this run is pointless.
 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators are regenerated.
 * @param observer An observer which selectively performs highlighting on observing changes.
 */
const beginHighlighting = (
	terms: MatchTerms, termsToPurge: MatchTerms, disable: boolean, termsFromSelection: boolean,
	highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators, observer: MutationObserver,
) => {
	highlightInNodesOnMutationDisconnect(observer);
	if (termsFromSelection) {
		terms = [];
		getTermsFromSelection().forEach(term => terms.push(term));
		chrome.runtime.sendMessage({
			terms,
			makeUnique: true,
			toggleHighlightsOn: true,
		} as BackgroundMessage);
	}
	restoreNodes(termsToPurge.length ? termsToPurge.map(term => getSel(ElementClass.TERM, term.selector)) : []);
	if (disable) {
		removeControls();
	} else if (!termsFromSelection) {
		generateTermHighlightsUnderNode(terms, document.body, highlightTags, requestRefreshIndicators);
		terms.forEach(term => updateTermOccurringStatus(term));
		highlightInNodesOnMutation(observer);
	}
};

// TODO document
const getTermsFromSelection = () => {
	const selection = document.getSelection();
	const terms: MatchTerms = [];
	if (selection && selection.anchorNode) {
		const termsAll = selection.toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
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
	 * @param termsFromSelection Indicates whether to skip all highlighting.
	 * This flag is handled externally to the effect of causing a later highlighting message with possibly different terms to be received,
	 * so highlighting in this run is pointless.
	 * @param disable Indicates whether to skip control and highlight insertion stages but run removal stages,
	 * thus visibly and functionally deactivating the extension within the page.
	 * @param controlsInfo Details of controls to insert.
	 * @param commands Browser commands to use in shortcut hints.
	 * @param highlightTags Element tags to reject from highlighting or form blocks of consecutive text nodes.
	 * @param hues Color hues for term styles to cycle through.
	 * @param observer An observer which selectively performs highlighting on observing changes.
	 * @param requestRefreshIndicators A generator function for requesting that term occurrence count indicators are regenerated.
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
	
		return (terms: MatchTerms, termsFromSelection: boolean, disable: boolean,
			controlsInfo: ControlsInfo, commands: BrowserCommands,
			highlightTags: HighlightTags, hues: TermHues,
			observer: MutationObserver, requestRefreshIndicators: RequestRefreshIndicators,
			termsUpdate?: MatchTerms, termUpdate?: MatchTerm,
			termToUpdateIdx?: TermChange.CREATE | TermChange.REMOVE | number,
		) => {
			const termsToHighlight: MatchTerms = [];
			const termsToPurge: MatchTerms = [];
			if (termsUpdate !== undefined && termToUpdateIdx !== undefined
				&& termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				// 'message.disable' assumed false.
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
					if (termRemovedPreviousIdx === -1) {
						console.warn(`Request received to delete term ${JSON.stringify(termUpdate)} which is not stored in this page.`);
					} else {
						removeTermControl(termRemovedPreviousIdx);
						terms.splice(termRemovedPreviousIdx, 1);
						restoreNodes([ getSel(ElementClass.TERM, termUpdate.selector) ]);
						fillStylesheetContent(terms, hues);
						requestRefreshIndicators.next();
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
					insertToolbar(terms, controlsInfo, commands, highlightTags, hues);
				}
			} else if (!disable && !termsFromSelection) {
				return;
			}
			if (!disable) {
				fillStylesheetContent(terms, hues);
			}
			if (controlsInfo.pageModifyEnabled) {
				beginHighlighting(
					termsToHighlight.length ? termsToHighlight : terms, termsToPurge,
					disable, termsFromSelection,
					highlightTags, requestRefreshIndicators, observer,
				);
			}
		};
	})();

	/**
	 * Inserts a uniquely identified CSS stylesheet to perform all extension styling.
	 */
	const insertStyleElement = () => {
		let style = document.getElementById(getSel(ElementID.STYLE)) as HTMLStyleElement;
		if (!style) {
			style = document.createElement("style");
			style.id = getSel(ElementID.STYLE);
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
	const requestRefreshIndicatorsFn = function* (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) {
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
			}, requestWaitDuration + 50); // Arbitrary small amount added to account for lag (preventing lost updates)
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
	const produceEffectOnCommandFn = function* (terms: MatchTerms, highlightTags: HighlightTags) {
		let selectModeFocus = false;
		let focusedIdx = 0;
		while (true) {
			const commandInfo: CommandInfo = yield;
			if (!commandInfo) {
				continue; // Requires an initial empty call before working (TODO otherwise mitigate)
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
				const control = getControl(undefined, commandInfo.termIdx) as HTMLElement;
				const input = control.querySelector("input") as HTMLInputElement;
				input.select();
				selectInputTextAll(input);
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

	/**
	 * Gets a set of highlight tags in all forms reasonably required.
	 * @param tagsLower An array of tag names in their lowercase form.
	 * @returns The corresponding set of tag names in all forms necessary.
	 */
	const getHighlightTagsSet = (tagsLower: Array<HTMLElementTagName>) =>
		new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ])) as ReadonlySet<TagName>
	;

	return () => {
		const commands: BrowserCommands = [];
		const terms: MatchTerms = [];
		const hues: TermHues = [];
		const controlsInfo: ControlsInfo = {
			pageModifyEnabled: false,
			highlightsShown: false,
			barControlsShown: {
				disableTabResearch: true,
				performSearch: true,
				appendTerm: true,
			},
			barLook: {
				showEditIcon: true,
			},
			matchMode: {
				regex: false,
				case: false,
				stem: false,
				whole: false,
			},
		};
		const highlightTags: HighlightTags = {
			reject: getHighlightTagsSet([ "meta", "style", "script", "noscript", "title" ]),
			flow: getHighlightTagsSet([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as HTMLElementTagName ]),
			// break: any other class of element
		};
		const requestRefreshIndicators: RequestRefreshIndicators = requestRefreshIndicatorsFn(terms, highlightTags, hues);
		const produceEffectOnCommand: ProduceEffectOnCommand = produceEffectOnCommandFn(terms, highlightTags);
		const observer = getObserverNodeHighlighter(requestRefreshIndicators, highlightTags, terms);
		produceEffectOnCommand.next(); // Requires an initial empty call before working (TODO otherwise mitigate)
		insertStyleElement();
		chrome.runtime.onMessage.addListener((message: HighlightMessage, sender,
			sendResponse: (response: HighlightDetails) => void) => {
			if (message.getDetails) {
				// This is a much more maintainable pattern. Maybe convert more extension logic to this getter/setter message design?
				if (message.getDetails.termsFromSelection) {
					sendResponse({ terms: getTermsFromSelection() });
				}
			}
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			if (message.barControlsShown) {
				controlsInfo.barControlsShown = message.barControlsShown;
			}
			if (message.barLook) {
				controlsInfo.barLook = message.barLook;
			}
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
				terms.splice(0);
			}
			if (message.enablePageModify !== undefined) {
				controlsInfo.pageModifyEnabled = message.enablePageModify;
			}
			if (
				message.deactivate || message.termsFromSelection || message.termUpdate
				|| (message.terms !== undefined
					&& (!itemsMatch(terms, message.terms, (a, b) => a.phrase === b.phrase)
						|| (!terms.length && !document.getElementById(ElementID.BAR))))
			) {
				refreshTermControlsAndBeginHighlighting(
					terms, message.termsFromSelection ?? false, message.deactivate ?? false, //
					controlsInfo, commands, //
					highlightTags, hues, //
					observer, requestRefreshIndicators, //
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
			sendResponse({}); // Mitigates manifest V3 bug which otherwise logs an error message
		});
	};
})()();
