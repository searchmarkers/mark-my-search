import { compatibility } from "/dist/modules/common.mjs";

chrome.tabs.query = (compatibility.browser === "chromium")
	? chrome.tabs.query
	: browser.tabs.query as typeof chrome.tabs.query
;

chrome.tabs.sendMessage = (compatibility.browser === "chromium")
	? chrome.tabs.sendMessage
	: browser.tabs.sendMessage as typeof chrome.tabs.sendMessage
;

chrome.tabs.get = (compatibility.browser === "chromium")
	? chrome.tabs.get
	: browser.tabs.get as typeof chrome.tabs.get
;

chrome.search["search"] = (compatibility.browser === "chromium")
	? (options: { query: string, tabId: number }) =>
		chrome.search["query"]({ text: options.query, tabId: options.tabId }, () => undefined)
	: browser.search.search
;

chrome.commands.getAll = (compatibility.browser === "chromium")
	? chrome.commands.getAll
	: browser.commands.getAll
;
