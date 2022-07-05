type MatchTerms = Array<MatchTerm>

interface MatchMode {
	case: boolean
	stem: boolean
	whole: boolean
}

class MatchTerm {
	phrase: string;
	selector: string;
	pattern: RegExp;
	matchMode: MatchMode;
	hue: number;
	command: string;
	commandReverse: string;
    
	constructor (phrase: string, matchMode?: MatchMode) {
		this.phrase = phrase;
		this.matchMode = phrase.length > 2 ? { case: false, stem: true, whole: false } : { case: false, stem: false, whole: true };
		if (matchMode)
			Object.assign(this.matchMode, matchMode);
		this.compile();
	}
    
	compile () {
		if (/\W/.test(this.phrase))
			this.matchMode.stem = false;
		this.selector = this.phrase.replace(/\s/g, "_");
		const flags = this.matchMode.case ? "gu" : "giu";
		const exp = (this.matchMode.stem ? getWordPatternString(this.phrase) : this.phrase);
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
	hostname: string;
	pathname: [ string, string ];
	param: string;

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
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const [ param, arg ] = Array.from(urlPattern.searchParams).find(param => param[1].includes("%s")) ?? [ "", "" ];
			this.param = param;
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
				? matchOnly ? [] : (url.searchParams.get(this.param) ?? "").split(" ")
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
	command?: CommandInfo
	extensionCommands?: Array<browser.commands.Command>
	terms?: MatchTerms
	termUpdate?: MatchTerm
	termToUpdateIdx?: number
	disable?: boolean
	termsFromSelection?: boolean
	toggleHighlightsOn?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	terms: MatchTerms
	termChanged?: MatchTerm
	termChangedIdx?: number
	makeUnique?: boolean
	disableTabResearch?: boolean
	toggleResearchOn?: boolean
	toggleHighlightsOn?: boolean
	performSearch?: boolean
}

enum CommandType {
	NONE,
	ENABLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
}

interface CommandInfo {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const parseCommand = (commandString: string): CommandInfo => {
	const parts = commandString.split("-");
	switch (parts[0]) {
	case "enable": {
		switch (parts[1]) {
		case "research": {
			return { type: CommandType.ENABLE_IN_TAB };
		}}
		break;
	} case "toggle": {
		switch (parts[1]) {
		case "research": {
			switch (parts[2]) {
			case "global": {
				return { type: CommandType.TOGGLE_ENABLED };
			}}
			break;
		} case "bar": {
			return { type: CommandType.TOGGLE_BAR };
		} case "highlights": {
			return { type: CommandType.TOGGLE_HIGHLIGHTS };
		} case "select": {
			return { type: CommandType.TOGGLE_SELECT };
		}}
		break;
	} case "advance": {
		switch (parts[1]) {
		case "global": {
			return { type: CommandType.ADVANCE_GLOBAL, reversed: parts[2] === "reverse" };
		}}
		break;
	} case "select": {
		switch (parts[1]) {
		case "term": {
			return { type: CommandType.SELECT_TERM, termIdx: Number(parts[2]), reversed: parts[3] === "reverse" };
		}}
	}}
	return { type: CommandType.NONE };
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const itemsMatchLoosely = <T> (as: ReadonlyArray<T>, bs: ReadonlyArray<T>, compare = (a: T, b: T) => a === b) =>
	as.length === bs.length && as.every((a, i) => compare(a, bs[i]))
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum BarControl {
	DISABLE_TAB_RESEARCH = "disableTabResearch",
	PERFORM_SEARCH = "performSearch",
	APPEND_TERM = "appendTerm",
}
