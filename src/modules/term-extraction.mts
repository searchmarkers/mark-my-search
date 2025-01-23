/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { MatchTerm } from "/dist/modules/match-term.mjs";

/**
 * Extracts terms from the currently user-selected string.
 * @returns The extracted terms, split at some separator and some punctuation characters,
 * with some other punctuation characters removed.
 */
const getTermsFromSelectedText = (text: string): ReadonlyArray<MatchTerm> => (
	Array.from(new Set((() => {
		if (/\p{Open_Punctuation}|\p{Close_Punctuation}|\p{Initial_Punctuation}|\p{Final_Punctuation}/u.test(text)) {
			// If there are brackets or quotes, we just assume it's too complicated to sensibly split up for now.
			// TODO make this behaviour smarter?
			return [ text ];
		} else {
			return text.split(/\n+|\r+|\p{Other_Punctuation}\p{Space_Separator}+|\p{Space_Separator}+/gu);
		}
	})()
		.map(phrase => phrase.replace(/\p{Other}/gu, ""))
		.filter(phrase => phrase !== "")
	))).map(phrase => new MatchTerm(phrase)
);

export { getTermsFromSelectedText };
