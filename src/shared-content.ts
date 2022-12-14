// eslint-disable-next-line @typescript-eslint/no-unused-vars
type HTMLElementTagName = keyof HTMLElementTagNameMap
type MatchTerms = Array<MatchTerm>

/**
 * Gets a JSON-stringified form of the given object for use in logging.
 * @param object An object.
 * @returns A stringified form of the object. The JSON may be collapsed or expanded depending on size.
 */
const getObjectStringLog = (object: Record<string, unknown>): string =>
	JSON.stringify(
		object,
		undefined,
		(Object.keys(object).length > 1
		|| (typeof(Object.values(object)[0]) === "object"
			&& Object.keys(Object.values(object)[0] as Record<string, unknown>).length))
			? 2 : undefined,
	)
;

/**
 * Logs a debug message as part of normal operation.
 * @param operation Description of the process started or completed, or the event encountered.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description of the reason for the process or situation.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const log = (operation: string, reason: string, metadata: Record<string, unknown> = {}) => {
	const operationStatement = `DEBUG: ${operation[0].toUpperCase() + operation.slice(1)}`;
	const reasonStatement = reason.length ? reason[0].toUpperCase() + reason.slice(1) : "";
	console.log(operationStatement
		+ (reasonStatement.length ? `: ${reasonStatement}.` : ".")
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : "")
	);
};

/**
 * Logs a graceful failure message.
 * @param condition A value which will be evaluated to `true` or `false`. If falsy, there has been a problem which will be logged.
 * @param problem Description of the operation failure.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description of the low-level reason for the failure.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 * @param metadata Objects which may help with debugging the problem.
 * @returns `true` if the condition is truthy, `false` otherwise.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const assert = (condition: unknown, problem: string, reason: string, metadata: Record<string, unknown> = {}): boolean => {
	if (!condition) {
		console.warn(`DEBUG: ${problem[0].toUpperCase() + problem.slice(1)}: ${reason[0].toUpperCase() + reason.slice(1)}.`
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : ""));
	}
	return !!condition;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum WindowFlag {
	EXECUTION_UNNECESSARY = "executionUnnecessary",
}

interface MatchMode {
	regex: boolean
	case: boolean
	stem: boolean
	whole: boolean
	diacritics: boolean
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
			diacritics: false,
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
		const [ patternStringPrefix, patternStringSuffix ] = (this.matchMode.stem && !this.matchMode.regex)
			? getWordPatternStrings(this.phrase)
			: [ this.phrase, "" ];
		const optionalHyphenStandin = "_ _ _"; // TODO improve method of inserting optional hyphens
		const optionalHyphen = this.matchMode.regex ? "" : "(\\p{Pd})?";
		const getDiacriticsMatchingPatternStringSafe = (chars: string) =>
			this.matchMode.diacritics ? getDiacriticsMatchingPatternString(chars) : chars;
		const getHyphenatedPatternString = (word: string) =>
			word.replace(/(\w\?|\w)/g,`$1${optionalHyphenStandin}`);
		const getBoundaryTest = (charBoundary: string) =>
			this.matchMode.whole && /\w/g.test(charBoundary) ? "\\b" : "";
		const patternString = `${
			getBoundaryTest(patternStringPrefix[0])
		}${
			getDiacriticsMatchingPatternStringSafe(getHyphenatedPatternString(sanitize(patternStringPrefix.slice(0, -1))))
		}${
			getDiacriticsMatchingPatternStringSafe(sanitize(patternStringPrefix.at(-1) as string))
		}(?:${
			patternStringSuffix ? optionalHyphenStandin + getDiacriticsMatchingPatternStringSafe(patternStringSuffix) : ""
		})?${
			getBoundaryTest(patternStringPrefix.at(-1) as string)
		}`.replace(new RegExp(optionalHyphenStandin, "g"), optionalHyphen);
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
	getDetails?: {
		termsFromSelection?: true
		highlightsShown?: true
	}
	command?: CommandInfo
	extensionCommands?: Array<chrome.commands.Command>
	terms?: MatchTerms
	termUpdate?: MatchTerm
	termToUpdateIdx?: number
	deactivate?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	autoOverwritable?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]
	highlightLook?: StorageSyncValues[StorageSync.HIGHLIGHT_LOOK]
	matchMode?: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface HighlightDetails {
	terms?: MatchTerms
	highlightsShown?: boolean
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
	toggleAutoOverwritable?: boolean
	performSearch?: boolean
}

enum CommandType {
	NONE,
	OPEN_POPUP,
	OPEN_OPTIONS,
	TOGGLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
	STEP_GLOBAL,
	FOCUS_TERM_INPUT,
}

interface CommandInfo {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

/**
 * Sanitizes a string for regex use by escaping all potential regex control characters.
 * @param word A string.
 * @param replacement The character pattern with which the sanitizer regex will replace potential control characters.
 * Defaults to a pattern which evaluates to the backslash character plus the control character, hence escaping it.
 * @returns The transformed string to be matched in exact form as a regex pattern.
 */
const sanitizeForRegex = (word: string, replacement = "\\$&") =>
	word.replace(/[/\\^$*+?.()|[\]{}]/g, replacement)
;

/**
 * Gets the URL filter array corresponding to an array of valid browser URLs.
 * @param urlStrings An array of valid URLs as strings.
 * @returns A URL filter array containing no wildcards which would filter in each of the URLs passed.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
	case "open": {
		switch (parts[1]) {
		case "popup": {
			return { type: CommandType.OPEN_POPUP };
		} case "options": {
			return { type: CommandType.OPEN_OPTIONS };
		}}
		break;
	} case "toggle": {
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
	} case "step": {
		switch (parts[1]) {
		case "global": {
			return { type: CommandType.STEP_GLOBAL, reversed: parts[2] === "reverse" };
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { objectSetValue, objectGetValue } = (() => {
	const objectSetGetValue = (object: Record<string, unknown>, key: string, value: unknown, set = true) => {
		if (key.includes(".")) {
			return objectSetValue(
				object[key.slice(0, key.indexOf("."))] as Record<string, unknown>,
				key.slice(key.indexOf(".") + 1),
				value,
			);
		} else {
			if (set) {
				object[key] = value;
			}
			return object[key];
		}
	};

	return {
		objectSetValue: (object: Record<string, unknown>, key: string, value: unknown) => {
			objectSetGetValue(object, key, value);
		},

		objectGetValue: (object: Record<string, unknown>, key: string) =>
			objectSetGetValue(object, key, undefined, false)
		,
	};
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getIdSequential = (function* () {
	let id = 0;
	while (true) {
		yield `input-${id++}`;
	}
})();

const getNameFull = (): string =>
	chrome.runtime.getManifest().name
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getName = (): string => {
	const manifest = chrome.runtime.getManifest();
	if (manifest.short_name) {
		return manifest.short_name;
	}
	const nameFull = getNameFull(); // The complete name may take the form e.g. " Name | Classification".
	const nameEndPosition = nameFull.search(/\W\W\W/g);
	return nameEndPosition === -1 ? nameFull : nameFull.slice(0, nameEndPosition);
};
