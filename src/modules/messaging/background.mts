/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type * as Message from "/dist/modules/messaging.mjs";

// TODO document
const sendBackgroundMessage = (message: Message.Background): Promise<Message.BackgroundResponse> =>
	chrome.runtime.sendMessage(message)
;

export { sendBackgroundMessage };
