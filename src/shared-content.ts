type MatchTerms = Array<MatchTerm>;

class MatchTerm {
    exp: string;
	matchCase: boolean;
	matchExact: boolean;
	matchWhole: boolean;
	matchRegex: boolean;
    
	constructor(exp: string) {
		this.exp = exp;
		this.matchCase = false;
		this.matchExact = false;
		this.matchWhole = false;
		this.matchRegex = false;
	}
    
	getPatternString(): string {
		if (this.matchRegex || this.matchExact) return this.exp;
		const pattern = stem()(this.exp).replace(/(.)/g,"$1(\\p{Pd})?").slice(0, -9); // TODO: address code duplication [term processing]
		return this.matchWhole ? `(\\b(${pattern})\\b)` : pattern; // TODO: move whole-word matching to a second stage
	}

	getPattern(): RegExp {
		const flags = this.matchCase ? "gu" : "giu";
		if (this.matchRegex || this.matchExact) return new RegExp(this.exp, flags);
		return new RegExp(this.matchWhole ? this.getPatternString() : this.getPatternString(), flags);
	}

	getSelector(): string {
		return this.exp;
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Message {
	command: string;
	terms: MatchTerms;
	enabled: boolean;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(messageObject: Record<string, any>) {
		this.command = messageObject.command;
		this.terms = messageObject.terms;
		this.enabled = messageObject.enabled === false ? false : true;
	}
}
