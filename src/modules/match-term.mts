import { getWordPatternStrings } from "/dist/modules/matching/word-stems.mjs";
import { getDiacriticsMatchingPatternString } from "/dist/modules/matching/diacritics.mjs";
import { sanitizeForRegex } from "/dist/modules/common.mjs";

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
	readonly phrase: string;
	readonly matchMode: Readonly<MatchMode>;

	constructor (phrase: string, matchMode?: Partial<MatchMode>, options: Partial<{
		allowStemOverride: boolean
	}> = {}) {
		this.phrase = phrase;
		const matchModeThis = {
			regex: false,
			case: false,
			stem: true,
			whole: false,
			diacritics: true,
		};
		if (matchMode) {
			Object.assign(matchModeThis, matchMode);
		}
		if (options.allowStemOverride && (phrase.length < 3 || /\W/g.test(phrase))) {
			matchModeThis.stem = false;
		}
		this.matchMode = matchModeThis;
	}
}

const termEquals = (termA: MatchTerm | undefined, termB: MatchTerm | undefined): boolean =>
	(!termA && !termB) ||
	!!(termA && termB &&
	termA.phrase === termB.phrase &&
	Object.entries(termA.matchMode).every(([ key, value ]) => termB.matchMode[key] === value))
;

const sanitize = (phrase: string, replacement: string, matchMode: MatchMode) => matchMode.regex
	? phrase
	: sanitizeForRegex(phrase, replacement)
;

const generateTokenUnique = (term: MatchTerm, tokenBaseCounts: Record<string, number>): string => {
	const tokenBase = sanitize(term.phrase, "_", term.matchMode).replace(/\W/g, "_")
		+ "_"
		+ Object.values(term.matchMode).map((flag: boolean) => flag ? "1" : "0").join("");
	const tokenBaseCount = tokenBaseCounts[tokenBase] ?? 0;
	tokenBaseCounts[tokenBase] = tokenBaseCount + 1;
	return tokenBaseCount === 0 ? tokenBase : (tokenBase + "-" + tokenBaseCount);
};

const generatePattern = (term: MatchTerm): RegExp => {
	const sanitize: (phrase: string, replacement?: string) => string = term.matchMode.regex
		? phrase => phrase
		: (phrase, replacement) => sanitizeForRegex(phrase, replacement);
	const flags = term.matchMode.case ? "gu" : "giu";
	const [ patternStringPrefix, patternStringSuffix ] = (term.matchMode.stem && !term.matchMode.regex)
		? getWordPatternStrings(term.phrase)
		: [ term.phrase, "" ];
	const optionalHyphenStandin = "_ _ _"; // TODO improve method of inserting optional hyphens
	const optionalHyphen = term.matchMode.regex ? "" : "(\\p{Pd})?";
	const getDiacriticsMatchingPatternStringSafe = (chars: string) =>
		term.matchMode.diacritics ? chars : getDiacriticsMatchingPatternString(chars);
	const getHyphenatedPatternString = (word: string) =>
		word.replace(/(\w\?|\w)/g,`$1${optionalHyphenStandin}`);
	const getBoundaryTest = (charBoundary: string) =>
		term.matchMode.whole && /\w/g.test(charBoundary) ? "\\b" : "";
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
	return new RegExp(patternString, flags);
};

class TermTokens {
	readonly #termTokens: WeakMap<MatchTerm, string> = new WeakMap();
	readonly #tokenBaseCounts: Record<string, number> = {};

	get (term: MatchTerm): string {
		const token = this.#termTokens.get(term);
		if (!token) {
			const token = generateTokenUnique(term, this.#tokenBaseCounts);
			this.#termTokens.set(term, token);
			return token;
		}
		return token;
	}
}

class TermPatterns {
	readonly #termPatterns: WeakMap<MatchTerm, RegExp> = new WeakMap();

	get (term: MatchTerm): RegExp {
		const pattern = this.#termPatterns.get(term);
		if (!pattern) {
			const pattern = generatePattern(term);
			this.#termPatterns.set(term, pattern);
			return pattern;
		}
		return pattern;
	}
}

export {
	type MatchMode, MatchTerm,
	termEquals,
	TermTokens, TermPatterns,
};
