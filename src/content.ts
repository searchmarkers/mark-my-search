import type { Highlighter, AbstractEngine } from "src/modules/highlight/engine.mjs"
import type { TermHues } from "src/modules/common.mjs"
const { EleID, EleClass, AtRuleID, getTermClass } = await import("src/modules/common.mjs");
type EleIDItem = (typeof EleID)[keyof typeof EleID]
type EleClassItem = (typeof EleClass)[keyof typeof EleClass]

type BrowserCommands = Array<chrome.commands.Command>

type ProduceEffectOnCommand = Generator<undefined, never, CommandInfo>

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

/*
USER INTERFACE
Methods for inserting, updating, or removing parts of the toolbar, as well as driving user interaction with the toolbar.
*/

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Toolbar {
	export type ControlButtonName = keyof StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	type ControlButtonInfo = {
		controlClasses?: Array<EleClassItem>
		buttonClasses?: Array<EleClassItem>
		path?: string
		pathSecondary?: string
		label?: string
		containerId: EleIDItem
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
	 */
	export const refreshTermControl = (
		term: MatchTerm,
		idx: number,
		highlighter: Highlighter,
	) => {
		const control = getControl(undefined, idx) as HTMLElement;
		control.classList.remove(Array.from(control.classList).find(className => className.startsWith(getTermClass(""))) ?? "-");
		control.classList.add(getTermClass(term.token));
		control.classList.add(EleClass.CONTROL, getTermClass(term.token));
		updateTermControlMatchModeClassList(term.matchMode, control.classList);
		const controlContent = control.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
		controlContent.onclick = event => // Overrides previous event handler in case of new term.
			highlighter.current.focusNextTerm(event.shiftKey, false, term);
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
	 */
	export const insertTermControl = (
		terms: MatchTerms,
		idx: number,
		command: string,
		commandReverse: string,
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
			highlighter.current.focusNextTerm(false, false, term);
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
	 * @param hues Color hues for term styles to cycle through.
	 */
	export const controlsInsert = (() => {
		/**
		 * Inserts a control.
		 * @param terms Terms to be controlled and highlighted.
		 * @param controlName A standard name for the control.
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
			terms.forEach((term, i) =>
				insertTermControl(terms, i, termCommands.down[i], termCommands.up[i], controlsInfo, highlighter)
			);
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
	 * @param commands Browser commands to use in shortcut hints.
	 * @param hues Color hues for term styles to cycle through.
	 * @param produceEffectOnCommand
	 * @param controlsInfo Details of controls to insert.
	 */
	export const insertToolbar = (
		terms: MatchTerms,
		commands: BrowserCommands,
		hues: TermHues,
		produceEffectOnCommand: ProduceEffectOnCommand,
		controlsInfo: ControlsInfo,
		highlighter: Highlighter,
	) => {
		const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
			&& document.activeElement.closest(`#${EleID.BAR}`);
		controlsRemove();
		controlsInsert(terms, commands, hues, produceEffectOnCommand, controlsInfo, highlighter);
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
ADMINISTRATION
Methods for managing the various content components of the highlighter and its UI.
*/

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
		hues: TermHues,
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
					Toolbar.insertTermControl(terms, idx, termCommands.down[idx], termCommands.up[idx], controlsInfo, highlighter);
					termsToHighlight.push(terms[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					termsToPurge.push(Object.assign({}, term));
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					Toolbar.refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx, highlighter);
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
						//termCountCheck();
						return;
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => {
						terms.push(new MatchTerm(term.phrase, term.matchMode));
					});
					highlighter.current.undoHighlights();
					Toolbar.insertToolbar(terms, commands, hues, produceEffectOnCommand, controlsInfo, highlighter);
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
			Toolbar.insertToolbar(terms, commands, hues, produceEffectOnCommand, controlsInfo, highlighter);
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
	 * @param terms Terms being controlled, highlighted, and jumped to.
	 */
	const produceEffectOnCommandFn = function* (
		terms: MatchTerms, controlsInfo: ControlsInfo, highlighter: Highlighter
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
				highlighter.current.focusNextTerm(commandInfo.reversed ?? false, true);
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				focusReturnToDocument();
				const term = selectModeFocus ? terms[focusedIdx] : undefined;
				highlighter.current.focusNextTerm(commandInfo.reversed ?? false, false, term);
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
					highlighter.current.focusNextTerm(!!commandInfo.reversed, false, terms[focusedIdx]);
				}
				break;
			}}
		}
	};

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
		//const termCountCheck: TermCountCheck = (() => {
		//	const requestRefreshIndicators = requestCallFn(
		//		() => highlighter.current.insertScrollMarkers(terms, hues),
		//		() => highlighter.current.getRequestWaitDuration(HighlighterProcess.REFRESH_INDICATORS),
		//		() => highlighter.current.getRequestReschedulingDelayMax(HighlighterProcess.REFRESH_INDICATORS),
		//	);
		//	const requestRefreshTermControls = requestCallFn(
		//		() => terms.forEach(term => Toolbar.updateTermOccurringStatus(term, highlighter)),
		//		() => highlighter.current.getRequestWaitDuration(HighlighterProcess.REFRESH_TERM_CONTROLS),
		//		() => highlighter.current.getRequestReschedulingDelayMax(HighlighterProcess.REFRESH_TERM_CONTROLS),
		//	);
		//	return () => {
		//		requestRefreshIndicators.next();
		//		requestRefreshTermControls.next();
		//	};
		//})();
		const highlighter: Highlighter = { current: new DummyEngine() };
		const produceEffectOnCommand = produceEffectOnCommandFn(terms, controlsInfo, highlighter);
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
					import("src/modules/highlight/engines/highlight.mjs").then(({ HighlightEngine }) => {
						highlighter.current = new HighlightEngine(terms);
					});
				} else if (message.setHighlighter.engine === Engine.PAINT) {
					const method = message.setHighlighter.paintEngineMethod ?? PaintEngineMethod.PAINT;
					import("src/modules/highlight/engines/paint.mjs").then(({ PaintEngine }) => {
						highlighter.current = new PaintEngine(terms, method);
					});
				} else {
					import("src/modules/highlight/engines/element.mjs").then(({ ElementEngine }) => {
						highlighter.current = new ElementEngine(terms);
					});
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
			Object.entries(message.barControlsShown ?? {})
				.forEach(([ controlName, value ]: [ Toolbar.ControlButtonName, boolean ]) => {
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
					hues,
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
