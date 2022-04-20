/**
 * Snowball (Porter2) stemming algorithm.
 *
 * http://snowball.tartarus.org/algorithms/english/stemmer.html
 */

// Created by @localvoid at https://github.com/localvoid/stemr/blob/master/src/index.ts, modified for ESLint by @ator-dev.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getStem = (() => {
	// Exceptional forms
	const EXCEPTIONAL_FORMS4: { [k: string]: string } = {
		"skis": "ski",
		"idly": "idl",
		"ugly": "ugli",
		"only": "onli",
		"news": "news",
		"howe": "howe",
		"bias": "bias",
	};

	const EXCEPTIONAL_FORMS5: { [k: string]: string } = {
		"skies": "sky",
		"dying": "die",
		"lying": "lie",
		"tying": "tie",
		"early": "earli",
		"atlas": "atlas",
		"andes": "andes",
	};

	const EXCEPTIONAL_FORMS6: { [k: string]: string } = {
		"gently": "gentl",
		"singly": "singl",
		"cosmos": "cosmos",
	};

	// Exceptional forms post 1a step
	const EXCEPTIONAL_FORMS_POST_1A: { [k: string]: number } = {
		"inning": 0,
		"outing": 0,
		"canning": 0,
		"herring": 0,
		"earring": 0,
		"proceed": 0,
		"exceed": 0,
		"succeed": 0,
	};

	const RANGE_RE = /[^aeiouy]*[aeiouy]+[^aeiouy](\w*)/;

	const EWSS1_RE = /^[aeiouy][^aeiouy]$/;
	const EWSS2_RE = /.*[^aeiouy][aeiouy][^aeiouywxY]$/;

	function isEndsWithShortSyllable(word: string): boolean {
		if (word.length === 2) {
			return EWSS1_RE.test(word);
		}
		return EWSS2_RE.test(word);
	}

	// Capitalize consonant regexp
	const CCY_RE = /([aeiouy])y/g;
	const S1A_RE = /[aeiouy]./;

	function step1bHelper(word: string, r1: number): string {
		if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) {
			return word + "e";
		}
		// double ending
		const l0 = word.charCodeAt(word.length - 1);
		// /(bb|dd|ff|gg|mm|nn|pp|rr|tt)$/
		if (l0 === word.charCodeAt(word.length - 2) &&
			(l0 === 98 ||
				l0 === 100 || l0 === 102 ||
				l0 === 103 || l0 === 109 ||
				l0 === 110 || l0 === 112 ||
				l0 === 114 || l0 === 116)) {

			return word.slice(0, -1);
		}
		// is short word
		if (r1 === word.length && isEndsWithShortSyllable(word)) {
			return word + "e";
		}
		return word;
	}

	const S1BSUFFIXES_RE = /(ed|edly|ing|ingly)$/;
	const S1B_RE = /[aeiouy]/;

	function step1b(word: string, r1: number): string {
		if (word.endsWith("eedly")) {
			if (word.length - 5 >= r1) {
				return word.slice(0, -3);
			}
			return word;
		}
		if (word.endsWith("eed")) {
			if (word.length - 3 >= r1) {
				return word.slice(0, -1);
			}
			return word;
		}
		const match = S1BSUFFIXES_RE.exec(word);
		if (match) {
			const preceding = word.slice(0, -match[0].length);
			if (word.length > 1 && S1B_RE.test(preceding)) {
				return step1bHelper(preceding, r1);
			}
		}

		return word;
	}

	function step2Helper(word: string, r1: number, end: string, repl: string, prev: string[] | null): string | null {
		if (word.endsWith(end)) {
			if ((word.length - end.length) >= r1) {
				const w = word.slice(0, -end.length);
				if (prev === null) {
					return w + repl;
				}
				for (let i = 0; i < prev.length; i++) {
					const p = prev[i];
					if (w.endsWith(p)) {
						return w + repl;
					}
				}
			}
			return word;
		}
		return null;
	}

	const S2_TRIPLES: Array<[string, string, Array<string> | null]> = [
		["enci", "ence", null],
		["anci", "ance", null],
		["abli", "able", null],
		["izer", "ize", null],
		["ator", "ate", null],
		["alli", "al", null],
		["bli", "ble", null],
		["ogi", "og", ["l"]],
		["li", "", ["c", "d", "e", "g", "h", "k", "m", "n", "r", "t"]],
	];

	const S2_TRIPLES5 = ([
		["ization", "ize", null],
		["ational", "ate", null],
		["fulness", "ful", null],
		["ousness", "ous", null],
		["iveness", "ive", null],
		["tional", "tion", null],
		["biliti", "ble", null],
		["lessli", "less", null],
		["entli", "ent", null],
		["ation", "ate", null],
		["alism", "al", null],
		["aliti", "al", null],
		["ousli", "ous", null],
		["iviti", "ive", null],
		["fulli", "ful", null],
	] as Array<[string, string, Array<string> | null]>).concat(S2_TRIPLES);

	function step2(word: string, r1: number): string {
		const triples = (word.length > 6) ? S2_TRIPLES5 : S2_TRIPLES;

		for (let i = 0; i < triples.length; i++) {
			const trip = triples[i];
			const attempt = step2Helper(word, r1, trip[0], trip[1], trip[2]);
			if (attempt !== null) {
				return attempt;
			}
		}
		return word;
	}

	function step3Helper(word: string, r1: number, r2: number, end: string, repl: string, r2_necessary: boolean)
		: string | null {

		if (word.endsWith(end)) {
			if (word.length - end.length >= r1) {
				if (!r2_necessary) {
					return word.slice(0, -end.length) + repl;
				} else if (word.length - end.length >= r2) {
					return word.slice(0, -end.length) + repl;
				}
			}
			return word;
		}
		return null;
	}

	const S3_TRIPLES: Array<{ a: string, b: string, c: boolean }> = [
		{ a: "ational", b: "ate", c: false },
		{ a: "tional", b: "tion", c: false },
		{ a: "alize", b: "al", c: false },
		{ a: "icate", b: "ic", c: false },
		{ a: "iciti", b: "ic", c: false },
		{ a: "ative", b: "", c: true },
		{ a: "ical", b: "ic", c: false },
		{ a: "ness", b: "", c: false },
		{ a: "ful", b: "", c: false },
	];

	function step3(word: string, r1: number, r2: number): string {
		for (let i = 0; i < S3_TRIPLES.length; i++) {
			const trip = S3_TRIPLES[i];
			const attempt = step3Helper(word, r1, r2, trip.a, trip.b, trip.c);
			if (attempt !== null) {
				return attempt;
			}
		}
		return word;
	}

	const S4_DELETE_LIST = ["al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment", "ent", "ism", "ate",
		"iti", "ous", "ive", "ize"];

	function step4(word: string, r2: number): string {
		for (let i = 0; i < S4_DELETE_LIST.length; i++) {
			const end = S4_DELETE_LIST[i];
			if (word.endsWith(end)) {
				if (word.length - end.length >= r2) {
					return word.slice(0, -end.length);
				}
				return word;
			}
		}

		if ((word.length - 3) >= r2) {
			const l = word.charCodeAt(word.length - 4);
			if ((l === 115 || l === 116) && word.endsWith("ion")) { // s === 115 , t === 116
				return word.slice(0, -3);
			}
		}

		return word;
	}

	const NORMALIZE_YS_RE = /Y/g;

	return (word: string): string => {
		let l;
		let match: RegExpExecArray | null;
		let r1: number;
		let r2: number;

		if (word.length < 3) {
			return word;
		}

		// remove initial apostrophe
		if (word.charCodeAt(0) === 39) { // "'" === 39
			word = word.slice(1);
		}

		// handle exceptional forms
		if (word === "sky") {
			return word;
		} else if (word.length < 7) {
			if (word.length === 4) {
				if (Object.prototype.hasOwnProperty.call(EXCEPTIONAL_FORMS4, word)) {
					return EXCEPTIONAL_FORMS4[word];
				}
			} else if (word.length === 5) {
				if (Object.prototype.hasOwnProperty.call(EXCEPTIONAL_FORMS5, word)) {
					return EXCEPTIONAL_FORMS5[word];
				}
			} else if (word.length === 6) {
				if (Object.prototype.hasOwnProperty.call(EXCEPTIONAL_FORMS6, word)) {
					return EXCEPTIONAL_FORMS6[word];
				}
			}
		}

		// capitalize consonant ys
		if (word.charCodeAt(0) === 121) { // "y" === 121
			word = "Y" + word.slice(1);
		}
		word = word.replace(CCY_RE, "$1Y");

		// r1
		if (word.length > 4 && (word.startsWith("gener") || word.startsWith("arsen"))) {
			r1 = 5;
		} else if (word.startsWith("commun")) {
			r1 = 6;
		} else {
			match = RANGE_RE.exec(word);
			r1 = (match) ? word.length - match[1].length : word.length;
		}

		// r2
		match = RANGE_RE.exec(word.slice(r1));
		// eslint-disable-next-line prefer-const
		r2 = match ? word.length - match[1].length : word.length;

		// step 0
		if (word.charCodeAt(word.length - 1) === 39) { // "'" === 39
			if (word.endsWith("'s'")) {
				word = word.slice(0, -3);
			} else {
				word = word.slice(0, -1);
			}
		} else if (word.endsWith("'s")) {
			word = word.slice(0, -2);
		}

		// step 1a
		if (word.endsWith("sses")) {
			word = word.slice(0, -4) + "ss";
		} else if (word.endsWith("ied") || word.endsWith("ies")) {
			word = word.slice(0, -3) + ((word.length > 4) ? "i" : "ie");
		} else if (word.endsWith("us") || word.endsWith("ss")) {
			//word = word;
		} else if (word.charCodeAt(word.length - 1) === 115) { // "s" == 115
			const preceding = word.slice(0, -1);
			if (S1A_RE.test(preceding)) {
				word = preceding;
			}
		}

		// handle exceptional forms post 1a
		if ((word.length === 6 || word.length === 7) && Object.prototype.hasOwnProperty.call(EXCEPTIONAL_FORMS_POST_1A, word)) {
			return word;
		}

		word = step1b(word, r1);

		// step 1c
		if (word.length > 2) {
			l = word.charCodeAt(word.length - 1);
			if (l === 121 || l === 89) {
				l = word.charCodeAt(word.length - 2);
				// "a|e|i|o|u|y"
				if (l < 97 || l > 121 || (l !== 97 && l !== 101 && l !== 105 && l !== 111 && l !== 117 && l !== 121)) {
					word = word.slice(0, -1);// + "i"; TODO: fix in highlighting
				}
			}
		}

		word = step2(word, r1);
		word = step3(word, r1, r2);
		word = step4(word, r2);

		// step 5
		l = word.charCodeAt(word.length - 1);

		if (l === 108) { // l = 108
			if (word.length - 1 >= r2 && word.charCodeAt(word.length - 2) === 108) { // l === 108
				word = word.slice(0, -1);
			}
		} else if (l === 101) { // e = 101
			if (word.length - 1 >= r2) {
				word = word.slice(0, -1);
			} else if (word.length - 1 >= r1 && !isEndsWithShortSyllable(word.slice(0, -1))) {
				word = word.slice(0, -1);
			}
		}

		// normalize Ys
		word = word.replace(NORMALIZE_YS_RE, "y");

		return word;
	};
})();
