/* eslint-disable indent */ // TODO remove
import type { StorageSyncValues } from "/dist/modules/privileged/storage.mjs";
import type { CommandInfo } from "/dist/modules/commands.mjs";
import type * as Message from "/dist/modules/messaging.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, termEquals } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass } from "/dist/modules/common.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import * as PaintMethodLoader from "/dist/modules/highlight/engines/paint/method-loader.mjs";
import * as Stylesheet from "/dist/modules/interface/stylesheet.mjs";
import * as TermsSetter from "/dist/modules/interface/terms-setter-legacy.mjs";
import * as Toolbar from "/dist/modules/interface/toolbar.mjs";
import * as ToolbarClasses from "/dist/modules/interface/toolbar/classes.mjs";
import { assert, compatibility, itemsMatch } from "/dist/modules/common.mjs";

type UpdateTermStatus = (term: MatchTerm) => void

interface ControlsInfo {
	pageModifyEnabled: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: Array<MatchTerm>
	["barControlsShown"]: StorageSyncValues["barControlsShown"]
	["barLook"]: StorageSyncValues["barLook"]
	matchMode: MatchMode
}

/**
 * Safely removes focus from the toolbar, returning it to the current document.
 * @returns `true` if focus was changed (i.e. it was in the toolbar), `false` otherwise.
 */
const focusReturnToDocument = (): boolean => {
	const activeElement = document.activeElement;
	if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${EleID.BAR}`)) {
		(activeElement as HTMLInputElement).blur();
		return true;
	}
	return false;
};

/**
 * Extracts terms from the currently user-selected string.
 * @returns The extracted terms, split at some separator and some punctuation characters,
 * with some other punctuation characters removed.
 */
const getTermsFromSelection = () => {
	const selection = getSelection();
	const terms: Array<MatchTerm> = [];
	if (selection && selection.anchorNode) {
		const termsAll = selection.toString().split(/\r|\p{Zs}|\p{Po}|\p{Cc}/gu)
			// (carriage return) | Space Separators | Other Punctuation | Control
			.map(phrase => phrase.replace(/\p{Ps}|\p{Pe}|\p{Pi}|\p{Pf}/gu, ""))
			// Open Punctuation | Close Punctuation | Initial Punctuation | Final Punctuation
			.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
		const termSelectors: Set<string> = new Set();
		termsAll.forEach(term => {
			if (!termSelectors.has(term.token)) {
				termSelectors.add(term.token);
				terms.push(term);
			}
		});
	}
	return terms;
};

/**
 * Inserts the toolbar with term controls and begins continuously highlighting terms in the document.
 * All controls necessary are first removed.
 * Highlighting refreshes may be whole or partial depending on which terms changed.
 * TODO document params
 */
const refreshTermControlsAndStartHighlighting = (
	terms: Array<MatchTerm>,
	controlsInfo: ControlsInfo,
	highlighter: Highlighter,
	commands: Toolbar.BrowserCommands,
	hues: TermHues,
	termsUpdate?: Array<MatchTerm>,
) => {
	// TODO fix this abomination of a function
	let termUpdate: MatchTerm | undefined = undefined;
	let termToUpdateIdx: keyof typeof Toolbar.TermChange | number | undefined = undefined;
	if (termsUpdate) {
		if (termsUpdate.length < terms.length
			&& (terms.length === 1 || termEquals(termsUpdate[termsUpdate.length - 1], terms[terms.length - 2]))
		) {
			termToUpdateIdx = Toolbar.TermChange.REMOVE;
			termUpdate = terms[terms.length - 1];
		} else if (termsUpdate.length > terms.length
			&& (termsUpdate.length === 1 || termEquals(termsUpdate[termsUpdate.length - 2], terms[terms.length - 1]))
		) {
			termToUpdateIdx = Toolbar.TermChange.CREATE;
			termUpdate = termsUpdate[termsUpdate.length - 1];
		} else {
			const termsCopy = terms.slice();
			const termsUpdateCopy = termsUpdate?.slice();
			let i = 0;
			while (termsUpdateCopy.length && termsCopy.length) {
				if (termEquals(termsUpdateCopy[0], termsCopy[0])) {
					termsUpdateCopy.splice(0, 1);
					termsCopy.splice(0, 1);
					i++;
				} else {
					if (termEquals(termsUpdateCopy[0], termsCopy[1])) {
						// Term deleted at current index.
						termToUpdateIdx = Toolbar.TermChange.REMOVE;
						termUpdate = termsCopy[0];
						termsCopy.splice(0, 1);
						i++;
					} else if (termEquals(termsUpdateCopy[1], termsCopy[0])) {
						// Term created at current index.
						termToUpdateIdx = Toolbar.TermChange.CREATE;
						termUpdate = termsUpdateCopy[0];
						termsUpdateCopy.splice(0, 1);
					} else if (termEquals(termsUpdateCopy[1], termsCopy[1])) {
						// Term changed at current index.
						termToUpdateIdx = i;
						termUpdate = termsUpdateCopy[0];
						termsUpdateCopy.splice(0, 1);
						termsCopy.splice(0, 1);
						i++;
					}
					break;
				}
			}
		}
	}
	const termsToHighlight: Array<MatchTerm> = [];
	const termsToPurge: Array<MatchTerm> = [];
	if (document.getElementById(EleID.BAR)) {
		if (termsUpdate !== undefined && termToUpdateIdx !== undefined
			&& termToUpdateIdx !== Toolbar.TermChange.REMOVE && termUpdate) {
			if (termToUpdateIdx === Toolbar.TermChange.CREATE) {
				terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
				const idx = terms.length - 1;
				Toolbar.insertTermControl(terms, idx, commands, controlsInfo, highlighter);
				termsToHighlight.push(terms[idx]);
			} else {
				const term = terms[termToUpdateIdx];
				termsToPurge.push(Object.assign({}, term));
				term.matchMode = termUpdate.matchMode;
				term.phrase = termUpdate.phrase;
				term.compile();
				Toolbar.refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx, highlighter);
				termsToHighlight.push(term);
			}
		} else if (termsUpdate !== undefined) {
			if (termToUpdateIdx === Toolbar.TermChange.REMOVE && termUpdate) {
				const termRemovedPreviousIdx = terms.findIndex(term => JSON.stringify(term) === JSON.stringify(termUpdate));
				if (assert(
					termRemovedPreviousIdx !== -1, "term not deleted", "not stored in this page", { term: termUpdate }
				)) {
					Toolbar.removeTermControl(termRemovedPreviousIdx);
					highlighter.current?.undoHighlights([ terms[termRemovedPreviousIdx] ]);
					terms.splice(termRemovedPreviousIdx, 1);
					Stylesheet.fillContent(terms, hues, controlsInfo.barLook, highlighter);
					highlighter.current?.countMatches();
					return;
				}
			} else {
				terms.splice(0);
				termsUpdate.forEach(term => {
					terms.push(new MatchTerm(term.phrase, term.matchMode));
				});
				highlighter.current?.undoHighlights();
				Toolbar.insertToolbar(terms, commands, hues, controlsInfo, highlighter);
			}
		} else {
			return;
		}
	} else if (termsUpdate) {
		terms.splice(0);
		termsUpdate.forEach(term => {
			terms.push(new MatchTerm(term.phrase, term.matchMode));
		});
		highlighter.current?.undoHighlights();
		Toolbar.insertToolbar(terms, commands, hues, controlsInfo, highlighter);
	} else {
		return;
	}
	Stylesheet.fillContent(terms, hues, controlsInfo.barLook, highlighter);
	if (!controlsInfo.pageModifyEnabled) {
		const bar = document.getElementById(EleID.BAR) as Element;
		bar.classList.add(EleClass.DISABLED);
		return;
	}
	// Give the interface a chance to redraw before performing [expensive] highlighting.
	setTimeout(() => {
		highlighter.current?.startHighlighting(
			terms,
			termsToHighlight,
			termsToPurge,
		);
	});
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
	const stylePaint = document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement | null;
	if (stylePaint && stylePaint.sheet) {
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
const produceEffectOnCommandFn = function* (
	terms: Array<MatchTerm>,
	controlsInfo: ControlsInfo,
	highlighter: Highlighter,
) {
	let selectModeFocus = false;
	let focusedIdx = 0;
	while (true) {
		const commandInfo: CommandInfo = yield;
		if (!commandInfo) {
			continue; // Requires an initial empty call before working (TODO solve this issue).
		}
		const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
		focusedIdx = getFocusedIdx(focusedIdx);
		switch (commandInfo.type) {
		case "toggleBar": {
			const bar = document.getElementById(EleID.BAR) as HTMLElement;
			bar.classList.toggle(EleClass.BAR_HIDDEN);
			break;
		} case "toggleSelect": {
			selectModeFocus = !selectModeFocus;
			break;
		} case "replaceTerms": {
			TermsSetter.termsSet(controlsInfo.termsOnHold);
			break;
		} case "stepGlobal": {
			if (focusReturnToDocument()) {
				break;
			}
			highlighter.current?.stepToNextOccurrence(commandInfo.reversed ?? false, true);
			break;
		} case "advanceGlobal": {
			focusReturnToDocument();
			const term = selectModeFocus ? terms[focusedIdx] : undefined;
			highlighter.current?.stepToNextOccurrence(commandInfo.reversed ?? false, false, term);
			break;
		} case "focusTermInput": {
			Toolbar.focusTermInput(commandInfo.termIdx);
			break;
		} case "selectTerm": {
			const barTerms = document.getElementById(EleID.BAR_TERMS) as HTMLElement;
			barTerms.classList.remove(ToolbarClasses.getControlPadClass(focusedIdx));
			focusedIdx = getFocusedIdx(commandInfo.termIdx ?? -1);
			barTerms.classList.add(ToolbarClasses.getControlPadClass(focusedIdx));
			if (!selectModeFocus) {
				highlighter.current?.stepToNextOccurrence(!!commandInfo.reversed, false, terms[focusedIdx]);
			}
			break;
		}}
	}
};

const onWindowMouseUp = () => {
	if (document.activeElement && document.activeElement.classList.contains(EleClass.CONTROL_REVEAL)) {
		(document.querySelector(`#${EleID.BAR} .${EleClass.WAS_FOCUSED}`) as HTMLElement | null)?.focus();
	}
};

(() => {
	// Can't remove controls because a script may be left behind from the last install, and start producing unhandled errors. FIXME
	//controlsRemove();
	const commands: Toolbar.BrowserCommands = [];
	const terms: Array<MatchTerm> = [];
	const hues: TermHues = [];
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
	const highlighter: Highlighter = {};
	const updateTermStatus = (term: MatchTerm) => Toolbar.updateTermStatus(term, highlighter);
	const produceEffectOnCommand = produceEffectOnCommandFn(terms, controlsInfo, highlighter);
	produceEffectOnCommand.next(); // Requires an initial empty call before working (TODO otherwise mitigate).
	const getDetails = (request: Message.TabDetailsRequest) => ({
		terms: request.termsFromSelection ? getTermsFromSelection() : undefined,
		highlightsShown: request.highlightsShown ? controlsInfo.highlightsShown : undefined,
	});
	type MessageHandler = (
		message: Message.Tab,
		sender: chrome.runtime.MessageSender,
		sendResponse: (response: Message.TabResponse) => void,
	) => void
	let queuingPromise: Promise<unknown> | undefined = undefined;
	const messageHandleHighlight: MessageHandler = (message, sender, sendResponse) => {
		if (message.getDetails) {
			sendResponse(getDetails(message.getDetails));
		}
		(async () => {
		if (queuingPromise) {
			await queuingPromise;
		}
		styleElementsInsert();
		if (message.setHighlighter !== undefined) {
			highlighter.current?.endHighlighting();
			if (message.setHighlighter.engine === "highlight" && compatibility.highlight.highlightEngine) {
				const enginePromise = import("/dist/modules/highlight/engines/highlight.mjs");
				queuingPromise = enginePromise;
				const { HighlightEngine } = await enginePromise;
				highlighter.current = new HighlightEngine(terms, hues, updateTermStatus);
			} else if (message.setHighlighter.engine === "paint" && compatibility.highlight.paintEngine) {
				const enginePromise = import("/dist/modules/highlight/engines/paint.mjs");
				const methodPromise = PaintMethodLoader.loadMethod(message.setHighlighter.paintEngineMethod ?? "paint");
				queuingPromise = new Promise<void>(resolve =>
					enginePromise.then(() => methodPromise.then(() => resolve()))
				);
				const { PaintEngine } = await enginePromise;
				highlighter.current = new PaintEngine(terms, hues, updateTermStatus, await methodPromise);
			} else {
				const enginePromise = import("/dist/modules/highlight/engines/element.mjs");
				queuingPromise = enginePromise;
				const { ElementEngine } = await enginePromise;
				highlighter.current = new ElementEngine(terms, hues, updateTermStatus);
			}
			queuingPromise = undefined;
		}
		if (message.enablePageModify !== undefined && controlsInfo.pageModifyEnabled !== message.enablePageModify) {
			controlsInfo.pageModifyEnabled = message.enablePageModify;
			if (!controlsInfo.pageModifyEnabled) {
				highlighter.current?.endHighlighting();
			}
		}
		if (message.extensionCommands) {
			commands.splice(0);
			message.extensionCommands.forEach(command => commands.push(command));
		}
		Object.entries(message.barControlsShown ?? {})
			.forEach(([ controlName, value ]: [ Toolbar.ControlButtonName, boolean ]) => {
				controlsInfo.barControlsShown[controlName] = value;
				Toolbar.controlVisibilityUpdate(controlName, controlsInfo, terms);
			});
		Object.entries(message.barLook ?? {}).forEach(([ key, value ]) => {
			controlsInfo.barLook[key] = value;
		});
		if (message.highlightMethod) {
			hues.splice(0);
			message.highlightMethod.hues.forEach(hue => hues.push(hue));
		}
		if (message.matchMode) {
			Object.assign(controlsInfo.matchMode, message.matchMode);
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
			window.removeEventListener("mouseup", onWindowMouseUp);
			highlighter.current?.endHighlighting();
			terms.splice(0);
			Toolbar.controlsRemove();
			styleElementsCleanup();
		}
		if (message.terms !== undefined &&
			(!itemsMatch(terms, message.terms, termEquals) || (!terms.length && !document.getElementById(EleID.BAR)))
		) {
			window.addEventListener("mouseup", onWindowMouseUp);
			refreshTermControlsAndStartHighlighting(
				terms,
				controlsInfo,
				highlighter,
				commands,
				hues,
				message.terms,
			);
		}
		(message.commands ?? []).forEach(command => {
			produceEffectOnCommand.next(command);
		});
		Toolbar.controlVisibilityUpdate("replaceTerms", controlsInfo, terms);
		const bar = document.getElementById(EleID.BAR);
		if (bar) {
			bar.classList.toggle(EleClass.HIGHLIGHTS_SHOWN, controlsInfo.highlightsShown);
			bar.classList.toggle(EleClass.COLLAPSED, controlsInfo.barCollapsed);
		}
		})();
	};
	(() => {
		const messageQueue: Array<{
			message: Message.Tab,
			sender: chrome.runtime.MessageSender,
			sendResponse: (response: Message.TabResponse) => void,
		}> = [];
		const messageHandleHighlightUninitialized: MessageHandler = (message, sender, sendResponse) => {
			if (message.getDetails) {
				sendResponse(getDetails(message.getDetails));
				delete message.getDetails;
			}
			if (!Object.keys(message).length) {
				return;
			}
			messageQueue.unshift({ message, sender, sendResponse });
			if (messageQueue.length === 1) {
				sendBackgroundMessage({ initializationGet: true }).then(message => {
					if (!message) {
						assert(false, "not initialized, so highlighting remains inactive", "no init response was received");
						return;
					}
					const initialize = () => {
						chrome.runtime.onMessage.removeListener(messageHandleHighlightUninitialized);
						chrome.runtime.onMessage.addListener(messageHandleHighlight);
						messageHandleHighlight(message, sender, sendResponse);
						messageQueue.forEach(messageInfo => {
							messageHandleHighlight(messageInfo.message, messageInfo.sender, messageInfo.sendResponse);
						});
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
	TermsSetter.registerMessageHandler(messageHandleHighlight);
})();

export type { UpdateTermStatus, ControlsInfo };
