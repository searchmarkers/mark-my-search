import { getWordPatternStrings } from "/dist/modules/matching/word-stems.mjs";
import { getDiacriticsMatchingPatternString } from "/dist/modules/matching/diacritics.mjs";

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
	token: string;
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
		this.token = `${
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

const termEquals = (termA: MatchTerm | undefined, termB: MatchTerm | undefined): boolean =>
	(!termA && !termB) ||
	!!(termA && termB &&
	termA.phrase === termB.phrase &&
	Object.entries(termA.matchMode).every(([ key, value ]) => termB.matchMode[key] === value))
;

export {
	type MatchMode, MatchTerm,
	sanitizeForRegex,
	termEquals,
};
