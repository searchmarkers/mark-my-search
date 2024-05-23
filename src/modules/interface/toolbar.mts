import * as Classes from "/dist/modules/interface/toolbar/classes.mjs";
import { type CommandInfo, parseCommand } from "/dist/modules/commands.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass, getTermClass, getTermTokenClass } from "/dist/modules/common.mjs";
type EleIDItem = typeof EleID[keyof typeof EleID]
type EleClassItem = typeof EleClass[keyof typeof EleClass]
import type { ConfigBarControlsShown } from "/dist/modules/privileged/storage.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import * as Stylesheet from "/dist/modules/interface/stylesheet.mjs";
import type { SetTerm, SetTerms, DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";
import { assert, getIdSequential } from "/dist/modules/common.mjs";

export type BrowserCommands = Array<chrome.commands.Command>

export type BarLook = ControlsInfo["barLook"]

export const TermChange = {
	REMOVE: -1,
	CREATE: -2,
} as const;

/**
 * Extracts assigned shortcut strings from browser commands.
 * @param commands Commands as returned by the browser.
 * @returns An object containing the extracted command shortcut strings.
 */
const getTermCommands = (commands: BrowserCommands): { down: Array<string>, up: Array<string> } => {
	const commandsDetail = commands.map((command): { info: CommandInfo, shortcut: string } => ({
		info: command.name ? parseCommand(command.name) : { type: "none" },
		shortcut: command.shortcut ?? "",
	}));
	return {
		down: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === "selectTerm" && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === "selectTerm" && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

export type ControlButtonName = keyof ConfigBarControlsShown
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
	const commit = (
		term: MatchTerm | null,
		setTerm: SetTerm,
		termTokens: TermTokens,
		inputValue?: string,
	) => {
		const control = term ? getControl(term, termTokens) : getControlAppendTerm();
		if (!control) {
			return;
		}
		const termInput = control.querySelector("input") as HTMLInputElement;
		inputValue = inputValue ?? termInput.value;
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		if (term) {
			const idx = getTermIndexFromBar(term, termTokens);
			if (idx === null) {
				return;
			}
			if (inputValue === "") {
				if (document.activeElement === termInput) {
					selectInput(getControlAtIndex(idx + 1) as HTMLElement);
					return;
				}
				setTerm(null, idx);
			} else if (inputValue !== term.phrase) {
				term = new MatchTerm(inputValue, term.matchMode);
				setTerm(term, idx);
			}
		} else {
			if (inputValue !== "") {
				term = new MatchTerm(
					inputValue,
					getTermControlMatchModeFromClassList(control.classList),
					{
						allowStemOverride: true,
					},
				);
				setTerm(term, true);
			}
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
	const tryShiftTermFocus = (
		term: MatchTerm | null,
		setTerm: SetTerm,
		idxTarget: number | undefined,
		shiftRight: boolean | undefined,
		onBeforeShift: () => void,
		termTokens: TermTokens,
	) => {
		const replaces = !!term; // Whether a commit in this control replaces an existing term or appends a new one.
		const control = term ? getControl(term, termTokens) : getControlAppendTerm();
		const termInput = control?.querySelector("input");
		if (!control || !termInput) {
			return;
		}
		const termCount = getTermCountFromBar();
		const termIdx = replaces ? getTermIndexFromBar(term, termTokens) : termCount;
		if (termIdx === null) {
			return;
		}
		shiftRight ??= (idxTarget ?? termIdx) > termIdx;
		if (termInput.selectionStart !== termInput.selectionEnd
			|| termInput.selectionStart !== (shiftRight ? termInput.value.length : 0)) {
			return;
		}
		onBeforeShift();
		idxTarget ??= Math.max(0, Math.min(shiftRight ? termIdx + 1 : termIdx - 1, termCount));
		if (termIdx === idxTarget) {
			// TODO why does this need to be done here?
			commit(term, setTerm, termTokens);
			if (!replaces) {
				termInput.value = "";
			}
		} else {
			const controlTarget = getControlAtIndex(idxTarget);
			if (controlTarget) {
				selectInput(controlTarget, shiftRight);
			}
		}
	};

	return (
		term: MatchTerm | null,
		setTerm: SetTerm,
		controlPad: HTMLElement,
		insertInput: (termInput: HTMLInputElement) => void,
		termTokens: TermTokens,
	) => {
		const controlContent = controlPad
			.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement ?? controlPad;
		const controlEdit = controlPad
			.getElementsByClassName(EleClass.CONTROL_EDIT)[0] as HTMLElement | undefined;
		// Whether a commit in this control replaces an existing term or appends a new one.
		const replaces = term !== null;
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
					commit(term, setTerm, termTokens);
					hide();
				} else { // Input is hidden; currently an edit button.
					show(event);
				}
			});
			controlEdit.addEventListener("contextmenu", event => {
				event.preventDefault();
				input.value = "";
				commit(term, setTerm, termTokens);
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
					commit(term, setTerm, termTokens, inputValue);
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
				tryShiftTermFocus(
					term,
					setTerm,
					undefined,
					event.key === "ArrowRight",
					() => event.preventDefault(),
					termTokens,
				);
				return;
			}
			case "ArrowUp":
			case "ArrowDown": {
				tryShiftTermFocus(
					term,
					setTerm,
					(event.key === "ArrowUp") ? 0 : getTermCountFromBar(),
					undefined,
					() => event.preventDefault(),
					termTokens,
				);
				return;
			}
			case " ": {
				if (!event.shiftKey) {
					return;
				}
				event.preventDefault();
				input.classList.add(EleClass.OPENED_MENU);
				openTermOptionList(term, termTokens);
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
					commit(term, setTerm, termTokens);
				}
			}
			inputSize = inputSizeNew;
		}).observe(input);
		insertInput(input);
		return input;
	};
})();

/**
 * Gets the control of a term or at an index.
 * @param term A term to identify the control by, if supplied.
 * @param idx An index to identify the control by, if supplied.
 * @returns The control matching `term` if supplied and `idx` is `undefined`,
 * OR the control matching `idx` if supplied and less than the number of terms,
 * OR the append term control otherwise.
 */
const getControl = (term: MatchTerm, termTokens: TermTokens): HTMLElement | null => (
	document.getElementById(EleID.BAR_TERMS)
		?.getElementsByClassName(getTermTokenClass(termTokens.get(term)))[0] as HTMLElement
		?? null
);

const getControlAtIndex = (idx: number | undefined): HTMLElement | null => {
	const barTerms = document.getElementById(EleID.BAR_TERMS);
	if (!barTerms) {
		return null;
	}
	if (idx === undefined || idx >= barTerms.childElementCount) {
		return getControlAppendTerm();
	}
	return barTerms.children.item(idx) as HTMLElement;
};

/**
 * Gets the index of a term within the terms listed as controls in the toolbar.
 * @param term A term to find.
 * @param termTokens 
 * @returns The term's index.
 */
const getTermIndexFromBar = (term: MatchTerm, termTokens: TermTokens): number | null => {
	const termControl = document.querySelector(`#${EleID.BAR} .${getTermClass(term, termTokens)}`);
	if (!termControl) {
		return -1;
	}
	return Array.from(termControl.parentElement?.children ?? []).indexOf(termControl);
};

/**
 * Gets the number of terms listed as controls in the toolbar.
 * @returns The term count.
 */
const getTermCountFromBar = (): number => (
	document.querySelector(`#${EleID.BAR_TERMS}`)?.childElementCount ?? 0
);

/**
 * Gets the control for appending a new term.
 * @returns The control if present, `null` otherwise.
 */
const getControlAppendTerm = (): HTMLElement | null => (
	document.getElementById(EleID.BAR_RIGHT)?.firstElementChild ?? null
) as HTMLElement | null;

/**
 * Updates the look of a term control to reflect whether or not it occurs within the document.
 * @param term A term to update the term control status for.
 */
export const updateTermStatus = (term: MatchTerm, termTokens: TermTokens, highlighter: Highlighter) => {
	const controlPad = (getControl(term, termTokens) as HTMLElement)
		.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
	controlPad.classList.toggle(EleClass.DISABLED, !highlighter.current?.termOccurrences?.exists(term, termTokens));
};

/**
 * Updates the tooltip of a term control to reflect current highlighting or extension information as appropriate.
 * @param term A term to update the tooltip for.
 */
const updateTermTooltip = (
	term: MatchTerm,
	termTokens: TermTokens,
	commands: BrowserCommands,
	highlighter: Highlighter,
) => {
	const idx = getTermIndexFromBar(term, termTokens);
	if (idx === null) {
		return;
	}
	const { up: { [idx]: command }, down: { [idx]: commandReverse } } = getTermCommands(commands);
	const controlPad = (getControl(term, termTokens) as HTMLElement)
		.getElementsByClassName(EleClass.CONTROL_PAD)[0] as HTMLElement;
	const controlContent = controlPad
		.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
	const occurrenceCount = highlighter.current?.termOccurrences?.countBetter(term, termTokens) ?? 0;
	controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${command} or ${commandReverse}`
				: `\nJump to next: ${command}\nJump to previous: ${commandReverse}`
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
export const refreshTermControl = (term: MatchTerm, idx: number, termTokens: TermTokens, highlighter: Highlighter) => {
	const control = getControlAtIndex(idx) as HTMLElement;
	control.classList.remove(
		Array.from(control.classList).find(className => className.startsWith(getTermTokenClass(""))) ?? "-"
	);
	control.classList.add(getTermClass(term, termTokens));
	control.classList.add(EleClass.CONTROL, getTermTokenClass(termTokens.get(term)));
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(EleClass.CONTROL_CONTENT)[0] as HTMLElement;
	controlContent.onclick = event => { // Overrides previous event handler in case of new term.
		highlighter.current?.stepToNextOccurrence(event.shiftKey, false, term);
	};
	controlContent.textContent = term.phrase;
};

/**
 * Removes a term control element.
 * @param idx The index of an existing control to remove.
 */
export const removeTermControl = (idx: number) => {
	(getControlAtIndex(idx) as HTMLElement).remove();
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
	term: MatchTerm | null,
	matchMode: MatchMode,
	termTokens: TermTokens,
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
		(term ? getControl(term, termTokens) : getControlAppendTerm())?.classList.remove(EleClass.MENU_OPEN);
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
		const control = term ? getControl(term, termTokens) : getControlAppendTerm();
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
		openTermOptionList(term, termTokens);
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
const openTermOptionList = (term: MatchTerm | null, termTokens: TermTokens) => {
	const control = term ? getControl(term, termTokens) : getControlAppendTerm();
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
 * @param terms The term corresponding to this control.
 * @param command The string of a command to display as a shortcut hint for jumping to the next term.
 * @param commandReverse The string of a command to display as a shortcut hint for jumping to the previous term.
 * @param controlsInfo Details of controls inserted.
 */
export const insertTermControl = (
	term: MatchTerm,
	setTerm: SetTerm,
	termTokens: TermTokens,
	commands: BrowserCommands,
	controlsInfo: ControlsInfo,
	highlighter: Highlighter,
) => {
	const { optionList, controlReveal } = createTermOptionList(
		term,
		term.matchMode,
		termTokens,
		controlsInfo,
		(matchType: string, checked: boolean) => {
			const matchMode = Object.assign({}, term.matchMode) as MatchMode;
			matchMode[matchType] = checked;
			term = new MatchTerm(term.phrase, matchMode);
			const idx = getTermIndexFromBar(term, termTokens);
			if (idx !== null) {
				setTerm(term, idx);
			}
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
		highlighter.current?.stepToNextOccurrence(false, false, term);
	};
	controlContent.addEventListener("mouseover", () => { // FIXME this is not screenreader friendly.
		updateTermTooltip(term, termTokens, commands, highlighter);
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
	insertTermInput(
		term,
		setTerm,
		controlPad,
		input => controlPad.insertBefore(input, controlEdit),
		termTokens,
	);
	const control = document.createElement("span");
	control.classList.add(EleClass.CONTROL, getTermClass(term, termTokens));
	control.appendChild(controlPad);
	control.appendChild(optionList);
	updateTermControlMatchModeClassList(term.matchMode, control.classList);
	(document.getElementById(EleID.BAR_TERMS) as HTMLElement).appendChild(control);
};

export const controlVisibilityUpdate = (
	controlName: ControlButtonName,
	controlsInfo: ControlsInfo,
	doPhrasesMatchTerms: DoPhrasesMatchTerms,
) => {
	const control = document.querySelector(`#${EleID.BAR} .${Classes.controlGetClass(controlName)}`);
	if (control) {
		const value = controlsInfo.barControlsShown[controlName];
		if (controlName === "replaceTerms") {
			const shown = (value
				&& controlsInfo.termsOnHold.length > 0
				&& !doPhrasesMatchTerms(controlsInfo.termsOnHold.map(term => term.phrase))
			);
			control.classList.toggle(EleClass.DISABLED, !shown);
		} else {
			control.classList.toggle(EleClass.DISABLED, !value);
		}
	}
};

const focusReturnInfo: { element: HTMLElement | null, selectionRanges: Array<Range> | null } = {
	element: null,
	selectionRanges: null,
};

export const focusTermInput = (termIdx?: number) => {
	const control = getControlAtIndex(termIdx);
	const input = control ? control.querySelector("input") : null;
	if (!control || !input) {
		return;
	}
	const selection = getSelection() as Selection;
	const activeElementOriginal = document.activeElement as HTMLElement;
	const selectionRangesOriginal = Array(selection.rangeCount).fill(null).map((v, i) => selection.getRangeAt(i));
	input.focus();
	input.select();
	if (activeElementOriginal && activeElementOriginal.closest(`#${EleID.BAR}`)) {
		return; // Focus was already in bar, so focus return should not be updated.
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
};

export const barVisibilityUpdate = (controlsInfo: ControlsInfo) => {
	const bar = document.getElementById(EleID.BAR);
	bar?.classList.toggle(EleClass.DISABLED, !controlsInfo.pageModifyEnabled);
};

/**
 * Inserts constant bar controls into the toolbar.
 * @param terms Terms highlighted in the page to mark the scroll position of.
 * @param controlsInfo Details of controls to insert.
 * @param commands Browser commands to use in shortcut hints.
 * @param hues Color hues for term styles to cycle through.
 */
const controlsInsert = (() => {
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
			control.classList.add(EleClass.CONTROL, Classes.controlGetClass(controlName));
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

		return (
			setTerm: SetTerm,
			setTerms: SetTerms,
			doPhrasesMatchTerms: DoPhrasesMatchTerms,
			controlName: ControlButtonName,
			hideWhenInactive: boolean,
			termTokens: TermTokens,
			controlsInfo: ControlsInfo,
		) => {
			const info: Record<ControlButtonName, ControlButtonInfo> = {
				toggleBarCollapsed: {
					controlClasses: [ EleClass.UNCOLLAPSIBLE ],
					path: "/icons/arrow.svg",
					pathSecondary: "/icons/mms.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => {
						controlsInfo.barCollapsed = !controlsInfo.barCollapsed;
						sendBackgroundMessage({
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
					onClick: () => sendBackgroundMessage({
						deactivateTabResearch: true,
					}),
				},
				performSearch: {
					path: "/icons/search.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => sendBackgroundMessage({
						performSearch: true,
					}),
				},
				toggleHighlights: {
					path: "/icons/show.svg",
					containerId: EleID.BAR_LEFT,
					onClick: () => sendBackgroundMessage({
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
						insertTermInput(
							null,
							setTerm,
							pad,
							input => pad.appendChild(input),
							termTokens,
						);
						updateTermControlMatchModeClassList(controlsInfo.matchMode, container.classList);
						const { optionList, controlReveal } = createTermOptionList(
							null,
							controlsInfo.matchMode,
							termTokens,
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
						setTerms(controlsInfo.termsOnHold);
					},
				},
			};
			controlInsertWithInfo(controlName, info[controlName], hideWhenInactive);
			controlVisibilityUpdate(controlName, controlsInfo, doPhrasesMatchTerms);
		};
	})();

	return (
		terms: ReadonlyArray<MatchTerm>,
		setTerm: SetTerm,
		setTerms: SetTerms,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
		termTokens: TermTokens,
		commands: BrowserCommands,
		hues: TermHues,
		controlsInfo: ControlsInfo,
		highlighter: Highlighter,
	) => {
		Stylesheet.fillContent(terms, termTokens, hues, controlsInfo.barLook, highlighter);
		const bar = document.createElement("div");
		bar.id = EleID.BAR;
		barVisibilityUpdate(controlsInfo);
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
					focusTermInput();
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
					focusTermInput();
				} else {
					// Ensure proper return of focus+selection.
					controlInput.blur();
				}
			}
		});
		if (controlsInfo.highlightsShown) {
			bar.classList.add(EleClass.HIGHLIGHTS_SHOWN);
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
			controlInsert(
				setTerm,
				setTerms,
				doPhrasesMatchTerms,
				barControlName,
				!controlsInfo.barControlsShown[barControlName],
				termTokens,
				controlsInfo,
			);
		});
		terms.forEach(term =>
			insertTermControl(term, setTerm, termTokens, commands, controlsInfo, highlighter)
		);
		const gutter = document.createElement("div");
		gutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

/**
 * Removes the control bar and scroll gutter.
 */
const controlsRemove = () => {
	// TODO why is this in charge of the scroll gutter??
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
 * Inserts the toolbar and appropriate controls.
 * @param terms Terms to highlight and display in the toolbar.
 * @param commands Browser commands to use in shortcut hints.
 * @param hues Color hues for term styles to cycle through.
 * @param controlsInfo Details of controls to insert.
 */
export const insert = (
	terms: ReadonlyArray<MatchTerm>,
	setTerm: SetTerm,
	setTerms: SetTerms,
	doPhrasesMatchTerms: DoPhrasesMatchTerms,
	termTokens: TermTokens,
	commands: BrowserCommands,
	hues: TermHues,
	controlsInfo: ControlsInfo,
	highlighter: Highlighter,
) => {
	const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
		&& document.activeElement.closest(`#${EleID.BAR}`);
	controlsRemove();
	controlsInsert(
		terms,
		setTerm,
		setTerms,
		doPhrasesMatchTerms,
		termTokens,
		commands,
		hues,
		controlsInfo,
		highlighter,
	);
	if (focusingControlAppend) {
		const input = getControlAppendTerm()?.querySelector("input");
		if (input) {
			input.focus();
			input.select();
		}
	}
};

/**
 * Removes the toolbar and appropriate controls.
 */
export const remove = () => {
	controlsRemove();
};
