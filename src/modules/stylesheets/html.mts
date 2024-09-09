/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractStylesheet } from "/dist/modules/stylesheet.d.mjs";
import { EleClass } from "/dist/modules/common.mjs";

class HTMLStylesheet implements AbstractStylesheet {
	readonly #stylesheet: HTMLStyleElement;
	
	constructor (parent: Node) {
		this.#stylesheet = document.createElement("style");
		this.#stylesheet.classList.add(EleClass.STYLESHEET);
		parent.appendChild(this.#stylesheet);
	}

	setStyle (style: string) {
		this.#stylesheet.textContent = style;
	}

	deactivate () {
		this.#stylesheet.remove();
	}
}

export { HTMLStylesheet };
