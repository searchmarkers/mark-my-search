type MatchTerms = Array<MatchTerm>;

interface MatchMode {
	case: boolean
	stem: boolean
	whole: boolean
}

class MatchTerm {
	phrase: string
    exp: string
	selector: string
	pattern: RegExp
	wordPattern: RegExp
	wholeStemPattern: RegExp
	matchMode: MatchMode
	hue: number
	command: string
	commandReverse: string
    
	constructor (phrase: string, matchMode?: MatchMode) {
		this.phrase = phrase;
		this.matchMode = { case: false, stem: true, whole: false };
		if (phrase.length <= 3)
			this.matchMode.stem = false;
		if (matchMode)
			Object.assign(this.matchMode, matchMode);
		this.compile();
	}
    
	compile () {
		if (this.phrase.includes(" "))
			this.matchMode.stem = false;
		this.exp = this.matchMode.stem ? getWordStem(this.phrase) : this.phrase;
		this.selector = this.exp.replace(/\W/g, "");
		const flags = this.matchMode.case ? "gu" : "giu";
		const patternString = this.exp.slice(0, -1).replace(/(.)/g,"$1(\\p{Pd})?") + this.exp.at(-1);
		this.pattern = new RegExp(this.matchMode.whole && !this.matchMode.stem ? `\\b(?:${patternString})\\b` : patternString,
			flags);
		if (this.matchMode.whole && this.matchMode.stem) {
			// Highlighting algorithm calls special case for term with match modes both 'whole' and 'stem'.
			this.wordPattern = /\b\w+\b/g;
			this.wholeStemPattern = new RegExp(`\\b(?:${patternString})\\b`, flags);
		}
	}

	matchWholeStem (text: string, start: number) {
		return getWordStem(Array.from(text.matchAll(this.wordPattern)).find(match => match.index + match[0].length > start)[0])
			.search(this.wholeStemPattern) !== -1;
	}

	totalEqualityWith (term: MatchTerm, equal = true) {
		return (term.phrase === this.phrase) === equal
			&& Object.entries(term).every(([matchType, value]) => (value === this[matchType]) === equal);
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface HighlightMessage {
	command?: string
	extensionCommands?: Array<browser.commands.Command>
	terms?: MatchTerms
	termUpdate?: MatchTerm
	termToUpdateIdx?: number
	disable?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	terms: MatchTerms
	termChanged?: MatchTerm
	termChangedIdx?: number
	makeUnique?: boolean
}
