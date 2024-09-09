/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/**
 * Returns a generator function, the generator of which consumes empty requests for calling the specified function.
 * Request fulfillment is variably delayed based on activity.
 * @param call The function to be intermittently called.
 * @param waitDuration Time to wait after the last request, before fulfilling it.
 * @param reschedulingDelayMax Maximum total delay time between requests and fulfillment.
 */
const requestCallFn = (
	call: () => void,
	waitDuration: number,
	reschedulingDelayMax: number,
): (() => void) => {
	const reschedulingRequestCountMargin = 1;
	let timeRequestAcceptedLast = 0;
	let requestCount = 0;
	const scheduleRefresh = () =>
		setTimeout(() => {
			const dateMs = Date.now();
			if (requestCount > reschedulingRequestCountMargin
				&& dateMs < timeRequestAcceptedLast + reschedulingDelayMax) {
				requestCount = 0;
				scheduleRefresh();
				return;
			}
			requestCount = 0;
			call();
		}, waitDuration + 20); // Arbitrary small amount added to account for lag (preventing lost updates).
	return () => {
		requestCount++;
		const dateMs = Date.now();
		if (dateMs > timeRequestAcceptedLast + waitDuration) {
			timeRequestAcceptedLast = dateMs;
			scheduleRefresh();
		}
	};
};

export { requestCallFn };
