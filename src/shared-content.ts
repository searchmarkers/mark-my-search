type MatchTerms = Array<MatchTerm>;

class MatchTerm {
	word: string;
    exp: string;
	matchCase: boolean;
	matchExact: boolean;
	matchWhole: boolean;
    
	constructor(word: string) {
		this.word = word;
		this.exp = stem()(word);
		this.matchCase = false;
		this.matchExact = false;
		this.matchWhole = false;
	}
    
	getPatternString(): string {
		if (this.matchExact) return this.exp;
		const pattern = stem()(this.exp).replace(/(.)/g,"$1(\\p{Pd})?").slice(0, -9); // TODO: address code duplication [term processing]
		return this.matchWhole ? `\\b(${pattern})\\b` : pattern;
	}

	getSelector(): string {
		return this.exp;
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
