import type { BrowserCommands } from "/dist/modules/interface/toolbar/common.mjs";
import type { TermControlInputInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { ConfigBarControlsShown } from "/dist/modules/privileged/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type SelectionReturnTarget = Readonly<{
	element: HTMLElement | null
	selectionRanges: Array<Range> | null
}>

type ControlButtonName = keyof ConfigBarControlsShown

interface AbstractToolbar {
	readonly appendTerm: (term: MatchTerm, commands: BrowserCommands) => void

	readonly insertTerm: (term: MatchTerm, index: number, commands: BrowserCommands) => void

	readonly replaceTerm: (term: MatchTerm, termOld: MatchTerm | number) => void

	readonly replaceTerms: (terms: ReadonlyArray<MatchTerm>, commands: BrowserCommands) => void

	readonly removeTerm: (term: MatchTerm | number) => void

	/**
	 * Updates the look of the control to reflect whether or not its term currently occurs within the document.
	 */
	readonly updateTermStatus: (term: MatchTerm) => void

	readonly indicateTerm: (term: MatchTerm | null) => void

	readonly focusTermInput: (termIndex: number | null) => void

	readonly updateHighlightsShownFlag: () => void

	readonly updateVisibility: () => void

	readonly updateCollapsed: () => void

	readonly toggleHidden: (force?: boolean) => void

	readonly updateControlVisibility: (controlName: ControlButtonName) => void

	/**
	 * Inserts the toolbar and appropriate controls.
	 */
	readonly insertIntoDocument: () => void

	/**
	 * Removes the toolbar and appropriate controls.
	 */
	readonly remove: () => void
}

interface ToolbarTermControlInterface extends ToolbarTermInputInterface, ToolbarTermOptionListInterface {
	readonly getTermControlIndex: (control: TermControlInputInterface) => number | null

	readonly setAutofocusable: (autofocus: boolean) => void
}

interface ToolbarTermComponentInterface {
	readonly hasLastFocusedInput: () => boolean

	readonly markLastFocusedInput: (focus: EventTarget) => void

	readonly forgetLastFocusedInput: () => void

	readonly focusLastFocusedInput: () => void
}

interface ToolbarTermInputInterface extends ToolbarTermComponentInterface {
	readonly getTermCount: () => number

	readonly getTermControlIndex: (control: TermControlInputInterface) => number | null

	/**
	 * Focuses and selects the text of the input of the term specified. Note that focus causes a term input to be visible.
	 * @param termIndex The target term's index in the toolbar.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	readonly selectTermInput: (termIndex: number, shiftCaret?: "right" | "left") => void
}

interface ToolbarTermOptionListInterface extends ToolbarTermComponentInterface {}

interface ToolbarControlButtonInterface {}

export type {
	SelectionReturnTarget,
	ControlButtonName,
	AbstractToolbar,
	ToolbarTermControlInterface,
	ToolbarTermInputInterface,
	ToolbarTermOptionListInterface,
	ToolbarControlButtonInterface,
};
