// eslint-disable-next-line @typescript-eslint/no-unused-vars
type HTMLElementTagName = keyof HTMLElementTagNameMap
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
		this.matchMode = phrase.length > 2 ? { case: false, stem: true, whole: false } : { case: false, stem: false, whole: false };
		if (matchMode)
			Object.assign(this.matchMode, matchMode);
		this.compile();
	}
    
	compile () {
		if (/\W/g.test(this.phrase)) {
			this.matchMode.stem = false;
		}
		const sanitize = (word: string, replacement = "\\$&") =>
			word.replace(/[/\\^$*+?.()|[\]{}]/g, replacement);
		this.selector = `${
			sanitize(this.phrase, "_").replace(/\W/g, "_")
		}-${
			Object.values(this.matchMode).map((matchFlag: boolean) => Number(matchFlag)).join("")
		}-${
			(Date.now() + Math.random()).toString(36).replace(/\W/g, "_")
		}`; // Selector is most likely unique; a repeated selector results in undefined behaviour
		const flags = this.matchMode.case ? "gu" : "giu";
		const exp = (this.matchMode.stem ? getWordPatternString(this.phrase) : this.phrase);
		const optionalHyphen = "(\\p{Pd})?";
		const addOptionalHyphens = (word: string) =>
			word.replace(/(\w\?|\w)/g,`$1${optionalHyphen}`);
		let patternString: string;
		if (this.matchMode.stem) {
			const dashedEnd = exp.search(/\(\?:/g);
			patternString = addOptionalHyphens(sanitize(exp.slice(0, dashedEnd))) + optionalHyphen + exp.slice(dashedEnd, -1);
		} else {
			patternString = addOptionalHyphens(sanitize(exp.slice(0, -1))) + sanitize(exp.at(-1) as string);
		}
		const getWordBoundaryTest = (charBoundary: string) => /\w/g.test(charBoundary) ? "\\b" : "";
		this.pattern = new RegExp(this.matchMode.whole
			? `${getWordBoundaryTest(patternString[0])}(?:${patternString})${getWordBoundaryTest(patternString.at(-1) as string)}`
			: patternString, flags);

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
	extensionCommands?: Array<chrome.commands.Command>
	terms?: MatchTerms
	termUpdate?: MatchTerm
	termToUpdateIdx?: number
	disable?: boolean
	termsFromSelection?: boolean
	toggleHighlightsOn?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface BackgroundMessage {
	tabId?: number
	highlightMessage?: HighlightMessage
	highlightCommand?: CommandInfo
	executeInTab?: boolean
	terms?: MatchTerms
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
	TOGGLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
	FOCUS_TERM_INPUT,
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
	case "toggle": {
		switch (parts[1]) {
		case "research": {
			switch (parts[2]) {
			case "global": {
				return { type: CommandType.TOGGLE_ENABLED };
			} case "tab": {
				return { type: CommandType.TOGGLE_IN_TAB };
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
	} case "focus": {
		switch (parts[1]) {
		case "term": {
			switch (parts[2]) {
			case "append": {
				return { type: CommandType.FOCUS_TERM_INPUT };
			}}
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
enum BarLook {
	SHOW_EDIT_ICON = "showEditIcon",
}
