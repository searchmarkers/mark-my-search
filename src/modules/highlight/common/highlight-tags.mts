/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { getElementTagsSet } from "/dist/modules/common.mjs";
import type { HighlightTagName } from "/dist/modules/highlight/models/tree-edit/tags.mjs";

const HIGHLIGHT_TAG: HighlightTagName = "mms-h";

type HighlightTags = Readonly<{
	reject: ReadonlySet<string>
	flow: ReadonlySet<string>
}>

const highlightTags: HighlightTags = {
	reject: getElementTagsSet([
		"meta", "style", "script", "noscript", "title", "textarea",
	]),
	flow: getElementTagsSet([
		"b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins", HIGHLIGHT_TAG,
	]),
	// break: any other class of element
};

export {
	type HighlightTags,
	highlightTags,
};
