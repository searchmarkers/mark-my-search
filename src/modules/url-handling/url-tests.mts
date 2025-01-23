/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { isUrlFilteredIn } from "/dist/modules/url-handling/url-filters.mjs";
import type { ConfigValues } from "/dist/modules/storage.mjs";

/**
 * Determines whether the user has permitted pages with the given URL to be deeply modified during highlighting,
 * which is powerful but may be destructive.
 * @param urlString The valid URL string corresponding to a page to be potentially highlighted.
 * @param urlFilter URL filter preferences.
 * @returns `true` if the corresponding page may be modified, `false` otherwise.
 */
const isUrlPageModificationAllowed = (urlString: string, urlFilter: ConfigValues["urlFilters"]["noPageModify"]): boolean => {
	try {
		return !isUrlFilteredIn(new URL(urlString), urlFilter);
	} catch {
		// We default to allowing page modification.
		return true;
	}
};

/**
 * Determines whether the user has permitted pages with the given URL to treated as a search site,
 * from which keywords may be collected.
 * @param urlString The valid URL string corresponding to a page to be potentially auto-highlighted.
 * @param urlFilter An object of details about URL filtering.
 * @returns `true` if the corresponding page may be treated as a search site, `false` otherwise.
 */
const isUrlAutoFindAllowed = (urlString: string, urlFilter: ConfigValues["urlFilters"]["nonSearch"]): boolean => {
	try {
		return !isUrlFilteredIn(new URL(urlString), urlFilter);
	} catch {
		// It doesn't make sense to allow extracting search terms from an invalid URL.
		return false;
	}
};

export {
	isUrlPageModificationAllowed,
	isUrlAutoFindAllowed,
};
