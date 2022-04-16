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
		const pattern = this.exp.replace(/(.)/g,"$1(-|‐|‐)?").slice(0, -8);
		return this.matchWhole ? `(\\b(${pattern})\\b)` : pattern; // TODO: advanced whole-word matching
	}

	getPattern(): RegExp {
		const flags = this.matchCase ? "g" : "gi"; // TODO: use u? (for \p{})
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
