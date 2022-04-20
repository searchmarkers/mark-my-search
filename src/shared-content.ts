type MatchTerms = Array<MatchTerm>;

class MatchTerm {
	phrase: string;
    exp: string;
	selector: string
	pattern: RegExp;
	patternWholeStem: RegExp;

	matchesCase: boolean;
	matchesStem: boolean;
	matchesWhole: boolean;
    
	constructor(phrase: string) {
		this.phrase = phrase;
		this.matchesCase = false;
		this.matchesStem = true;
		this.matchesWhole = false;
		this.compile();
	}
    
	compile() {
		this.exp = this.matchesStem ? getStem(this.phrase) : this.phrase;
		this.selector = this.exp;
		const flags = this.matchesCase ? "gu" : "giu";
		const pattern = this.exp.replace(/(.)/g,"$1(\\p{Pd})?").slice(0, -9); // TODO: address code duplication [term processing]
		this.pattern = new RegExp(this.matchesWhole && !this.matchesStem ? `\\b(?:${pattern})\\b` : pattern, flags);
		if (this.matchesWhole && this.matchesStem)
			this.patternWholeStem = new RegExp("");
		// Highlighting algorithm uses special case for terms matching 'whole' as well as 'stem'.
	}

	matchWholeStem(text: string, start: number, end: number) {
		return !!(text[Math.max(0, start - 1)].match(this.patternWholeStem) && text[Math.min(text.length - 1, end + 1)].match(this.patternWholeStem));
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class HighlightMessage {
	command: string;
	terms: MatchTerms;
	enabled: boolean;

	constructor(command?: string, terms?: MatchTerms, enabled?: boolean) {
		this.command = command;
		this.terms = terms;
		this.enabled = enabled === false ? false : true;
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class BackgroundMessage {
	terms: MatchTerms;
	makeUnique: boolean;

	constructor(terms: MatchTerms, makeUnique: boolean) {
		this.terms = terms;
		this.makeUnique = makeUnique;
	}
}
