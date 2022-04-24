// Porter stemmer in Javascript. Few comments, but it's easy to follow against the rules in the original
// paper, in
//
//  Porter, 1980, An algorithm for suffix stripping, Program, Vol. 14,
//  no. 3, pp 130-137,
//
// see also http://www.tartarus.org/~martin/PorterStemmer

// Release 1 be 'andargor', Jul 2004
// Release 2 (substantially revised) by Christopher McKenzie, Aug 2009

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getWordStem = (() => {
	const getStem = (() => {
		const step2list = {
			"ational" : "ate",
			"tional" : "tion",
			"enci" : "ence",
			"anci" : "ance",
			"izer" : "ize",
			"bli" : "ble",
			"alli" : "al",
			"entli" : "ent",
			"eli" : "e",
			"ousli" : "ous",
			"ization" : "ize",
			"isation" : "ise",
			"ation" : "ate",
			"ator" : "ate",
			"alism" : "al",
			"iveness" : "ive",
			"fulness" : "ful",
			"ousness" : "ous",
			"aliti" : "al",
			"iviti" : "ive",
			"biliti" : "ble",
			"logi" : "log"
		};

		const step3list = {
			"icate" : "ic",
			"ative" : "",
			"alize" : "al",
			"alise" : "al",
			"iciti" : "ic",
			"ical" : "ic",
			"ful" : "",
			"ness" : ""
		};

		const c = "[^aeiou]";          // consonant
		const v = "[aeiouy]";          // vowel
		const C = c + "[^aeiouy]*";    // consonant sequence
		const V = v + "[aeiou]*";      // vowel sequence

		const mgr0 = "^(" + C + ")?" + V + C;               // [C]VC... is m>0
		const meq1 = "^(" + C + ")?" + V + C + "(" + V + ")?$";  // [C]VC[V] is m=1
		const mgr1 = "^(" + C + ")?" + V + C + V + C;       // [C]VCVC... is m>1
		const s_v = "^(" + C + ")?" + v;                   // vowel in stem

		return (w: string) => {
			let stem: string,
				suffix: string,
				re0: RegExp,
				re1: RegExp,
				re2: RegExp,
				re3: RegExp;

			if (w.length < 3) { return w; }

			const firstch = w[0];
			if (firstch === "y") {
				w = firstch.toUpperCase() + w.substring(1);
			}

			// Step 1a
			re0 = /^(.+?)(ss|i)es$/;
			re1 = /^(.+?)([^s])s$/;

			if (re0.test(w)) { w = w.replace(re0,"$1$2"); }
			else if (re1.test(w)) {	w = w.replace(re1,"$1$2"); }

			// Step 1b
			re0 = /^(.+?)eed$/;
			re1 = /^(.+?)(ed|ing)$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				re0 = new RegExp(mgr0);
				if (re0.test(fp[1])) {
					re0 = /.$/;
					w = w.replace(re0,"");
				}
			} else if (re1.test(w)) {
				const fp = re1.exec(w);
				stem = fp[1];
				re1 = new RegExp(s_v);
				if (re1.test(stem)) {
					w = stem;
					re1 = /(at|bl|iz)$/;
					re2 = new RegExp("([^aeiouylsz])\\1$");
					re3 = new RegExp("^" + C + v + "[^aeiouwxy]$");
					if (re1.test(w)) {	w = w + "e"; }
					else if (re2.test(w)) { re0 = /.$/; w = w.replace(re0,""); }
					else if (re3.test(w)) { w = w + "e"; }
				}
			}

			// Step 1c
			re0 = /^(.+?)y$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				stem = fp[1];
				re0 = new RegExp(s_v);
				if (re0.test(stem)) { w = stem + "i"; }
			}

			// Step 2
			re0 = /^(.+?)(ational|tional|enci|anci|i(?:z|s)er|bli|alli|entli|eli|ousli|i(?:z|s)ation|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				stem = fp[1];
				suffix = fp[2];
				re0 = new RegExp(mgr0);
				if (re0.test(stem)) {
					w = stem + step2list[suffix];
				}
			}

			// Step 3
			re0 = /^(.+?)(icate|ative|ali(?:z|s)e|iciti|ical|ful|ness)$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				stem = fp[1];
				suffix = fp[2];
				re0 = new RegExp(mgr0);
				if (re0.test(stem)) {
					w = stem + step3list[suffix];
				}
			}

			// Step 4
			re0 = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|i(?:z|s)e)$/;
			re1 = /^(.+?)(s|t)(ion)$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				stem = fp[1];
				re0 = new RegExp(mgr1);
				if (re0.test(stem)) {
					w = stem;
				}
			} else if (re1.test(w)) {
				const fp = re1.exec(w);
				stem = fp[1] + fp[2];
				re1 = new RegExp(mgr1);
				if (re1.test(stem)) {
					w = stem;
				}
			}

			// Step 5
			re0 = /^(.+?)e$/;
			if (re0.test(w)) {
				const fp = re0.exec(w);
				stem = fp[1];
				re0 = new RegExp(mgr1);
				re1 = new RegExp(meq1);
				re2 = new RegExp("^" + C + v + "[^aeiouwxy]$");
				if (re0.test(stem) || (re1.test(stem) && !(re2.test(stem)))) {
					w = stem;
				}
			}

			re0 = /ll$/;
			re1 = new RegExp(mgr1);
			if (re0.test(w) && re1.test(w)) {
				re0 = /.$/;
				w = w.replace(re0,"");
			}

			// and turn initial Y back to y

			if (firstch === "y") {
				w = firstch.toLowerCase() + w.substring(1);
			}

			return w;
		};
	})();

	const ENDINGS = new Set(["e", "i"]);

	return (word: string) => {
		// Retain case after necessary conversion to lowercase.
		// TODO: generate regex for possible word forms (likely large, non-stemmer project)
		let wordStem = getStem(word.toLocaleLowerCase());
		wordStem = Array.from(word.matchAll(new RegExp(wordStem.replace(/(.)/g,"(?:$1") + wordStem.replace(/./g, ")?"), "gi")))[0][0];
		return ENDINGS.has(wordStem.at(-1)) ? wordStem.slice(0, -1) : wordStem;
	};
})();
