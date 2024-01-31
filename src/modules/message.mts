import type { StorageSyncValues } from "/dist/modules/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { Engine, PaintEngineMethod } from "/dist/modules/common.mjs";
import { log } from "/dist/modules/common.mjs";

type HighlightDetailsRequest = {
	termsFromSelection?: true
	highlightsShown?: true
}

type HighlightMessage = {
	getDetails?: HighlightDetailsRequest
	commands?: Array<CommandInfo>
	extensionCommands?: Array<chrome.commands.Command>
	terms?: Array<MatchTerm>
	termsOnHold?: Array<MatchTerm>
	deactivate?: boolean
	setHighlighter?: {
		engine: Engine
		paintEngineMethod?: PaintEngineMethod
	}
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: StorageSyncValues["barControlsShown"]
	barLook?: StorageSyncValues["barLook"]
	highlightMethod?: StorageSyncValues["highlightMethod"]
	matchMode?: StorageSyncValues["matchModeDefaults"]
}

type HighlightMessageResponse = {
	terms?: Array<MatchTerm>
	highlightsShown?: boolean
}

type BackgroundMessage<WithId = false> = {
	highlightCommands?: Array<CommandInfo>
	initializationGet?: boolean
	terms?: Array<MatchTerm>
	termsSend?: boolean
	deactivateTabResearch?: boolean
	performSearch?: boolean
	toggle?: {
		highlightsShownOn?: boolean
		barCollapsedOn?: boolean
	}
} & (WithId extends true
	? { tabId: number }
	: { tabId?: number }
)

type BackgroundMessageResponse = HighlightMessage | null

interface CommandInfo {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

type CommandType =
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
;

/**
 * Transforms a command string into a command object understood by the extension.
 * @param commandString The string identifying a user command in `manifest.json`.
 * @returns The corresponding command object.
 */
const parseCommand = (commandString: string): CommandInfo => {
	const parts = commandString.split("-");
	switch (parts[0]) {
	case "open": {
		switch (parts[1]) {
		case "popup": {
			return { type: "openPopup" };
		} case "options": {
			return { type: "openOptions" };
		}}
		break;
	} case "toggle": {
		switch (parts[1]) {
		case "research": {
			switch (parts[2]) {
			case "global": {
				return { type: "toggleEnabled" };
			} case "tab": {
				return { type: "toggleInTab" };
			}}
			break;
		} case "bar": {
			return { type: "toggleBar" };
		} case "highlights": {
			return { type: "toggleHighlights" };
		} case "select": {
			return { type: "toggleSelect" };
		}}
		break;
	} case "terms": {
		switch (parts[1]) {
		case "replace": {
			return { type: "replaceTerms" };
		}}
		break;
	} case "step": {
		switch (parts[1]) {
		case "global": {
			return { type: "stepGlobal", reversed: parts[2] === "reverse" };
		}}
		break;
	} case "advance": {
		switch (parts[1]) {
		case "global": {
			return { type: "advanceGlobal", reversed: parts[2] === "reverse" };
		}}
		break;
	} case "focus": {
		switch (parts[1]) {
		case "term": {
			switch (parts[2]) {
			case "append": {
				return { type: "focusTermInput" };
			}}
		}}
		break;
	} case "select": {
		switch (parts[1]) {
		case "term": {
			return { type: "selectTerm", termIdx: Number(parts[2]), reversed: parts[3] === "reverse" };
		}}
	}}
	return { type: "none" };
};

// TODO document
const messageSendHighlight = (tabId: number, message: HighlightMessage): Promise<HighlightMessageResponse> =>
	chrome.tabs.sendMessage(tabId, message).catch(reason => {
		console.warn(reason);
		log("messaging fail", "scripts may not be injected");
	})
;

// TODO document
const messageSendBackground = (message: BackgroundMessage): Promise<BackgroundMessageResponse> =>
	chrome.runtime.sendMessage(message)
;

export {
	type HighlightDetailsRequest, type HighlightMessage, type HighlightMessageResponse,
	messageSendHighlight,
	type BackgroundMessage, type BackgroundMessageResponse,
	type CommandInfo, type CommandType,
	messageSendBackground,
	parseCommand,
}
