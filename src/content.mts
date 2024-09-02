/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/* eslint-disable indent */ // TODO remove
import type { ConfigValues } from "./modules/storage.mjs";
import type { CommandInfo } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, termEquals, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID } from "/dist/modules/common.mjs";
import { type AbstractEngineManager, EngineManager } from "/dist/modules/highlight/engine-manager.mjs";
import * as Stylesheet from "/dist/modules/interface/stylesheet.mjs";
import { type AbstractToolbar, type ControlButtonName } from "/dist/modules/interface/toolbar.mjs";
import { Toolbar } from "/dist/modules/interface/toolbars/toolbar.mjs";
import { assert, itemsMatch } from "/dist/modules/common.mjs";

type GetToolbar<CreateIfNull extends boolean> = (CreateIfNull extends true
	? () => AbstractToolbar
	: () => AbstractToolbar | null
)

type UpdateTermStatus = (term: MatchTerm) => void

type DoPhrasesMatchTerms = (phrases: ReadonlyArray<string>) => boolean

type BrowserCommands = Array<chrome.commands.Command>
type BrowserCommandsReadonly = ReadonlyArray<chrome.commands.Command>

type ControlsInfo = {
	pageModifyEnabled: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: ReadonlyArray<MatchTerm>
	barControlsShown: ConfigValues["barControlsShown"]
	barLook: ConfigValues["barLook"]
	matchMode: Readonly<MatchMode>
}

// TODO put in toolbar
/**
 * Safely removes focus from the toolbar, returning it to the current document.
 * @returns `true` if focus was changed (i.e. it was in the toolbar), `false` otherwise.
 */
const focusReturnToDocument = (): boolean => {
	const activeElement = document.activeElement;
	if (activeElement instanceof HTMLInputElement && activeElement.closest(`#${EleID.BAR}`)) {
		activeElement.blur();
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
	termsOld: ReadonlyArray<MatchTerm>,
	terms: ReadonlyArray<MatchTerm>,
	update: {
		term: MatchTerm | null
		termIndex: number
	} | null,
	toolbar: AbstractToolbar,
	commands: BrowserCommandsReadonly,
) => {
	if (update && update.term) {
		if (update.termIndex === termsOld.length) {
			toolbar.appendTerm(update.term, commands);
		} else {
			toolbar.replaceTerm(update.term, update.termIndex);
		}
	} else if (update && !update.term) {
		toolbar.removeTerm(update.termIndex);
	} else if (!update) {
		toolbar.replaceTerms(terms, commands);
	}
	toolbar.updateControlVisibility("replaceTerms");
	toolbar.insertIntoDocument();
};

const startHighlighting = (
	termsOld: ReadonlyArray<MatchTerm>,
	terms: ReadonlyArray<MatchTerm>,
	highlighter: AbstractEngineManager,
	hues: ReadonlyArray<number>,
) => {
	const termsToHighlight: ReadonlyArray<MatchTerm> = terms.filter(term =>
		!termsOld.find(termOld => termEquals(term, termOld))
	);
	const termsToPurge: ReadonlyArray<MatchTerm> = termsOld.filter(term =>
		!terms.find(termOld => termEquals(term, termOld))
	);
	highlighter.startHighlighting(
		terms,
		termsToHighlight,
		termsToPurge,
		hues,
	);
};

/**
 * Inserts a uniquely identified CSS stylesheet to perform all extension styling.
 */
const styleElementsInsert = () => {
	if (!document.getElementById(EleID.STYLE)) {
		const style = document.createElement("style");
		style.id = EleID.STYLE;
		document.head.appendChild(style);
	}
	if (!document.getElementById(EleID.STYLE_PAINT)) {
		const style = document.createElement("style");
		style.id = EleID.STYLE_PAINT;
		document.head.appendChild(style);
	}
	if (!document.getElementById(EleID.DRAW_CONTAINER)) {
		const container = document.createElement("div");
		container.id = EleID.DRAW_CONTAINER;
		document.body.insertAdjacentElement("afterend", container);
	}
};

const styleElementsCleanup = () => {
	const style = document.getElementById(EleID.STYLE);
	if (style && style.textContent !== "") {
		style.textContent = "";
	}
	const stylePaint = document.getElementById(EleID.STYLE_PAINT);
	if (stylePaint instanceof HTMLStyleElement && stylePaint.sheet) {
		while (stylePaint.sheet.cssRules.length) {
			stylePaint.sheet.deleteRule(0);
		}
	}
};

// TODO decompose this horrible generator function
/**
 * Returns a generator function to consume individual command objects and produce their desired effect.
 * @param terms Terms being controlled, highlighted, and jumped to.
 */
const respondToCommand_factory = (
	terms: ReadonlyArray<MatchTerm>,
	termSetter: TermSetter,
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
		if (focusedIdx !== null && focusedIdx >= terms.length) {
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
			termSetter.setTerms(controlsInfo.termsOnHold);
			break;
		} case "stepGlobal": {
			if (focusReturnToDocument()) {
				break;
			}
			highlighter.stepToNextOccurrence(commandInfo.reversed ?? false, true, null);
			break;
		} case "advanceGlobal": {
			focusReturnToDocument();
			const term = (selectModeFocus && focusedIdx !== null) ? terms[focusedIdx] : null;
			highlighter.stepToNextOccurrence(commandInfo.reversed ?? false, false, term);
			break;
		} case "focusTermInput": {
			getToolbarOrNull()?.focusTermInput(commandInfo.termIdx ?? null);
			break;
		} case "selectTerm": {
			if (focusedIdx === null) {
				break;
			}
			getToolbarOrNull()?.indicateTerm(terms[focusedIdx]);
			if (!selectModeFocus) {
				highlighter.stepToNextOccurrence(!!commandInfo.reversed, false, terms[focusedIdx]);
			}
			break;
		}}
	};
};

interface TermSetter<Async = true> extends TermReplacer<Async>, TermAppender<Async> {
	setTerms: (termsNew: ReadonlyArray<MatchTerm>) => Async extends true ? Promise<void> : void;
}

interface TermReplacer<Async = true> {
	replaceTerm: (term: MatchTerm | null, index: number) => Async extends true ? Promise<void> : void;
}

interface TermAppender<Async = true> {
	appendTerm: (term: MatchTerm) => Async extends true ? Promise<void> : void;
}

(() => {
	// Can't remove controls because a script may be left behind from the last install, and start producing unhandled errors. FIXME
	//controlsRemove();
	const commands: BrowserCommands = [];
	let terms: ReadonlyArray<MatchTerm> = [];
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
	const updateTermStatus = (term: MatchTerm) => getToolbarOrNull()?.updateTermStatus(term);
	const highlighter: AbstractEngineManager = new EngineManager(updateTermStatus, termTokens, termPatterns);
	const termSetterInternal: TermSetter<false> = {
		setTerms: termsNew => {
			if (itemsMatch(terms, termsNew, termEquals)) {
				return;
			}
			const termsOld: ReadonlyArray<MatchTerm> = [ ...terms ];
			terms = termsNew;
			Stylesheet.fillContent(terms, termTokens, hues, controlsInfo.barLook, highlighter);
			updateToolbar(termsOld, terms, null, getToolbar(), commands);
			// Give the interface a chance to redraw before performing highlighting.
			setTimeout(() => {
				if (controlsInfo.pageModifyEnabled) startHighlighting(termsOld, terms, highlighter, hues);
			});
		},
		replaceTerm: (term, termIndex) => {
			const termsOld: ReadonlyArray<MatchTerm> = [ ...terms ];
			if (term) {
				const termsNew = [ ...terms ];
				termsNew[termIndex] = term;
				terms = termsNew;
			} else {
				terms = terms.slice(0, termIndex).concat(terms.slice(termIndex + 1));
			}
			Stylesheet.fillContent(terms, termTokens, hues, controlsInfo.barLook, highlighter);
			updateToolbar(termsOld, terms, { term, termIndex }, getToolbar(), commands);
			// Give the interface a chance to redraw before performing highlighting.
			setTimeout(() => {
				if (controlsInfo.pageModifyEnabled) startHighlighting(termsOld, terms, highlighter, hues);
			});
		},
		appendTerm: term => {
			const termsOld: ReadonlyArray<MatchTerm> = [ ...terms ];
			terms = terms.concat(term);
			Stylesheet.fillContent(terms, termTokens, hues, controlsInfo.barLook, highlighter);
			updateToolbar(termsOld, terms, { term, termIndex: termsOld.length }, getToolbar(), commands);
			// Give the interface a chance to redraw before performing highlighting.
			setTimeout(() => {
				if (controlsInfo.pageModifyEnabled) startHighlighting(termsOld, terms, highlighter, hues);
			});
		},
	};
	const termSetter: TermSetter = {
		setTerms: async termsNew => {
			termSetterInternal.setTerms(termsNew);
			await sendBackgroundMessage({ terms });
		},
		replaceTerm: async (term, termIndex) => {
			termSetterInternal.replaceTerm(term, termIndex);
			await sendBackgroundMessage({ terms });
		},
		appendTerm: async term => {
			termSetterInternal.appendTerm(term);
			await sendBackgroundMessage({ terms });
		},
	};
	const doPhrasesMatchTerms = (phrases: ReadonlyArray<string>) => (
		phrases.length === terms.length // TODO this seems dubious
		&& phrases.every(phrase => terms.find(term => term.phrase === phrase))
	);
	// TODO remove toolbar completely when not in use
	// use WeakRef?
	const { getToolbarOrNull, getToolbar } = (() => {
		// TODO use generator function?
		let toolbar: AbstractToolbar | null = null;
		return {
			getToolbarOrNull: () => toolbar,
			getToolbar: () => {
				if (!toolbar) {
					toolbar = new Toolbar([],
						commands, hues,
						controlsInfo,
						termSetter, doPhrasesMatchTerms,
						termTokens, highlighter,
					);
				}
				return toolbar;
			}
		};
	})();
	const respondToCommand = respondToCommand_factory(terms, termSetter, controlsInfo, getToolbar, highlighter);
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
		styleElementsInsert();
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
			getToolbarOrNull()?.updateVisibility();
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
				getToolbarOrNull()?.updateControlVisibility(controlName);
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
			terms = [];
			getToolbarOrNull()?.remove();
			styleElementsCleanup();
		}
		if (message.terms) {
			// TODO make sure same MatchTerm objects are used for terms which are equivalent
			termSetterInternal.setTerms(message.terms);
		}
		if (message.commands) {
			for (const command of message.commands) {
				respondToCommand(command);
			}
		}
		const toolbar = getToolbarOrNull();
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
						assert(false, "not initialized, so highlighting remains inactive", "no init response was received");
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

export type {
	TermSetter, TermReplacer, TermAppender,
	DoPhrasesMatchTerms,
	UpdateTermStatus,
	ControlsInfo,
};
