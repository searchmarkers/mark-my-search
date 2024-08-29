import type { TermControlInputInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { SelectionReturnTarget, ToolbarTermInputInterface } from "/dist/modules/interface/toolbar.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

class TermInput {
	readonly #controlInterface: TermControlInputInterface;
	readonly #toolbarInterface: ToolbarTermInputInterface;
	
	readonly #input: HTMLInputElement;

	#term: MatchTerm | null = null;

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
		const focusOnEvent = (event: MouseEvent) => {
			event.preventDefault();
			this.select();
		};
		if (controlElements.type === "replace") {
			controlElements.editButton.addEventListener("click", event => {
				if (inputSize) { // Input is shown; currently a delete button.
					input.value = "";
					controlInterface.commit();
					this.unfocus();
				} else { // Input is hidden; currently an edit button.
					focusOnEvent(event);
				}
			});
			controlElements.editButton.addEventListener("contextmenu", event => {
				event.preventDefault();
				input.value = "";
				controlInterface.commit();
				this.unfocus();
			});
			controlElements.content.addEventListener("contextmenu", focusOnEvent);
		} else if (controlElements.type === "append") {
			controlElements.button.addEventListener("click", focusOnEvent);
			controlElements.button.addEventListener("contextmenu", focusOnEvent);
		}
		new ResizeObserver(entries => {
			entries.forEach(entry => {
				if (entry.contentRect.width === 0) {
					this.unfocus();
				}
			});
		}).observe(input);
		input.addEventListener("focus", () => {
			toolbarInterface.forgetLastFocusedInput();
		});
		input.addEventListener("blur", event => {
			if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest(`#${EleID.BAR}`)) {
				toolbarInterface.markLastFocusedInput(input);
			}
		});
		input.addEventListener("keydown", event => {
			if (event.key === "Tab") {
				return; // Must be caught by the bar to be handled independently.
			}
			event.stopPropagation();
			switch (event.key) {
			case "Enter": {
				if (event.shiftKey) {
					this.unfocus();
				} else {
					controlInterface.commit();
				}
				return;
			}
			case "Escape": {
				this.resetValue();
				this.unfocus();
				return;
			}
			case "ArrowLeft":
			case "ArrowRight": {
				this.tryShiftTermFocus((event.key === "ArrowRight") ? "right" : "left", () => event.preventDefault());
				return;
			}
			case "ArrowUp":
			case "ArrowDown": {
				this.tryShiftTermFocus((event.key === "ArrowUp") ? 0 : toolbarInterface.getTermCount(), () => event.preventDefault());
				return;
			}
			case " ": {
				if (event.shiftKey) {
					event.preventDefault();
					input.classList.add(EleClass.LAST_FOCUSED);
					controlInterface.openOptionList();
				}
				return;
			}}
		});
		let inputSize = 0;
		new ResizeObserver(entries => {
			const inputSizeNew = entries[0]?.contentBoxSize[0]?.inlineSize ?? 0;
			if (inputSizeNew !== inputSize && inputSizeNew === 0) {
				controlInterface.commit();
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
		const index = this.#toolbarInterface.getTermControlIndex(this.#controlInterface)
			?? this.#toolbarInterface.getTermCount();
		if (index === null
			|| this.#input.selectionStart !== this.#input.selectionEnd
			|| this.#input.selectionStart !== ((shiftTarget === "left" || shiftTarget === 0) ? 0 : this.#input.value.length)
		) {
			return;
		}
		onBeforeShift();
		const targetIndex = typeof shiftTarget === "number" ? shiftTarget : (index + (shiftTarget === "right" ? 1 : -1));
		if (index === targetIndex || targetIndex === -1 || targetIndex > this.#toolbarInterface.getTermCount()) {
			this.#controlInterface.commit();
		} else {
			this.#toolbarInterface.selectTermInput(
				targetIndex,
				typeof shiftTarget === "string"
					? (shiftTarget === "left" ? "right" : "left")
					: (shiftTarget === 0 ? "right" : "left"),
			);
		}
	}

	setTerm (term: MatchTerm) {
		this.#term = term;
		this.resetValue();
	}

	getValue (): string {
		return this.#input.value;
	}

	resetValue () {
		this.#input.value = this.#term?.phrase ?? "";
	}

	/**
	 * Focuses and selects the text of the input. Note that focus causes a term input to be visible.
	 * @param shiftCaret If supplied, whether to shift the caret to the "right" or the "left". If unsupplied, all text is selected.
	 */
	select (shiftCaret?: "right" | "left"): SelectionReturnTarget | null {
		const returnTarget = document.activeElement !== this.#input ? this.focus() : null;
		if (shiftCaret) {
			const caretPosition = shiftCaret === "left" ? 0 : -1;
			this.#input.setSelectionRange(caretPosition, caretPosition);
		} else {
			this.#input.select();
		}
		return returnTarget;
	}

	focus (): SelectionReturnTarget {
		const activeElementOriginal = document.activeElement as HTMLElement;
		const selection = getSelection();
		const selectionRangesOriginal = selection && Array(selection.rangeCount).fill(null).map((v, i) => selection.getRangeAt(i));
		this.#input.focus();
		return {
			element: activeElementOriginal,
			selectionRanges: selectionRangesOriginal,
		};
	}

	unfocus () {
		this.#input.blur();
	}

	hasFocus (): boolean {
		return document.activeElement === this.#input;
	}

	isEventTarget (target: EventTarget): boolean {
		return this.#input === target;
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

export { TermInput };
