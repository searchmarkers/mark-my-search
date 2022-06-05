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
		if (/\W/.test(this.phrase))
			this.matchMode.stem = false;
		this.selector = this.phrase.replace(/\s/g, "_");
		const flags = this.matchMode.case ? "gu" : "giu";
		const exp = (this.matchMode.stem
			? getWordPatternString(this.phrase.replace(/(o)+/gi, "$1")).replace(/(o)/gi, "$1$1?")
			: this.phrase);
		const sanitize = (word: string) =>
			word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
		const addOptionalHyphens = (word: string) =>
			word.replace(/(\w\?|\w)/g,"(\\p{Pd})?$1");
		let patternString: string;
		if (this.matchMode.stem) {
			const dashedEnd = exp.search(/\(\?:/g);
			patternString = exp[0] + addOptionalHyphens(exp.substring(1, dashedEnd)) + exp.substring(dashedEnd);
		} else {
			patternString = sanitize(exp[0]) + addOptionalHyphens(sanitize(exp).substring(1));
		}
		this.pattern = new RegExp(this.matchMode.whole ? `\\b(?:${patternString})\\b` : patternString, flags);
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class Engine {
	hostname: string
	pathname: [ string, string ]
	param: string

	constructor (args?: { urlPatternString: string }) {
		if (!args)
			return;
		// TODO: error checking?
		const urlPattern = new URL(args.urlPatternString);
		this.hostname = urlPattern.hostname;
		if (urlPattern.pathname.includes("%s")) {
			const parts = urlPattern.pathname.split("%s");
			this.pathname = [ parts[0], parts[1].slice(0, parts[1].endsWith("/") ? parts[1].length : undefined) ];
		} else {
			this.param = Array.from(urlPattern.searchParams).find(param => param[1].includes("%s"))[0];
		}
	}

	extract (urlString: string, matchOnly = false) {
		const url = new URL(urlString);
		return url.hostname !== this.hostname ? null : this.pathname
			? url.pathname.startsWith(this.pathname[0]) && url.pathname.slice(this.pathname[0].length).includes(this.pathname[1])
				? matchOnly ? [] : url.pathname.slice(
					url.pathname.indexOf(this.pathname[0]) + this.pathname[0].length,
					url.pathname.lastIndexOf(this.pathname[1])).split("+")
				: null
			: url.searchParams.has(this.param)
				? matchOnly ? [] : url.searchParams.get(this.param).split(" ")
				: null;
	}

	match (urlString: string) {
		return !!this.extract(urlString, true);
	}

	equals (engine: Engine) {
		return engine.hostname === this.hostname
			&& engine.param === this.param
			&& engine.pathname === this.pathname;
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
