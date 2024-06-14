type URLFilter = Array<{
	hostname: string,
	pathname: string,
}>

/**
 * Gets the URL filter array corresponding to an array of valid browser URLs.
 * @param urlStrings An array of valid URLs as strings.
 * @returns A URL filter array containing no wildcards which would filter in each of the URLs passed.
 */
const getUrlFilter = (urlStrings: Array<string>): URLFilter =>
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

export { getUrlFilter };
