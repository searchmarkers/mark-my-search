/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/**
 * Represents the set of URLs used by a particular search site and how to extract the dynamic search query section.
 */
type SearchSite = Readonly<{
	hostname: string
} & (
	{
		pathname: [ string, string ]
	} | {
		param: string
	}
)>

const createSearchSite = (args: { dynamicUrl: string }): SearchSite => {
	const dynamicUrl = new URL(args.dynamicUrl);
	if (dynamicUrl.pathname.includes("%s")) {
		const parts = dynamicUrl.pathname.split("%s");
		return {
			hostname: dynamicUrl.hostname,
			pathname: [ parts[0], parts[1].slice(0, parts[1].endsWith("/") ? parts[1].length : undefined) ],
		};
	} else {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [ param, arg ] = (Array.from(dynamicUrl.searchParams))
			.find(param => param[1].includes("%s")) ?? [ "", "" ];
		return {
			hostname: dynamicUrl.hostname,
			param,
		};
	}
};

const searchSiteEquals = (a: SearchSite, b: SearchSite) => (
	a.hostname === b.hostname
	&& (
		("pathname" in a && "pathname" in b && a.pathname === b.pathname)
		|| ("param" in a && "param" in b && a.param === b.param)
	)
);

/**
 * Extracts the search query from a URL matching the pattern of this user search site.
 * @param urlString The string of a URL to extract from.
 * @param matchOnly Indicates whether to return an empty array if an array of phrases would otherwise be returned.
 * @returns An array of the phrases extracted from the URL dynamic query section, or null if the URL does not match the site.
 */
const extractSearchPhrases = (urlString: string, searchSite: SearchSite, matchOnly = false): ReadonlyArray<string> | null => {
	// TODO generalise functionality? Allow for phrase groups?
	const url = new URL(urlString);
	if (url.hostname !== searchSite.hostname) {
		return null;
	}
	if ("pathname" in searchSite) {
		if (
			url.pathname.startsWith(searchSite.pathname[0])
			&& url.pathname.slice(searchSite.pathname[0].length).includes(searchSite.pathname[1])
		) {
			return matchOnly ? [] : url.pathname.slice(
				url.pathname.indexOf(searchSite.pathname[0]) + searchSite.pathname[0].length,
				url.pathname.lastIndexOf(searchSite.pathname[1])).split("+");
		}
		return null;
	} else {
		if (url.searchParams.has(searchSite.param)) {
			return matchOnly ? [] : (url.searchParams.get(searchSite.param) ?? "").split(" ");
		}
		return null;
	}
};

/**
 * Gets whether or not a URL matches the pattern of this user search site.
 * @param urlString The string of a URL to match.
 * @returns `true` if the URL string matches, `false` otherwise.
 */
const matches = (urlString: string, searchSite: SearchSite) => (
	extractSearchPhrases(urlString, searchSite, true) !== null
);

export {
	type SearchSite,
	createSearchSite,
	searchSiteEquals,
	extractSearchPhrases, matches,
};
