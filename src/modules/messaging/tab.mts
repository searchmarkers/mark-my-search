/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type * as Message from "/dist/modules/messaging.d.mjs";
import { log } from "/dist/modules/common.mjs";

// TODO document
const sendTabMessage = (tabId: number, message: Message.Tab): Promise<Message.TabResponse> => (
	chrome.tabs.sendMessage(tabId, message).catch(reason => {
		log("messaging fail", "scripts may not be injected", { reason });
	}) as Promise<Message.TabResponse>
);

export { sendTabMessage };
