/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { SelectionReturnTarget } from "/dist/modules/interface/toolbar.mjs";
import type { ControlFocusArea } from "/dist/modules/interface/toolbar/common.mjs";

interface TermAbstractControl extends TermControlInputInterface, TermControlOptionListInterface {
	readonly getInputValue: () => string

	readonly inputIsLastFocused: () => boolean

	readonly markInputAsLastFocused: (value: boolean) => void

	readonly inputIsEventTarget: (target: EventTarget) => boolean

	/**
	 * Focuses and selects the text of the control's input. Note that focus causes a term input to be visible.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	readonly selectInput: (shiftCaret?: "right" | "left") => void

	readonly focusInput: () => SelectionReturnTarget

	readonly unfocusInput: () => void

	readonly getFocusArea: () => ControlFocusArea

	readonly appendTo: (parent: HTMLElement) => void
}

interface TermControlComponentInterface {
	readonly commit: (inputValue?: string) => void

	readonly classListToggle: (token: string, force?: boolean) => boolean

	readonly classListContains: (token: string) => boolean
}

interface TermControlInputInterface extends TermControlComponentInterface {
	readonly openOptionList: () => void
}

interface TermControlOptionListInterface extends TermControlComponentInterface {}

export type {
	TermAbstractControl,
	TermControlComponentInterface,
	TermControlInputInterface,
	TermControlOptionListInterface,
};
