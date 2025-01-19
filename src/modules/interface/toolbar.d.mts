/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { TermControlInputInterface } from "/dist/modules/interface/toolbar/term-control.d.mjs";
import type { ConfigBarControlsShown } from "/dist/modules/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type SelectionReturnTarget = Readonly<{
	element: HTMLElement | null
	selectionRanges: Array<Range> | null
}>

type ControlButtonName = keyof ConfigBarControlsShown

interface AbstractToolbar {
	/**
	 * Updates the look of every term control, to reflect whether their terms currently occur within the document.
	 */
	readonly updateStatuses: () => void

	/**
	 * Updates the look of a term control, to reflect whether its term currently occurs within the document.
	 * @param term The control's term.
	 */
	readonly updateTermStatus: (term: MatchTerm) => void

	readonly indicateTerm: (term: MatchTerm | null) => void

	readonly focusTermInput: (termIndex: number | null) => void

	readonly isFocused: () => boolean
	
	readonly returnSelectionToDocument: () => void

	readonly updateHighlightsShownFlag: () => void

	readonly updateVisibility: () => void

	readonly updateCollapsed: () => void

	readonly toggleHidden: (force?: boolean) => void

	readonly updateControlVisibility: (controlName: ControlButtonName) => void

	/**
	 * Inserts the toolbar as a child or sibling of an element.
	 * @param element The element into which to insert the toolbar.
	 * @param position The target position, adjacent to the element provided.  
	 * "beforebegin" / "afterend" = previous/next sibling;  
	 * "afterbegin" / "beforeend" = first/last child.
	 */
	readonly insertAdjacentTo: (element: HTMLElement, position: InsertPosition) => void

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
