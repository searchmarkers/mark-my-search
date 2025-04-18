/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type {
	SelectionReturnTarget, ControlButtonName,
	AbstractToolbar,
	ToolbarControlButtonInterface, ToolbarTermControlInterface,
} from "/dist/modules/interface/toolbar.d.mjs";
import { ToolbarStyle } from "/dist/modules/interface/toolbar/style.mjs";
import { Control, type ControlButtonInfo } from "/dist/modules/interface/toolbar/control.mjs";
import type {
	TermAbstractControl, TermControlOptionListInterface,
} from "/dist/modules/interface/toolbar/term-control.d.mjs";
import { TermReplaceControl } from "/dist/modules/interface/toolbar/term-controls/replace.mjs";
import { TermAppendControl } from "/dist/modules/interface/toolbar/term-controls/append.mjs";
import type { ControlFocusArea, BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import { EleID, EleClass, getControlPadClass, passKeyEvent } from "/dist/modules/interface/toolbar/common.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import type { ArrayAccessor, ArrayMutator, ArrayMutation, ArrayObservable } from "/dist/modules/common.mjs";
import { EleID as CommonEleID, EleClass as CommonEleClass } from "/dist/modules/common.mjs";
import type { HighlighterCSSInterface } from "/dist/modules/highlight/engine.d.mjs";
import type {
	HighlighterCounterInterface, HighlighterWalkerInterface,
} from "/dist/modules/highlight/engine-manager.d.mjs";
import type { ControlsInfo } from "/dist/content.mjs";

enum ToolbarSection { LEFT, TERMS, RIGHT }

class Toolbar implements AbstractToolbar, ToolbarTermControlInterface, ToolbarControlButtonInterface {
	readonly #controlsInfo: ControlsInfo;
	readonly #commands: BrowserCommands; // TODO: Make commands data passing more consistent.
	readonly #termsBox: ArrayAccessor<MatchTerm> & ArrayMutator<MatchTerm>;
	readonly #termTokens: TermTokens;
	readonly #highlighter: HighlighterCSSInterface & HighlighterCounterInterface & HighlighterWalkerInterface;

	static readonly #sectionNames = [ ToolbarSection.LEFT, ToolbarSection.TERMS, ToolbarSection.RIGHT ] as const;

	readonly #style: ToolbarStyle;
	readonly #barContainer: HTMLElement;
	readonly #bar: HTMLElement;
	readonly #sections: Readonly<Record<ToolbarSection, HTMLElement>>;
	readonly #controls: Readonly<Record<ControlButtonName, Control>>;
	readonly #termControls: Array<TermReplaceControl> = [];
	readonly #termAppendControl: TermAppendControl;

	readonly #selectionReturn = new ToolbarSelectionReturnManager();
	#indicatedClassToken: string | null = null;

	readonly #hues: ReadonlyArray<number> = [];

	constructor (
		hues: ReadonlyArray<number>,
		commands: BrowserCommands,
		controlsInfo: ControlsInfo,
		termsBox: ArrayAccessor<MatchTerm> & ArrayMutator<MatchTerm> & ArrayObservable<MatchTerm>,
		termTokens: TermTokens,
		highlighter: HighlighterCSSInterface & HighlighterCounterInterface & HighlighterWalkerInterface,
	) {
		this.#hues = hues;
		this.#termsBox = termsBox;
		this.#controlsInfo = controlsInfo;
		this.#commands = commands;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		this.#barContainer = document.createElement("div");
		this.#barContainer.id = CommonEleID.BAR;
		this.#barContainer.style.cssText = "all: revert !important;";
		const shadowRoot = this.#barContainer.attachShadow({
			mode: "closed",
			delegatesFocus: false,
		});
		this.#style = new ToolbarStyle(shadowRoot, this.#termTokens, this.#highlighter);
		this.#style.applyStyle();
		this.#style.updateStyle(controlsInfo.barLook);
		this.#bar = document.createElement("div");
		this.#bar.id = EleID.BAR;
		shadowRoot.append(this.#bar);
		this.updateHighlightsShownFlag();
		this.updateVisibility();
		this.updateCollapsed();
		// Inputs should not be focusable unless user has already focused bar. (1)
		const inputsSetFocusable = (focusable: boolean) => {
			const inputs = this.#bar.querySelectorAll<HTMLInputElement>(`input.${EleClass.CONTROL_INPUT}`);
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
			if (!(event.relatedTarget instanceof Node) || !this.#bar.contains(event.relatedTarget)) {
				if (this.hasLastFocusedInput()) {
					if (!this.#bar.classList.contains(EleClass.BAR_NO_AUTOFOCUS)) {
						this.focusLastFocusedInput();
					}
				} else {
					this.onFocusOut(event.relatedTarget);
					inputsSetFocusable(false);
				}
			}
		});
		this.#bar.addEventListener("pointerdown", event => {
			if (event.target instanceof Node && this.#bar.contains(event.target)) {
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
			[ToolbarSection.LEFT]: document.createElement("span"),
			[ToolbarSection.TERMS]: document.createElement("span"),
			[ToolbarSection.RIGHT]: document.createElement("span"),
		};
		this.#sections[ToolbarSection.LEFT].id = EleID.BAR_LEFT;
		this.#sections[ToolbarSection.LEFT].classList.add(EleClass.BAR_CONTROLS);
		this.#sections[ToolbarSection.TERMS].id = EleID.BAR_TERMS;
		this.#sections[ToolbarSection.RIGHT].id = EleID.BAR_RIGHT;
		this.#sections[ToolbarSection.RIGHT].classList.add(EleClass.BAR_CONTROLS);
		for (const sectionName of Toolbar.#sectionNames) {
			this.#bar.appendChild(this.#sections[sectionName]);
		}
		this.#termAppendControl = new TermAppendControl(controlsInfo, this, termsBox);
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
				this.#termAppendControl.appendTo(this.#sections[ToolbarSection.RIGHT]);
				return this.#termAppendControl.control;
			})(),
			replaceTerms: (
				this.createAndInsertControl("replaceTerms", ToolbarSection.RIGHT)
			),
		};
		termsBox.addListener((terms, oldTerms, mutation) => {
			this.onTermsMutated(terms, mutation);
		});
		this.onTermsMutated(termsBox.getItems(), null);
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

	onTermsMutated (terms: ReadonlyArray<MatchTerm>, mutation: ArrayMutation<MatchTerm> | null) {
		switch (mutation?.type) {
		case "remove": {
			this.removeTerm(mutation.index);
			break;
		}
		case "replace": {
			this.replaceTerm(mutation.new, mutation.index);
			break;
		}
		case "insert": {
			this.insertTerm(mutation.new, mutation.index, this.#commands);
			break;
		}
		default: {
			this.replaceTerms(terms, this.#commands);
		}}
		this.updateControlVisibility("replaceTerms");
	}

	appendTerm (term: MatchTerm, commands: BrowserCommands) {
		this.#termControls.push(new TermReplaceControl(term,
			commands, this.#controlsInfo,
			this, this.#termsBox, this.#termTokens, this.#highlighter,
		));
		this.#style.applyTermStyle(term, this.#termControls.length - 1, this.#hues);
		this.refreshTermControls();
	}

	insertTerm (term: MatchTerm, index: number, commands: BrowserCommands) {
		this.#termControls.splice(index, 0, new TermReplaceControl(term,
			commands, this.#controlsInfo,
			this, this.#termsBox, this.#termTokens, this.#highlighter,
		));
		this.#style.applyTermStyle(term, index, this.#hues);
		this.refreshTermControls();
	}

	replaceTerm (term: MatchTerm, termOld: MatchTerm | number) {
		if (typeof termOld === "number") {
			this.#termControls[termOld].replaceTerm(term);
			this.#style.applyTermStyle(term, termOld, this.#hues);
		} else {
			const termToken = this.#termTokens.get(term);
			const index = this.#termControls.findIndex(control => control.getTermToken() === termToken);
			this.#termControls[index].replaceTerm(term);
			this.#style.applyTermStyle(term, index, this.#hues);
		}
	}

	// TODO ensure that focus is handled correctly
	replaceTerms (terms: ReadonlyArray<MatchTerm>, commands: BrowserCommands) {
		for (const termControl of this.#termControls) {
			this.#style.removeTermStyle(termControl.getTermToken());
		}
		this.#termControls.splice(0);
		for (const term of terms) {
			this.#termControls.push(new TermReplaceControl(term,
				commands, this.#controlsInfo,
				this, this.#termsBox, this.#termTokens, this.#highlighter,
			));
		}
		for (let i = 0; i < terms.length; i++) {
			this.#style.applyTermStyle(terms[i], i, this.#hues);
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

	updateStatuses () {
		for (const termControl of this.#termControls) {
			termControl.updateStatus();
		}
	}

	updateTermStatus (term: MatchTerm) {
		const termToken = this.#termTokens.get(term);
		this.#termControls.find(control => control.getTermToken() === termToken)?.updateStatus();
	}

	indicateTerm (term: MatchTerm | null) {
		if (this.#indicatedClassToken) {
			this.#sections[ToolbarSection.TERMS].classList.remove(this.#indicatedClassToken);
		}
		if (term) {
			const termToken = this.#termTokens.get(term);
			const termControl = this.#termControls.findIndex(control => control.getTermToken() === termToken);
			this.#indicatedClassToken = getControlPadClass(termControl);
			this.#sections[ToolbarSection.TERMS].classList.add(this.#indicatedClassToken);
		}
	}

	refreshTermControls () {
		this.#sections[ToolbarSection.TERMS].replaceChildren();
		for (const control of this.#termControls) {
			control.appendTo(this.#sections[ToolbarSection.TERMS]);
		}
		for (let i = 0; i < this.#termControls.length; i++) {
			this.#style.updateTermStyle(this.#termControls[i].getTermToken(), i, this.#hues);
		}
	}

	getTermCount (): number {
		return this.#termControls.length;
	}

	getTermControlIndex (control: TermControlOptionListInterface): number | null {
		const index = this.#termControls.indexOf(control as TermReplaceControl); // TODO improve this logic
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

	isFocused () {
		return !!document.activeElement && document.activeElement.id === CommonEleID.BAR as string;
	}

	returnSelectionToDocument () {
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

	onFocusOut (newFocus: EventTarget | null) {
		if (newFocus) {
			// Focus is being moved, not lost.
			setTimeout(() => {
				if (!this.isFocused()) {
					this.#selectionReturn.forgetTarget();
				}
			});
		} else {
			if (!this.isFocused()) {
				this.returnSelectionToDocument();
			}
		}
	}

	updateHighlightsShownFlag () {
		this.#barContainer.classList.toggle(CommonEleClass.HIGHLIGHTS_SHOWN, this.#controlsInfo.highlightsShown);
	}

	updateVisibility () {
		this.#bar.classList.toggle(EleClass.DISABLED, !this.#controlsInfo.pageModificationAllowed);
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
		const control = new Control(controlName, info, this.#controlsInfo, this.#termsBox);
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
					type: "commands",
					commands: [ {
						type: "toggleInTab",
						barCollapsedOn: controlsInfo.barCollapsed,
					} ],
				});
				this.updateCollapsed();
			},
		};
		case "disableTabResearch": return {
			path: "/icons/close.svg",
			onClick: () => sendBackgroundMessage({
				type: "commands",
				commands: [ {
					type: "deactivateTabResearch",
				} ],
			}),
		};
		case "performSearch": return {
			path: "/icons/search.svg",
			onClick: () => sendBackgroundMessage({
				type: "commands",
				commands: [ {
					type: "performTabSearch",
				} ],
			}),
		};
		case "toggleHighlights": return {
			path: "/icons/show.svg",
			onClick: () => sendBackgroundMessage({
				type: "commands",
				commands: [ {
					type: "toggleInTab",
					highlightsShownOn: !controlsInfo.highlightsShown,
				} ],
			}),
		};
		case "replaceTerms": return {
			path: "/icons/refresh.svg",
			onClick: () => {
				this.#termsBox.setItems(controlsInfo.termsOnHold);
			},
		};
		}
	}

	insertAdjacentTo (element: HTMLElement, position: InsertPosition) {
		if (this.#barContainer.parentElement !== document.body.parentElement) {
			element.insertAdjacentElement(position, this.#barContainer);
		}
	}

	remove () {
		if (document.activeElement instanceof HTMLElement && this.#bar.contains(document.activeElement)) {
			 // Allow focus+selection to be properly restored.
			document.activeElement.blur();
		}
		this.#barContainer.remove();
	}
}

class ToolbarSelectionReturnManager {
	#target: SelectionReturnTarget | null = null;

	setTargetIfValid (target: SelectionReturnTarget | null) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
		if (!target?.element || target.element.id === CommonEleID.BAR) {
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
