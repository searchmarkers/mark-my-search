type CommandInfo = Readonly<{
	type: CommandType
	termIdx?: number
	reversed?: boolean
}>

type CommandType = (
	| "none"
	| "openPopup"
	| "openOptions"
	| "toggleInTab"
	| "toggleEnabled"
	| "toggleBar"
	| "toggleHighlights"
	| "toggleSelect"
	| "replaceTerms"
	| "advanceGlobal"
	| "selectTerm"
	| "stepGlobal"
	| "focusTermInput"
)

/**
 * Transforms a command string into a command object understood by the extension.
 * @param commandString The string identifying a user command in `manifest.json`.
 * @returns The corresponding command object.
 */
const parseCommand = (commandString: string): CommandInfo => {
	switch (commandString) {
	case "open-popup": return { type: "openPopup" };
	case "open-options": return { type: "openOptions" };
	case "toggle-research-global": return { type: "toggleEnabled" };
	case "toggle-research-tab": return { type: "toggleInTab" };
	case "toggle-bar": return { type: "toggleBar" };
	case "toggle-highlights": return { type: "toggleHighlights" };
	case "toggle-select": return { type: "toggleSelect" };
	case "terms-replace": return { type: "replaceTerms" };
	case "step-global": return { type: "stepGlobal", reversed: false };
	case "step-global-reverse": return { type: "stepGlobal", reversed: true };
	case "advance-global": return { type: "advanceGlobal", reversed: false };
	case "advance-global-reverse": return { type: "advanceGlobal", reversed: true };
	case "focus-term-append": return { type: "focusTermInput" };
	}
	const parts = commandString.split("-");
	if (commandString.startsWith("select-term-")) {
		return { type: "selectTerm", termIdx: Number(parts[2]), reversed: parts[3] === "reverse" };
	}
	return { type: "none" };
};

export {
	type CommandInfo, type CommandType,
	parseCommand,
};
