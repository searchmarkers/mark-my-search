/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractStylesheet } from "/dist/modules/stylesheet.mjs";

class HTMLStylesheet implements AbstractStylesheet {
	readonly #stylesheet = document.createElement("style");
	
	constructor (parent: Node) {
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
