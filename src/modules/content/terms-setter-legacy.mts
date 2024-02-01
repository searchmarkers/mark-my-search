import {
	type HighlightMessage, type HighlightMessageResponse,
	messageSendBackground,
} from "/dist/modules/message.mjs";
import { MatchTerm } from "/dist/modules/match-term.mjs";

type MessageHandler = (
	message: HighlightMessage,
	sender: chrome.runtime.MessageSender | null,
	sendResponse: (response: HighlightMessageResponse) => void,
) => void

let messageHandleHighlightGlobal: MessageHandler = () => undefined;

const registerMessageHandler = (handler: MessageHandler) => {
	messageHandleHighlightGlobal = handler;
};

const termsSet = async (terms: Array<MatchTerm>) => {
	messageHandleHighlightGlobal({ terms: terms.slice() }, null, () => undefined);
	await messageSendBackground({ terms });
};

export { registerMessageHandler, termsSet };
