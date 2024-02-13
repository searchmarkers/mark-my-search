import type * as Message from "/dist/modules/messaging.mjs";

// TODO document
const sendBackgroundMessage = (message: Message.Background): Promise<Message.BackgroundResponse> =>
	chrome.runtime.sendMessage(message)
;

export { sendBackgroundMessage };
