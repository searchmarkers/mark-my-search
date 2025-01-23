/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

type UserCommand = Readonly<{
	type: "openPopup"
} | {
	type: "openOptions"
} | {
	type: "toggleAutoFind"
} | {
	type: "tab_toggleResearch"
} | {
	type: "tab_toggleHighlightsShown"
} | {
	type: "tab_toggleBarCollapsed"
} | {
	type: "tab_toggleSelectMode"
} | {
	type: "tab_replaceTerms"
} | {
	type: "tab_stepGlobal"
	forwards: boolean
} | {
	type: "tab_jumpGlobal"
	forwards: boolean
} | {
	type: "tab_selectTerm"
	forwards: boolean
	termIndex: number
} | {
	type: "tab_focusTermInput"
	termIndex: number | null
}>

/**
 * Transforms a command string into a command object understood by the extension.
 * @param commandString The string identifying a user command in `manifest.json`.
 * @returns The corresponding command object.
 */
const parseUserCommand = (commandString: string): UserCommand | null => {
	switch (commandString) {
	case "open-popup":
		return { type: "openPopup" };
	case "open-options":
		return { type: "openOptions" };
	case "toggle-research-global":
		return { type: "toggleAutoFind" };
	case "toggle-research-tab":
		return { type: "tab_toggleResearch" };
	case "toggle-highlights":
		return { type: "tab_toggleHighlightsShown" };
	case "toggle-bar":
		return { type: "tab_toggleBarCollapsed" };
	case "toggle-select":
		return { type: "tab_toggleSelectMode" };
	case "terms-replace":
		return { type: "tab_replaceTerms" };
	case "step-global":
		return { type: "tab_stepGlobal", forwards: true };
	case "step-global-reverse":
		return { type: "tab_stepGlobal", forwards: false };
	case "advance-global":
		return { type: "tab_jumpGlobal", forwards: true };
	case "advance-global-reverse":
		return { type: "tab_jumpGlobal", forwards: false };
	case "focus-term-append":
		return { type: "tab_focusTermInput", termIndex: null };
	}
	const parts = commandString.split("-");
	if (commandString.startsWith("select-term-")) {
		return { type: "tab_selectTerm", forwards: parts[3] !== "reverse", termIndex: Number(parts[2]) };
	}
	return null;
};

export {
	type UserCommand,
	parseUserCommand,
};
