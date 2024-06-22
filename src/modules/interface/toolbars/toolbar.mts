import type {
	SelectionReturnTarget, ControlButtonName,
	AbstractToolbar,
	ToolbarControlButtonInterface, ToolbarTermControlInterface,
} from "/dist/modules/interface/toolbar.mjs";
import { Control, type ControlButtonInfo } from "/dist/modules/interface/toolbar/control.mjs";
import type { TermAbstractControl, TermControlOptionListInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import { TermReplaceControl } from "/dist/modules/interface/toolbar/term-controls/replace.mjs";
import { TermAppendControl } from "/dist/modules/interface/toolbar/term-controls/append.mjs";
import type { ControlFocusArea, BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import { getControlPadClass, passKeyEvent } from "/dist/modules/interface/toolbar/common.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";
import type { HighlighterCounterInterface, HighlighterWalkerInterface } from "/dist/modules/highlight/model.mjs";
import type { TermSetter, DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";

enum ToolbarSection {
	LEFT = "left",
	TERMS = "terms",
	RIGHT = "right",
}

const toolbarSectionNames = [ ToolbarSection.LEFT, ToolbarSection.TERMS, ToolbarSection.RIGHT ] as const;

class Toolbar implements AbstractToolbar, ToolbarTermControlInterface, ToolbarControlButtonInterface {
	readonly #controlsInfo: ControlsInfo;
	readonly #termSetter: TermSetter;
	readonly #doPhrasesMatchTerms: DoPhrasesMatchTerms;
	readonly #termTokens: TermTokens;
	readonly #highlighter: HighlighterCounterInterface & HighlighterWalkerInterface;

	readonly #bar: HTMLElement;
	readonly #sections: Readonly<Record<ToolbarSection, HTMLElement>>;
	readonly #controls: Readonly<Record<ControlButtonName, Control>>;
	readonly #termControls: Array<TermReplaceControl> = [];
	readonly #termAppendControl: TermAppendControl;
	// TODO why is the toolbar in charge of the scroll gutter??
	readonly #scrollGutter: HTMLElement;

	readonly #selectionReturn = new ToolbarSelectionReturnManager();
	#indicatedClassToken: string | null = null;

	constructor (
		terms: ReadonlyArray<MatchTerm>,
		commands: BrowserCommands,
		hues: ReadonlyArray<number>,
		controlsInfo: ControlsInfo,
		termSetter: TermSetter,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
		termTokens: TermTokens,
		highlighter: HighlighterCounterInterface & HighlighterWalkerInterface,
	) {
		this.#termSetter = termSetter;
		this.#doPhrasesMatchTerms = doPhrasesMatchTerms;
		this.#controlsInfo = controlsInfo;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		this.#bar = document.createElement("div");
		this.#bar.id = EleID.BAR;
		this.updateHighlightsShownFlag();
		this.updateVisibility();
		this.updateCollapsed();
		// Inputs should not be focusable unless user has already focused bar. (1)
		const inputsSetFocusable = (focusable: boolean) => {
			const inputs = this.#bar.querySelectorAll(`input.${EleClass.CONTROL_INPUT}`) as NodeListOf<HTMLInputElement>;
			for (const input of inputs) {
				if (focusable) {
					input.removeAttribute("tabindex");
				} else {
					input.tabIndex = -1;
				}
			}
		};
		this.#bar.addEventListener("focusin", () => {
			inputsSetFocusable(true);
		});
		this.#bar.addEventListener("focusout", event => {
			const newFocus = event.relatedTarget as Element | null;
			if (!this.#bar.contains(newFocus)) {
				if (this.hasLastFocusedInput()) {
					if (!this.#bar.classList.contains(EleClass.BAR_NO_AUTOFOCUS)) {
						this.focusLastFocusedInput();
					}
				} else {
					this.returnSelectionToDocument(!!event.relatedTarget);
					inputsSetFocusable(false);
				}
			}
		});
		this.#bar.addEventListener("pointerdown", event => {
			const target = event.target as Element | null;
			if (this.#bar.contains(target)) {
				this.#bar.classList.remove(EleClass.BAR_NO_AUTOFOCUS);
			}
		});
		this.#bar.addEventListener("pointerleave", () => {
			if (!this.#bar.contains(document.activeElement) && this.#bar.classList.contains(EleClass.BAR_NO_AUTOFOCUS)) {
				this.#bar.classList.remove(EleClass.BAR_NO_AUTOFOCUS);
				this.forgetLastFocusedInput();
			}
		});
		this.#bar.addEventListener("contextmenu", event => {
			event.preventDefault();
		});
		this.#bar.addEventListener("keydown", event => {
			if (passKeyEvent(event)) {
				return;
			}
			if (event.key === "Tab") { // This is the only key that will escape term inputs; the rest are blocked automatically.
				event.stopPropagation();
				const { control, termIndex: index, focusArea } = this.getFocusedTermControl(true);
				if (!control || focusArea !== "input") {
					return;
				}
				// Special case to specifically focus the term append input, in case the button is hidden.
				if (control && !event.shiftKey && index === this.#termControls.length - 1) {
					event.preventDefault();
					this.#selectionReturn.setTargetIfValid(this.#termAppendControl.focusInput());
					return;
				}
				if (!(event.shiftKey ? control === this.#termControls[0] : control === this.#termAppendControl)) {
					return;
				}
				event.preventDefault();
				if (!event.shiftKey && control.getInputValue().length > 0) {
					control.commit();
					// TODO this (alternative) sequence is now obsolete anyway, but why does it not work anymore?
					//control.unfocusInput();
					//control.focusInput();
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
			if (passKeyEvent(event)) {
				return;
			}
			event.stopPropagation();
		});
		this.#bar.addEventListener("keypress", event => {
			if (passKeyEvent(event)) {
				return;
			}
			event.stopPropagation();
		});
		this.#bar.addEventListener("dragstart", event => {
			event.preventDefault();
		});
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
		for (const sectionName of toolbarSectionNames) {
			this.#bar.appendChild(this.#sections[sectionName]);
		}
		this.#termAppendControl = new TermAppendControl(controlsInfo, this, termSetter, doPhrasesMatchTerms);
		this.#controls = {
			// The order of properties determines the order of insertion into (sections of) the toolbar.
			toggleBarCollapsed: (
				this.createAndInsertControl("toggleBarCollapsed", ToolbarSection.LEFT)
			),
			disableTabResearch: (
				this.createAndInsertControl("disableTabResearch", ToolbarSection.LEFT)
			),
			performSearch: (
				this.createAndInsertControl("performSearch", ToolbarSection.LEFT)
			),
			toggleHighlights: (
				this.createAndInsertControl("toggleHighlights", ToolbarSection.LEFT)
			),
			appendTerm: (() => {
				this.#termAppendControl.appendTo(this.#sections.right);
				return this.#termAppendControl.control;
			})(),
			replaceTerms: (
				this.createAndInsertControl("replaceTerms", ToolbarSection.RIGHT)
			),
		};
		terms.forEach(term => {
			this.#termControls.push(new TermReplaceControl(term,
				commands, controlsInfo,
				this, this.#termSetter, this.#termTokens, this.#highlighter,
			));
		});
		this.refreshTermControls();
		this.#scrollGutter = document.createElement("div");
		this.#scrollGutter.id = EleID.MARKER_GUTTER;
	}

	getTermAbstractControls (): Array<TermAbstractControl> {
		const array: Array<TermAbstractControl> = [];
		return array.concat(this.#termControls).concat(this.#termAppendControl);
	}

	setAutofocusable (autofocus: boolean) {
		this.#bar.classList.toggle(EleClass.BAR_NO_AUTOFOCUS, !autofocus);
	}

	hasLastFocusedInput (): boolean {
		for (const termControl of this.getTermAbstractControls()) {
			if (termControl.inputIsLastFocused()) {
				return true;
			}
		}
		return false;
	}

	markLastFocusedInput (focus: EventTarget) {
		for (const termControl of this.getTermAbstractControls()) {
			if (termControl.inputIsEventTarget(focus)) {
				termControl.markInputAsLastFocused(true);
				return;
			}
		}
	}

	forgetLastFocusedInput () {
		for (const termControl of this.getTermAbstractControls()) {
			termControl.markInputAsLastFocused(false);
		}
	}

	focusLastFocusedInput () {
		for (const termControl of this.getTermAbstractControls()) {
			if (termControl.inputIsLastFocused()) {
				this.#selectionReturn.setTargetIfValid(termControl.focusInput());
				return;
			}
		}
	}

	appendTerm (term: MatchTerm, commands: BrowserCommands) {
		this.#termControls.push(new TermReplaceControl(term,
			commands, this.#controlsInfo,
			this, this.#termSetter, this.#termTokens, this.#highlighter,
		));
		this.refreshTermControls();
	}

	insertTerm (term: MatchTerm, index: number, commands: BrowserCommands) {
		this.#termControls.splice(index, 0, new TermReplaceControl(term,
			commands, this.#controlsInfo,
			this, this.#termSetter, this.#termTokens, this.#highlighter,
		));
		this.refreshTermControls();
	}

	replaceTerm (term: MatchTerm, termOld: MatchTerm | number) {
		if (typeof termOld === "number") {
			this.#termControls[termOld].replaceTerm(term);
		} else {
			const termToken = this.#termTokens.get(term);
			const index = this.#termControls.findIndex(control => control.getTermToken() === termToken);
			this.#termControls[index].replaceTerm(term);
		}
	}

	// TODO ensure that focus is handled correctly
	replaceTerms (terms: ReadonlyArray<MatchTerm>, commands: BrowserCommands) {
		this.#termControls.splice(0);
		for (const term of terms) {
			this.#termControls.push(new TermReplaceControl(term,
				commands, this.#controlsInfo,
				this, this.#termSetter, this.#termTokens, this.#highlighter,
			));
		}
		this.refreshTermControls();
	}

	// TODO ensure that focus is handled correctly
	removeTerm (term: MatchTerm | number) {
		if (typeof term === "number") {
			this.#termControls.splice(term, 1);
		} else {
			const termToken = this.#termTokens.get(term);
			const index = this.#termControls.findIndex(control => control.getTermToken() === termToken);
			this.#termControls.splice(index, 1);
		}
		this.refreshTermControls();
	}

	updateTermStatus (term: MatchTerm) {
		const termToken = this.#termTokens.get(term);
		this.#termControls.find(control => control.getTermToken() === termToken)?.updateStatus();
	}

	indicateTerm (term: MatchTerm | null) {
		if (this.#indicatedClassToken) {
			this.#sections.terms.classList.remove(this.#indicatedClassToken);
		}
		if (term) {
			const termToken = this.#termTokens.get(term);
			const termControl = this.#termControls.findIndex(control => control.getTermToken() === termToken);
			this.#indicatedClassToken = getControlPadClass(termControl);
			this.#sections.terms.classList.add(this.#indicatedClassToken);
		}
	}

	refreshTermControls () {
		this.#sections.terms.replaceChildren();
		for (const control of this.#termControls) {
			control.appendTo(this.#sections.terms);
		}
	}

	getTermCount (): number {
		return this.#termControls.length;
	}

	getTermControlIndex (control: TermControlOptionListInterface): number | null {
		const index = this.#termControls.indexOf(control as TermReplaceControl);
		if (index === -1) {
			return null;
		}
		return index;
	}

	selectTermInput (termIndex: number, shiftCaret?: "right" | "left") {
		termIndex = Math.max(0, Math.min(termIndex, this.#termControls.length));
		if (termIndex < this.#termControls.length) {
			this.#selectionReturn.setTargetIfValid(this.#termControls[termIndex].selectInput(shiftCaret));
		} else {
			this.#termAppendControl.selectInput(shiftCaret);
		}
	}

	focusTermInput (termIndex: number | null) {
		if (typeof termIndex === "number" && termIndex < this.#termControls.length) {
			this.#selectionReturn.setTargetIfValid(this.#termControls[termIndex].focusInput());
		} else {
			this.#selectionReturn.setTargetIfValid(this.#termAppendControl.focusInput());
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
		for (const control of this.#termControls) {
			const focusArea = control.getFocusArea();
			if (focusArea !== "none") {
				return { control, termIndex: i, focusArea };
			}
			i++;
		}
		return { control: null, termIndex: null, focusArea: "none" };
	}

	returnSelectionToDocument (eventHasRelatedTarget: boolean) {
		if (eventHasRelatedTarget) {
			setTimeout(() => {
				if (!document.activeElement || !document.activeElement.closest(`#${EleID.BAR}`)) {
					this.#selectionReturn.forgetTarget();
				}
			});
			return; // Focus is being moved, not lost.
		}
		if (document.activeElement && document.activeElement.closest(`#${EleID.BAR}`)) {
			return;
		}
		const target = this.#selectionReturn.getTarget();
		if (target) {
			this.#selectionReturn.forgetTarget();
			if (target.element) {
				target.element.focus({ preventScroll: true });
			}
			if (target.selectionRanges) {
				const selection = document.getSelection();
				if (selection) {
					selection.removeAllRanges();
					target.selectionRanges.forEach(range => selection.addRange(range));
				}
			}
		}
	}

	updateHighlightsShownFlag () {
		this.#bar.classList.toggle(EleClass.HIGHLIGHTS_SHOWN, this.#controlsInfo.highlightsShown);
	}

	updateVisibility () {
		this.#bar.classList.toggle(EleClass.DISABLED, !this.#controlsInfo.pageModifyEnabled);
	}

	updateCollapsed () {
		this.#bar.classList.toggle(EleClass.COLLAPSED, this.#controlsInfo.barCollapsed);
	}

	toggleHidden (force?: boolean) {
		this.#bar.classList.toggle(EleClass.BAR_HIDDEN, force);
	}

	updateControlVisibility (controlName: ControlButtonName) {
		this.#controls[controlName].updateVisibility();
	}

	createAndInsertControl (
		controlName: Exclude<ControlButtonName, "appendTerm">,
		barSide: Exclude<ToolbarSection, ToolbarSection.TERMS>,
	): Control {
		const info = this.createControlButtonInfo(controlName);
		const control = new Control(controlName, info, this.#controlsInfo, this.#doPhrasesMatchTerms);
		control.appendTo(this.#sections[barSide]);
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
			onClick: () => {
				controlsInfo.barCollapsed = !controlsInfo.barCollapsed;
				sendBackgroundMessage({
					toggle: {
						barCollapsedOn: controlsInfo.barCollapsed,
					},
				});
				this.updateCollapsed();
			},
		}; case "disableTabResearch": return {
			path: "/icons/close.svg",
			onClick: () => sendBackgroundMessage({
				deactivateTabResearch: true,
			}),
		}; case "performSearch": return {
			path: "/icons/search.svg",
			onClick: () => sendBackgroundMessage({
				performSearch: true,
			}),
		}; case "toggleHighlights": return {
			path: "/icons/show.svg",
			onClick: () => sendBackgroundMessage({
				toggle: {
					highlightsShownOn: !controlsInfo.highlightsShown,
				},
			}),
		}; case "replaceTerms": return {
			path: "/icons/refresh.svg",
			onClick: () => {
				this.#termSetter.setTerms(controlsInfo.termsOnHold);
			},
		};}
	}

	insertIntoDocument () {
		if (!this.#bar.parentElement) {
			document.body.insertAdjacentElement("beforebegin", this.#bar);
		}
		if (!this.#scrollGutter.parentElement) {
			document.body.insertAdjacentElement("afterend", this.#scrollGutter);
		}
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

	setTargetIfValid (target: SelectionReturnTarget | null) {
		if (!target?.element || (target.element && target.element.closest(`#${EleID.BAR}`))) {
			return;
		}
		this.#target = target;
	}

	forgetTarget () {
		this.#target = null;
	}

	getTarget () {
		return this.#target;
	}
}

export { Toolbar };
