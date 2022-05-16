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
	matchMode: MatchMode
	hue: number
	command: string
	commandReverse: string
    
	constructor (phrase: string, matchMode?: MatchMode) {
		this.phrase = phrase;
		this.matchMode = { case: false, stem: true, whole: false };
		if (phrase.length <= 3) {
			this.matchMode.stem = false;
			this.matchMode.whole = true;
		}
		if (matchMode)
			Object.assign(this.matchMode, matchMode);
		this.compile();
	}
    
	compile () {
		if (this.phrase.includes(" "))
			this.matchMode.stem = false;
		this.exp = this.matchMode.stem ? getWordPatternString(this.phrase) : this.phrase;
		this.selector = this.phrase.replace(/\W/g, "");
		const flags = this.matchMode.case ? "gu" : "giu";
		const patternString = this.exp.slice(0, -1).replace(/(\w)/g,"$1(\\p{Pd})?") + this.exp[this.exp.length - 1];
		this.pattern = new RegExp(this.matchMode.whole ? `\\b(?:${patternString})\\b` : patternString, flags);
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
	termsFromSelection?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	terms: MatchTerms
	termChanged?: MatchTerm
	termChangedIdx?: number
	makeUnique?: boolean
	disablePageResearch?: boolean
	toggleResearchOn?: boolean
}
