import * as Classes from "/dist/modules/interface/toolbar/classes.mjs";
import { type CommandInfo, parseCommand } from "/dist/modules/commands.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass, getTermClass } from "/dist/modules/common.mjs";
import type { ConfigBarControlsShown } from "/dist/modules/privileged/storage.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import type { SetTerm, SetTerms, DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";
import { getIdSequential } from "/dist/modules/common.mjs";

export type BrowserCommands = ReadonlyArray<chrome.commands.Command>

export type BarLook = ControlsInfo["barLook"]

enum ControlFocusArea {
	NONE,
	INPUT,
	OPTIONS_MENU,
}

type SelectionReturnTarget = Readonly<{
	element: HTMLElement | null
	selectionRanges: Array<Range> | null
}>

/**
 * Extracts assigned shortcut strings from browser commands.
 * @param commands Commands as returned by the browser.
 * @returns An object containing the extracted command shortcut strings.
 */
const getTermCommands = (commands: BrowserCommands): ReadonlyArray<{ down: string, up: string }> => {
	const commandsDetail = commands.map((command): { info: CommandInfo, shortcut: string } => ({
		info: command.name ? parseCommand(command.name) : { type: "none" },
		shortcut: command.shortcut ?? "",
	}));
	const commandsDownDetail = commandsDetail
		.filter(({ info }) => info.type === "selectTerm" && !info.reversed);
	const commandsUpDetail = commandsDetail
		.filter(({ info }) => info.type === "selectTerm" && info.reversed);
	return commandsDownDetail.map(({ shortcut }, i) => ({
		down: shortcut,
		up: commandsUpDetail[i].shortcut,
	}));
};

export type ControlButtonName = keyof ConfigBarControlsShown

type ControlButtonInfo = {
	controlClasses?: Array<typeof EleClass[keyof typeof EleClass]>
	buttonClasses?: Array<typeof EleClass[keyof typeof EleClass]>
	path?: string
	pathSecondary?: string
	label?: string
	containerId: "BAR_LEFT" | "BAR_RIGHT"
	onClick?: () => void
	setUp?: (container: HTMLElement) => void
}

const getMatchModeOptionClass = (matchType: keyof MatchMode) => EleClass.OPTION + "-" + matchType;

const getMatchModeFromClassList = (
	classListContains: (token: typeof EleClass[keyof typeof EleClass]) => boolean,
) => ({
	regex: classListContains(EleClass.MATCH_REGEX),
	case: classListContains(EleClass.MATCH_CASE),
	stem: classListContains(EleClass.MATCH_STEM),
	whole: classListContains(EleClass.MATCH_WHOLE),
	diacritics: classListContains(EleClass.MATCH_DIACRITICS),
});

const applyMatchModeToClassList = (
	matchMode: Readonly<MatchMode>,
	classListToggle: (token: typeof EleClass[keyof typeof EleClass], force: boolean) => void,
) => {
	classListToggle(EleClass.MATCH_REGEX, matchMode.regex);
	classListToggle(EleClass.MATCH_CASE, matchMode.case);
	classListToggle(EleClass.MATCH_STEM, matchMode.stem);
	classListToggle(EleClass.MATCH_WHOLE, matchMode.whole);
	classListToggle(EleClass.MATCH_DIACRITICS, matchMode.diacritics);
};

const getInputIdSequential = () => EleID.INPUT + "-" + getIdSequential.next().value.toString();

interface AbstractToolbar extends ToolbarTermControlInterface, ToolbarControlButtonInterface {
	appendTerm: (term: MatchTerm, commands: BrowserCommands) => void

	insertTerm: (term: MatchTerm, index: number, commands: BrowserCommands) => void

	replaceTerm: (term: MatchTerm, termOld: MatchTerm | number) => void

	replaceTerms: (terms: ReadonlyArray<MatchTerm>, commands: BrowserCommands) => void

	removeTerm: (term: MatchTerm | number) => void

	/**
	 * Updates the look of the control to reflect whether or not its term currently occurs within the document.
	 */
	updateTermStatus: (term: MatchTerm) => void

	focusTermInput: (termIndex: number | null) => void
	
	updateBarVisibility: () => void

	updateControlVisibility: (controlName: ControlButtonName) => void

	/**
	 * Inserts the toolbar and appropriate controls.
	 */
	insertIntoDocument: () => void

	/**
	 * Removes the toolbar and appropriate controls.
	 */
	remove: () => void
}

interface ToolbarTermControlInterface extends ToolbarTermInputInterface {
	getTermControlIndex: (control: TermAbstractControl) => number | null

	forgetOpenedMenu: () => void
}

interface ToolbarTermInputInterface {
	getTermCount: () => number

	getTermControlIndex: (control: TermControlInputInterface) => number | null

	/**
	 * Focuses and selects the text of the input of the term specified. Note that focus causes a term input to be visible.
	 * @param termIndex The target term's index in the toolbar.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	selectTermInput: (termIndex: number, shiftCaret?: "right" | "left") => void
}

interface ToolbarControlButtonInterface {
	setCollapsed: (collapsed: boolean) => void
}

class ToolbarSelectionReturnManager {
	#target: SelectionReturnTarget | null = null;

	set target(target: SelectionReturnTarget | null) {
		if (target?.element && target.element.closest(`#${EleID.BAR}`)) {
			this.#target = null;
			return;
		}
		this.#target = target;
	}
	get target() {
		return this.#target;
	}
}

class StandardToolbar implements AbstractToolbar, ToolbarTermControlInterface, ToolbarControlButtonInterface {
	readonly #controlsInfo: ControlsInfo;
	readonly #setTerm: SetTerm;
	readonly #setTerms: SetTerms;
	readonly #doPhrasesMatchTerms: DoPhrasesMatchTerms;
	readonly #termTokens: TermTokens;
	readonly #highlighter: Highlighter;

	readonly #bar: HTMLElement;
	static readonly sectionNames = [ "left", "terms", "right" ] as const;
	readonly #sections: Readonly<Record<typeof StandardToolbar.sectionNames[number], HTMLElement>>;
	readonly #controls: Readonly<Record<ControlButtonName, Control>>;
	readonly #termControls: Array<{ token: string, control: TermReplaceControl }> = [];
	readonly #termAppendControl: TermAppendControl;
	// TODO why is the toolbar in charge of the scroll gutter??
	readonly #scrollGutter: HTMLElement;

	readonly #selectionReturn = new ToolbarSelectionReturnManager();

	constructor (
		terms: ReadonlyArray<MatchTerm>,
		commands: BrowserCommands,
		hues: TermHues,
		controlsInfo: ControlsInfo,
		setTerm: SetTerm,
		setTerms: SetTerms,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
		termTokens: TermTokens,
		highlighter: Highlighter,
	) {
		this.#setTerm = setTerm;
		this.#setTerms = setTerms;
		this.#doPhrasesMatchTerms = doPhrasesMatchTerms;
		this.#controlsInfo = controlsInfo;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		// TODO this used to run before the toolbar was removed, determining whether it was focused (so should be re-focused);
		// may or may not be needed again
		//const focusingControlAppend = document.activeElement && document.activeElement.tagName === "INPUT"
		//	&& document.activeElement.closest(`#${EleID.BAR}`);
		//
		this.#bar = document.createElement("div");
		this.#bar.id = EleID.BAR;
		this.updateBarVisibility();
		// Inputs should not be focusable unless user has already focused bar. (1)
		const inputsSetFocusable = (focusable: boolean) => {
			this.#bar.querySelectorAll(`input.${EleClass.CONTROL_INPUT}`).forEach((input: HTMLElement) => {
				if (focusable) {
					input.removeAttribute("tabindex");
				} else {
					input.tabIndex = -1;
				}
			});
		};
		this.#bar.addEventListener("focusin", () => {
			inputsSetFocusable(true);
		});
		this.#bar.addEventListener("focusout", event => {
			this.returnSelectionToDocument(!!event.relatedTarget);
			// Only if focus is not moving (and has not already moved) somewhere else within the bar.
			if (!this.#bar.contains(event.relatedTarget as Node) && !this.#bar.contains(document.activeElement)) {
				inputsSetFocusable(false);
			}
		});
		const updateInputsFocused = () => {
			// Causes the last focused input to be forgotten, as long as the user is not currently interacting with the bar.
			// If the user is interacting with the bar, the information may be needed for restoring (or preparing to restore) focus.
			if (!document.querySelector(`#${EleID.BAR}:active`)) {
				this.#bar.querySelectorAll(`.${EleClass.WAS_FOCUSED}`).forEach(input => {
					input.classList.remove(EleClass.WAS_FOCUSED);
				});
			}
		};
		this.#bar.addEventListener("mousedown", updateInputsFocused);
		this.#bar.addEventListener("mouseup", updateInputsFocused);
		this.#bar.addEventListener("contextmenu", event => {
			event.preventDefault();
		});
		this.#bar.addEventListener("keydown", event => {
			if (event.key === "Tab") { // This is the only key that will escape term inputs; the rest are blocked automatically.
				event.stopPropagation();
				const { control, termIndex: index, focusArea } = this.getFocusedTermControl(true);
				if (!control || focusArea !== ControlFocusArea.INPUT) {
					return;
				}
				// Special case to specifically focus the term append input, in case the button is hidden.
				if (control && !event.shiftKey && index === this.#termControls.length - 1) {
					event.preventDefault();
					this.#termAppendControl.focusInput();
					return;
				}
				if (!(event.shiftKey ? control === this.#termControls[0].control : control === this.#termAppendControl)) {
					return;
				}
				event.preventDefault();
				if (!event.shiftKey && control.getInputValue().length > 0) {
					// Force term-append to commit (add new term) then regain focus.
					control.unfocusInput();
					// Use focus-term-input command to ensure that focus+selection will later be restored.
					// TODO ensure focus+selection is restored by a cleaner method
					control.focusInput();
				} else {
					// Ensure proper return of focus+selection.
					control.unfocusInput();
				}
			} else {
				event.stopPropagation();
				event.preventDefault();
			}
		});
		this.#bar.addEventListener("keyup", event => {
			event.stopPropagation();
		});
		this.#bar.addEventListener("keypress", event => {
			event.stopPropagation();
		});
		if (controlsInfo.highlightsShown) {
			this.#bar.classList.add(EleClass.HIGHLIGHTS_SHOWN);
		}
		this.#sections = {
			left: document.createElement("span"),
			terms: document.createElement("span"),
			right: document.createElement("span"),
		};
		this.#sections.left.id = EleID.BAR_LEFT;
		this.#sections.left.classList.add(EleClass.BAR_CONTROLS);
		this.#sections.terms.id = EleID.BAR_TERMS;
		this.#sections.right.id = EleID.BAR_RIGHT;
		this.#sections.right.classList.add(EleClass.BAR_CONTROLS);
		for (const sectionName of StandardToolbar.sectionNames) {
			this.#bar.appendChild(this.#sections[sectionName]);
		}
		this.#termAppendControl = new TermAppendControl(controlsInfo, this, setTerm, doPhrasesMatchTerms);
		this.#termAppendControl.appendTo(this.#sections.right);
		this.#controls = {
			toggleBarCollapsed: this.createAndInsertControl("toggleBarCollapsed"),
			disableTabResearch: this.createAndInsertControl("disableTabResearch"),
			performSearch: this.createAndInsertControl("performSearch"),
			toggleHighlights: this.createAndInsertControl("toggleHighlights"),
			appendTerm: this.#termAppendControl.control,
			replaceTerms: this.createAndInsertControl("replaceTerms"),
		};
		terms.forEach(term => {
			this.#termControls.push({
				token: this.#termTokens.get(term),
				control: new TermReplaceControl(term,
					commands, controlsInfo,
					this, this.#setTerm, this.#termTokens, this.#highlighter,
				),
			});
		});
		this.refreshTermControls();
		this.#scrollGutter = document.createElement("div");
		this.#scrollGutter.id = EleID.MARKER_GUTTER;
		// TODO make this functional again
		//if (focusingControlAppend) {
		//	const input = this.#controls.appendTerm.querySelector("input");
		//	if (input) {
		//		input.focus();
		//		input.select();
		//	}
		//}
	}

	setCollapsed (collapsed: boolean) {
		this.#bar.classList.toggle(EleClass.COLLAPSED, collapsed);
	}

	forgetOpenedMenu () {
		document.querySelectorAll(`#${EleID.BAR} .${EleClass.OPENED_MENU}`).forEach(input => {
			input.classList.remove(EleClass.OPENED_MENU);
		});
	}

	appendTerm (term: MatchTerm, commands: BrowserCommands) {
		this.#termControls.push({
			token: this.#termTokens.get(term),
			control: new TermReplaceControl(term,
				commands, this.#controlsInfo,
				this, this.#setTerm, this.#termTokens, this.#highlighter,
			),
		});
		this.refreshTermControls();
	}

	insertTerm (term: MatchTerm, index: number, commands: BrowserCommands) {
		this.#termControls.splice(index, 0, {
			token: this.#termTokens.get(term),
			control: new TermReplaceControl(term,
				commands, this.#controlsInfo,
				this, this.#setTerm, this.#termTokens, this.#highlighter,
			),
		});
		this.refreshTermControls();
	}

	replaceTerm (term: MatchTerm, termOld: MatchTerm | number) {
		const index = typeof termOld === "number"
			? termOld
			: this.#termControls.findIndex(
				({ token }) => token === this.#termTokens.get(term)
			);
		this.#termControls[index].control.replaceTerm(term);
	}

	// TODO ensure that focus is handled correctly
	replaceTerms (terms: ReadonlyArray<MatchTerm>, commands: BrowserCommands) {
		this.#termControls.splice(0);
		for (const term of terms) {
			this.#termControls.push({
				token: this.#termTokens.get(term),
				control: new TermReplaceControl(term,
					commands, this.#controlsInfo,
					this, this.#setTerm, this.#termTokens, this.#highlighter,
				),
			});
		}
		this.refreshTermControls();
	}

	// TODO ensure that focus is handled correctly
	removeTerm (term: MatchTerm | number) {
		const index = typeof term === "number"
			? term
			: this.#termControls.findIndex(
				({ token }) => token === this.#termTokens.get(term)
			);
		this.#termControls.splice(index, 1);
		this.refreshTermControls();
	}

	updateTermStatus (term: MatchTerm) {
		const termToken = this.#termTokens.get(term);
		this.#termControls
			.find(({ token }) => token === termToken)
			?.control.updateStatus();
	}

	refreshTermControls () {
		this.#sections.terms.replaceChildren();
		for (const { control } of this.#termControls) {
			control.appendTo(this.#sections.terms);
		}
	}

	getTermCount (): number {
		return this.#termControls.length;
	}

	getTermControlIndex (control: TermReplaceControl): number | null {
		const index = this.#termControls.map(({ control }) => control).indexOf(control);
		if (index === -1) {
			return null;
		}
		return index;
	}

	selectTermInput (termIndex: number, shiftCaret?: "right" | "left") {
		termIndex = Math.max(0, Math.min(termIndex, this.#termControls.length));
		if (termIndex < this.#termControls.length) {
			this.#termControls[termIndex].control.selectInput(shiftCaret);
		} else {
			this.#termAppendControl.selectInput(shiftCaret);
		}
	}

	focusTermInput (termIndex: number | null) {
		if (typeof termIndex === "number" && termIndex < this.#termControls.length) {
			this.#selectionReturn.target = this.#termControls[termIndex].control.focusInput();
		} else {
			this.#selectionReturn.target = this.#termAppendControl.focusInput();
		}
	}

	getFocusedTermControl (includeAppend: boolean): {
		control: TermAbstractControl | null
		termIndex: number | null
		focusArea: ControlFocusArea
	} {
		if (includeAppend) {
			const focusArea = this.#termAppendControl.getFocusArea();
			if (focusArea !== ControlFocusArea.NONE) {
				return { control: this.#termAppendControl, termIndex: null, focusArea };
			}
		}
		let i = 0;
		for (const { control } of this.#termControls) {
			const focusArea = control.getFocusArea();
			if (focusArea !== ControlFocusArea.NONE) {
				return { control, termIndex: i, focusArea };
			}
			i++;
		}
		return { control: null, termIndex: null, focusArea: ControlFocusArea.NONE };
	}

	returnSelectionToDocument = (eventHasRelatedTarget: boolean) => {
		if (eventHasRelatedTarget) {
			setTimeout(() => {
				if (!document.activeElement || !document.activeElement.closest(`#${EleID.BAR}`)) {
					this.#selectionReturn.target = null;
				}
			});
			return; // Focus is being moved, not lost.
		}
		if (document.activeElement && document.activeElement.closest(`#${EleID.BAR}`)) {
			return;
		}
		if (this.#selectionReturn.target?.element) {
			this.#selectionReturn.target.element.focus({ preventScroll: true });
		}
		if (this.#selectionReturn.target?.selectionRanges) {
			const selection = document.getSelection();
			if (selection) {
				selection.removeAllRanges();
				this.#selectionReturn.target.selectionRanges.forEach(range => selection.addRange(range));
			}
		}
	};

	updateBarVisibility () {
		this.#bar.classList.toggle(EleClass.DISABLED, !this.#controlsInfo.pageModifyEnabled);
	}

	updateControlVisibility (controlName: ControlButtonName) {
		this.#controls[controlName].updateVisibility();
	}

	createAndInsertControl (controlName: Exclude<ControlButtonName, "appendTerm">): Control {
		const controlButtonInfo = this.createControlButtonInfo(controlName);
		const control = new Control(controlName, controlButtonInfo, this.#controlsInfo, this.#doPhrasesMatchTerms);
		switch (controlButtonInfo.containerId) {
		case "BAR_LEFT": {
			control.appendTo(this.#sections.left);
			break;
		} case "BAR_RIGHT": {
			control.appendTo(this.#sections.right);
			break;
		}}
		return control;
	}

	/**
	 * Gets details for use in initializing a control.
	 * @param controlName The key for the control.
	 * @returns Dynamic details for the control.
	 */
	createControlButtonInfo (controlName: Exclude<ControlButtonName, "appendTerm">): ControlButtonInfo {
		const controlsInfo = this.#controlsInfo;
		switch (controlName) {
		case "toggleBarCollapsed": return {
			controlClasses: [ EleClass.UNCOLLAPSIBLE ],
			path: "/icons/arrow.svg",
			pathSecondary: "/icons/mms.svg",
			containerId: "BAR_LEFT",
			onClick: () => {
				controlsInfo.barCollapsed = !controlsInfo.barCollapsed;
				sendBackgroundMessage({
					toggle: {
						barCollapsedOn: controlsInfo.barCollapsed,
					},
				});
				this.setCollapsed(controlsInfo.barCollapsed);
			},
		}; case "disableTabResearch": return {
			path: "/icons/close.svg",
			containerId: "BAR_LEFT",	
			onClick: () => sendBackgroundMessage({
				deactivateTabResearch: true,
			}),
		}; case "performSearch": return {
			path: "/icons/search.svg",
			containerId: "BAR_LEFT",
			onClick: () => sendBackgroundMessage({
				performSearch: true,
			}),
		}; case "toggleHighlights": return {
			path: "/icons/show.svg",
			containerId: "BAR_LEFT",
			onClick: () => sendBackgroundMessage({
				toggle: {
					highlightsShownOn: !controlsInfo.highlightsShown,
				},
			}),
		}; case "replaceTerms": return {
			path: "/icons/refresh.svg",
			containerId: "BAR_RIGHT",
			onClick: () => {
				this.#setTerms(controlsInfo.termsOnHold);
			},
		};}
	}

	insertIntoDocument () {
		document.body.insertAdjacentElement("beforebegin", this.#bar);
		document.body.insertAdjacentElement("afterend", this.#scrollGutter);
	}

	remove () {
		if (document.activeElement && this.#bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur(); // Allow focus+selection to be properly restored.
		}
		this.#bar.remove();
		this.#scrollGutter.remove();
	}
}

class Control {
	readonly #controlsInfo: ControlsInfo;
	readonly #doPhrasesMatchTerms: DoPhrasesMatchTerms;

	readonly #control: HTMLElement;
	// TODO do not expose this; remove attribute
	readonly button: HTMLButtonElement;

	readonly #name: string;

	/**
	 * Creates a control.
	 * @param name The key for the control.
	 * @param info Dynamic details used in creating the control.
	 */
	constructor (
		name: ControlButtonName,
		info: ControlButtonInfo,
		controlsInfo: ControlsInfo,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
	) {
		this.#controlsInfo = controlsInfo;
		this.#doPhrasesMatchTerms = doPhrasesMatchTerms;
		this.#name = name;
		this.#control = document.createElement("span");
		this.#control.classList.add(EleClass.CONTROL, Classes.controlGetClass(name));
		(info.controlClasses ?? []).forEach(elementClass =>
			this.#control.classList.add(elementClass)
		);
		this.#control.tabIndex = -1;
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
		this.button = button;
		this.#control.appendChild(pad);
		//if (hideWhenInactive) {
		if (!controlsInfo.barControlsShown[name]) {
			this.#control.classList.add(EleClass.DISABLED);
		}
		if (info.onClick) {
			button.addEventListener("click", info.onClick);
		}
		if (info.setUp) {
			info.setUp(this.#control);
		}
	}

	updateVisibility () {
		const value = this.#controlsInfo.barControlsShown[this.#name];
		if (this.#name === "replaceTerms") {
			const shown = (value
				&& this.#controlsInfo.termsOnHold.length > 0
				&& !this.#doPhrasesMatchTerms(this.#controlsInfo.termsOnHold.map(term => term.phrase))
			);
			this.#control.classList.toggle(EleClass.DISABLED, !shown);
		} else {
			this.#control.classList.toggle(EleClass.DISABLED, !value);
		}
	}

	classListToggle (token: string, force?: boolean) {
		return this.#control.classList.toggle(token, force);
	}

	classListContains (token: string) {
		return this.#control.classList.contains(token);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#control);
	}
}

interface TermAbstractControl extends TermControlInputInterface, TermControlOptionListInterface {
	getInputValue: () => string

	/**
	 * Focuses and selects the text of the control's input. Note that focus causes a term input to be visible.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	selectInput: (shiftCaret?: "right" | "left") => void

	focusInput: () => SelectionReturnTarget;

	unfocusInput: () => void

	getFocusArea: () => ControlFocusArea
	
	appendTo: (parent: HTMLElement) => void
}

interface TermControlComponentInterface {
	commit: (inputValue?: string) => void

	classListToggle: (token: string, force?: boolean) => boolean

	classListContains: (token: string) => boolean
}

interface TermControlInputInterface extends TermControlComponentInterface {
	openOptionList: () => void
}

interface TermControlOptionListInterface extends TermControlComponentInterface {
	forgetToolbarOpenedMenu: () => void
}

class TermReplaceControl implements TermAbstractControl {
	readonly #toolbarInterface: ToolbarTermControlInterface;
	readonly #setTerm: SetTerm;
	readonly #termTokens: TermTokens;
	readonly #highlighter: Highlighter;

	readonly #input: TermInput;
	readonly #optionList: TermOptionList;

	readonly #control: HTMLElement;
	readonly #controlPad: HTMLElement;
	readonly #controlContent: HTMLButtonElement;

	#term: MatchTerm;

	/**
	 * Inserts an interactive term control element.
	 * @param terms The term corresponding to this control.
	 * @param commands Keyboard commands to display as shortcut hints.
	 * @param controlsInfo Details of controls inserted.
	 */
	constructor (
		termParameter: MatchTerm,
		commands: BrowserCommands,
		controlsInfo: ControlsInfo, // TODO ControlsInfo should be an observable
		toolbarInterface: ToolbarTermControlInterface,
		setTerm: SetTerm,
		termTokens: TermTokens,
		highlighter: Highlighter,
	) {
		this.#toolbarInterface = toolbarInterface;
		this.#setTerm = setTerm;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		this.#term = termParameter;
		this.#optionList = new TermOptionList(
			(matchType: string, checked: boolean) => {
				const matchMode = Object.assign({}, this.#term.matchMode) as MatchMode;
				matchMode[matchType] = checked;
				this.#term = new MatchTerm(this.#term.phrase, matchMode);
				const idx = toolbarInterface.getTermControlIndex(this);
				if (idx !== null) {
					setTerm(this.#term, idx);
				}
			},
			this.#term.matchMode,
			controlsInfo,
			this,
		);
		const revealButton = this.#optionList.createRevealButton();
		revealButton.addEventListener("click", () => {
			this.#input.classListToggle(EleClass.OPENED_MENU, true);
		});
		this.#controlPad = document.createElement("span");
		this.#controlPad.classList.add(EleClass.CONTROL_PAD, EleClass.DISABLED);
		this.#controlPad.appendChild(revealButton);
		this.#controlContent = document.createElement("button");
		this.#controlContent.type = "button";
		this.#controlContent.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT);
		this.#controlContent.tabIndex = -1;
		this.#controlContent.textContent = this.#term.phrase;
		this.#controlContent.addEventListener("click", () => {
			highlighter.current?.stepToNextOccurrence(false, false, this.#term);
		});
		this.#controlContent.addEventListener("mouseover", () => { // FIXME this is not screenreader friendly.
			this.updateTooltip(commands);
		});
		this.#controlPad.appendChild(this.#controlContent);
		const editButton = document.createElement("button");
		editButton.type = "button";
		editButton.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_EDIT);
		editButton.tabIndex = -1;
		editButton.disabled = !controlsInfo.barLook.showEditIcon;
		const editChangeImage = document.createElement("img");
		editChangeImage.classList.add(EleClass.PRIMARY);
		editChangeImage.src = chrome.runtime.getURL("/icons/edit.svg");
		editChangeImage.draggable = false;
		const editRemoveImage = document.createElement("img");
		editRemoveImage.classList.add(EleClass.SECONDARY);
		editRemoveImage.src = chrome.runtime.getURL("/icons/delete.svg");
		editRemoveImage.draggable = false;
		editButton.append(editChangeImage, editRemoveImage);
		this.#input = new TermInput({ type: "replace", editButton, content: this.#controlContent }, this, this.#toolbarInterface);
		this.#input.appendTo(this.#controlPad);
		this.#controlPad.appendChild(editButton);
		this.#control = document.createElement("span");
		this.#control.classList.add(EleClass.CONTROL, getTermClass(this.#term, termTokens));
		this.#control.appendChild(this.#controlPad);
		this.#optionList.appendTo(this.#control);
		this.updateMatchModeClassList();
	}

	forgetToolbarOpenedMenu () {
		this.#toolbarInterface.forgetOpenedMenu();
	}

	getInputValue () {
		return this.#input.getValue();
	}

	selectInput (shiftCaret?: "right" | "left") {
		this.#input.select(shiftCaret);
	}

	focusInput () {
		return this.#input.focus();
	}

	unfocusInput () {
		this.#input.unfocus();
	}

	openOptionList () {
		this.#optionList.open();
	}

	getFocusArea (): ControlFocusArea {
		if (this.#input.isFocused()) {
			return ControlFocusArea.INPUT;
		}
		return ControlFocusArea.NONE;
	}

	/**
	 * Executes the change indicated by the current input text of the control.
	 * Operates by sending a background message to this effect provided that the text was altered.
	 * @param inputValue 
	 */
	commit (inputValue?: string) {
		inputValue ??= this.#input.getValue();
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		const index = this.#toolbarInterface.getTermControlIndex(this);
		if (index === null) {
			return;
		}
		if (inputValue === "") {
			if (this.#input.isFocused()) {
				this.#toolbarInterface.selectTermInput(index + 1);
				return;
			}
			this.#setTerm(null, index);
		} else if (inputValue !== this.#term.phrase) {
			this.#term = new MatchTerm(inputValue, this.#term.matchMode);
			this.#setTerm(this.#term, index);
		}
	}

	/**
	 * Updates the look of the control to reflect whether or not its term currently occurs within the document.
	 */
	updateStatus () {
		this.#controlPad.classList.toggle(
			EleClass.DISABLED,
			!this.#highlighter.current?.termOccurrences?.exists(this.#term, this.#termTokens),
		);
	}

	/**
	 * Updates the tooltip of the control to reflect current highlighting and keyboard command information.
	 * @param commands 
	 */
	updateTooltip (commands: BrowserCommands) {
		const index = this.#toolbarInterface.getTermControlIndex(this);
		if (index === null) {
			return;
		}
		const { [index]: commandObject } = getTermCommands(commands);
		const { down: command, up: commandReverse } = commandObject ?? { down: "", up: "" };
		const occurrenceCount = this.#highlighter.current?.termOccurrences?.countBetter(this.#term, this.#termTokens) ?? 0;
		const matchesString = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page`;
		if (occurrenceCount > 0 && command && commandReverse) {
			const commandString = (occurrenceCount === 1)
				? `Jump to: ${command} or ${commandReverse}`
				: `Jump to next: ${command}\nJump to previous: ${commandReverse}`;
			this.#controlContent.title = matchesString + "\n" + commandString;
		} else {
			this.#controlContent.title = matchesString;
		}
	}

	/**
	 * Updates the class list of the control to reflect the matching options of its term.
	 */
	updateMatchModeClassList () {
		applyMatchModeToClassList(
			this.#term.matchMode,
			(token, force) => this.#control.classList.toggle(token, force),
		);
	}

	/**
	 * Replaces the control's term in-place, and updates it to reflect the new state.
	 * @param term The new term.
	 */
	replaceTerm (term: MatchTerm) {
		this.#control.classList.remove(getTermClass(this.#term, this.#termTokens));
		this.#term = term;
		this.#controlContent.textContent = this.#term.phrase;
		this.#control.classList.add(getTermClass(this.#term, this.#termTokens));
	}

	classListToggle (token: string, force?: boolean) {
		return this.#control.classList.toggle(token, force);
	}

	classListContains (token: string) {
		return this.#control.classList.contains(token);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#control);
	}
}

class TermAppendControl implements TermAbstractControl {
	readonly #toolbarInterface: ToolbarTermControlInterface;
	readonly #setTerm: SetTerm;

	readonly #input: TermInput;
	readonly #optionList: TermOptionList;
	readonly control: Control;
	
	readonly matchMode: MatchMode;

	constructor (
		controlsInfo: ControlsInfo,
		toolbarInterface: ToolbarTermControlInterface,
		setTerm: SetTerm,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
	) {
		this.#toolbarInterface = toolbarInterface;
		this.#setTerm = setTerm;
		this.matchMode = Object.assign({}, controlsInfo.matchMode);
		let controlContainerTemp: HTMLElement | undefined = undefined;
		const setUpControl = (container: HTMLElement) => {
			const pad = container.querySelector(`.${EleClass.CONTROL_PAD}`) as HTMLElement;
			this.#input.appendTo(pad);
			const revealButton = this.#optionList.createRevealButton();
			revealButton.addEventListener("click", () => {
				this.#input.classListToggle(EleClass.OPENED_MENU, true);
			});
			pad.appendChild(revealButton);
			this.#optionList.appendTo(container);
		};
		this.control = new Control("appendTerm", {
			buttonClasses: [ EleClass.CONTROL_BUTTON, EleClass.CONTROL_CONTENT ],
			path: "/icons/create.svg",
			containerId: "BAR_RIGHT",
			setUp: container => {
				controlContainerTemp = container;
			},
		}, controlsInfo, doPhrasesMatchTerms);
		this.#input = new TermInput({ type: "append", button: this.control.button }, this, toolbarInterface);
		this.#optionList = new TermOptionList(
			(matchType, checked) => {
				this.matchMode[matchType] = checked;
				this.updateMatchModeClassList();
			},
			this.matchMode,
			controlsInfo,
			this,
		);
		if (controlContainerTemp) {
			setUpControl(controlContainerTemp);
		}
		this.updateMatchModeClassList();
	}

	forgetToolbarOpenedMenu () {
		this.#toolbarInterface.forgetOpenedMenu();
	}

	getInputValue () {
		return this.#input.getValue();
	}

	selectInput (shiftCaret?: "right" | "left") {
		this.#input.select(shiftCaret);
	}

	focusInput () {
		return this.#input.focus();
	}

	unfocusInput () {
		this.#input.unfocus();
	}

	openOptionList () {
		this.#optionList.open();
	}

	getFocusArea (): ControlFocusArea {
		if (this.#input.isFocused()) {
			return ControlFocusArea.INPUT;
		}
		return ControlFocusArea.NONE;
	}

	commit (inputValue?: string) {
		inputValue ??= this.#input.getValue();
		// TODO standard method of avoiding race condition (arising from calling termsSet, which immediately updates controls)
		if (inputValue !== "") {
			const matchMode: MatchMode = getMatchModeFromClassList(
				token => this.control.classListContains(token),
			);
			const term = new MatchTerm(inputValue, matchMode, { allowStemOverride: true });
			this.#setTerm(term, true);
		}
	}

	/**
	 * Updates the class list of the control to reflect the matching options of its term.
	 */
	updateMatchModeClassList () {
		applyMatchModeToClassList(
			this.matchMode,
			(token, force) => this.control.classListToggle(token, force),
		);
	}

	classListToggle (token: string, force?: boolean) {
		return this.control.classListToggle(token, force);
	}

	classListContains (token: string) {
		return this.control.classListContains(token);
	}

	appendTo (parent: HTMLElement) {
		this.control.appendTo(parent);
	}
}

class TermInput {
	readonly #controlInterface: TermControlInputInterface;
	readonly #toolbarInterface: ToolbarTermInputInterface;
	
	readonly #input: HTMLInputElement;

	term: MatchTerm | null;

	/**
	 * Creates an interactive term editing input. Inserts it into a term control.
	 * @param terms Terms being controlled and highlighted.
	 * @param controlPad The visible pad of the control. Contains the inline buttons and inputs.
	 * @param idxCode The append term constant if the control is used to append a term,
	 * or the index of a term if used to edit that term.
	 * @returns The input element created.
	 */
	constructor (
		controlElements:
			| { type: "replace", editButton: HTMLButtonElement, content: HTMLButtonElement }
			| { type: "append", button: HTMLButtonElement },
		controlInterface: TermControlInputInterface,
		toolbarInterface: ToolbarTermInputInterface,
	) {
		this.#controlInterface = controlInterface;
		this.#toolbarInterface = toolbarInterface;
		const input = document.createElement("input");
		this.#input = input;
		input.type = "text";
		input.classList.add(EleClass.CONTROL_INPUT);
		// Inputs should not be focusable unless user has already focused bar. (0)
		if (!document.activeElement || !document.activeElement.closest(`#${EleID.BAR}`)) {
			input.tabIndex = -1;
		}
		const resetInput = () => {
			input.value = this.term?.phrase ?? "";
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
		const hide = () => {
			input.blur();
		};
		if (controlElements.type === "replace") {
			controlElements.editButton.addEventListener("click", event => {
				if (inputSize) { // Input is shown; currently a delete button.
					input.value = "";
					controlInterface.commit();
					hide();
				} else { // Input is hidden; currently an edit button.
					show(event);
				}
			});
			controlElements.editButton.addEventListener("contextmenu", event => {
				event.preventDefault();
				input.value = "";
				controlInterface.commit();
				hide();
			});
			controlElements.content.addEventListener("contextmenu", show);
		} else if (controlElements.type === "append") {
			controlElements.button.addEventListener("click", show);
			controlElements.button.addEventListener("contextmenu", show);
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
					input.value = inputValue;
					controlInterface.commit(inputValue);
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
				this.tryShiftTermFocus(event.key === "ArrowRight" ? "right" : "left", () => event.preventDefault());
				return;
			}
			case "ArrowUp":
			case "ArrowDown": {
				this.tryShiftTermFocus((event.key === "ArrowUp") ? 0 : toolbarInterface.getTermCount(), () => event.preventDefault());
				return;
			}
			case " ": {
				if (!event.shiftKey) {
					return;
				}
				event.preventDefault();
				input.classList.add(EleClass.OPENED_MENU);
				controlInterface.openOptionList();
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
					controlInterface.commit();
				}
			}
			inputSize = inputSizeNew;
		}).observe(input);
	}

	/**
	 * Shifts the control focus to another control if the caret is at the input end corresponding to the requested direction.
	 * A control is considered focused if its input is focused.
	 * @param term The term of the currently focused control.
	 * @param idxTarget The index of the target term control to shift to, if no shift direction is passed.
	 * @param shiftTarget Whether to shift "right" or "left", if no target index is passed.
	 * @param onBeforeShift A function to execute once the shift is confirmed but has not yet taken place.
	 * @param terms Terms being controlled and highlighted.
	 */
	tryShiftTermFocus (
		shiftTarget: "right" | "left" | number,
		onBeforeShift: () => void,
	) {
		const index = this.#toolbarInterface.getTermControlIndex(this.#controlInterface);
		if (index === null
			|| this.#input.selectionStart !== this.#input.selectionEnd
			|| this.#input.selectionStart !== (shiftTarget === "right" ? this.#input.value.length : 0)
		) {
			return;
		}
		onBeforeShift();
		const targetIndex = typeof shiftTarget === "number" ? shiftTarget : (index + (shiftTarget === "right" ? 1 : -1));
		if (index === targetIndex) {
			// TODO why does this need to be done here?
			this.#controlInterface.commit();
			//if (!replaces) {
			//	this.#input.value = "";
			//}
		} else {
			this.#toolbarInterface.selectTermInput(targetIndex, typeof shiftTarget === "string" ? shiftTarget : undefined);
		}
	}

	getValue (): string {
		return this.#input.value;
	}

	/**
	 * Focuses and selects the text of the input. Note that focus causes a term input to be visible.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	select (shiftCaret?: "right" | "left") {
		this.#input.focus();
		this.#input.select();
		if (shiftCaret !== undefined) {
			const caretPosition = shiftCaret === "right" ? 0 : -1;
			this.#input.setSelectionRange(caretPosition, caretPosition);
		}
	}

	focus (): SelectionReturnTarget {
		const selection = getSelection() as Selection;
		const activeElementOriginal = document.activeElement as HTMLElement;
		const selectionRangesOriginal = Array(selection.rangeCount).fill(null).map((v, i) => selection.getRangeAt(i));
		this.#input.focus();
		this.#input.select();
		return {
			element: activeElementOriginal,
			selectionRanges: selectionRangesOriginal,
		};
	}

	unfocus () {
		this.#input.blur();
	}

	isFocused (): boolean {
		return document.activeElement === this.#input;
	}

	classListToggle (token: string, force?: boolean) {
		return this.#input.classList.toggle(token, force);
	}

	classListContains (token: string) {
		return this.#input.classList.contains(token);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#input);
	}
}

class TermOptionList {
	readonly #controlsInfo: ControlsInfo;
	readonly #controlInterface: TermControlOptionListInterface;

	readonly #optionList: HTMLElement;
	readonly #checkboxes: Array<HTMLInputElement> = [];
	
	/**
	 * Creates a menu structure containing clickable elements to individually toggle the matching options for the term.
	 * @param controlsInfo Details of controls being inserted.
	 * @param onActivated A function, taking the identifier for a match option, to execute each time the option is activated.
	 * @returns The resulting menu element.
	 */
	constructor (
		onActivated: (matchType: string, checked: boolean) => void,
		matchMode: Readonly<MatchMode>,
		controlsInfo: ControlsInfo,
		controlInterface: TermControlOptionListInterface,
	) {
		this.#controlsInfo = controlsInfo;
		this.#controlInterface = controlInterface;
		this.#optionList = document.createElement("span");
		this.#optionList.classList.add(EleClass.OPTION_LIST);
		const options = (() => {
			const options: Array<{ matchType: keyof MatchMode, title: string }> = [
				{ matchType: "case", title: "Case Sensitive" },
				{ matchType: "whole", title: "Whole Word" },
				{ matchType: "stem", title: "Stem Word" },
				{ matchType: "diacritics", title: "Diacritics Sensitive" },
				{ matchType: "regex", title: "Regex Mode" },
			];
			return options.map(({ matchType, title }) => {
				const {
					optionElement, checkbox, toggle, makeFocusable,
				} = this.createOption(matchType, title, matchMode, onActivated);
				this.#optionList.appendChild(optionElement);
				this.#checkboxes.push(checkbox);
				return {
					matchType,
					title,
					toggle,
					makeFocusable,
				};
			});
		})();
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
				this.close(true);
			} else if (event.key.startsWith("Arrow")) {
				if (event.key === "ArrowUp" || event.key === "ArrowDown") {
					const down = event.key === "ArrowDown";
					const checkboxes = this.#checkboxes;
					let index = checkboxes.findIndex(checkbox => checkbox === document.activeElement);
					if (index === -1) {
						index = down ? 0 : (checkboxes.length - 1);
					} else {
						index = (index + (down ? 1 : -1) + checkboxes.length) % checkboxes.length;
					}
					checkboxes[index].focus();
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
				this.close(true);
			}
		};
		this.#optionList.addEventListener("keydown", handleKeyEvent);
		this.#optionList.addEventListener("keyup", stopKeyEvent);
		this.#optionList.addEventListener("focusin", () => {
			options.forEach(option => option.makeFocusable(true));
		});
		this.#optionList.addEventListener("focusout", event => {
			this.#optionList.removeAttribute("tabindex");
			const newFocus = event.relatedTarget as Element | null;
			if (this.#optionList.contains(newFocus)) {
				return;
			}
			options.forEach(option => option.makeFocusable(false));
			if (newFocus?.classList.contains(EleClass.CONTROL_REVEAL)) {
				this.close(false);
			} else {
				this.close(true);
				controlInterface.forgetToolbarOpenedMenu();
			}
		});
	}

	createRevealButton (): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_REVEAL);
		button.tabIndex = -1;
		button.disabled = !this.#controlsInfo.barLook.showRevealIcon;
		button.addEventListener("mousedown", () => {
			// If menu was open, it is about to be "just closed" because the mousedown will close it.
			// If menu was closed, remove "just closed" class if present.
			this.#controlInterface.classListToggle(
				EleClass.MENU_JUST_CLOSED_BY_BUTTON, // *just closed "by button"* because this class is only applied here.
				this.#controlInterface.classListContains(EleClass.MENU_OPEN),
			);
			this.close(true);
			this.#controlInterface.forgetToolbarOpenedMenu();
		});
		button.addEventListener("click", () => {
			if (this.#controlInterface.classListContains(EleClass.MENU_JUST_CLOSED_BY_BUTTON)) {
				return;
			}
			this.open();
		});
		const image = document.createElement("img");
		image.src = chrome.runtime.getURL("/icons/reveal.svg");
		image.draggable = false;
		button.appendChild(image);
		return button;
	}

	/**
	 * Creates a clickable element to toggle one of the matching options for the term.
	 * @param matchType The match type of this option.
	 * @param text Text content for the option, which is also used to determine the matching mode it controls.
	 * @param onActivated A function, taking the identifier for the match option, to execute each time the option is activated.
	 * @returns The resulting option element.
	 */
	createOption (
		matchType: keyof MatchMode,
		text: string,
		matchMode: Readonly<MatchMode>,
		onActivated: (matchType: string, checked: boolean) => void,
	) {
		const option = document.createElement("label");
		option.classList.add(EleClass.OPTION, getMatchModeOptionClass(matchType));
		const id = getInputIdSequential();
		option.htmlFor = id;
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.id = id;
		checkbox.checked = matchMode[matchType];
		checkbox.tabIndex = -1;
		// TODO is this the correct event to use? should "change" be used instead?
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
			checkbox,
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
	}

	/**
	 * Opens and focuses the menu of matching options, allowing the user to toggle matching modes.
	 */
	open () {
		this.#controlInterface.classListToggle(EleClass.MENU_OPEN, true);
		this.#optionList.tabIndex = 0;
		this.#optionList.focus();
	}

	close (moveFocus: boolean) {
		const input = document.querySelector(`#${EleID.BAR} .${EleClass.OPENED_MENU}`) as HTMLElement | null;
		if (input) {
			if (moveFocus) {
				input.focus();
			}
		} else if (moveFocus) {
			const focus = document.activeElement as HTMLElement | null;
			if (this.#optionList.contains(focus)) {
				focus?.blur();
			}
		}
		this.#controlInterface.classListToggle(EleClass.MENU_OPEN, false);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#optionList);
	}
}

export {
	type AbstractToolbar,
	StandardToolbar,
};
