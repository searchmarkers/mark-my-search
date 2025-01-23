/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { sanitizeForRegex } from "/dist/modules/common.mjs";

type URLFilter = Array<Readonly<{
	hostname: string,
	pathname: string,
}>>

/**
 * Gets the URL filter array corresponding to an array of valid browser URLs.
 * @param urlStrings An array of valid URLs as strings.
 * @returns A URL filter array containing no wildcards which would filter in each of the URLs passed.
 */
const createUrlFilter = (urlStrings: ReadonlyArray<string>): URLFilter => (
	urlStrings.map(urlString => {
		try {
			const url = new URL(urlString
				.replace(/\s/g, "")
				.replace(/.*:\/\//g, "protocol://")
			);
			return {
				hostname: url.hostname,
				pathname: url.pathname,
			};
		} catch {
			return null;
		}
	}).filter(urlFilterPart => urlFilterPart !== null)
);

/**
 * Determines whether a URL is filtered in by a given URL filter.
 * @param url A URL object.
 * @param urlFilter A URL filter array, the component strings of which may contain wildcards.
 * @returns `true` if the URL is filtered in, `false` otherwise.
 */
const isUrlFilteredIn = (() => {
	const sanitize = (urlComponent: string) => (
		sanitizeForRegex(urlComponent).replace("\\*", ".*")
	);

	return (url: URL, urlFilter: URLFilter): boolean => (
		!!urlFilter.find(({ hostname, pathname }) => (
			(new RegExp(sanitize(hostname) + "\\b")).test(url.hostname)
			&& (pathname === ""
				|| pathname === "/"
				|| (new RegExp("\\b" + sanitize(pathname.slice(1)))).test(url.pathname.slice(1))
			)
		))
	);
})();

export {
	type URLFilter,
	createUrlFilter,
	isUrlFilteredIn,
};
