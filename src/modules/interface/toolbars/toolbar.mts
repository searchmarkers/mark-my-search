import type { AbstractToolbar, ControlButtonName, SelectionReturnTarget } from "/dist/modules/interface/toolbar.mjs";
import { Control, type ControlButtonInfo } from "/dist/modules/interface/toolbar/control.mjs";
import type { TermAbstractControl } from "/dist/modules/interface/toolbar/term-control.mjs";
import { TermReplaceControl } from "/dist/modules/interface/toolbar/term-controls/replace.mjs";
import { TermAppendControl } from "/dist/modules/interface/toolbar/term-controls/append.mjs";
import type { ControlFocusArea, BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import { getControlPadClass } from "/dist/modules/interface/toolbar/common.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass } from "/dist/modules/common.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import type { SetTerm, SetTerms, DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";

class Toolbar implements AbstractToolbar {
	readonly #controlsInfo: ControlsInfo;
	readonly #setTerm: SetTerm;
	readonly #setTerms: SetTerms;
	readonly #doPhrasesMatchTerms: DoPhrasesMatchTerms;
	readonly #termTokens: TermTokens;
	readonly #highlighter: Highlighter;

	readonly #bar: HTMLElement;
	static readonly sectionNames = [ "left", "terms", "right" ] as const;
	readonly #sections: Readonly<Record<typeof Toolbar.sectionNames[number], HTMLElement>>;
	readonly #controls: Readonly<Record<ControlButtonName, Control>>;
	readonly #termControls: Array<{ token: string, control: TermReplaceControl }> = [];
	readonly #termAppendControl: TermAppendControl;
	// TODO why is the toolbar in charge of the scroll gutter??
	readonly #scrollGutter: HTMLElement;

	readonly #selectionReturn = new ToolbarSelectionReturnManager();
	#indicatedClassToken: string | null = null;

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
				if (!control || focusArea !== "input") {
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
		for (const sectionName of Toolbar.sectionNames) {
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

	indicateTerm (term: MatchTerm | null) {
		this.#sections.terms.classList.remove(this.#indicatedClassToken ?? "");
		if (term) {
			this.#indicatedClassToken = getControlPadClass(this.#termControls.findIndex(
				({ token }) => token === this.#termTokens.get(term)
			));
			this.#sections.terms.classList.add(this.#indicatedClassToken);
		}
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
			if (focusArea !== "none") {
				return { control: this.#termAppendControl, termIndex: null, focusArea };
			}
		}
		let i = 0;
		for (const { control } of this.#termControls) {
			const focusArea = control.getFocusArea();
			if (focusArea !== "none") {
				return { control, termIndex: i, focusArea };
			}
			i++;
		}
		return { control: null, termIndex: null, focusArea: "none" };
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

export { Toolbar };
