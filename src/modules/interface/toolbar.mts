import type { BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import type { TermAbstractControl, TermControlInputInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { ConfigBarControlsShown } from "/dist/modules/privileged/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type SelectionReturnTarget = Readonly<{
	element: HTMLElement | null
	selectionRanges: Array<Range> | null
}>

type ControlButtonName = keyof ConfigBarControlsShown

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

	indicateTerm: (term: MatchTerm | null) => void

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

export type {
	SelectionReturnTarget,
	ControlButtonName,
	AbstractToolbar,
	ToolbarTermControlInterface,
	ToolbarTermInputInterface,
	ToolbarControlButtonInterface,
};
