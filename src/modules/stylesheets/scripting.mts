/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractStylesheet } from "/dist/modules/stylesheet.d.mjs";

// TODO backend implementation

class ScriptingStylesheet implements AbstractStylesheet {
	static #count = 0;

	readonly #id = ScriptingStylesheet.#count++;
	
	#style = "";

	constructor () {
		chrome.runtime.sendMessage({
			style: {
				type: "create",
				sheetId: this.#id,
			},
		});
	}

	setStyle (style: string) {
		if (this.#style === style) {
			return;
		}
		chrome.runtime.sendMessage({
			style: {
				type: "update",
				sheetId: this.#id,
				old: this.#style,
				new: style,
			},
		});
		this.#style = style;
	}

	deactivate () {
		chrome.runtime.sendMessage({
			style: {
				type: "delete",
				sheetId: this.#id,
			},
		});
		this.#style = "";
	}
}

export { ScriptingStylesheet };
