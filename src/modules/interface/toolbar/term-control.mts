import type { SelectionReturnTarget } from "/dist/modules/interface/toolbar.mjs";
import type { ControlFocusArea } from "/dist/modules/interface/toolbar/common.mjs";

interface TermAbstractControl extends TermControlInputInterface, TermControlOptionListInterface {
	getInputValue: () => string

	/**
	 * Focuses and selects the text of the control's input. Note that focus causes a term input to be visible.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	selectInput: (shiftCaret?: "right" | "left") => void

	focusInput: () => SelectionReturnTarget

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

export type {
	TermAbstractControl,
	TermControlComponentInterface,
	TermControlInputInterface,
	TermControlOptionListInterface,
};
