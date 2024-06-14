import type { CommandInfo } from "/dist/modules/commands.mjs";
import type { ConfigValues } from "/dist/modules/privileged/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Tab = {
	getDetails?: TabDetailsRequest
	commands?: Array<CommandInfo>
	extensionCommands?: Array<chrome.commands.Command>
	terms?: Array<MatchTerm>
	termsOnHold?: Array<MatchTerm>
	deactivate?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: ConfigValues["barControlsShown"]
	barLook?: ConfigValues["barLook"]
	highlightLook?: ConfigValues["highlightLook"]
	highlighter?: ConfigValues["highlighter"]
	matchMode?: ConfigValues["matchModeDefaults"]
}

type TabDetailsRequest = {
	termsFromSelection?: true
	highlightsShown?: true
}

type TabResponse = {
	terms?: Array<MatchTerm>
	highlightsShown?: boolean
}

type Background<WithId = false> = {
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

type BackgroundResponse = Tab | null

export type {
	Tab, TabDetailsRequest, TabResponse,
	Background, BackgroundResponse,
};
