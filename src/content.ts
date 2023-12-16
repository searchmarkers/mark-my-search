type BrowserCommands = Array<chrome.commands.Command>
type HighlightTags = {
	reject: ReadonlySet<string>,
	flow: ReadonlySet<string>,
}
type TermHues = Array<number>
type TermSelectorStyles = Record<string, {
	hue: number
	cycle: number
}>
type TermCountCheck = () => void
type ProduceEffectOnCommand = Generator<undefined, never, CommandInfo>

enum AtRuleID {
	FLASH = "markmysearch__flash",
	MARKER_ON = "markmysearch__marker_on",
	MARKER_OFF = "markmysearch__marker_off",
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
	STYLE_PAINT_SPECIAL = "markmysearch__style_paint_special",
	BAR = "markmysearch__bar",
	BAR_LEFT = "markmysearch__bar_left",
	BAR_TERMS = "markmysearch__bar_terms",
	BAR_RIGHT = "markmysearch__bar_right",
	MARKER_GUTTER = "markmysearch__markers",
	DRAW_CONTAINER = "markmysearch__draw_container",
	DRAW_ELEMENT = "markmysearch__draw",
	ELEMENT_CONTAINER_SPECIAL = "markmysearch__element_container_special",
	INPUT = "markmysearch__input",
}

const HIGHLIGHT_TAG = "mms-h";
const HIGHLIGHT_TAG_UPPER = "MMS-H";

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface ControlsInfo {
	pageModifyEnabled: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: MatchTerms
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
	matchMode: MatchMode
}

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

/**
 * Fills a CSS stylesheet element to style all UI elements we insert.
 * @param terms Terms to account for and style.
 * @param hues Color hues for term styles to cycle through.
 */
const fillStylesheetContent = (terms: MatchTerms, hues: TermHues, controlsInfo: ControlsInfo, highlighter: Highlighter) => {
	const style = document.getElementById(EleID.STYLE) as HTMLStyleElement;
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
	&.${EleClass.COLLAPSED} .${Toolbar.controlGetClass("toggleBarCollapsed")} .${EleClass.PRIMARY},
	&:not(.${EleClass.COLLAPSED}) .${Toolbar.controlGetClass("toggleBarCollapsed")} .${EleClass.SECONDARY} {
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
		&.${EleClass.MATCH_DIACRITICS} .${EleClass.CONTROL_CONTENT} {
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
		&.${EleClass.MATCH_DIACRITICS} .${EleClass.CONTROL_CONTENT} {
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
		z-index: ${Z_INDEX_MAX};
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
		z-index: ${Z_INDEX_MAX};
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
${highlighter.current.getTermHighlightsCSS()}

/**/

`) + `

${highlighter.current.getMiscCSS()}

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

/**/`
	;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const cycle = Math.floor(i / hues.length);
		const getTermBackgroundStyle = highlighter.current.getTermBackgroundStyle;
		term.hue = hue;
		style.textContent += makeImportant(`
/* || Term Highlight */

${highlighter.current.getTermHighlightCSS(terms, hues, i)}

/**/

/* || Term Scroll Markers */

#${EleID.MARKER_GUTTER} .${getTermClass(term.token)} {
	background: hsl(${hue} 100% 44%);
}

/**/

/* || Term Control Buttons */

#${EleID.BAR_TERMS} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
	background: ${getTermBackgroundStyle(
		`hsl(${hue} 70% 70% / ${controlsInfo.barLook.opacityTerm})`,
		`hsl(${hue} 70% 88% / ${controlsInfo.barLook.opacityTerm})`,
		cycle,
	)};
}

#${EleID.BAR}.${EleClass.DISABLED} #${EleID.BAR_TERMS} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
	background: ${getTermBackgroundStyle(
		`hsl(${hue} 70% 70% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
		`hsl(${hue} 70% 88% / min(${controlsInfo.barLook.opacityTerm}, 0.4))`,
		cycle,
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
	&.${Toolbar.getControlPadClass(i)} .${getTermClass(term.token)} .${EleClass.CONTROL_PAD} {
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
USER INTERFACE
Methods for inserting, updating, or removing parts of the toolbar, as well as driving user interaction with the toolbar.
*/

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Toolbar {
	export type ControlButtonName = keyof StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
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

	export const getControlPadClass = (index: number) => EleClass.CONTROL_PAD + "-" + index.toString();

	const getMatchModeOptionClass = (matchType: keyof MatchMode) => EleClass.OPTION + "-" + matchType;
	
	const getInputIdSequential = () => EleID.INPUT + "-" + getIdSequential.next().value.toString();

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
			const control = getControl(term);
			if (!control)
				return;
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
	export const getControl = (term?: MatchTerm, idx?: number): Element | null => {
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
		document.getElementById(EleID.BAR_RIGHT)?.firstElementChild ?? null
	;

	/**
	 * Updates the look of a term control to reflect whether or not it occurs within the document.
	 * @param term A term to update the term control status for.
	 */
	export const updateTermOccurringStatus = (term: MatchTerm, highlighter: Highlighter) => {
		const controlPad = (getControl(term) as HTMLElement)
			.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
		controlPad.classList.toggle(EleClass.DISABLED, !highlighter.current.getTermOccurrenceCount(term, true));
	};

	/**
	 * Updates the tooltip of a term control to reflect current highlighting or extension information as appropriate.
	 * @param term A term to update the tooltip for.
	 */
	const updateTermTooltip = (term: MatchTerm, highlighter: Highlighter) => {
		const controlPad = (getControl(term) as HTMLElement)
			.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
		const controlContent = controlPad
			.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
		const occurrenceCount = highlighter.current.getTermOccurrenceCount(term);
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
	export const refreshTermControl = (
		term: MatchTerm,
		idx: number,
		highlightTags: HighlightTags,
		highlighter: Highlighter,
	) => {
		const control = getControl(undefined, idx) as HTMLElement;
		control.classList.remove(Array.from(control.classList).find(className => className.startsWith(getTermClass(""))) ?? "-");
		control.classList.add(getTermClass(term.token));
		control.classList.add(EleClass.CONTROL, getTermClass(term.token));
		updateTermControlMatchModeClassList(term.matchMode, control.classList);
		const controlContent = control.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
		controlContent.onclick = event => // Overrides previous event handler in case of new term.
			highlighter.current.focusNextTerm(highlightTags, event.shiftKey, false, term);
		controlContent.textContent = term.phrase;
	};

	/**
	 * Removes a term control element.
	 * @param idx The index of an existing control to remove.
	 */
	export const removeTermControl = (idx: number) => {
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
				{ matchType: "diacritics", title: "Diacritics" },
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
	export const insertTermControl = (
		terms: MatchTerms,
		idx: number,
		command: string,
		commandReverse: string,
		highlightTags: HighlightTags,
		controlsInfo: ControlsInfo,
		highlighter: Highlighter,
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
			highlighter.current.focusNextTerm(highlightTags, false, false, term);
		};
		controlContent.addEventListener("mouseover", () => { // FIXME this is not screenreader friendly.
			updateTermTooltip(term, highlighter);
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

	export const controlGetClass = (controlName: ControlButtonName) =>
		EleClass.CONTROL + "-" + controlName
	;

	export const controlVisibilityUpdate = (
		controlName: ControlButtonName,
		controlsInfo: ControlsInfo,
		terms: MatchTerms,
	) => {
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
	export const controlsInsert = (() => {
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

			return (terms: MatchTerms, controlName: ControlButtonName, hideWhenInactive: boolean, controlsInfo: ControlsInfo) => {
				const info: Record<ControlButtonName, ControlButtonInfo> = {
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
				};
				controlInsertWithInfo(controlName, info[controlName], hideWhenInactive);
				controlVisibilityUpdate(controlName, controlsInfo, terms);
			};
		})();

		return (
			terms: MatchTerms,
			commands: BrowserCommands,
			highlightTags: HighlightTags,
			hues: TermHues,
			produceEffectOnCommand: ProduceEffectOnCommand,
			controlsInfo: ControlsInfo,
			highlighter: Highlighter,
		) => {
			fillStylesheetContent(terms, hues, controlsInfo, highlighter);
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
			terms.forEach((term, i) => insertTermControl(terms, i, termCommands.down[i], termCommands.up[i], highlightTags,
				controlsInfo, highlighter));
			const gutter = document.createElement("div");
			gutter.id = EleID.MARKER_GUTTER;
			document.body.insertAdjacentElement("afterend", gutter);
		};
	})();

	/**
	 * Removes the control bar and scroll gutter.
	 */
	export const controlsRemove = () => {
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

	/**
	 * Insert the toolbar and appropriate controls.
	 * @param terms Terms to highlight and display in the toolbar.
	 * @param controlsInfo Details of controls to insert.
	 * @param commands Browser commands to use in shortcut hints.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param hues Color hues for term styles to cycle through.
	 * @param produceEffectOnCommand
	 */
	export const insertToolbar = (
		terms: MatchTerms,
		commands: BrowserCommands,
		highlightTags: HighlightTags,
		hues: TermHues,
		produceEffectOnCommand: ProduceEffectOnCommand,
		controlsInfo: ControlsInfo,
		highlighter: Highlighter,
	) => {
		const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
			&& document.activeElement.closest(`#${EleID.BAR}`);
		controlsRemove();
		controlsInsert(terms, commands, highlightTags, hues, produceEffectOnCommand, controlsInfo, highlighter);
		if (focusingControlAppend) {
			const input = (getControl() as HTMLElement).querySelector("input") as HTMLInputElement;
			input.focus();
			input.select();
		}
	};
}

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

/*
HIGHLIGHTING - MAIN
Types, methods, and classes for use in highlighting. Includes all available highlighting engines.
*/

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace TermCSS {
	export const getFlatStyle = (color: string) => color;

	export const getDiagonalStyle = (colorA: string, colorB: string, cycle: number) => {
		const isAboveStyleLevel = (level: number) => cycle >= level;
		return isAboveStyleLevel(1)
			? `repeating-linear-gradient(${
				isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
			}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
			: colorA;
	};

	export const getHorizontalStyle = (colorA: string, colorB: string, cycle: number) => {
		const isAboveStyleLevel = (level: number) => cycle >= level;
		return isAboveStyleLevel(1)
			? `linear-gradient(${Array(Math.floor(cycle/2 + 1.5) * 2).fill("").map((v, i) =>
				(Math.floor(i / 2) % 2 == cycle % 2 ? colorB : colorA) + `${Math.floor((i + 1) / 2)/(Math.floor((cycle + 1) / 2) + 1) * 100}%`
			)})`
			: colorA;
	};
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Matcher {
	type BoxInfoExt = Record<string | never, unknown>
	export type BaseFlow<WithNode extends boolean, BoxInfoExtension extends BoxInfoExt = Record<never, never>> = {
		text: string
		boxesInfo: Array<BaseBoxInfo<WithNode, BoxInfoExtension>>
	}

	export type Flow = BaseFlow<true>

	export type BaseBoxInfo<WithNode extends boolean, BoxInfoExtension extends BoxInfoExt = Record<never, never>> = {
		term: MatchTerm
		start: number
		end: number
	} & (WithNode extends true ? { node: Text } : Record<never, never>) & Partial<BoxInfoExtension>

	export type BoxInfo = BaseBoxInfo<true>

	export const flowPopulateBoxesInfo = (flow: Flow, textFlow: Array<Text>, terms: MatchTerms) => {
		for (const term of terms) {
			let i = 0;
			let node = textFlow[0];
			let textStart = 0;
			let textEnd = node.length;
			for (const match of flow.text.matchAll(term.pattern)) {
				const highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					node = textFlow[++i];
					textStart = textEnd;
					textEnd += node.length;
				}
				// eslint-disable-next-line no-constant-condition
				while (true) {
					// Register as much of this highlight that fits into this node.
					flow.boxesInfo.push({
						term,
						node,
						start: Math.max(0, highlightStart - textStart),
						end: Math.min(highlightEnd - textStart, node.length),
					});
					if (highlightEnd <= textEnd) {
						break;
					}
					// The highlight extends beyond this node, so keep going; move onto the next node.
					node = textFlow[++i];
					textStart = textEnd;
					textEnd += node.length;
				}
			}
		}
	};
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace FlowMonitor {
	export const CACHE = "markmysearch__cache";

	export type TreeCache<Flow = Matcher.Flow> = {
		flows: Array<Flow>
	}
	
	export interface AbstractHighlightable {
		checkElement: (node: Node) => boolean

		findAncestor: <T extends Element>(element: T) => T

		/**
		 * From the element specified (included) to its highest ancestor element (not included),
		 * mark each as _an element beneath a highlightable one_ (which could e.g. have a background that obscures highlights).
		 * This allows them to be selected in CSS.
		 * @param element The lowest descendant to be marked of the highlightable element.
		 */
		markElementsUpTo: (element: Element) => void
	}

	export class StandardHighlightable implements AbstractHighlightable {
		checkElement = () => true;

		findAncestor = <T extends Element>(element: T) => element;

		markElementsUpTo = () => undefined;
	}

	export class CSSPaintHighlightable implements AbstractHighlightable {
		checkElement = (element: Element) => !element.closest("a");

		findAncestor <T extends Element>(element: T) {
			let ancestor = element;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				// Anchors cannot (yet) be highlighted directly inside, due to security concerns with CSS Paint.
				const ancestorUnhighlightable = ancestor.closest("a") as T | null;
				if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
					ancestor = ancestorUnhighlightable.parentElement as unknown as T;
				} else {
					break;
				}
			}
			return ancestor;
		}

		markElementsUpTo (element: Element) {
			if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
				element.setAttribute("markmysearch-h_beneath", "");
				this.markElementsUpTo(element.parentElement as Element);
			}
		}
	}
}

interface AbstractFlowMonitor {
	mutationObserver: MutationObserver;

	initMutationUpdatesObserver: (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
		onElementsAdded: (elements: Set<Element>) => void,
	) => void

	boxesInfoCalculate: (
		terms: MatchTerms,
		flowOwner: Element,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) => void
}

class DummyFlowMonitor implements AbstractFlowMonitor {
	mutationObserver = new MutationObserver(() => undefined);
	initMutationUpdatesObserver = () => undefined;
	boxesInfoCalculate = () => undefined;
}

class StandardFlowMonitor implements AbstractFlowMonitor {
	mutationObserver = new MutationObserver(() => undefined);

	highlightable: FlowMonitor.AbstractHighlightable;

	onNewHighlightedAncestor: (ancestor: Element, ancestorHighlightable: Element) => void = () => undefined;

	createElementCache: (element: Element) => FlowMonitor.TreeCache = () => ({ flows: [] });

	onBoxesInfoPopulated?: (boxesInfo: Array<Matcher.BoxInfo>) => void;
	onBoxesInfoCleared?: (boxesInfo: Array<Matcher.BoxInfo>) => void;

	constructor (
		highlightable: FlowMonitor.AbstractHighlightable,
		onNewHighlightedAncestor: (ancestor: Element, ancestorHighlightable: Element) => void,
		createElementCache: (element: Element) => FlowMonitor.TreeCache,
		onBoxesInfoPopulated?: (boxesInfo: Array<Matcher.BoxInfo>) => void,
		onBoxesInfoCleared?: (boxesInfo: Array<Matcher.BoxInfo>) => void,
	) {
		this.highlightable = highlightable;
		this.onNewHighlightedAncestor = onNewHighlightedAncestor;
		this.createElementCache = createElementCache;
		this.onBoxesInfoPopulated = onBoxesInfoPopulated;
		this.onBoxesInfoCleared = onBoxesInfoCleared;
	}

	initMutationUpdatesObserver (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
		onElementsAdded: (elements: Set<Element>) => void,
	) {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		this.mutationObserver = new MutationObserver(mutations => {
			// TODO optimise as above
			const elementsAffected: Set<Element> = new Set();
			const elementsAdded: Set<Element> = new Set();
			for (const mutation of mutations) {
				if (mutation.type === "characterData"
					&& mutation.target.parentElement
					&& canHighlightElement(rejectSelector, mutation.target.parentElement)
				) {
					elementsAffected.add(mutation.target.parentElement);
				}
				for (const node of mutation.addedNodes) if (node.parentElement) {
					switch (node.nodeType) {
					case Node.ELEMENT_NODE: { if (canHighlightElement(rejectSelector, node as Element)) {
						elementsAdded.add(node as Element);
						elementsAffected.add(node as Element);
					} break; }
					case Node.TEXT_NODE: { if (canHighlightElement(rejectSelector, node.parentElement)) {
						elementsAffected.add(node.parentElement);
					} break; }
					}
				}
				(this.onBoxesInfoCleared && this.onBoxesInfoCleared(Array.from(mutation.removedNodes).flatMap(node =>
					(node[FlowMonitor.CACHE] as FlowMonitor.TreeCache | undefined)?.flows.flatMap(flow => flow.boxesInfo) ?? []
				)));
			}
			onElementsAdded(elementsAdded);
			for (const element of elementsAffected) {
				this.boxesInfoCalculateForFlowOwnersFromContent(terms, element, highlightTags, termCountCheck);
			}
		});
	}

	boxesInfoCalculateForFlowOwnersFromContent (
		terms: MatchTerms,
		element: Element,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		if (highlightTags.flow.has(element.tagName)) {
			// The element may include non self-contained flows.
			this.boxesInfoCalculateForFlowOwners(terms, element, highlightTags, termCountCheck);
		} else {
			// The element can only include self-contained flows, so flows need only be recalculated below the element.
			this.boxesInfoCalculate(terms, element, highlightTags, termCountCheck);
		}
	}

	boxesInfoCalculateForFlowOwners (
		terms: MatchTerms,
		node: Node,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
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
				this.boxesInfoCalculate(terms, parent, highlightTags, termCountCheck);
			} else {
				// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
				this.boxesInfoCalculateForFlowOwners(terms, parent, highlightTags, termCountCheck);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.boxesInfoCalculate(terms, parent, highlightTags, termCountCheck);
		}
	}

	boxesInfoCalculate (
		terms: MatchTerms,
		flowOwner: Element,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		if (!flowOwner.firstChild)
			return;
		const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
		const textFlows = getTextFlows(flowOwner.firstChild, highlightTags);
		this.flowsRemove(flowOwner, highlightTags);
		textFlows // The first flow is always before the first break, and the last flow after the last break. Either may be empty.
			.slice((breaksFlow && textFlows[0]?.length) ? 0 : 1, (breaksFlow && textFlows.at(-1)?.length) ? undefined : -1)
			.forEach(textFlow => this.flowCacheWithBoxesInfo(terms, textFlow));
		termCountCheck(); // Major performance hit when using very small delay or small delay maximum for debounce.
	}

	/**
	 * Removes the flows cache from all descendant elements.
	 * @param element The ancestor below which to forget flows.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 */
	flowsRemove (element: Element, highlightTags: HighlightTags) {
		if (highlightTags.reject.has(element.tagName)) {
			return;
		}
		const highlighting = element[FlowMonitor.CACHE] as FlowMonitor.TreeCache;
		if (highlighting) {
			(this.onBoxesInfoCleared && this.onBoxesInfoCleared(highlighting.flows.flatMap(flow => flow.boxesInfo)));
			highlighting.flows = [];
		}
		for (const child of element.children) {
			this.flowsRemove(child, highlightTags);
		}
	}

	/**
	 * TODO document
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	flowCacheWithBoxesInfo (terms: MatchTerms, textFlow: Array<Text>) {
		const text = textFlow.map(node => node.textContent).join("");
		const getAncestorCommon = (ancestor: Element, node: Node): Element =>
			ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as Element, node);
		const ancestor = getAncestorCommon(textFlow[0].parentElement as Element, textFlow.at(-1) as Text);
		let ancestorHighlighting = ancestor[FlowMonitor.CACHE] as FlowMonitor.TreeCache | undefined;
		const flow: Matcher.Flow = {
			text,
			boxesInfo: [],
		};
		if (ancestorHighlighting) {
			ancestorHighlighting.flows.push(flow);
		} else {
			// This condition *should* be impossible, but since in rare cases (typically when running before "document_idle")
			// mutation observers may not always fire, it must be accounted for.
			ancestorHighlighting = this.createElementCache(ancestor);
			ancestorHighlighting.flows.push(flow);
			ancestor[FlowMonitor.CACHE] = ancestorHighlighting;
			//console.warn("Element missing cache unexpectedly, applied new cache.", ancestor, ancestorHighlighting);
		}
		// Match the terms inside the flow to produce highlighting box info.
		Matcher.flowPopulateBoxesInfo(flow, textFlow, terms);
		(this.onBoxesInfoPopulated && this.onBoxesInfoPopulated(flow.boxesInfo));
		if (!flow.boxesInfo.length) {
			return;
		}
		const ancestorHighlightable = this.highlightable.findAncestor(ancestor);
		this.onNewHighlightedAncestor(ancestor, ancestorHighlightable);
	}
}

interface AbstractSpecialEngine {
	startHighlighting: (terms: MatchTerms) => void

	endHighlighting: () => void

	highlight: (highlightCtx: PaintSpecial.HighlightContext, terms: MatchTerms) => void

	unhighlight: (highlightCtx: PaintSpecial.HighlightContext) => void
}

class DummySpecialEngine implements AbstractSpecialEngine {
	startHighlighting = () => undefined;
	endHighlighting = () => undefined;
	highlight = () => undefined;
	unhighlight = () => undefined;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace PaintSpecial {
	export type Flow = Matcher.BaseFlow<false, Paint.BoxInfoBoxes>

	export type BoxInfo = Matcher.BaseBoxInfo<false, Paint.BoxInfoBoxes>

	export const contextCSS = { hovered: ":hover", focused: ":focus" };

	export type HighlightContext = keyof typeof contextCSS

	export type StyleRulesInfo = Record<HighlightContext, string>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class PaintSpecialEngine implements AbstractSpecialEngine {
	method = new Paint.UrlMethod();
	terms: MatchTerms = [];
	styleRules: PaintSpecial.StyleRulesInfo = { hovered: "", focused: "" };

	onFocusInListener: (event: FocusEvent) => void = () => undefined;
	onHoverListener: (event: MouseEvent) => void = () => undefined;

	constructor () {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const objectThis = this;
		this.onFocusInListener = event => objectThis.onFocusIn(event);
		this.onHoverListener = event => objectThis.onHover(event);
	}

	startHighlighting (terms: MatchTerms) {
		// Clean up.
		this.endHighlighting();
		// MAIN
		this.insertElements();
		this.terms = terms;
		window.addEventListener("focusin", this.onFocusInListener);
		window.addEventListener("mouseover", this.onHoverListener);
	}

	endHighlighting () {
		this.terms = [];
		window.removeEventListener("focusin", this.onFocusInListener);
		window.removeEventListener("mouseover", this.onHoverListener);
		this.removeElements();
	}

	insertElements () {
		const style = document.createElement("style");
		style.id = EleID.STYLE_PAINT_SPECIAL;
		document.head.appendChild(style);
		const elementContainer = document.createElement("div");
		elementContainer.id = EleID.ELEMENT_CONTAINER_SPECIAL;
		document.body.insertAdjacentElement("afterend", elementContainer);
	}

	removeElements () {
		document.querySelectorAll(
			`#${EleID.STYLE_PAINT_SPECIAL}, #${EleID.ELEMENT_CONTAINER_SPECIAL}`
		).forEach(Element.prototype.remove);
	}

	getFlow (terms: MatchTerms, input: HTMLInputElement) {
		const flow: PaintSpecial.Flow = {
			text: input.value,
			boxesInfo: [],
		};
		for (const term of terms) {
			for (const match of flow.text.matchAll(term.pattern)) {
				flow.boxesInfo.push({
					term,
					start: match.index as number,
					end: (match.index as number) + match[0].length,
					boxes: [],
				});
			}
		}
	}

	onFocusIn (event: FocusEvent) {
		console.log("focus in", event.target, event.relatedTarget);
		if ((event.target as HTMLElement | null)?.tagName === "INPUT") {
			this.highlight("focused", this.terms);
		} else if ((event.relatedTarget as HTMLElement | null)?.tagName === "INPUT") {
			this.unhighlight("focused");
		}
	}

	onHover (event: MouseEvent) {
		console.log("mouse enter", event.target, event.relatedTarget);
		if ((event.target as HTMLElement | null)?.tagName === "INPUT") {
			this.highlight("hovered", this.terms);
		} else if ((event.relatedTarget as HTMLElement | null)?.tagName === "INPUT") {
			this.unhighlight("hovered");
		}
	}

	highlight (highlightCtx: PaintSpecial.HighlightContext, terms: MatchTerms) {
		this.styleUpdate({ [highlightCtx]: this.constructHighlightStyleRule(terms, highlightCtx) });
	}

	unhighlight (highlightCtx: PaintSpecial.HighlightContext) {
		this.styleUpdate({ [highlightCtx]: "" });
	}

	constructHighlightStyleRule = (terms: MatchTerms, highlightCtx: PaintSpecial.HighlightContext) =>
		`#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body input${PaintSpecial.contextCSS[highlightCtx]} { background-image: ${
			this.constructHighlightStyleRuleUrl(terms)
		} !important; }`;

	constructHighlightStyleRuleUrl (terms: MatchTerms) {
		if (!terms.length) {
			return "url()";
		}
		return this.method.constructHighlightStyleRuleUrl([ { token: terms[0].token, x: 20, y: 0, width: 50, height: 16 } ], terms);
	}

	styleUpdate (styleRules: Partial<PaintSpecial.StyleRulesInfo>) {
		const style = document.getElementById(EleID.STYLE_PAINT_SPECIAL) as HTMLStyleElement;
		Object.keys(PaintSpecial.contextCSS).forEach(highlightContext => {
			const rule = styleRules[highlightContext];
			if (rule !== undefined) {
				this.styleRules[highlightContext] = rule;
			}
		});
		const styleContent = Object.values(this.styleRules).join("\n");
		if (styleContent !== style.textContent) {
			style.textContent = styleContent;
		}
	}
}

enum HighlighterProcess {
	REFRESH_TERM_CONTROLS,
	REFRESH_INDICATORS,
}

interface AbstractEngine {
	// TODO document each
	getMiscCSS: () => string
	getTermHighlightsCSS: () => string
	getTermHighlightCSS: (terms: MatchTerms, hues: Array<number>, termIndex: number) => string

	// TODO document
	getTermBackgroundStyle: (colorA: string, colorB: string, cycle: number) => string

	// TODO document
	getRequestWaitDuration: (process: HighlighterProcess) => number

	// TODO document
	getRequestReschedulingDelayMax: (process: HighlighterProcess) => number

	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insertScrollMarkers: (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		hues: TermHues,
	) => void

	// TODO document
	raiseScrollMarker: (
		term: MatchTerm | undefined,
		container: HTMLElement,
	) => void

	/**
	 * Removes previous highlighting, then highlights the document using the terms supplied.
	 * Disables then restarts continuous highlighting.
	 * @param terms Terms to be continuously found and highlighted within the DOM.
	 * @param termsToPurge Terms for which to remove previous highlights.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param termCountCheck A function for requesting that term occurrence count indicators be regenerated.
	 */
	startHighlighting: (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) => void
	
	// TODO document
	undoHighlights: (
		terms?: MatchTerms | undefined,
		root?: HTMLElement | DocumentFragment,
	) => void

	// TODO document
	endHighlighting: () => void

	// TODO document
	focusNextTerm: (
		highlightTags: HighlightTags,
		reverse: boolean,
		stepNotJump: boolean,
		term?: MatchTerm,
	) => void

	/**
	 * Gets the number of matches for a term in the document.
	 * @param term A term to get the occurrence count for.
	 * @returns The occurrence count for the term.
	 */
	getTermOccurrenceCount: (
		term: MatchTerm,
		checkExistsOnly?: boolean,
	) => number
}

type Highlighter = { current: AbstractEngine }

class DummyEngine implements AbstractEngine {
	getMiscCSS = () => "";
	getTermHighlightsCSS = () => "";
	getTermHighlightCSS = () => "";
	getTermBackgroundStyle = () => "";
	getRequestWaitDuration = () => 0;
	getRequestReschedulingDelayMax = () => 0;
	insertScrollMarkers = () => undefined;
	raiseScrollMarker = () => undefined;
	startHighlighting = () => undefined;
	undoHighlights = () => undefined;
	endHighlighting = () => undefined;
	focusNextTerm = () => undefined;
	getTermOccurrenceCount = () => 0;
}

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
const elementsReMakeUnfocusable = (root: HTMLElement | DocumentFragment = document.body) => {
	if (!root.parentNode) {
		return;
	}
	root.parentNode.querySelectorAll(`.${EleClass.FOCUS_REVERT}`)
		.forEach((element: HTMLElement) => {
			element.tabIndex = -1;
			element.classList.remove(EleClass.FOCUS_REVERT);
		});
};

/**
 * Determines whether or not the highlighting algorithm should be run on an element.
 * @param rejectSelector A selector string for ancestor tags to cause rejection.
 * @param element An element to test for highlighting viability.
 * @returns `true` if determined highlightable, `false` otherwise.
 */
const canHighlightElement = (rejectSelector: string, element: Element): boolean =>
	!element.closest(rejectSelector) && element.tagName !== HIGHLIGHT_TAG_UPPER
;

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Elem {
	export const ELEMENT_IS_KNOWN = "markmysearch__known";

	export interface FlowNodeListItem {
		value: Text
		next: FlowNodeListItem | null
	}

	/**
	 * Singly linked list implementation for efficient highlight matching of DOM node 'flow' groups.
	 */
	export class FlowNodeList {
		first: FlowNodeListItem | null;
		last: FlowNodeListItem | null;

		push (value: Text) {
			if (this.last) {
				this.last.next = { value, next: null };
				this.last = this.last.next;
			} else {
				this.first = { value, next: null };
				this.last = this.first;
			}
		}

		insertAfter (itemBefore: FlowNodeListItem | null, value: Text): FlowNodeListItem {
			if (itemBefore) {
				itemBefore.next = { next: itemBefore.next, value };
				return itemBefore.next;
			} else {
				this.first = { next: this.first, value };
				return this.first;
			}
		}

		remove (itemBefore: FlowNodeListItem | null) {
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
				text += (current as FlowNodeListItem).value.textContent;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as FlowNodeListItem).next);
			return text;
		}

		clear () {
			this.first = null;
			this.last = null;
		}

		*[Symbol.iterator] () {
			let current = this.first;
			do {
				yield current as FlowNodeListItem;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as FlowNodeListItem).next);
		}
	}
}

class ElementEngine implements AbstractEngine {
	mutationObserver: MutationObserver | null = null;
	mutationUpdates = getMutationUpdates(() => this.mutationObserver);
	specialHighlighter: AbstractSpecialEngine = new DummySpecialEngine();

	constructor (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		this.mutationObserver = this.getMutationUpdatesObserver(terms, highlightTags, termCountCheck);
	}

	getMiscCSS () {
		return "";
	}

	getTermHighlightsCSS () {
		return `
${HIGHLIGHT_TAG} {
	font: inherit;
	border-radius: 2px;
	visibility: visible;
}
.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}`
		;
	}

	getTermHighlightCSS (terms: MatchTerms, hues: Array<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		const cycle = Math.floor(termIndex / hues.length);
		return `
#${EleID.BAR} ~ body .${EleClass.FOCUS_CONTAINER} ${HIGHLIGHT_TAG}.${getTermClass(term.token)},
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ${HIGHLIGHT_TAG}.${getTermClass(term.token)} {
	background: ${this.getTermBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle)};
	box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35);
}`
		;
	}

	getTermBackgroundStyle = TermCSS.getDiagonalStyle;

	getRequestWaitDuration (process: HighlighterProcess) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 50;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 50;
	} }

	getRequestReschedulingDelayMax (process: HighlighterProcess) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 500;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 500;
	} }

	insertScrollMarkers (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) {
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
						const termsAddedCount = containersInfo[containerIdx].termsAdded.size;
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
	}

	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		const scrollMarkerGutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		elementsPurgeClass(EleClass.FOCUS, scrollMarkerGutter);
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
	}

	startHighlighting (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.undoHighlights(termsToPurge);
		// MAIN
		this.generateTermHighlightsUnderNode(termsToHighlight.length ? termsToHighlight : terms,
			document.body, highlightTags, termCountCheck);
		this.mutationUpdates.observe();
		this.specialHighlighter.startHighlighting(terms);
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.undoHighlights();
		this.specialHighlighter.endHighlighting();
	}

	/**
	 * Revert all direct DOM tree changes introduced by the extension, under a root node.
	 * Circumstantial and non-direct alterations may remain.
	 * @param terms The terms associated with the highlights to remove. If `undefined`, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	undoHighlights (terms?: MatchTerms, root: HTMLElement | DocumentFragment = document.body) {
		if (terms && !terms.length)
			return; // Optimization for removing 0 terms
		const classNames = terms?.map(term => getTermClass(term.token));
		const highlights = Array.from(root.querySelectorAll(
			classNames ? `${HIGHLIGHT_TAG}.${classNames.join(`, ${HIGHLIGHT_TAG}.`)}` : HIGHLIGHT_TAG
		)).reverse();
		// TODO attempt to join text nodes back together
		for (const highlight of highlights) {
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
		elementsReMakeUnfocusable(root);
	}

	/**
	 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
	 * @param terms Terms to find, highlight, and mark.
	 * @param rootNode A node under which to find and highlight term occurrences.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param termCountCheck A function for requesting that term occurrence count indicators be regenerated.
	 */
	generateTermHighlightsUnderNode = (() => {
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
			nodeItems: Elem.FlowNodeList,
			nodeItemPrevious: Elem.FlowNodeListItem | null,
		): Elem.FlowNodeListItem => {
			// This is necessarily a destructive strategy. Occasional damage to the webpage and its functionality is unavoidable.
			const text = textAfterNode.textContent ?? "";
			if (text.length === 0) {
				textAfterNode.parentElement?.removeChild(textAfterNode);
				return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as Elem.FlowNodeListItem;
			}
			const parent = textAfterNode.parentNode as Node;
			const textEndNode = document.createTextNode(text.substring(start, end));
			const highlight = document.createElement(HIGHLIGHT_TAG);
			highlight.classList.add(getTermClass(term.token));
			highlight.appendChild(textEndNode);
			textAfterNode.textContent = text.substring(end);
			parent.insertBefore(highlight, textAfterNode);
			parent[Elem.ELEMENT_IS_KNOWN] = true;
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
		const highlightInBlock = (terms: MatchTerms, nodeItems: Elem.FlowNodeList) => {
			const textFlow = nodeItems.getText();
			for (const term of terms) {
				let nodeItemPrevious: Elem.FlowNodeListItem | null = null;
				let nodeItem: Elem.FlowNodeListItem | null = nodeItems.first as Elem.FlowNodeListItem;
				let textStart = 0;
				let textEnd = nodeItem.value.length;
				for (const match of textFlow.matchAll(term.pattern)) {
					let highlightStart = match.index as number;
					const highlightEnd = highlightStart + match[0].length;
					while (textEnd <= highlightStart) {
						nodeItemPrevious = nodeItem;
						nodeItem = nodeItem.next as Elem.FlowNodeListItem;
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
						nodeItem = nodeItem.next as Elem.FlowNodeListItem;
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
			nodeItems: Elem.FlowNodeList,
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
				const nodeItems = new Elem.FlowNodeList();
				nodeItems.push(rootNode as Text);
				highlightInBlock(terms, nodeItems);
			} else {
				const nodeItems = new Elem.FlowNodeList();
				insertHighlights(terms, rootNode, highlightTags, nodeItems, false);
				if (nodeItems.first) {
					highlightInBlock(terms, nodeItems);
				}
			}
			termCountCheck();
		};
	})();

	focusNextTerm (
		highlightTags: HighlightTags,
		reverse: boolean,
		stepNotJump: boolean,
		term: MatchTerm | undefined,
	) {
		if (stepNotJump) {
			// Currently no support for specific terms.
			this.focusNextTermStep(highlightTags, reverse);
		} else {
			this.focusNextTermJump(highlightTags, reverse, term);
		}
	}

	/**
	 * Focuses an element, preventing immediate scroll-into-view and forcing visible focus where supported.
	 * @param element An element.
	 */
	focusElement (element: HTMLElement) {
		element.focus({
			preventScroll: true,
			focusVisible: true, // Very sparse browser compatibility
		} as FocusOptions);
	}

	// TODO document
	selectNextElement (
		reverse: boolean,
		walker: TreeWalker,
		walkSelectionFocusContainer: { accept: boolean },
		highlightTags: HighlightTags,
		elementToSelect?: HTMLElement,
	): { elementSelected: HTMLElement | null, container: HTMLElement | null } {
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
		this.focusElement(elementToSelect);
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(EleClass.REMOVE);
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			this.focusElement(elementToSelect);
		}
		if (document.activeElement === elementToSelect) {
			return { elementSelected: elementToSelect, container };
		}
		return this.selectNextElement(reverse, walker, walkSelectionFocusContainer, highlightTags, elementToSelect);
	}

	/**
	 * Scrolls to and focuses the next block containing an occurrence of a term in the document, from the current selection position.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	focusNextTermJump (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) {
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
			elementsReMakeUnfocusable();
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
		const { elementSelected, container } = this.selectNextElement(reverse, walker, walkSelectionFocusContainer, highlightTags);
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
		this.raiseScrollMarker(term, container);
	}

	getSiblingHighlightFinal (
		highlight: HTMLElement,
		node: Node,
		nextSiblingMethod: "nextSibling" | "previousSibling"
	) {
		return node[nextSiblingMethod]
			? (node[nextSiblingMethod] as Node).nodeType === Node.ELEMENT_NODE
				? (node[nextSiblingMethod] as HTMLElement).tagName === HIGHLIGHT_TAG_UPPER
					? this.getSiblingHighlightFinal(node[nextSiblingMethod] as HTMLElement, node[nextSiblingMethod] as HTMLElement,
						nextSiblingMethod)
					: highlight
				: (node[nextSiblingMethod] as Node).nodeType === Node.TEXT_NODE
					? (node[nextSiblingMethod] as Text).textContent === ""
						? this.getSiblingHighlightFinal(highlight, node[nextSiblingMethod] as Text, nextSiblingMethod)
						: highlight
					: highlight
			: highlight;
	}

	getTopLevelHighlight (element: Element) {
		const closestHighlight = (element.parentElement as Element).closest(HIGHLIGHT_TAG);
		return closestHighlight ? this.getTopLevelHighlight(closestHighlight) : element;
	}

	stepToElement (highlightTags: HighlightTags, element: HTMLElement) {
		element = this.getTopLevelHighlight(element);
		const elementFirst = this.getSiblingHighlightFinal(element, element, "previousSibling");
		const elementLast = this.getSiblingHighlightFinal(element, element, "nextSibling");
		(getSelection() as Selection).setBaseAndExtent(elementFirst, 0, elementLast, elementLast.childNodes.length);
		element.scrollIntoView({ block: "center" });
		this.raiseScrollMarker(undefined, getContainerBlock(element, highlightTags));
	}

	/**
	 * Scrolls to and focuses the next occurrence of a term in the document, from the current selection position.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param nodeStart __Only supplied in recursion.__ Specifies a node at which to begin scanning.
	 */
	focusNextTermStep (highlightTags: HighlightTags, reverse: boolean, nodeStart?: Node) {
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
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = reverse ? selection.anchorNode : selection.focusNode;
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
		const element = walker[reverse ? "previousNode" : "nextNode"]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				this.focusNextTermStep(highlightTags, reverse, nodeBegin);
			}
			return;
		}
		this.stepToElement(highlightTags, element);
	}

	// Increasingly inaccurate as highlights elements are more often split.
	getTermOccurrenceCount (term: MatchTerm) {
		const occurrences = document.body.getElementsByClassName(getTermClass(term.token));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length; // Poor and changeable heuristic, but so far the most reliable efficient method.
	}

	getMutationUpdatesObserver (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		const rejectSelector = Array.from(highlightTags.reject).join(", ");
		const elements: Set<HTMLElement> = new Set();
		let periodDateLast = 0;
		let periodHighlightCount = 0;
		let throttling = false;
		let highlightIsPending = false;
		const highlightElements = () => {
			highlightIsPending = false;
			for (const element of elements) {
				this.undoHighlights(undefined, element);
				this.generateTermHighlightsUnderNode(terms, element, highlightTags, termCountCheck);
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
			const elementsKnown: Set<HTMLElement> = new Set();
			for (const mutation of mutations) {
				const element = mutation.target.nodeType === Node.TEXT_NODE
					? mutation.target.parentElement as HTMLElement
					: mutation.target as HTMLElement;
				if (element) {
					if (element[Elem.ELEMENT_IS_KNOWN]) {
						elementsKnown.add(element);
					} else if ((mutation.type === "childList" || !element.querySelector(HIGHLIGHT_TAG))
						&& canHighlightElement(rejectSelector, element)) {
						elements.add(element);
					}
				}
			}
			for (const element of elementsKnown) {
				delete element[Elem.ELEMENT_IS_KNOWN];
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
	}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Paint {
	export type Flow = Matcher.BaseFlow<true, BoxInfoBoxes>

	export type BoxInfo = Matcher.BaseBoxInfo<true, BoxInfoBoxes>

	export type BoxInfoBoxes = { boxes: Array<Box> }

	export type Box = {
		token: string
		x: number
		y: number
		width: number
		height: number
	}

	export type TreeCache = {
		id: string
		styleRuleIdx: number
		isHighlightable: boolean
	} & FlowMonitor.TreeCache<Flow>

	export type StyleRuleInfo = {
		rule: string
		element: Element
	}

	export const getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	export const styleRulesGetBoxesOwned = (
		owner: Element,
		element?: Element,
		range = new Range,
	): Array<Box> => {
		element ??= owner;
		return getOwnedBoxes(owner, element, range).concat(Array.from(element.children).flatMap(child =>
			(child[FlowMonitor.CACHE] ? !(child[FlowMonitor.CACHE] as Paint.TreeCache).isHighlightable : false)
				? styleRulesGetBoxesOwned(owner, child, range) : []
		));
	};

	const getOwnedBoxes = (
		owner: Element,
		element?: Element,
		range = new Range(),
	) => {
		element ??= owner;
		const elementInfo = element[FlowMonitor.CACHE] as Paint.TreeCache;
		if (!elementInfo || elementInfo.flows.every(flow => flow.boxesInfo.length === 0)) {
			return [];
		}
		let ownerRects = Array.from(owner.getClientRects());
		if (!ownerRects.length) {
			ownerRects = [ owner.getBoundingClientRect() ];
		}
		elementPopulateBoxes(elementInfo.flows, ownerRects, range);
		return elementInfo.flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes ?? []));
	};

	const elementPopulateBoxes = (
		elementFlows: Array<Flow>,
		elementRects: Array<DOMRect>,
		range = new Range(),
	) =>
		elementFlows.forEach(flow => flow.boxesInfo.forEach(boxInfo => {
			boxInfo.boxes?.splice(0);
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
				for (const ownerRect of elementRects) {
					if (ownerRect.bottom > textRect.top) {
						x += textRect.x - ownerRect.x;
						y = textRect.y - ownerRect.y;
						break;
					} else {
						x += ownerRect.width;
					}
				}
				boxInfo.boxes ??= [];
				boxInfo.boxes.push({
					token: boxInfo.term.token,
					x: Math.round(x),
					y: Math.round(y),
					width: Math.round(textRect.width),
					height: Math.round(textRect.height),
				});
			}
		}))
	;

	export interface AbstractMethod {
		highlightable: FlowMonitor.AbstractHighlightable

		getMiscCSS: () => string

		getTermHighlightsCSS: () => string

		getTermHighlightCSS: (terms: MatchTerms, hues: Array<number>, termIndex: number) => string

		endHighlighting: () => void

		getHighlightedElements: () => NodeListOf<Element>

		/**
		 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
		 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
		 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
		 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
		 */
		constructHighlightStyleRule: (highlightId: string, boxes: Array<Box>, terms: MatchTerms) => string

		tempReplaceContainers: (root: Element, recurse: boolean) => void

		tempRemoveDrawElement: (element: Element) => void
	}

	export class DummyMethod implements AbstractMethod {
		highlightable = new FlowMonitor.StandardHighlightable();
		getMiscCSS = () => "";
		getTermHighlightsCSS = () => "";
		getTermHighlightCSS = () => "";
		getHighlightedElements = (): NodeListOf<Element> => document.querySelectorAll("#_");
		endHighlighting = () => undefined;
		constructHighlightStyleRule = () => "";
		tempReplaceContainers = () => undefined;
		tempRemoveDrawElement = () => undefined;
	}

	export class PaintMethod implements AbstractMethod {
		highlightable = new FlowMonitor.CSSPaintHighlightable();

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

		constructHighlightStyleRule = (highlightId: string, boxes: Array<Box>) =>
			`body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${JSON.stringify(boxes)}; }`;
		
		tempReplaceContainers = () => undefined;

		tempRemoveDrawElement = () => undefined;
	}

	export class ElementMethod implements AbstractMethod {
		highlightable = new FlowMonitor.StandardHighlightable();

		getMiscCSS () {
			return `
#${EleID.DRAW_CONTAINER} {
	& {
		position: fixed;
		width: 100%;
		height: 100%;
		top: 100%;
		z-index: ${Z_INDEX_MIN};
	}
	& > * {
		position: fixed;
		width: 100%;
		height: 100%;
	}
}

#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${EleClass.TERM} {
	outline: 2px solid hsl(0 0% 0% / 0.1);
	outline-offset: -2px;
	border-radius: 2px;
}`
			;
		}

		getTermHighlightsCSS = () => "";

		getTermHighlightCSS (terms: MatchTerms, hues: Array<number>, termIndex: number) {
			const term = terms[termIndex];
			const hue = hues[termIndex % hues.length];
			const cycle = Math.floor(termIndex / hues.length);
			const selector = `#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ #${EleID.DRAW_CONTAINER} .${
				getTermClass(term.token)
			}`;
			const backgroundStyle = getTermBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 88% / 0.4)`, cycle);
			return`${selector} { background: ${backgroundStyle}; }`;
		}

		endHighlighting = () => undefined;

		getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

		getElementDrawId = (highlightId: string) => EleID.DRAW_ELEMENT + "-" + highlightId;

		constructHighlightStyleRule = (highlightId: string) =>
			`body [markmysearch-h_id="${highlightId}"] { background-image: -moz-element(#${
				this.getElementDrawId(highlightId)
			}) !important; background-repeat: no-repeat !important; }`;

		tempReplaceContainers (root: Element, recurse: boolean) {
			// This whole operation is plagued with issues. Containers will almost never get deleted when they should
			// (e.g. when all terms have been removed or highlighting is disabled), and removing an individual term does not
			// result in the associated elements being deleted. TODO
			const containers: Array<Element> = [];
			this.collectElements(root, recurse, containers);
			const parent = document.getElementById(EleID.DRAW_CONTAINER) as Element;
			containers.forEach(container => {
				const containerExisting = document.getElementById(container.id);
				if (containerExisting) {
					containerExisting.remove();
				}
				parent.appendChild(container);
			});
		}
		
		collectElements (
			element: Element,
			recurse: boolean,
			containers: Array<Element>,
			range = new Range(),
		) {
			const elementInfo = element[FlowMonitor.CACHE] as Paint.TreeCache;
			const boxes: Array<Box> = styleRulesGetBoxesOwned(element);
			if (boxes.length) {
				const container = document.createElement("div");
				container.id = this.getElementDrawId(elementInfo.id);
				boxes.forEach(box => {
					const element = document.createElement("div");
					element.style.position = "absolute"; // Should it be "fixed"? Should it be applied in a stylesheet?
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
			if (recurse) {
				for (const child of element.children) if (child[FlowMonitor.CACHE]) {
					this.collectElements(child, recurse, containers, range);
				}
			}
		}

		tempRemoveDrawElement (element: Element) {
			document.getElementById(this.getElementDrawId((element[FlowMonitor.CACHE] as Paint.TreeCache).id))?.remove();
		}
	}

	export class UrlMethod implements AbstractMethod {
		highlightable = new FlowMonitor.StandardHighlightable();

		getMiscCSS = () => "";

		getTermHighlightsCSS = () => "";

		getTermHighlightCSS = () => "";

		endHighlighting = () => undefined;

		getHighlightedElements = () => document.body.querySelectorAll("[markmysearch-h_id]");

		constructHighlightStyleRule = (highlightId: string, boxes: Array<Box>, terms: MatchTerms) =>
			`#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id="${highlightId}"] { background-image: ${
				this.constructHighlightStyleRuleUrl(boxes, terms)
			} !important; }`;

		constructHighlightStyleRuleUrl = (boxes: Array<Box>, terms: MatchTerms) =>
			`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
				boxes.map(box =>
					`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${(
						terms.find(term => term.token === box.token) as MatchTerm).hue
					} 100% 50% / 0.4)'/%3E`
				).join("")
			}%3C/svg%3E")`;

		tempReplaceContainers = () => undefined;

		tempRemoveDrawElement = () => undefined;
	}
}

class PaintEngine implements AbstractEngine {
	method: Paint.AbstractMethod = new Paint.DummyMethod();

	flowMonitor: AbstractFlowMonitor = new DummyFlowMonitor();

	mutationUpdates = getMutationUpdates(() => this.flowMonitor.mutationObserver);

	elementsVisible: Set<Element> = new Set();
	shiftObserver: ResizeObserver | null = null;
	visibilityObserver: IntersectionObserver | null = null;
	styleUpdates = getStyleUpdates(this.elementsVisible, () => ({
		shiftObserver: this.shiftObserver,
		visibilityObserver: this.visibilityObserver,
	}));

	/**
	 * 
	 * @param terms 
	 * @param highlightTags 
	 * @param termCountCheck 
	 * @param useExperimental Whether experimental browser technologies (paint/element methods) should be used, if available.
	 */
	constructor (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
		methodPreference: PaintEngineMethod,
	) {
		if (methodPreference === PaintEngineMethod.PAINT && compatibility.highlight.paintEngine.paintMethod) {
			this.method = new Paint.PaintMethod();
		} else if (methodPreference === PaintEngineMethod.ELEMENT && compatibility.highlight.paintEngine.elementMethod) {
			this.method = new Paint.ElementMethod();
		} else {
			this.method = new Paint.UrlMethod();
		}
		this.flowMonitor = new StandardFlowMonitor(
			this.method.highlightable,
			(ancestor, ancestorHighlightable) => {
				this.styleUpdates.observe(ancestorHighlightable);
				const highlighting = ancestorHighlightable[FlowMonitor.CACHE] as Paint.TreeCache;
				if (highlighting.id === "") {
					highlighting.id = highlightingId.next().value;
					// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
					ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
				}
				this.method.highlightable.markElementsUpTo(ancestor);
			},
			(element): Paint.TreeCache => ({
				id: highlightingId.next().value,
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightable.checkElement(element),
				flows: [],
			}),
		);
		this.flowMonitor.initMutationUpdatesObserver(terms, highlightTags, termCountCheck,
			elementsAdded => elementsAdded.forEach(element => this.cacheExtend(element, highlightTags))
		);
		const { shiftObserver, visibilityObserver } = this.getShiftAndVisibilityObservers(terms);
		this.shiftObserver = shiftObserver;
		this.visibilityObserver = visibilityObserver;
		const highlightingId: Generator<string, never, unknown> = (function* () {
			let i = 0;
			while (true) {
				yield (i++).toString();
			}
		})();
		this.getMiscCSS = this.method.getMiscCSS;
		this.getTermHighlightsCSS = this.method.getTermHighlightsCSS;
		this.getTermHighlightCSS = this.method.getTermHighlightCSS;
	}

	// These are applied before construction, so we need to apply them in the constructor too.
	getMiscCSS = this.method.getMiscCSS;
	getTermHighlightsCSS = this.method.getTermHighlightsCSS;
	getTermHighlightCSS = this.method.getTermHighlightCSS;

	getTermBackgroundStyle = Paint.getTermBackgroundStyle;

	getRequestWaitDuration (process: HighlighterProcess) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 200;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 50;
	} }

	getRequestReschedulingDelayMax (process: HighlighterProcess) { switch (process) {
	case HighlighterProcess.REFRESH_INDICATORS: return 2000;
	case HighlighterProcess.REFRESH_TERM_CONTROLS: return 500;
	} }
	
	insertScrollMarkers (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) {
		if (terms.length === 0) {
			return; // Efficient escape in case of no possible markers to be inserted.
		}
		// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
		const termsAllowed = new Set(terms.slice(0, hues.length));
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		let markersHtml = "";
		this.method.getHighlightedElements().forEach((element: HTMLElement) => {
			const terms = (element[FlowMonitor.CACHE] as Paint.TreeCache | undefined)?.flows.flatMap(flow => flow.boxesInfo
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
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		// Depends on scroll markers refreshed Paint implementation (TODO)
	}
	
	focusClosest (element: HTMLElement, filter: (element: HTMLElement) => boolean) {
		element.focus({ preventScroll: true });
		if (document.activeElement !== element) {
			if (filter(element)) {
				this.focusClosest(element.parentElement as HTMLElement, filter);
			} else if (document.activeElement) {
				(document.activeElement as HTMLElement).blur();
			}
		}
	}

	/**
	 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	focusNextTerm (highlightTags: HighlightTags, reverse: boolean, stepNotJump: boolean, term?: MatchTerm, nodeStart?: Node) {
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
			(element[FlowMonitor.CACHE] as Paint.TreeCache | undefined)?.flows.some(flow =>
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
				this.focusNextTerm(highlightTags, reverse, stepNotJump, term, nodeBegin);
			}
			return;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		this.focusClosest(element, element =>
			element[FlowMonitor.CACHE] && !!(element[FlowMonitor.CACHE] as Paint.TreeCache).flows
		);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		this.raiseScrollMarker(term, element);
	}

	startHighlighting (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		// Clean up.
		this.mutationUpdates.disconnect();
		this.boxesInfoRemoveForTerms(termsToPurge); // BoxInfo stores highlighting, so this effectively 'undoes' highlights.
		// MAIN
		this.cacheExtend(document.body, highlightTags); // Ensure the *whole* document is set up for highlight-caching.
		this.flowMonitor.boxesInfoCalculate(terms, document.body, highlightTags, termCountCheck);
		this.mutationUpdates.observe();
		this.styleUpdate(Array.from(new Set(
			Array.from(this.elementsVisible).map(element => this.method.highlightable.findAncestor(element))
		)).flatMap(ancestor => this.getStyleRules(ancestor, false, terms)));
	}

	endHighlighting () {
		this.mutationUpdates.disconnect();
		this.styleUpdates.disconnectAll();
		this.undoHighlights();
		document.querySelectorAll("*").forEach(element => {
			delete element[FlowMonitor.CACHE];
		});
		document.body.querySelectorAll("[markmysearch-h_id]").forEach(element => {
			element.removeAttribute("markmysearch-h_id");
		});
		this.method.endHighlighting();
	}

	undoHighlights (terms?: MatchTerms, root: HTMLElement | DocumentFragment = document.body) {
		this.boxesInfoRemoveForTerms(terms, root);
	}

	cacheExtend (element: Element, highlightTags: HighlightTags, cacheApply = (element: Element) => {
		if (!element[FlowMonitor.CACHE]) {
			(element[FlowMonitor.CACHE] as Paint.TreeCache) = {
				id: "",
				styleRuleIdx: -1,
				isHighlightable: this.method.highlightable.checkElement(element),
				flows: [],
			};
		}
	}) { if (!highlightTags.reject.has(element.tagName)) {
		cacheApply(element);
		for (const child of element.children) {
			this.cacheExtend(child, highlightTags);
		}
	} }
	
	/** TODO update documentation
	 * FIXME this is a cut-down and adapted legacy function which may not function efficiently or fully correctly.
	 * Remove highlights for matches of terms.
	 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	boxesInfoRemoveForTerms (terms?: MatchTerms, root: HTMLElement | DocumentFragment = document.body) {
		const editFlow: (flow: Paint.Flow) => void = terms
			? flow => flow.boxesInfo = flow.boxesInfo.filter(boxInfo => terms.every(term => term.token !== boxInfo.term.token))
			: flow => flow.boxesInfo = [];
		for (const element of root.querySelectorAll("[markmysearch-h_id]")) {
			const filterBoxesInfo = (element: Element) => {
				const elementInfo = element[FlowMonitor.CACHE] as Paint.TreeCache;
				if (!elementInfo)
					return;
				elementInfo.flows.forEach(editFlow);
				Array.from(element.children).forEach(filterBoxesInfo);
			};
			filterBoxesInfo(element);
		}
	}

	getStyleRules (root: Element, recurse: boolean, terms: MatchTerms) {
		this.method.tempReplaceContainers(root, recurse);
		const styleRules: Array<Paint.StyleRuleInfo> = [];
		// 'root' must have [elementInfo].
		this.collectStyleRules(root, recurse, new Range(), styleRules, terms);
		return styleRules;
	}

	collectStyleRules (
		element: Element,
		recurse: boolean,
		range: Range,
		styleRules: Array<Paint.StyleRuleInfo>,
		terms: MatchTerms,
	) {
		const elementInfo = element[FlowMonitor.CACHE] as Paint.TreeCache;
		const boxes: Array<Paint.Box> = Paint.styleRulesGetBoxesOwned(element);
		if (boxes.length) {
			styleRules.push({
				rule: this.method.constructHighlightStyleRule(elementInfo.id, boxes, terms),
				element,
			});
		}
		if (recurse) {
			for (const child of element.children) if (child[FlowMonitor.CACHE]) {
				this.collectStyleRules(child, recurse, range, styleRules, terms);
			}
		}
	}
	
	styleUpdate (styleRules: Array<Paint.StyleRuleInfo>) {
		const styleSheet = (document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement).sheet as CSSStyleSheet;
		styleRules.forEach(({ rule, element }) => {
			const elementInfo = element[FlowMonitor.CACHE] as Paint.TreeCache;
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
	}

	getTermOccurrenceCount (term: MatchTerm, checkExistsOnly = false) {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(FlowMonitor.CACHE in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let count = 0;
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (!element) {
				break;
			}
			(element[FlowMonitor.CACHE] as Paint.TreeCache).flows.forEach(flow => {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			});
			if (checkExistsOnly && count > 0) {
				return 1;
			}
		}
		return count;
	}

	getShiftAndVisibilityObservers (terms: MatchTerms) {
		const shiftObserver = new ResizeObserver(entries => {
			const styleRules: Array<Paint.StyleRuleInfo> = entries.flatMap(entry =>
				this.getStyleRules(this.method.highlightable.findAncestor(entry.target), true, terms)
			);
			if (styleRules.length) {
				this.styleUpdate(styleRules);
			}
		});
		const visibilityObserver = new IntersectionObserver(entries => {
			let styleRules: Array<Paint.StyleRuleInfo> = [];
			entries.forEach(entry => {
				if (entry.isIntersecting) {
					//console.log(entry.target, "intersecting");
					if (entry.target[FlowMonitor.CACHE]) {
						this.elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						styleRules = styleRules.concat(
							this.getStyleRules(this.method.highlightable.findAncestor(entry.target), false, terms)
						);
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (entry.target[FlowMonitor.CACHE]) {
						this.method.tempRemoveDrawElement(entry.target);
					}
					this.elementsVisible.delete(entry.target);
					shiftObserver.unobserve(entry.target);
				}
			});
			if (styleRules.length) {
				this.styleUpdate(styleRules);
			}
		}, { rootMargin: "400px" });
		return { shiftObserver, visibilityObserver };
	}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Highlt {
	export type Flow = Matcher.BaseFlow<true, BoxInfoRange>

	export type BoxInfo = Matcher.BaseBoxInfo<true, BoxInfoRange>

	export type BoxInfoRange = { range: AbstractRange }

	export const getName = (termToken: string) => "markmysearch-" + termToken;
}

class HighlightEngine implements AbstractEngine {
	flowMonitor: AbstractFlowMonitor = new DummyFlowMonitor();

	mutationUpdates = getMutationUpdates(() => this.flowMonitor.mutationObserver);

	highlights = (() => {
		const highlights = CSS.highlights as HighlightRegistry;
		const map: HighlightRegistry = new Map();
		return {
			set: (termToken: string, value: Highlight) => {
				highlights.set(Highlt.getName(termToken), value);
				return map.set(termToken, value);
			},
			get: (termToken: string) => map.get(termToken),
			has: (termToken: string) => map.has(termToken),
			delete: (termToken: string) => {
				highlights.delete(Highlt.getName(termToken));
				return map.delete(termToken);
			},
			clear: () => {
				for (const termToken of map.keys()) {
					highlights.delete(Highlt.getName(termToken));
				}
				return map.clear();
			}
		};
	})();
	
	constructor (
		terms: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		this.flowMonitor = new StandardFlowMonitor(
			new FlowMonitor.StandardHighlightable(),
			() => undefined,
			() => ({ flows: [] }),
			boxesInfo => {
				for (const boxInfo of boxesInfo) {
					const highlight = this.highlights.get(boxInfo.term.token);
					if (!highlight)
						continue;
					highlight.add(new StaticRange({
						startContainer: boxInfo.node,
						startOffset: boxInfo.start,
						endContainer: boxInfo.node,
						endOffset: boxInfo.end,
					}));
				}
			},
		);
		this.flowMonitor.initMutationUpdatesObserver(terms, highlightTags, termCountCheck,
			elementsAdded => elementsAdded.forEach(element => this.cacheExtend(element, highlightTags))
		);
	}

	getMiscCSS () {
		return "";
	}

	getTermHighlightsCSS () {
		return "";
	}

	getTermHighlightCSS (terms: MatchTerms, hues: Array<number>, termIndex: number) {
		const term = terms[termIndex];
		const hue = hues[termIndex % hues.length];
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const cycle = Math.floor(termIndex / hues.length);
		return `
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body ::highlight(${Highlt.getName(term.token)}) {
	background-color: hsl(${hue} 70% 70%);
	color: black;
	/* text-decoration to indicate cycle */
}`
		;
	}

	getTermBackgroundStyle = TermCSS.getFlatStyle;

	getRequestWaitDuration () {
		return 50;
	}

	getRequestReschedulingDelayMax () {
		return 500;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	insertScrollMarkers (terms: MatchTerms, highlightTags: HighlightTags, hues: TermHues) {
		//
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	raiseScrollMarker (term: MatchTerm | undefined, container: HTMLElement) {
		//
	}

	startHighlighting (
		terms: MatchTerms,
		termsToHighlight: MatchTerms,
		termsToPurge: MatchTerms,
		highlightTags: HighlightTags,
		termCountCheck: TermCountCheck,
	) {
		// Clean up.
		termsToPurge.forEach(term => this.highlights.delete(term.token));
		this.mutationUpdates.disconnect();
		// MAIN
		terms.forEach(term => this.highlights.set(term.token, new Highlight()));
		this.cacheExtend(document.body, highlightTags); // Ensure the *whole* document is set up for highlight-caching.
		this.flowMonitor.boxesInfoCalculate(terms, document.body, highlightTags, termCountCheck);
		this.mutationUpdates.observe();
	}

	endHighlighting () {
		this.highlights.clear();
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	undoHighlights (terms?: MatchTerms | undefined, root: HTMLElement | DocumentFragment = document.body) {
		terms?.forEach(term => this.highlights.delete(term.token));
	}

	cacheExtend (element: Element, highlightTags: HighlightTags, cacheApply = (element: Element) => {
		if (!element[FlowMonitor.CACHE]) {
			(element[FlowMonitor.CACHE] as FlowMonitor.TreeCache) = {
				flows: [],
			};
		}
	}) { if (!highlightTags.reject.has(element.tagName)) {
		cacheApply(element);
		for (const child of element.children) {
			this.cacheExtend(child, highlightTags);
		}
	} }

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	focusNextTerm (highlightTags: HighlightTags, reverse: boolean, stepNotJump: boolean, term?: MatchTerm) {
		//
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getTermOccurrenceCount (term: MatchTerm, checkExistsOnly = false) {
		return 0;
	}
}

/*
ADMINISTRATION
Methods for managing the various content components of the highlighter and its UI.
*/

/**
 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
 * @param observer A highlighter-connected observer responsible for listening and responding to document mutations.
 * @returns The manager interface for the observer.
 */
const getMutationUpdates = (observer: () => MutationObserver | null) => ({
	observe: () => { observer()?.observe(document.body, { subtree: true, childList: true, characterData: true }); },
	disconnect: () => { observer()?.disconnect(); },
});

// TODO document
const getStyleUpdates = (
	elementsVisible: Set<Element>,
	getObservers: () => { shiftObserver: ResizeObserver | null, visibilityObserver: IntersectionObserver | null },
) => ({
	observe: (element: Element) => { getObservers().visibilityObserver?.observe(element); },
	disconnectAll: () => {
		elementsVisible.clear();
		getObservers().shiftObserver?.disconnect();
		getObservers().visibilityObserver?.disconnect();
	},
});

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
		const termSelectors: Set<string> = new Set();
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
	 * All controls necessary are first removed.
	 * Highlighting refreshes may be whole or partial depending on which terms changed.
	 * TODO document params
	 */
	const refreshTermControlsAndStartHighlighting = (
		terms: MatchTerms,
		controlsInfo: ControlsInfo,
		highlighter: Highlighter,
		commands: BrowserCommands,
		highlightTags: HighlightTags,
		hues: TermHues,
		termCountCheck: TermCountCheck,
		produceEffectOnCommand: ProduceEffectOnCommand,
		termsUpdate?: MatchTerms,
	) => {
		// TODO fix this abomination of a function
		let termUpdate: MatchTerm | undefined = undefined;
		let termToUpdateIdx: TermChange.CREATE | TermChange.REMOVE | number | undefined = undefined;
		if (termsUpdate) {
			if (termsUpdate.length < terms.length
				&& (terms.length === 1 || termEquals(termsUpdate[termsUpdate.length - 1], terms[terms.length - 2]))
			) {
				termToUpdateIdx = TermChange.REMOVE;
				termUpdate = terms[terms.length - 1];
			} else if (termsUpdate.length > terms.length
				&& (termsUpdate.length === 1 || termEquals(termsUpdate[termsUpdate.length - 2], terms[terms.length - 1]))
			) {
				termToUpdateIdx = TermChange.CREATE;
				termUpdate = termsUpdate[termsUpdate.length - 1];
			} else {
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
					Toolbar.insertTermControl(terms, idx, termCommands.down[idx], termCommands.up[idx], highlightTags,
						controlsInfo, highlighter);
					termsToHighlight.push(terms[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					termsToPurge.push(Object.assign({}, term));
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					Toolbar.refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx, highlightTags, highlighter);
					termsToHighlight.push(term);
				}
			} else if (termsUpdate !== undefined) {
				if (termToUpdateIdx === TermChange.REMOVE && termUpdate) {
					const termRemovedPreviousIdx = terms.findIndex(term => JSON.stringify(term) === JSON.stringify(termUpdate));
					if (assert(
						termRemovedPreviousIdx !== -1, "term not deleted", "not stored in this page", { term: termUpdate }
					)) {
						Toolbar.removeTermControl(termRemovedPreviousIdx);
						highlighter.current.undoHighlights([ terms[termRemovedPreviousIdx] ]);
						terms.splice(termRemovedPreviousIdx, 1);
						fillStylesheetContent(terms, hues, controlsInfo, highlighter);
						termCountCheck();
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => {
						terms.push(new MatchTerm(term.phrase, term.matchMode));
					});
					highlighter.current.undoHighlights();
					Toolbar.insertToolbar(terms, commands, highlightTags, hues, produceEffectOnCommand, controlsInfo, highlighter);
				}
			} else {
				return;
			}
		} else if (termsUpdate) {
			terms.splice(0);
			termsUpdate.forEach(term => {
				terms.push(new MatchTerm(term.phrase, term.matchMode));
			});
			highlighter.current.undoHighlights();
			Toolbar.insertToolbar(terms, commands, highlightTags, hues, produceEffectOnCommand, controlsInfo, highlighter);
		} else {
			return;
		}
		fillStylesheetContent(terms, hues, controlsInfo, highlighter);
		if (!controlsInfo.pageModifyEnabled) {
			const bar = document.getElementById(EleID.BAR) as Element;
			bar.classList.add(EleClass.DISABLED);
			return;
		}
		// Give the interface a chance to redraw before performing [expensive] highlighting.
		setTimeout(() => {
			highlighter.current.startHighlighting(
				terms,
				termsToHighlight,
				termsToPurge,
				highlightTags,
				termCountCheck,
			);
			terms.forEach(term => Toolbar.updateTermOccurringStatus(term, highlighter));
		});
	};

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
		terms: MatchTerms, highlightTags: HighlightTags, controlsInfo: ControlsInfo, highlighter: Highlighter
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
				highlighter.current.focusNextTerm(highlightTags, commandInfo.reversed ?? false, true);
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				focusReturnToDocument();
				highlighter.current.focusNextTerm(highlightTags, commandInfo.reversed ?? false, false,
					selectModeFocus ? terms[focusedIdx] : undefined);
				break;
			} case CommandType.FOCUS_TERM_INPUT: {
				const control = Toolbar.getControl(undefined, commandInfo.termIdx);
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
				barTerms.classList.remove(Toolbar.getControlPadClass(focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx ?? -1);
				barTerms.classList.add(Toolbar.getControlPadClass(focusedIdx));
				if (!selectModeFocus) {
					highlighter.current.focusNextTerm(highlightTags, !!commandInfo.reversed, false, terms[focusedIdx]);
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
	const getHighlightTagsSet = (tagsLower: Array<keyof HTMLElementTagNameMap>) =>
		new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ]))
	;

	const onWindowMouseUp = () => {
		if (document.activeElement && document.activeElement.classList.contains(EleClass.CONTROL_REVEAL)) {
			(document.querySelector(`#${EleID.BAR} .${EleClass.WAS_FOCUSED}`) as HTMLElement | null)?.focus();
		}
	};

	return () => {
		// Can't remove controls because a script may be left behind from the last install, and start producing unhandled errors. FIXME
		//controlsRemove();
		const commands: BrowserCommands = [];
		const terms: MatchTerms = [];
		const hues: TermHues = [];
		const controlsInfo: ControlsInfo = { // Unless otherwise indicated, the values assigned here are arbitrary and to be overridden.
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
			const requestRefreshIndicators = requestCallFn(
				() => highlighter.current.insertScrollMarkers(terms, highlightTags, hues),
				() => highlighter.current.getRequestWaitDuration(HighlighterProcess.REFRESH_INDICATORS),
				() => highlighter.current.getRequestReschedulingDelayMax(HighlighterProcess.REFRESH_INDICATORS),
			);
			const requestRefreshTermControls = requestCallFn(
				() => terms.forEach(term => Toolbar.updateTermOccurringStatus(term, highlighter)),
				() => highlighter.current.getRequestWaitDuration(HighlighterProcess.REFRESH_TERM_CONTROLS),
				() => highlighter.current.getRequestReschedulingDelayMax(HighlighterProcess.REFRESH_TERM_CONTROLS),
			);
			return () => {
				requestRefreshIndicators.next();
				requestRefreshTermControls.next();
			};
		})();
		const highlighter: Highlighter = { current: new DummyEngine() };
		const produceEffectOnCommand = produceEffectOnCommandFn(terms, highlightTags, controlsInfo, highlighter);
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
			if (message.setHighlighter !== undefined) {
				highlighter.current.endHighlighting();
				if (message.setHighlighter.engine === Engine.HIGHLIGHT && compatibility.highlight.highlightEngine) {
					highlighter.current = new HighlightEngine(terms, highlightTags, termCountCheck);
				} else if (message.setHighlighter.engine === Engine.PAINT) {
					highlighter.current = new PaintEngine(terms, highlightTags, termCountCheck,
						message.setHighlighter.paintEngineMethod ?? PaintEngineMethod.PAINT);
				} else {
					highlighter.current = new ElementEngine(terms, highlightTags, termCountCheck);
				}
			}
			if (message.enablePageModify !== undefined && controlsInfo.pageModifyEnabled !== message.enablePageModify) {
				controlsInfo.pageModifyEnabled = message.enablePageModify;
				if (!controlsInfo.pageModifyEnabled) {
					highlighter.current.endHighlighting();
				}
			}
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			Object.entries(message.barControlsShown ?? {}).forEach(([ controlName, value ]: [ Toolbar.ControlButtonName, boolean ]) => {
				controlsInfo.barControlsShown[controlName] = value;
				Toolbar.controlVisibilityUpdate(controlName, controlsInfo, terms);
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
				highlighter.current.endHighlighting();
				terms.splice(0);
				Toolbar.controlsRemove();
				styleElementsCleanup();
			}
			if (message.terms !== undefined &&
				(!itemsMatch(terms, message.terms, termEquals) || (!terms.length && !document.getElementById(EleID.BAR)))
			) {
				window.addEventListener("mouseup", onWindowMouseUp);
				refreshTermControlsAndStartHighlighting(
					terms,
					controlsInfo,
					highlighter,
					commands,
					highlightTags,
					hues,
					termCountCheck,
					produceEffectOnCommand,
					message.terms,
				);
			}
			(message.commands ?? []).forEach(command => {
				produceEffectOnCommand.next(command);
			});
			Toolbar.controlVisibilityUpdate("replaceTerms", controlsInfo, terms);
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
