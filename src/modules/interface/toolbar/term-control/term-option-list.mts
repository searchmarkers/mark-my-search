import type { TermControlOptionListInterface } from "/dist/modules/interface/toolbar/term-control.mjs";
import type { ToolbarTermOptionListInterface } from "/dist/modules/interface/toolbar.mjs";
import { getMatchModeOptionClass, getInputIdSequential } from "/dist/modules/interface/toolbar/common.mjs";
import type { MatchMode } from "/dist/modules/match-term.mjs";
import { EleClass } from "/dist/modules/common.mjs";
import type { ControlsInfo } from "/dist/content.mjs";

class TermOptionList {
	readonly #controlsInfo: ControlsInfo;
	readonly #controlInterface: TermControlOptionListInterface;
	readonly #toolbarInterface: ToolbarTermOptionListInterface;

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
		toolbarInterface: ToolbarTermOptionListInterface,
	) {
		this.#controlsInfo = controlsInfo;
		this.#controlInterface = controlInterface;
		this.#toolbarInterface = toolbarInterface;
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
					if (option.title.toLowerCase()[0] === event.key) {
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
			console.log(newFocus);
			if (this.#optionList.contains(newFocus)) {
				return;
			}
			for (const option of options) {
				option.makeFocusable(false);
			}
			if (newFocus?.classList.contains(EleClass.CONTROL_REVEAL)) {
				this.close(false);
			} else {
				this.close(true);
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
			if (this.isOpen()) {
				this.#optionList.dataset.mousedownClosed = "";
				this.close(true);
			}
		});
		button.addEventListener("click", () => {
			if ("mousedownClosed" in this.#optionList.dataset) {
				delete this.#optionList.dataset.mousedownClosed;
			} else {
				this.open();
			}
		});
		button.addEventListener("mouseleave", () => {
			delete this.#optionList.dataset.mousedownClosed;
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
		checkbox.addEventListener("change", () => {
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
			// Prevent the menu from perceiving a loss in focus (and closing) the second time an option is clicked.
			// TODO why does that happen?
			event.preventDefault();
		});
		option.addEventListener("mouseup", () => {
			if (!option.closest(`.${EleClass.MENU_OPEN}`)) {
				// For when the user 'pulls down' the menu and releases over the option.
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

	close (focusMenuOpener: boolean) {
		if (focusMenuOpener) {
			this.#toolbarInterface.focusMenuOpener();
		}
		this.#controlInterface.classListToggle(EleClass.MENU_OPEN, false);
	}
	
	isOpen (): boolean {
		return this.#controlInterface.classListContains(EleClass.MENU_OPEN);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#optionList);
	}
}

export { TermOptionList };
