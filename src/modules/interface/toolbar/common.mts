import type { ControlButtonName } from "/dist/modules/interface/toolbar.mjs";
import { type CommandInfo, parseCommand } from "/dist/modules/commands.mjs";
import type { MatchMode } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";
import type { ControlsInfo } from "/dist/content.mjs";
import { getIdSequential } from "/dist/modules/common.mjs";

type BarLook = ControlsInfo["barLook"]

type BrowserCommands = ReadonlyArray<chrome.commands.Command>

type ControlFocusArea = (
	| "none"
	| "input"
	| "options_menu"
)

/**
 * Extracts assigned shortcut strings from browser commands.
 * @param commands Commands as returned by the browser.
 * @returns An object containing the extracted command shortcut strings.
 */
const getTermCommands = (commands: BrowserCommands): ReadonlyArray<{ down: string, up: string }> => {
	const commandsDetail = commands.map((command): { info: CommandInfo, shortcut: string } => ({
		info: command.name ? parseCommand(command.name) : { type: "none" },
		shortcut: command.shortcut ?? "",
	}));
	const commandsDownDetail = commandsDetail
		.filter(({ info }) => info.type === "selectTerm" && !info.reversed);
	const commandsUpDetail = commandsDetail
		.filter(({ info }) => info.type === "selectTerm" && info.reversed);
	return commandsDownDetail.map(({ shortcut }, i) => ({
		down: shortcut,
		up: commandsUpDetail[i].shortcut,
	}));
};

const getMatchModeOptionClass = (matchType: keyof MatchMode) => EleClass.OPTION + "-" + matchType;

const getMatchModeFromClassList = (
	classListContains: (token: typeof EleClass[keyof typeof EleClass]) => boolean,
) => ({
	regex: classListContains(EleClass.MATCH_REGEX),
	case: classListContains(EleClass.MATCH_CASE),
	stem: classListContains(EleClass.MATCH_STEM),
	whole: classListContains(EleClass.MATCH_WHOLE),
	diacritics: classListContains(EleClass.MATCH_DIACRITICS),
});

const applyMatchModeToClassList = (
	matchMode: Readonly<MatchMode>,
	classListToggle: (token: typeof EleClass[keyof typeof EleClass], force: boolean) => void,
) => {
	classListToggle(EleClass.MATCH_REGEX, matchMode.regex);
	classListToggle(EleClass.MATCH_CASE, matchMode.case);
	classListToggle(EleClass.MATCH_STEM, matchMode.stem);
	classListToggle(EleClass.MATCH_WHOLE, matchMode.whole);
	classListToggle(EleClass.MATCH_DIACRITICS, matchMode.diacritics);
};

const getInputIdSequential = () => EleID.INPUT + "-" + getIdSequential.next().value.toString();

const getControlClass = (controlName: ControlButtonName) => EleClass.CONTROL + "-" + controlName;

const getControlPadClass = (index: number) => EleClass.CONTROL_PAD + "-" + index.toString();

export {
	type BarLook,
	type BrowserCommands,
	type ControlFocusArea,
	getTermCommands,
	getMatchModeOptionClass, getMatchModeFromClassList, applyMatchModeToClassList,
	getInputIdSequential,
	getControlClass as getControlClass, getControlPadClass,
};
