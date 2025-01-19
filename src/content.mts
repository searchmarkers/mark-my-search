/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/* eslint-disable indent */ // TODO remove
import type { ConfigValues } from "/dist/modules/storage.mjs";
import type { CommandInfo } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.d.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, termEquals, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID, ArrayBox, type ArrayMutation } from "/dist/modules/common.mjs";
import type { AbstractEngineManager } from "/dist/modules/highlight/engine-manager.d.mjs";
import { EngineManager } from "/dist/modules/highlight/engine-manager.mjs";
import type { AbstractToolbar, ControlButtonName } from "/dist/modules/interface/toolbar.d.mjs";
import { Toolbar } from "/dist/modules/interface/toolbar.mjs";
import { assert, itemsMatch } from "/dist/modules/common.mjs";

type GetToolbar<CreateIfNull extends boolean> = (CreateIfNull extends true
	? () => AbstractToolbar
	: () => AbstractToolbar | null
)

type BrowserCommands = Array<chrome.commands.Command>
type BrowserCommandsReadonly = ReadonlyArray<chrome.commands.Command>

type ControlsInfo = {
	pageModifyEnabled: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: ReadonlyArray<MatchTerm>
	barControlsShown: Readonly<ConfigValues["barControlsShown"]>
	barLook: Readonly<ConfigValues["barLook"]>
	matchMode: Readonly<MatchMode>
}

// TODO put in toolbar
/**
 * Safely removes focus from the toolbar, returning it to the current document.
 * @returns `true` if focus was changed (i.e. it was in the toolbar), `false` otherwise.
 */
const focusReturnToDocument = (): boolean => {
	const focus = document.activeElement;
	// eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
	if (focus instanceof HTMLElement && focus.id === EleID.BAR) {
		focus.blur();
		return true;
	}
	return false;
};

/**
 * Extracts terms from the currently user-selected string.
 * @returns The extracted terms, split at some separator and some punctuation characters,
 * with some other punctuation characters removed.
 */
const getTermsFromSelection = (termTokens: TermTokens): Array<MatchTerm> => {
	const selection = getSelection();
	const termsMut: Array<MatchTerm> = [];
	if (selection && selection.anchorNode) {
		const termsAll = (() => {
			const string = selection.toString();
			if (/\p{Open_Punctuation}|\p{Close_Punctuation}|\p{Initial_Punctuation}|\p{Final_Punctuation}/u.test(string)) {
				// If there are brackets or quotes, we just assume it's too complicated to sensibly split up for now.
				// TODO make this behaviour smarter?
				return [ string ];
			} else {
				return string.split(/\n+|\r+|\p{Other_Punctuation}\p{Space_Separator}+|\p{Space_Separator}+/gu);
			}
		})()
			.map(phrase => phrase.replace(/\p{Other}/gu, ""))
			.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
		const termSelectors = new Set<string>();
		for (const term of termsAll) {
			const token = termTokens.get(term);
			if (!termSelectors.has(token)) {
				termSelectors.add(token);
				termsMut.push(term);
			}
		}
	}
	return termsMut;
};

const updateToolbar = (
	terms: ReadonlyArray<MatchTerm>,
	mutation: ArrayMutation<MatchTerm> | null,
	toolbar: AbstractToolbar,
	commands: BrowserCommandsReadonly,
) => {
	switch (mutation?.type) {
		case "remove": {
			toolbar.removeTerm(mutation.index);
			break;
		}
		case "replace": {
			toolbar.replaceTerm(mutation.new, mutation.index);
			break;
		}
		case "insert": {
			toolbar.insertTerm(mutation.new, mutation.index, commands);
			break;
		}
		default: {
			toolbar.replaceTerms(terms, commands);
		}
	}
	toolbar.updateControlVisibility("replaceTerms");
	toolbar.insertAdjacentTo(document.body, "beforebegin");
};

const startHighlighting = (
	termsOld: ReadonlyArray<MatchTerm>,
	terms: ReadonlyArray<MatchTerm>,
	highlighter: AbstractEngineManager,
	hues: ReadonlyArray<number>,
) => {
	const termsToHighlight: ReadonlyArray<MatchTerm> = terms.filter(term => !termsOld.includes(term));
	const termsToPurge: ReadonlyArray<MatchTerm> = termsOld.filter(termOld => !terms.includes(termOld));
	highlighter.startHighlighting(
		terms,
		termsToHighlight,
		termsToPurge,
		hues,
	);
};

// TODO decompose this horrible generator function
/**
 * Returns a generator function to consume individual command objects and produce their desired effect.
 * @param terms Terms being controlled, highlighted, and jumped to.
 */
const respondToCommand_factory = (
	termsBox: ArrayBox<MatchTerm>,
	controlsInfo: ControlsInfo,
	getToolbarOrNull: GetToolbar<false>,
	highlighter: AbstractEngineManager,
) => {
	let selectModeFocus = false;
	let focusedIdx: number | null = null;
	return (commandInfo: CommandInfo) => {
		if (commandInfo.termIdx !== undefined) {
			focusedIdx = commandInfo.termIdx;
		}
		if (focusedIdx !== null && focusedIdx >= termsBox.getItems().length) {
			focusedIdx = null;
		}
		switch (commandInfo.type) {
		case "toggleBar": {
			getToolbarOrNull()?.toggleHidden();
			break;
		} case "toggleSelect": {
			selectModeFocus = !selectModeFocus;
			break;
		} case "replaceTerms": {
			termsBox.setItems(controlsInfo.termsOnHold);
			break;
		} case "stepGlobal": {
			if (focusReturnToDocument()) {
				break;
			}
			highlighter.stepToNextOccurrence(commandInfo.reversed ?? false, true, null);
			break;
		} case "advanceGlobal": {
			focusReturnToDocument();
			const term = (selectModeFocus && focusedIdx !== null) ? termsBox.getItems()[focusedIdx] : null;
			highlighter.stepToNextOccurrence(commandInfo.reversed ?? false, false, term);
			break;
		} case "focusTermInput": {
			getToolbarOrNull()?.focusTermInput(commandInfo.termIdx ?? null);
			break;
		} case "selectTerm": {
			if (focusedIdx === null) {
				break;
			}
			const term = termsBox.getItems()[focusedIdx];
			getToolbarOrNull()?.indicateTerm(term);
			if (!selectModeFocus) {
				highlighter.stepToNextOccurrence(!!commandInfo.reversed, false, term);
			}
			break;
		}}
	};
};

class TermsSyncService {
	#remoteTerms: ReadonlyArray<MatchTerm> = [];

	constructor (termsBox: ArrayBox<MatchTerm>) {
		termsBox.addListener(terms => {
			if (itemsMatch(terms, this.#remoteTerms, termEquals)) {
				return;
			}
			// NOTE: Race condition:
			// After sending terms (A) to remote, we receive terms (B);
			// remote silently accepts (A), but we believe remote holds (B).
			sendBackgroundMessage({ terms });
			this.#remoteTerms = terms;
		});
	}

	updateRemoteTerms (terms: ReadonlyArray<MatchTerm>) {
		this.#remoteTerms = terms;
	}
}

(() => {
	const commands: BrowserCommands = [];
	let hues: ReadonlyArray<number> = [];
	const termTokens = new TermTokens();
	const termPatterns = new TermPatterns();
	const controlsInfo: ControlsInfo = { // Unless otherwise indicated, the values assigned here are arbitrary and to be overridden.
		pageModifyEnabled: true, // Currently has an effect.
		highlightsShown: false,
		barCollapsed: false,
		termsOnHold: [],
		barControlsShown: {
			toggleBarCollapsed: false,
			disableTabResearch: false,
			performSearch: false,
			toggleHighlights: false,
			appendTerm: false,
			replaceTerms: false,
		},
		barLook: {
			showEditIcon: false,
			showRevealIcon: false,
			fontSize: "",
			opacityControl: 0,
			opacityTerm: 0,
			borderRadius: "",
		},
		matchMode: {
			regex: false,
			case: false,
			stem: false,
			whole: false,
			diacritics: false,
		},
	};
	const highlighter: AbstractEngineManager = new EngineManager(termTokens, termPatterns);
	highlighter.addHighlightingUpdatedListener(() => {
		getToolbar()?.updateStatuses();
	});
	const termsBox = new ArrayBox<MatchTerm>();
	termsBox.addListener((terms, oldTerms, mutation) => {
		if (itemsMatch(terms, oldTerms, termEquals)) {
			return;
		}
		updateToolbar(terms, mutation, getOrCreateToolbar(), commands);
		// Give the interface a chance to redraw before performing highlighting.
		setTimeout(() => {
			if (controlsInfo.pageModifyEnabled) startHighlighting(oldTerms, terms, highlighter, hues);
		});
	});
	const termsSyncService = new TermsSyncService(termsBox);
	// TODO: Remove toolbar completely when not in use. Use WeakRef?
	const { getToolbar, getOrCreateToolbar } = (() => {
		// TODO: Use generator function?
		let toolbar: AbstractToolbar | null = null;
		return {
			getToolbar: () => toolbar,
			getOrCreateToolbar: () => {
				if (!toolbar) {
					toolbar = new Toolbar(
						hues, commands,
						controlsInfo,
						termsBox,
						termTokens, highlighter,
					);
				}
				return toolbar;
			}
		};
	})();
	const respondToCommand = respondToCommand_factory(termsBox, controlsInfo, getOrCreateToolbar, highlighter);
	const getDetails = (request: Message.TabDetailsRequest) => ({
		terms: request.termsFromSelection ? getTermsFromSelection(termTokens) : undefined,
		highlightsShown: request.highlightsShown ? controlsInfo.highlightsShown : undefined,
	});
	type MessageHandler = (
		message: Message.Tab,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: Message.TabResponse) => void,
		detailsHandled?: boolean,
	) => void
	let queuingPromise: Promise<unknown> | undefined = undefined;
	const messageHandleHighlight: MessageHandler = (
		message,
		sender,
		sendResponse,
		detailsHandled?,
	) => {
		if (message.getDetails && !detailsHandled) {
			sendResponse(getDetails(message.getDetails));
		}
		(async () => {
		if (queuingPromise) {
			await queuingPromise;
		}
		if (message.highlighter !== undefined) {
			highlighter.removeEngine();
			highlighter.signalPaintEngineMethod(message.highlighter.paintEngine.method);
			queuingPromise = highlighter.setEngine(message.highlighter.engine);
			await queuingPromise;
			queuingPromise = undefined;
			highlighter.applyEngine();
		}
		if (message.enablePageModify !== undefined && controlsInfo.pageModifyEnabled !== message.enablePageModify) {
			controlsInfo.pageModifyEnabled = message.enablePageModify;
			getToolbar()?.updateVisibility();
			if (!controlsInfo.pageModifyEnabled) {
				highlighter.removeEngine();
			}
		}
		if (message.extensionCommands) {
			commands.splice(0, commands.length, ...message.extensionCommands);
		}
		if (message.barControlsShown) {
			controlsInfo.barControlsShown = message.barControlsShown;
			for (const controlName of Object.keys(message.barControlsShown) as Array<ControlButtonName>) {
				getToolbar()?.updateControlVisibility(controlName);
			}
		}
		if (message.barLook) {
			controlsInfo.barLook = message.barLook;
		}
		if (message.highlightLook) {
			hues = [ ...message.highlightLook.hues ];
		}
		if (message.matchMode) {
			controlsInfo.matchMode = message.matchMode;
		}
		if (message.toggleHighlightsOn !== undefined) {
			controlsInfo.highlightsShown = message.toggleHighlightsOn;
		}
		if (message.toggleBarCollapsedOn !== undefined) {
			controlsInfo.barCollapsed = message.toggleBarCollapsedOn;
		}
		if (message.termsOnHold) {
			controlsInfo.termsOnHold = message.termsOnHold;
		}
		if (message.deactivate) {
			//removeTermsAndDeactivate();
			highlighter.endHighlighting();
			termsBox.setItems([]);
			getToolbar()?.remove();
		}
		if (message.terms) {
			// Ensure the toolbar is set up.
			getOrCreateToolbar().insertAdjacentTo(document.body, "beforebegin");
			// TODO: Make sure same MatchTerm objects are used for terms which are equivalent.
			termsSyncService.updateRemoteTerms(message.terms);
			termsBox.setItems(message.terms);
		}
		if (message.commands) {
			for (const command of message.commands) {
				respondToCommand(command);
			}
		}
		const toolbar = getToolbar();
		if (toolbar) {
			toolbar.updateHighlightsShownFlag();
			toolbar.updateCollapsed();
			toolbar.updateControlVisibility("replaceTerms");
		}
		})();
	};
	(() => {
		type MessageInfo = {
			message: Message.Tab,
			sender: chrome.runtime.MessageSender,
			sendResponse: (response: Message.TabResponse) => void,
		}
		const messageQueue: Array<MessageInfo> = [];
		const messageHandleHighlightUninitialized: MessageHandler = (
			message,
			sender,
			sendResponse,
			detailsHandled?,
		) => {
			if (message.getDetails && !detailsHandled) {
				sendResponse(getDetails(message.getDetails));
			}
			if (Object.keys(message).length === 1) {
				// If the message only requested details, we can now discard it.
				return;
			}
			messageQueue.push({ message, sender, sendResponse });
			if (messageQueue.length === 1) {
				sendBackgroundMessage({ initializationGet: true }).then(initMessage => {
					if (!initMessage) {
						assert(false, "not initialized, so highlighting remains inactive",
							"no init response was received");
						return;
					}
					const initialize = () => {
						chrome.runtime.onMessage.removeListener(messageHandleHighlightUninitialized);
						chrome.runtime.onMessage.addListener(messageHandleHighlight);
						messageHandleHighlight(initMessage, sender, sendResponse);
						let info: MessageInfo | undefined;
						// eslint-disable-next-line no-cond-assign
						while (info = messageQueue.shift()) {
							messageHandleHighlight(info.message, info.sender, info.sendResponse, true);
						}
					};
					if (document.body) {
						initialize();
					} else {
						const observer = new MutationObserver(() => {
							if (document.body) {
								observer.disconnect();
								initialize();
							}
						});
						observer.observe(document.documentElement, { childList: true });
					}
				});
			}
		};
		chrome.runtime.onMessage.addListener(messageHandleHighlightUninitialized);
	})();
})();

export type { ControlsInfo };
