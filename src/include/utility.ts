/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

type MatchTerms = Array<MatchTerm>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const useChromeAPI = () =>
	!this.browser
;

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
 * @param reason Description (omittable) of the reason for the process or situation.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 */
const log = (operation: string, reason: string, metadata: Record<string, unknown> = {}) => {
	const operationStatement = `LOG: ${operation[0].toUpperCase() + operation.slice(1)}`;
	const reasonStatement = reason.length ? reason[0].toUpperCase() + reason.slice(1) : "";
	console.log(operationStatement
		+ (reasonStatement.length ? `: ${reasonStatement}.` : ".")
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : "")
	);
};

/**
 * Logs a graceful failure message if the condition is not met.
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
		console.warn(`LOG: ${problem[0].toUpperCase() + problem.slice(1)}: ${reason[0].toUpperCase() + reason.slice(1)}.`
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : ""));
	}
	return !!condition;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum WindowVariable {
	CONFIG_HARD = "configHard",
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
		}`; // Selector is most likely unique; a repeated selector results in undefined behaviour.
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
			getDiacriticsMatchingPatternStringSafe(sanitize(patternStringPrefix[patternStringPrefix.length - 1]))
		}(?:${
			patternStringSuffix ? optionalHyphenStandin + getDiacriticsMatchingPatternStringSafe(patternStringSuffix) : ""
		})?${
			getBoundaryTest(patternStringPrefix[patternStringPrefix.length - 1])
		}`.replace(new RegExp(optionalHyphenStandin, "g"), optionalHyphen);
		this.pattern = new RegExp(patternString, flags);
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const termEquals = (termA: MatchTerm | undefined, termB: MatchTerm | undefined): boolean =>
	(!termA && !termB) ||
	!!(termA && termB &&
	termA.phrase === termB.phrase &&
	Object.entries(termA.matchMode).every(([ key, value ]) => termB.matchMode[key] === value))
;

type HighlightDetailsRequest = {
	termsFromSelection?: true
	highlightsShown?: true
}

type HighlightMessage = {
	getDetails?: HighlightDetailsRequest
	commands?: Array<CommandInfo>
	extensionCommands?: Array<chrome.commands.Command>
	terms?: MatchTerms
	termsOnHold?: MatchTerms
	deactivate?: boolean
	useClassicHighlighting?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]
	highlightMethod?: StorageSyncValues[StorageSync.HIGHLIGHT_METHOD]
	matchMode?: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS]
}

type HighlightMessageResponse = {
	terms?: MatchTerms
	highlightsShown?: boolean
}

type BackgroundMessage<WithId = false> = {
	highlightCommands?: Array<CommandInfo>
	initializationGet?: boolean
	terms?: MatchTerms
	termsSend?: boolean
	deactivateTabResearch?: boolean
	performSearch?: boolean
	toggle?: {
		highlightsShownOn?: boolean
		barCollapsedOn?: boolean
	}
} & (WithId extends true
	? {
		tabId: number
	} : {
		tabId?: number
	}
)

type BackgroundMessageResponse = HighlightMessage | null

enum CommandType {
	NONE,
	OPEN_POPUP,
	OPEN_OPTIONS,
	TOGGLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	REPLACE_TERMS,
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

// TODO document
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const messageSendHighlight = (tabId: number, message: HighlightMessage): Promise<HighlightMessageResponse> =>
	chrome.tabs.sendMessage(tabId, message).catch(() => {
		log("messaging fail", "scripts may not be injected");
	})
;

// TODO document
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const messageSendBackground = (message: BackgroundMessage): Promise<BackgroundMessageResponse> =>
	chrome.runtime.sendMessage(message)
;

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
		objectSetValue: (object: Record<string, unknown>, key: string, value: unknown) =>
			objectSetGetValue(object, key, value),
		objectGetValue: (object: Record<string, unknown>, key: string) =>
			objectSetGetValue(object, key, undefined, false),
	};
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getIdSequential = (function* () {
	let id = 0;
	while (true) {
		yield id++;
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
