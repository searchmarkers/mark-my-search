/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/**
 * Converts an attribute name into its fully-qualified form.
 * @param name The simple name of the attribute, with no colon.
 * @returns `{namespace}:{name}`, where `{namespace}` is our attribute namespace.
 */
const getAttributeName = (name: string) => "markmysearch--" + name;

const highlightingIdAttr = getAttributeName("highlighting-id");

class HighlightingIdGenerator {
	#count = 0;

	getNextId (): number {
		return this.#count++;
	}
}

export {
	getAttributeName, highlightingIdAttr,
	HighlightingIdGenerator,
};
