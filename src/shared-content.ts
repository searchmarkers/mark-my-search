type MatchTerms = Array<MatchTerm>;

interface MatchMode {
	case: boolean
	stem: boolean
	whole: boolean
}

class MatchTerm {
	phrase: string
	selector: string
	pattern: RegExp
	matchMode: MatchMode
	hue: number
	command: string
	commandReverse: string
    
	constructor (phrase: string, matchMode?: MatchMode) {
		this.phrase = phrase;
		this.matchMode = phrase.length > 3 ? { case: false, stem: true, whole: false } : { case: false, stem: false, whole: true };
		if (matchMode)
			Object.assign(this.matchMode, matchMode);
		this.compile();
	}
    
	compile () {
		if (/\s/.test(this.phrase))
			this.matchMode.stem = false;
		this.selector = this.phrase.replace(/\W/g, "");
		const flags = this.matchMode.case ? "gu" : "giu";
		const exp = this.matchMode.stem ? getWordPatternString(this.phrase.replace(/o+/g, "o").replace("o", "oo")) : this.phrase;
		const addOptionalHyphens = word =>
			word.replace(/(\w\?|\w)/g,"(\\p{Pd})?$1");
		let patternString: string;
		if (this.matchMode.stem) {
			const dashedEnd = exp.search(/\(/g);
			patternString = exp[0] + addOptionalHyphens(exp.substring(1, dashedEnd)) + exp.substring(dashedEnd);
		} else {
			patternString = exp[0] + addOptionalHyphens(exp.substring(1));
		}
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
