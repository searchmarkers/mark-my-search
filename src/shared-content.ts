// eslint-disable-next-line @typescript-eslint/no-unused-vars
type HTMLElementTagName = keyof HTMLElementTagNameMap
type MatchTerms = Array<MatchTerm>

interface MatchMode {
	regex: boolean
	case: boolean
	stem: boolean
	whole: boolean
}

/**
 * Represents a search term with regex matching options. Used by the DOM text finding algorithm and supporting components.
 */
class MatchTerm {
	phrase: string;
	selector: string;
	pattern: RegExp;
	matchMode: MatchMode;
	hue: number;
	command: string;
	commandReverse: string;

	constructor (phrase: string, matchMode?: Partial<MatchMode>, options: Partial<{
		allowStemOverride: boolean
	}> = {}) {
		this.phrase = phrase;
		this.matchMode = {
			regex: false,
			case: false,
			stem: true,
			whole: false,
		};
		if (matchMode) {
			Object.assign(this.matchMode, matchMode);
		}
		if (options.allowStemOverride && phrase.length < 3) {
			this.matchMode.stem = false;
		}
		this.compile();
	}

	/**
	 * Construct a regex based on the stored search term information, assigning it to `this.pattern`.
	 */
	compile () {
		if (/\W/g.test(this.phrase)) {
			this.matchMode.stem = false;
		}
		const sanitize: (phrase: string, replacement?: string) => string = this.matchMode.regex
			? phrase => phrase
			: (phrase, replacement) => sanitizeForRegex(phrase, replacement);
		this.selector = `${
			sanitize(this.phrase, "_").replace(/\W/g, "_")
		}-${
			Object.values(this.matchMode).map((matchFlag: boolean) => Number(matchFlag)).join("")
		}-${
			(Date.now() + Math.random()).toString(36).replace(/\W/g, "_")
		}`; // Selector is most likely unique; a repeated selector results in undefined behaviour
		const flags = this.matchMode.case ? "gu" : "giu";
		const [ patternStringPrefix, patternStringSuffix ] = (this.matchMode.stem && !this.matchMode.regex
			? getWordPatternStrings(this.phrase) : [ this.phrase, "" ]);
		const optionalHyphen = this.matchMode.regex ? "" : "(\\p{Pd})?";
		const addOptionalHyphens = (word: string) => word.replace(/(\w\?|\w)/g,`$1${optionalHyphen}`);
		const getBoundaryTest = (charBoundary: string) => this.matchMode.whole && /\w/g.test(charBoundary) ? "\\b" : "";
		const patternString = `${
			getBoundaryTest(patternStringPrefix[0])}${
			addOptionalHyphens(sanitize(patternStringPrefix.slice(0, -1)))}${
			sanitize(patternStringPrefix.at(-1) as string)}(?:${
			patternStringSuffix.length ? optionalHyphen + patternStringSuffix + (this.matchMode.whole ? "\\b" : "") : ""}|${
			getBoundaryTest(patternStringPrefix.at(-1) as string)})`;
		this.pattern = new RegExp(patternString, flags);
	}
}

/**
 * Represents the set of URLs used by a particular search engine and how to extract the dynamic search query section.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Engine {
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
			const [ param, arg ] = Array.from(urlDynamic.searchParams).find(param => param[1].includes("%s")) ?? [ "", "" ];
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface HighlightMessage {
	command?: CommandInfo
	extensionCommands?: Array<chrome.commands.Command>
	terms?: MatchTerms
	termUpdate?: MatchTerm
	termToUpdateIdx?: number
	deactivate?: boolean
	enablePageModify?: boolean
	termsFromSelection?: boolean
	toggleHighlightsOn?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]
	highlightLook?: StorageSyncValues[StorageSync.HIGHLIGHT_LOOK]
	matchMode?: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	tabId?: number
	highlightMessage?: HighlightMessage
	highlightCommand?: CommandInfo
	executeInTab?: boolean
	terms?: MatchTerms
	termChanged?: MatchTerm
	termChangedIdx?: number
	makeUnique?: boolean
	disableTabResearch?: boolean
	toggleResearchOn?: boolean
	toggleHighlightsOn?: boolean
	performSearch?: boolean
}

enum CommandType {
	NONE,
	TOGGLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
	FOCUS_TERM_INPUT,
}

interface CommandInfo {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

// TODO document
const sanitizeForRegex = (word: string, replacement = "\\$&") =>
	word.replace(/[/\\^$*+?.()|[\]{}]/g, replacement)
;

// TODO document
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

/**
 * Transforms a command string into a command object understood by the extension.
 * @param commandString The string identifying a user command in `manifest.json`.
 * @returns The corresponding command object.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseCommand = (commandString: string): CommandInfo => {
	const parts = commandString.split("-");
	switch (parts[0]) {
	case "toggle": {
		switch (parts[1]) {
		case "research": {
			switch (parts[2]) {
			case "global": {
				return { type: CommandType.TOGGLE_ENABLED };
			} case "tab": {
				return { type: CommandType.TOGGLE_IN_TAB };
			}}
			break;
		} case "bar": {
			return { type: CommandType.TOGGLE_BAR };
		} case "highlights": {
			return { type: CommandType.TOGGLE_HIGHLIGHTS };
		} case "select": {
			return { type: CommandType.TOGGLE_SELECT };
		}}
		break;
	} case "advance": {
		switch (parts[1]) {
		case "global": {
			return { type: CommandType.ADVANCE_GLOBAL, reversed: parts[2] === "reverse" };
		}}
		break;
	} case "focus": {
		switch (parts[1]) {
		case "term": {
			switch (parts[2]) {
			case "append": {
				return { type: CommandType.FOCUS_TERM_INPUT };
			}}
		}}
		break;
	} case "select": {
		switch (parts[1]) {
		case "term": {
			return { type: CommandType.SELECT_TERM, termIdx: Number(parts[2]), reversed: parts[3] === "reverse" };
		}}
	}}
	return { type: CommandType.NONE };
};

/**
 * Compares two arrays using an item comparison function.
 * @param as An array of items of a single type.
 * @param bs An array of items of the same type.
 * @param compare A function comparing a corresponding pair of items from the arrays.
 * If unspecified, the items are compared with strict equality.
 * @returns `true` if each item pair matches and arrays are of equal cardinality, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const itemsMatch = <T> (as: ReadonlyArray<T>, bs: ReadonlyArray<T>, compare = (a: T, b: T) => a === b) =>
	as.length === bs.length && as.every((a, i) => compare(a, bs[i]))
;

/**
 * Gets whether or not a tab has active highlighting information stored, so is considered highlighted.
 * @param researchInstances An array of objects each representing an instance of highlighting.
 * @param tabId The ID of a tab.
 * @returns `true` if the tab is considered highlighted, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isTabResearchPage = (researchInstances: ResearchInstances, tabId: number): boolean =>
	(tabId in researchInstances) && researchInstances[tabId].enabled
;
