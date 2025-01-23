/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { Config, type ConfigValues } from "/dist/modules/storage.mjs";
import type * as Message from "/dist/modules/messaging.d.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { type MatchMode, MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { isUrlPageModificationAllowed } from "/dist/modules/url-handling/url-tests.mjs";
import type { ArrayAccessor, ArrayMutator, ArrayObservable, Partial2 } from "/dist/modules/common.mjs";
import type { AbstractEngineManager } from "/dist/modules/highlight/engine-manager.d.mjs";
import { EngineManager } from "/dist/modules/highlight/engine-manager.mjs";
import type { AbstractToolbar, ControlButtonName } from "/dist/modules/interface/toolbar.d.mjs";
import { Toolbar } from "/dist/modules/interface/toolbar.mjs";
import { ArrayBox } from "/dist/modules/common.mjs";

type ControlsInfo = {
	pageModificationAllowed: boolean
	highlightsShown: boolean
	barCollapsed: boolean
	termsOnHold: ReadonlyArray<MatchTerm>
	barControlsShown: Readonly<ConfigValues["barControlsShown"]>
	barLook: Readonly<ConfigValues["barLook"]>
	matchMode: Readonly<MatchMode>
}

interface ToolbarGetter {
	get: () => AbstractToolbar | null
}

interface ToolbarGetterCreator extends ToolbarGetter {
	getCreateIfNull: () => AbstractToolbar
}

class TermsSyncService {
	#remoteTerms: ReadonlyArray<MatchTerm> = [];

	constructor (termsBox: ArrayAccessor<MatchTerm> & ArrayObservable<MatchTerm>) {
		termsBox.addListener(terms => {
			if (termsBox.itemsEqual(this.#remoteTerms)) {
				return;
			}
			// NOTE: Race condition:
			// After sending terms (A) to remote, we receive terms (B);
			// remote silently accepts (A), but we believe remote holds (B).
			sendBackgroundMessage({
				type: "commands",
				commands: [ {
					type: "assignTabTerms",
					terms,
				} ],
			});
			this.#remoteTerms = terms;
		});
	}

	updateRemoteTerms (terms: ReadonlyArray<MatchTerm>) {
		this.#remoteTerms = terms;
	}
}

export const handleMessage = await (async () => {
	const commands: Array<chrome.commands.Command> = [];
	let hues: ReadonlyArray<number> = [];
	const termTokens = new TermTokens();
	const termPatterns = new TermPatterns();
	const controlsInfo: ControlsInfo = { // Unless otherwise indicated, the values assigned here are arbitrary and to be overridden.
		// TODO: Make engine manager adhere to this? (instead of handling it our side)
		pageModificationAllowed: true, // Currently has an effect.
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
	let active = false;
	let selectModeFocus = false;
	let focusedIndex: number | null = null;
	const highlighter: AbstractEngineManager = new EngineManager(termTokens, termPatterns);
	highlighter.addHighlightingUpdatedListener(() => {
		toolbarBox.get()?.updateStatuses();
	});
	type TermsBox = ArrayAccessor<MatchTerm> & ArrayMutator<MatchTerm> & ArrayObservable<MatchTerm>
	const termsBox: TermsBox = new ArrayBox<MatchTerm>((a, b) => JSON.stringify(a) === JSON.stringify(b));
	termsBox.addListener(terms =>
		// The timeout gives the toolbar a chance to redraw before we start highlighting.
		setTimeout(() => {
			if (!(controlsInfo.pageModificationAllowed && active)) {
				return;
			}
			highlighter.startHighlighting(terms, hues);
		})
	);
	const termsSyncService = new TermsSyncService(termsBox);
	class ToolbarBox implements ToolbarGetterCreator {
		// TODO: Remove toolbar completely when not in use. Use WeakRef?
		#toolbar: AbstractToolbar | null = null;

		get () {
			return this.#toolbar;
		}
		getCreateIfNull () {
			if (!this.#toolbar) {
				this.#toolbar = new Toolbar(hues, commands, controlsInfo, termsBox, termTokens, highlighter);
			}
			return this.#toolbar;
		}
	}
	const toolbarBox = new ToolbarBox();
	const applyConfig = async (config: Partial2<ConfigValues>) => {
		if (config.urlFilters?.noPageModify) {
			const allowed = isUrlPageModificationAllowed(location.href, config.urlFilters.noPageModify);
			controlsInfo.pageModificationAllowed = allowed;
			toolbarBox.get()?.updateVisibility();
			if (!controlsInfo.pageModificationAllowed) {
				highlighter.removeEngine();
			}
		}
		if (config.highlighter && controlsInfo.pageModificationAllowed) {
			highlighter.removeEngine();
			if (config.highlighter.paintEngine) {
				highlighter.signalPaintEngineMethod(config.highlighter.paintEngine.method);
			}
			if (config.highlighter.engine) {
				//queuingPromise = highlighter.setEngine(config.highlighter.engine);
				//await queuingPromise;
				//queuingPromise = undefined;
				await highlighter.setEngine(config.highlighter.engine);
			}
			// TODO: Make this one apply only when the user visits the tab (as otherwise many tabs may "start highlighting" at once).
			highlighter.applyEngine();
		}
		if (config.barControlsShown) {
			for (const [ controlName, shown ] of Object.entries(config.barControlsShown)) {
				controlsInfo.barControlsShown[controlName] = shown;
			}
			const toolbar = toolbarBox.get();
			if (toolbar) {
				for (const controlName of Object.keys(config.barControlsShown) as Array<ControlButtonName>) {
					toolbar.updateControlVisibility(controlName);
				}
			}
		}
		if (config.barLook) {
			for (const [ key, value ] of Object.entries(config.barLook)) {
				controlsInfo.barLook[key] = value;
			}
		}
		if (config.highlightLook?.hues) {
			hues = [ ...config.highlightLook.hues ];
		}
		if (config.matchModeDefaults) {
			for (const [ option, on ] of Object.entries(config.matchModeDefaults)) {
				controlsInfo.matchMode[option] = on;
			}
		}
	};
	const handleRequestMessage = (message: Message.TabRequest, sendResponse: (response: Message.TabResponse) => void) => {
		switch (message.requestType) {
		case "selectedText": {
			const selection = getSelection();
			sendResponse({
				type: "selectedText",
				selectedText: (selection && selection.anchorNode) ? selection.toString() : "",
			});
			return;
		}
		case "highlightsShown": {
			sendResponse({
				type: "highlightsShown",
				highlightsShown: controlsInfo.highlightsShown,
			});
			return;
		}}
	};
	const handleCommand = (command: Message.TabCommand) => {
		if (focusedIndex !== null && focusedIndex >= termsBox.getItems().length) {
			focusedIndex = null;
		}
		switch (command.type) {
		case "receiveExtensionCommands": {
			commands.splice(0, commands.length, ...command.extensionCommands);
			return;
		}
		case "useTerms": {
			if (command.replaceExisting) {
				// TODO: Make sure same MatchTerm objects are used for terms which are equivalent.
				termsSyncService.updateRemoteTerms(command.terms);
				termsBox.setItems(command.terms);
			} else {
				controlsInfo.termsOnHold = command.terms;
			}
			return;
		}
		case "activate": {
			const toolbar = toolbarBox.getCreateIfNull();
			toolbar.insertAdjacentTo(document.body, "beforebegin");
			if (controlsInfo.pageModificationAllowed && !active) {
				highlighter.startHighlighting(termsBox.getItems(), hues);
			}
			active = true;
			return;
		}
		case "deactivate": {
			highlighter.endHighlighting();
			toolbarBox.get()?.remove();
			active = false;
			return;
		}
		case "toggleHighlightsShown": {
			controlsInfo.highlightsShown = command.enable;
			return;
		}
		case "toggleBarCollapsed": {
			controlsInfo.barCollapsed = command.enable;
			return;
		}
		case "toggleSelectMode": {
			selectModeFocus = !selectModeFocus;
			return;
		}
		case "replaceTerms": {
			termsBox.setItems(controlsInfo.termsOnHold);
			return;
		}
		case "stepGlobal": {
			if (toolbarBox.get()?.isFocused()) {
				// We return the document selection and do not proceed.
				toolbarBox.get()?.returnSelectionToDocument();
				return;
			}
			highlighter.stepToNextOccurrence(!command.forwards, true, null);
			return;
		}
		case "jumpGlobal": {
			if (toolbarBox.get()?.isFocused()) {
				// We return the document selection and then jump from there.
				toolbarBox.get()?.returnSelectionToDocument();
			}
			const term = (selectModeFocus && focusedIndex !== null)
				? termsBox.getItems()[focusedIndex]
				: null;
			highlighter.stepToNextOccurrence(!command.forwards, false, term);
			return;
		}
		case "selectTerm": {
			focusedIndex = command.termIndex;
			if (command.termIndex >= termsBox.getItems().length) {
				focusedIndex = null;
				return;
			}
			const term = termsBox.getItems()[focusedIndex];
			toolbarBox.get()?.indicateTerm(term);
			if (!selectModeFocus) {
				highlighter.stepToNextOccurrence(!command.forwards, false, term);
			}
			return;
		}
		case "focusTermInput": {
			toolbarBox.get()?.focusTermInput(command.termIndex);
			return;
		}}
	};
	const handleMessage = (message: Message.Tab, sender: void, sendResponse: (response: Message.TabResponse) => void) => {
		switch (message.type) {
		case "request": {
			handleRequestMessage(message, sendResponse);
			break;
		}
		case "commands": {
			message.commands.forEach(handleCommand);
			break;
		}}
		const toolbar = toolbarBox.get();
		if (toolbar) {
			toolbar.updateHighlightsShownFlag();
			toolbar.updateCollapsed();
			toolbar.updateControlVisibility("replaceTerms");
		}
	};
	await applyConfig(await Config.get({
		barControlsShown: true,
		barLook: true,
		highlightLook: true,
		highlighter: true,
		matchModeDefaults: true,
		urlFilters: true,
	}));
	return handleMessage;
})();

export type { ControlsInfo };
