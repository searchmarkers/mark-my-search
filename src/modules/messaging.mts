/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { CommandInfo } from "/dist/modules/commands.mjs";
import type { ConfigValues } from "./storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

type Tab = Readonly<{
	getDetails?: TabDetailsRequest
	commands?: ReadonlyArray<CommandInfo>
	extensionCommands?: ReadonlyArray<chrome.commands.Command>
	terms?: ReadonlyArray<MatchTerm>
	termsOnHold?: ReadonlyArray<MatchTerm>
	deactivate?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: ConfigValues["barControlsShown"]
	barLook?: ConfigValues["barLook"]
	highlightLook?: ConfigValues["highlightLook"]
	highlighter?: ConfigValues["highlighter"]
	matchMode?: ConfigValues["matchModeDefaults"]
}>

type TabDetailsRequest = Readonly<{
	termsFromSelection?: true
	highlightsShown?: true
}>

type TabResponse = Readonly<{
	terms?: ReadonlyArray<MatchTerm>
	highlightsShown?: boolean
}>

type Background<WithId = false> = Readonly<{
	highlightCommands?: ReadonlyArray<CommandInfo>
	initializationGet?: boolean
	terms?: ReadonlyArray<MatchTerm>
	termsSend?: boolean
	deactivateTabResearch?: boolean
	performSearch?: boolean
	toggle?: {
		highlightsShownOn?: boolean
		barCollapsedOn?: boolean
	}
} & (
	(WithId extends true ? never : Record<never, never>) | {
		tabId: number
	}
)>

type BackgroundResponse = Tab | null

export type {
	Tab, TabDetailsRequest, TabResponse,
	Background, BackgroundResponse,
};
