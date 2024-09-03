/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { ControlButtonName } from "/dist/modules/interface/toolbar.mjs";
import { EleClass, getControlClass } from "/dist/modules/interface/toolbar/common.mjs";
import type { DoPhrasesMatchTerms, ControlsInfo } from "/dist/content.mjs";

type ControlButtonInfo = Readonly<{
	controlClasses?: Array<EleClass>
	buttonClasses?: Array<EleClass>
	path?: string
	pathSecondary?: string
	label?: string
	onClick?: () => void
	setUp?: (container: HTMLElement) => void
}>

class Control {
	readonly #controlsInfo: ControlsInfo;
	readonly #doPhrasesMatchTerms: DoPhrasesMatchTerms;

	readonly #control: HTMLElement;
	// TODO do not expose this; remove attribute
	readonly button: HTMLButtonElement;

	readonly #name: ControlButtonName;

	/**
	 * Creates a control.
	 * @param name The key for the control.
	 * @param info Dynamic details used in creating the control.
	 */
	constructor (
		name: ControlButtonName,
		info: ControlButtonInfo,
		controlsInfo: ControlsInfo,
		doPhrasesMatchTerms: DoPhrasesMatchTerms,
	) {
		this.#controlsInfo = controlsInfo;
		this.#doPhrasesMatchTerms = doPhrasesMatchTerms;
		this.#name = name;
		this.#control = document.createElement("span");
		this.#control.classList.add(EleClass.CONTROL, getControlClass(name));
		(info.controlClasses ?? []).forEach(elementClass =>
			this.#control.classList.add(elementClass)
		);
		this.#control.tabIndex = -1;
		const pad = document.createElement("span");
		pad.classList.add(EleClass.CONTROL_PAD);
		pad.tabIndex = -1;
		const button = document.createElement("button");
		button.type = "button";
		button.classList.add(EleClass.CONTROL_BUTTON);
		button.tabIndex = -1;
		if (info.buttonClasses) {
			info.buttonClasses.forEach(className => {
				button.classList.add(className);
			});
		}
		if (info.path) {
			const image = document.createElement("img");
			if (info.pathSecondary) {
				image.classList.add(EleClass.PRIMARY);
			}
			image.src = chrome.runtime.getURL(info.path);
			image.draggable = false;
			button.appendChild(image);
		}
		if (info.pathSecondary) {
			// TODO make function
			const image = document.createElement("img");
			image.classList.add(EleClass.SECONDARY);
			image.src = chrome.runtime.getURL(info.pathSecondary);
			image.draggable = false;
			button.appendChild(image);
		}
		if (info.label) {
			const text = document.createElement("span");
			text.tabIndex = -1;
			text.textContent = info.label;
			button.appendChild(text);
		}
		pad.appendChild(button);
		this.button = button;
		this.#control.appendChild(pad);
		//if (hideWhenInactive) {
		if (!controlsInfo.barControlsShown[name]) {
			this.#control.classList.add(EleClass.DISABLED);
		}
		if (info.onClick) {
			button.addEventListener("click", info.onClick);
		}
		if (info.setUp) {
			info.setUp(this.#control);
		}
	}

	updateVisibility () {
		const value = this.#controlsInfo.barControlsShown[this.#name];
		if (this.#name === "replaceTerms") {
			const shown = (value
				&& this.#controlsInfo.termsOnHold.length > 0
				&& !this.#doPhrasesMatchTerms(this.#controlsInfo.termsOnHold.map(term => term.phrase))
			);
			this.#control.classList.toggle(EleClass.DISABLED, !shown);
		} else {
			this.#control.classList.toggle(EleClass.DISABLED, !value);
		}
	}

	classListToggle (token: string, force?: boolean) {
		return this.#control.classList.toggle(token, force);
	}

	classListContains (token: string) {
		return this.#control.classList.contains(token);
	}

	appendTo (parent: HTMLElement) {
		parent.appendChild(this.#control);
	}
}

export {
	type ControlButtonInfo,
	Control,
};
