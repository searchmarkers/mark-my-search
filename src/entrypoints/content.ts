/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

// Block-scoped to prevent variable redeclaration errors.
// This occurs when a new instance of the add-on executes its content script in the same page as an extant one.
{
	type ResearchRecord = import("/dist/modules/research.mjs").ResearchRecord

	type Message_Tab = import("/dist/modules/messaging.mjs").Tab
	type Message_TabCommand = import("/dist/modules/messaging.mjs").TabCommand
	type Message_Background = import("/dist/modules/messaging.mjs").Background
	type Message_BackgroundResponse = import("/dist/modules/messaging.mjs").BackgroundResponse

	const messageQueue: Array<Message_Tab> = [];

	const handleMessageUninitialized = async (message: Message_Tab) => {
		messageQueue.push(message);
		if (messageQueue.length === 1) {
			load();
		}
	};

	chrome.runtime.onMessage.addListener(handleMessageUninitialized);

	type MainModule = {
		handleMessage: (message: Message_Tab) => void
	}

	const load = async () => {
		const message: Message_Background = {
			type: "request",
			requestType: "tabResearchRecord",
		};
		const researchResponsePromise = chrome.runtime.sendMessage(message);
		const { handleMessage } = await import(chrome.runtime.getURL("/dist/content.mjs")) as MainModule;
		const researchResponse = await researchResponsePromise as Message_BackgroundResponse;
		const researchRecord = researchResponse.type === "tabResearchRecord" ? researchResponse.researchRecord : null;
		if (document.body) {
			initialize(handleMessage, researchRecord);
		} else {
			const observer = new MutationObserver(() => {
				if (document.body) {
					observer.disconnect();
					initialize(handleMessage, researchRecord);
				}
			});
			observer.observe(document.documentElement, { childList: true });
		}
	};

	const initialize = (handleMessage: (message: Message_Tab) => void, researchRecord: ResearchRecord | null) => {
		chrome.runtime.onMessage.removeListener(handleMessageUninitialized);
		chrome.runtime.onMessage.addListener(handleMessage);
		for (const message of messageQueue) {
			handleMessage(message);
		}
		if (researchRecord) {
			const commands: Array<Message_TabCommand> = [ {
				type: "toggleHighlightsShown",
				enable: researchRecord.highlightsShown,
			}, {
				type: "toggleBarCollapsed",
				enable: researchRecord.barCollapsed,
			}, {
				type: "useTerms",
				terms: researchRecord.terms,
				replaceExisting: true,
			} ];
			if (researchRecord.active) {
				commands.push({
					type: "activate",
				});
			}
			handleMessage({
				type: "commands",
				commands,
			});
		}
	};
}
