import type { TermControlInputInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { SelectionReturnTarget, ToolbarTermInputInterface } from "/dist/modules/interface/toolbar.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

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

export { TermInput };
