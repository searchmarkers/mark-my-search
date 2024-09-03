/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractStylesheet } from "/dist/modules/stylesheet.mjs";

class StyleManager<Variables extends { [K in string]: string | number }> {
	#stylesheet: AbstractStylesheet;
	#variables: {
		selector: string,
		values: Variables,
		stylesheet: AbstractStylesheet,
	} | null = null;
	
	constructor (
		stylesheet: AbstractStylesheet,
		variables?: { selector: string, defaults: Variables, stylesheet: AbstractStylesheet },
	) {
		this.#stylesheet = stylesheet;
		if (variables) {
			this.#variables = {
				selector: variables.selector,
				values: variables.defaults,
				stylesheet: variables.stylesheet,
			};
			this.setVariables(variables.defaults);
		}
	}

	setStyle (style: string) {
		this.#stylesheet.setStyle(style);
	}

	setVariables (variableValues: Partial<Variables>) {
		const variables = this.#variables;
		if (!variables) {
			return;
		}
		Object.assign(variables.values, variableValues);
		let style = `${variables.selector} {\n`;
		for (const [ key, value ] of Object.entries(variables.values)) {
			style += `\t${key}: ${value};\n`;
		}
		style += "}";
		variables.stylesheet.setStyle(style);
	}

	deactivate () {
		this.#stylesheet.deactivate();
		this.#variables?.stylesheet.deactivate();
	}
}

export { StyleManager };
