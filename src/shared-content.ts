type MatchTerms = Array<MatchTerm>;

class MatchTerm {
	phrase: string;
    exp: string;
	selector: string
	pattern: RegExp;
	wordPattern: RegExp;
	wholeStemPattern: RegExp;
	matchesCase = false;
	matchesStem = true;
	matchesWhole = false;
    
	constructor(phrase: string) {
		this.phrase = phrase;
		this.compile();
	}
    
	compile() {
		if (this.phrase.includes(" ")) {
			this.matchesStem = false;
		}
		this.exp = this.matchesStem ? getWordStem(this.phrase) : this.phrase;
		this.selector = this.exp.replace(/\W/g, "");
		const flags = this.matchesCase ? "gu" : "giu";
		const patternString = this.exp.slice(0, -1).replace(/(.)/g,"$1(\\p{Pd})?") + this.exp.at(-1);
		this.pattern = new RegExp(this.matchesWhole && !this.matchesStem ? `\\b(?:${patternString})\\b` : patternString, flags);
		if (this.matchesWhole && this.matchesStem) {
			// Highlighting algorithm calls special case for term with match modes both 'whole' and 'stem'.
			this.wordPattern = /\b\w+\b/g;
			this.wholeStemPattern = new RegExp(`\\b(?:${patternString})\\b`, flags);
		}
	}

	matchWholeStem(text: string, start: number) {
		return getWordStem(Array.from(text.matchAll(this.wordPattern)).find(match => match.index + match[0].length > start)[0])
			.search(this.wholeStemPattern) !== -1;
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface HighlightMessage {
	command?: string;
	commands?: Array<browser.commands.Command>
	terms?: MatchTerms;
	disable?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	terms: MatchTerms;
	makeUnique: boolean;
}
