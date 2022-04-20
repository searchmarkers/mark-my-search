type MatchTerms = Array<MatchTerm>;

class MatchTerm {
	phrase: string;
    exp: string;
	selector: string
	pattern: RegExp;
	wordPattern: RegExp;
	wholeStemPattern: RegExp;

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
		const patternString = this.exp.replace(/(.)/g,"$1(\\p{Pd})?").slice(0, -9); // TODO: address code duplication [term processing]
		this.pattern = new RegExp(this.matchesWhole && !this.matchesStem ? `\\b(?:${patternString})\\b` : patternString, flags);
		if (this.matchesWhole && this.matchesStem) {
			// Highlighting algorithm calls special case for term with match modes both 'whole' and 'stem'.
			this.wordPattern = /\b\w+\b/g;
			this.wholeStemPattern = new RegExp(`\\b(?:${patternString})\\b`, flags);
			console.log(this.wholeStemPattern);
		}
	}

	matchWholeStem(text: string, start: number) {
		console.log(getStem(Array.from(text.matchAll(this.wordPattern)).find(match => match.index + match[0].length > start)[0]));
		return getStem(Array.from(text.matchAll(this.wordPattern)).find(match => match.index + match[0].length > start)[0])
			.search(this.wholeStemPattern) !== -1;
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
