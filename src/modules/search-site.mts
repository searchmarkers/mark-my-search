/**
 * Represents the set of URLs used by a particular search engine and how to extract the dynamic search query section.
 */
class SearchSite {
	// All appropriate attributes must be compared in `this.equals`
	readonly hostname: string;
	readonly pathname: [ string, string ] | undefined;
	readonly param: string | undefined;

	constructor (args: { urlDynamicString: string }) {
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
			: url.searchParams.has(this.param ?? "")
				? matchOnly ? [] : (url.searchParams.get(this.param ?? "") ?? "").split(" ")
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
	equals (engine: SearchSite) {
		return engine.hostname === this.hostname
			&& engine.param === this.param
			&& engine.pathname === this.pathname;
	}
}

export { SearchSite };
