import type { TermControlOptionListInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import { getMatchModeOptionClass, getInputIdSequential } from "/dist/modules/interface/toolbar/common.mjs";
import type { MatchMode } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";
import type { ControlsInfo } from "/dist/content.mjs";

class TermOptionList {
	readonly #controlsInfo: ControlsInfo;
	readonly #controlInterface: TermControlOptionListInterface;

	readonly #optionList: HTMLElement;
	readonly #checkboxes: Array<HTMLInputElement> = [];

	#matchMode: MatchMode;
	
	/**
	 * Creates a menu structure containing clickable elements to individually toggle the matching options for the term.
	 * @param controlsInfo Details of controls being inserted.
	 * @param onActivated A function, taking the identifier for a match option, to execute each time the option is activated.
	 * @returns The resulting menu element.
	 */
	constructor (
		onActivated: (matchType: string, checked: boolean) => void,
		matchMode: Readonly<MatchMode>,
		controlsInfo: ControlsInfo,
		controlInterface: TermControlOptionListInterface,
	) {
		this.#controlsInfo = controlsInfo;
		this.#controlInterface = controlInterface;
		this.#matchMode = matchMode;
		this.#optionList = document.createElement("span");
		this.#optionList.classList.add(EleClass.OPTION_LIST);
		const options = (() => {
			const options: Array<keyof MatchMode> = [ "case", "whole", "stem", "diacritics", "regex" ];
			return options.map(matchType => {
				const titles: Record<keyof MatchMode, string> = {
					case: "Case Sensitive",
					whole: "Whole Word",
					stem: "Stem Word",
					diacritics: "Diacritics Sensitive",
					regex: "Regex Mode",
				};
				const title = titles[matchType];
				const { optionElement, checkbox, toggle, makeFocusable } = this.createOption(matchType, title, onActivated);
				this.#optionList.appendChild(optionElement);
				this.#checkboxes.push(checkbox);
				return {
					matchType,
					title,
					toggle,
					makeFocusable,
				};
			});
		})();
		const stopKeyEvent = (event: KeyboardEvent) => {
			event.stopPropagation();
			if (event.key === "Tab") {
				return;
			}
			event.preventDefault();
		};
		const handleKeyEvent = (event: KeyboardEvent) => {
			stopKeyEvent(event);
			if (event.key === "Escape") {
				this.close(true);
			} else if (event.key.startsWith("Arrow")) {
				if (event.key === "ArrowUp" || event.key === "ArrowDown") {
					const down = event.key === "ArrowDown";
					const checkboxes = this.#checkboxes;
					let index = checkboxes.findIndex(checkbox => checkbox === document.activeElement);
					if (index === -1) {
						index = down ? 0 : (checkboxes.length - 1);
					} else {
						index = (index + (down ? 1 : -1) + checkboxes.length) % checkboxes.length;
					}
					checkboxes[index].focus();
				} else {
					// TODO move to the menu of the next term
				}
			} else if (/\b\w\b/.test(event.key)) {
				options.some(option => {
					if (option.title.toLowerCase().startsWith(event.key)) {
						option.toggle();
						return true;
					}
					return false;
				});
				this.close(true);
			}
		};
		this.#optionList.addEventListener("keydown", handleKeyEvent);
		this.#optionList.addEventListener("keyup", stopKeyEvent);
		this.#optionList.addEventListener("focusin", () => {
			options.forEach(option => option.makeFocusable(true));
		});
		this.#optionList.addEventListener("focusout", event => {
			this.#optionList.removeAttribute("tabindex");
			const newFocus = event.relatedTarget as Element | null;
			if (this.#optionList.contains(newFocus)) {
				return;
			}
			options.forEach(option => option.makeFocusable(false));
			if (newFocus?.classList.contains(EleClass.CONTROL_REVEAL)) {
				this.close(false);
			} else {
				this.close(true);
				controlInterface.forgetToolbarOpenedMenu();
			}
		});
	}

	createRevealButton (): HTMLButtonElement {
		const button = document.createElement("button");
		button.type = "button";
		button.classList.add(EleClass.CONTROL_BUTTON, EleClass.CONTROL_REVEAL);
		button.tabIndex = -1;
		button.disabled = !this.#controlsInfo.barLook.showRevealIcon;
		button.addEventListener("mousedown", () => {
			// If menu was open, it is about to be "just closed" because the mousedown will close it.
			// If menu was closed, remove "just closed" class if present.
			this.#controlInterface.classListToggle(
				EleClass.MENU_JUST_CLOSED_BY_BUTTON, // *just closed "by button"* because this class is only applied here.
				this.#controlInterface.classListContains(EleClass.MENU_OPEN),
			);
			this.close(true);
			this.#controlInterface.forgetToolbarOpenedMenu();
		});
		button.addEventListener("click", () => {
			if (this.#controlInterface.classListContains(EleClass.MENU_JUST_CLOSED_BY_BUTTON)) {
				return;
			}
			this.open();
		});
		const image = document.createElement("img");
		image.src = chrome.runtime.getURL("/icons/reveal.svg");
		image.draggable = false;
		button.appendChild(image);
		return button;
	}

	/**
	 * Creates a clickable element to toggle one of the matching options for the term.
	 * @param matchType The match type of this option.
	 * @param text Text content for the option, which is also used to determine the matching mode it controls.
	 * @param onActivated A function, taking the identifier for the match option, to execute each time the option is activated.
	 * @returns The resulting option element.
	 */
	createOption (
		matchType: keyof MatchMode,
		text: string,
		onActivated: (matchType: string, checked: boolean) => void,
	) {
		const option = document.createElement("label");
		option.classList.add(EleClass.OPTION, getMatchModeOptionClass(matchType));
		const id = getInputIdSequential();
		option.htmlFor = id;
		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.id = id;
		checkbox.checked = this.#matchMode[matchType];
		checkbox.tabIndex = -1;
		// TODO is this the correct event to use? should "change" be used instead?
		checkbox.addEventListener("click", () => {
			onActivated(matchType, checkbox.checked);
		});
		checkbox.addEventListener("keydown", event => {
			if (event.key === " ") {
				checkbox.click(); // Why is this not happening by default anyway?
				event.preventDefault();
			}
		});
		const label = document.createElement("span");
		label.textContent = text;
		option.addEventListener("mousedown", event => {
			event.preventDefault(); // Prevent the menu from perceiving a loss in focus (and closing) the second time an option is clicked.
		});
		option.addEventListener("mouseup", () => {
			if (!option.closest(`.${EleClass.MENU_OPEN}`)) { // So that the user can "pulldown" the menu and release over an option.
				checkbox.click();
			}
		});
		option.appendChild(checkbox);
		option.appendChild(label);
		return {
			optionElement: option,
			checkbox,
			toggle: () => {
				checkbox.click();
			},
			makeFocusable: (focusable: boolean) => {
				if (focusable) {
					checkbox.removeAttribute("tabindex");
				} else {
					checkbox.tabIndex = -1;
				}
			},
		};
	}

	setMatchMode (matchMode: Readonly<MatchMode>) {
		this.#matchMode = matchMode;
	}

	/**
	 * Opens and focuses the menu of matching options, allowing the user to toggle matching modes.
	 */
	open () {
		this.#controlInterface.classListToggle(EleClass.MENU_OPEN, true);
		this.#optionList.tabIndex = 0;
		this.#optionList.focus();
	}

	close (moveFocus: boolean) {
		const input = document.querySelector(`#${EleID.BAR} .${EleClass.OPENED_MENU}`) as HTMLElement | null;
		if (input) {
			if (moveFocus) {
				input.focus();
			}
		} else if (moveFocus) {
			const focus = document.activeElement as HTMLElement | null;
			if (this.#optionList.contains(focus)) {
				focus?.blur();
			}
		}
		this.#controlInterface.classListToggle(EleClass.MENU_OPEN, false);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#optionList);
	}
}

export { TermOptionList };
