/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { CommandInfo } from "/dist/modules/utility.mjs";
import { CommandType } from "/dist/modules/utility.mjs";
import type { URLFilter } from "/dist/modules/storage.mjs";
import { StorageSession, storageGet } from "/dist/modules/storage.mjs";

chrome.tabs.query = !globalThis.browser ? chrome.tabs.query : browser.tabs.query as typeof chrome.tabs.query;
chrome.tabs.sendMessage = !globalThis.browser
	? chrome.tabs.sendMessage
	: browser.tabs.sendMessage as typeof chrome.tabs.sendMessage;
chrome.tabs.get = !globalThis.browser ? chrome.tabs.get : browser.tabs.get as typeof chrome.tabs.get;
chrome.search["search"] = !globalThis.browser
	? (options: { query: string, tabId: number }) =>
		chrome.search["query"]({ text: options.query, tabId: options.tabId }, () => undefined)
	: browser.search.search;
chrome.commands.getAll = !globalThis.browser ? chrome.commands.getAll : browser.commands.getAll;

/**
 * Represents the set of URLs used by a particular search engine and how to extract the dynamic search query section.
 */
export class Engine {
	// All appropriate attributes must be compared in `this.equals`
	hostname: string;
	pathname: [ string, string ];
	param: string;

	constructor (args?: { urlDynamicString: string }) {
		if (!args)
			return;
		const urlDynamic = new URL(args.urlDynamicString);
		this.hostname = urlDynamic.hostname;
		if (urlDynamic.pathname.includes("%s")) {
			const parts = urlDynamic.pathname.split("%s");
			this.pathname = [ parts[0], parts[1].slice(0, parts[1].endsWith("/") ? parts[1].length : undefined) ];
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [ param, arg ] = (Array.from(urlDynamic.searchParams as unknown as ArrayLike<string>))
				.find(param => param[1].includes("%s")) ?? [ "", "" ];
			this.param = param;
		}
	}

	/**
	 * Extracts the search query from a URL matching the pattern of this user search engine.
	 * @param urlString The string of a URL to extract from.
	 * @param matchOnly Indicates whether to return an empty array if an array of phrases would otherwise be returned.
	 * @returns An array of the phrases extracted from the URL dynamic query section, or null if the URL does not match the engine.
	 */
	extract (urlString: string, matchOnly = false): Array<string> | null {
		// TODO generalise functionality? Allow for phrase groups?
		const url = new URL(urlString);
		return url.hostname !== this.hostname ? null : this.pathname
			? url.pathname.startsWith(this.pathname[0]) && url.pathname.slice(this.pathname[0].length).includes(this.pathname[1])
				? matchOnly ? [] : url.pathname.slice(
					url.pathname.indexOf(this.pathname[0]) + this.pathname[0].length,
					url.pathname.lastIndexOf(this.pathname[1])).split("+")
				: null
			: url.searchParams.has(this.param)
				? matchOnly ? [] : (url.searchParams.get(this.param) ?? "").split(" ")
				: null;
	}

	/**
	 * Gets whether or not a URL matches the pattern of this user search engine.
	 * @param urlString The string of a URL to match.
	 * @returns `true` if the URL string matches, `false` otherwise.
	 */
	match (urlString: string) {
		return !!this.extract(urlString, true);
	}

	/**
	 * Compares this user search engine to another for strict equality of appropriate attributes.
	 * @param engine The other user search engine.
	 * @returns `true` if considered equal, `false` otherwise.
	 */
	equals (engine: Engine) {
		return engine.hostname === this.hostname
			&& engine.param === this.param
			&& engine.pathname === this.pathname;
	}
}

/**
 * Gets the URL filter array corresponding to an array of valid browser URLs.
 * @param urlStrings An array of valid URLs as strings.
 * @returns A URL filter array containing no wildcards which would filter in each of the URLs passed.
 */
export const getUrlFilter = (urlStrings: Array<string>): URLFilter =>
	urlStrings.map((urlString): URLFilter[0] => {
		try {
			const url = new URL(urlString.replace(/\s/g, "").replace(/.*:\/\//g, "protocol://"));
			return {
				hostname: url.hostname,
				pathname: url.pathname,
			};
		} catch {
			return {
				hostname: "",
				pathname: "",
			};
		}
	}).filter(({ hostname }) => !!hostname)
;

/**
 * Gets whether or not a tab has active highlighting information stored, so is considered highlighted.
 * @param tabId The ID of a tab.
 * @returns `true` if the tab is considered highlighted, `false` otherwise.
 */
export const isTabResearchPage = async (tabId: number): Promise<boolean> => {
	const { researchInstances } = await storageGet("session", [ StorageSession.RESEARCH_INSTANCES ]);
	return (tabId in researchInstances) && researchInstances[tabId].enabled;
};
