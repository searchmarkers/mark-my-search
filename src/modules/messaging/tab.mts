import type * as Message from "/dist/modules/messaging.mjs";
import { log } from "/dist/modules/common.mjs";

// TODO document
const sendTabMessage = (tabId: number, message: Message.Tab): Promise<Message.TabResponse> =>
	chrome.tabs.sendMessage(tabId, message).catch(reason => {
		log("messaging fail", "scripts may not be injected", { reason });
	}) as Promise<Message.TabResponse>
;

export { sendTabMessage };
