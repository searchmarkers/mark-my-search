/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";
import type { ResearchRecord } from "/dist/modules/research.mjs";

type Tab = Readonly<TabRequest | {
	type: "commands"
	commands: ReadonlyArray<TabCommand>
}>

type TabRequest = Readonly<{
	type: "request"
} & (
	{
		requestType: "selectedText"
	} | {
		requestType: "highlightsShown"
	}
)>

type TabResponse = Readonly<{
	type: "selectedText"
	selectedText: string
} | {
	type: "highlightsShown"
	highlightsShown: boolean
}>

type TabCommand = Readonly<{
	type: "receiveExtensionCommands"
	extensionCommands: ReadonlyArray<chrome.commands.Command>
} | {
	type: "useTerms"
	terms: ReadonlyArray<MatchTerm>
	replaceExisting: boolean
} | {
	type: "activate"
} | {
	type: "deactivate"
} | {
	type: "toggleHighlightsShown"
	enable: boolean
} | {
	type: "toggleBarCollapsed"
	enable: boolean
} | {
	type: "toggleSelectMode"
} | {
	type: "replaceTerms"
} | {
	type: "stepGlobal"
	forwards: boolean
} | {
	type: "jumpGlobal"
	forwards: boolean
} | {
	type: "selectTerm"
	forwards: boolean
	termIndex: number
} | {
	type: "focusTermInput"
	termIndex: number | null
}>

type Background = Readonly<BackgroundRequest | {
	type: "commands"
	commands: ReadonlyArray<BackgroundCommand>
}>

type BackgroundRequest = Readonly<{
	type: "request"
} & (
	{
		requestType: "tabId"
	} | {
		requestType: "tabResearchRecord"
	}
)>

type BackgroundCommand = Readonly<{
	type: "assignTabTerms"
	terms: ReadonlyArray<MatchTerm>
} | {
	type: "sendTabCommands"
	commands: ReadonlyArray<TabCommand>
} | {
	type: "toggleInTab"
	highlightsShownOn?: boolean
	barCollapsedOn?: boolean
} | {
	type: "deactivateTabResearch"
} | {
	type: "performTabSearch"
}>

type BackgroundResponse = Readonly<{
	type: "tabId"
	tabId: number
} | {
	type: "tabResearchRecord"
	researchRecord: ResearchRecord | null
}>

export type {
	Tab, TabRequest, TabResponse, TabCommand,
	Background, BackgroundRequest, BackgroundResponse, BackgroundCommand,
};
