import type * as Message from "/dist/modules/messaging.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { MatchTerm } from "/dist/modules/match-term.mjs";

type MessageHandler = (
	message: Message.Tab,
	sender: chrome.runtime.MessageSender | null,
	sendResponse: (response: Message.TabResponse) => void,
) => void

let messageHandleHighlightGlobal: MessageHandler = () => undefined;

const registerMessageHandler = (handler: MessageHandler) => {
	messageHandleHighlightGlobal = handler;
};

const termsSet = async (terms: Array<MatchTerm>) => {
	messageHandleHighlightGlobal({ terms: terms.slice() }, null, () => undefined);
	await sendBackgroundMessage({ terms });
};

export { registerMessageHandler, termsSet };
