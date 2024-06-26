import * as Manifest from "/dist/modules/manifest.mjs";
import {
	type Page, loadPage, pageReload, pageThemeUpdate,
	isWindowInFrame, sendProblemReport, getOrderedShortcut, forInput,
} from "/dist/modules/page/build.mjs";
import type { StoreImmediate, StoreList, ConfigValues, ConfigKey } from "/dist/modules/privileged/storage.mjs";
import { StoreType, StoreListInterface, Config } from "/dist/modules/privileged/storage.mjs";
import { compatibility } from "/dist/modules/common.mjs";

const getControlOptionTemp = <ConfigK extends ConfigKey>(
	labelInfo: { text: string, tooltip?: string },
	configKey: ConfigK,
	key: keyof ConfigValues[ConfigK],
	inputType: Page.InputType,
	details?: {
		onChange?: () => unknown
		command?: { name?: string, shortcut?: string }
	}
): Page.InteractionInfo => ({
		className: "option",
		label: {
			text: labelInfo.text,
			tooltip: labelInfo.tooltip,
		},
		note: {
			text: details?.command?.shortcut,
			getText: details?.command?.name
				? async () => getOrderedShortcut(
					(await chrome.commands.getAll())
						.find(commandOther => commandOther.name === details?.command?.name)?.shortcut?.split("+") ?? []
				).join("+") : undefined,
			forInput: details?.command?.name && (chrome.commands["update"] || (globalThis["browser"] && browser.commands["update"]))
				? (input, getText, setFloatingText) => forInput(input, getText, setFloatingText, details!.command!.name!)
				: undefined,
		},
		input: {
			getType: () => inputType,
			onLoad: async setValue => {
				const config = await Config.get({ [configKey]: [ key ] });
				const value = config[configKey][key];
				switch (Config.getType({ [configKey]: [ key ] })[configKey][key]) {
				case StoreType.IMMEDIATE: {
					setValue(value as StoreImmediate<unknown> as unknown as boolean);
					break;
				} case StoreType.LIST: {
					setValue((value as StoreList<unknown>).getList() as unknown as boolean);
					break;
				}}
			},
			onChange: async (value, objectIndex, containerIndex, store) => {
				if (store) {
					const config = await Config.get({ [configKey]: [ key ] });
					const valueTransformed = (inputType === "textArray")
						? (value as unknown as string).split(",")
						: inputType === "textNumber"
							? parseFloat(value as unknown as string)
							: value;
					switch (Config.getType({ [configKey]: [ key ] })[configKey][key]) {
					case StoreType.IMMEDIATE: {
						(config[configKey][key] as unknown) = valueTransformed as StoreImmediate<unknown>;
						break;
					} case StoreType.LIST: {
						const storeList = Config.getDefault({ [configKey]: [ key ] })[configKey][key] as StoreListInterface<unknown>;
						storeList.setList(valueTransformed as Array<unknown>);
						(config[configKey][key] as unknown) = storeList;
						break;
					}}
					await Config.set(config);
				}
				if (details?.onChange) {
					details.onChange();
				}
			},
		},
	})
;

/**
 * Loads the sendoff page content into the page.
 * This presents the user with an offboarding form with detail, for use when the user has uninstalled the extension.
 */
const loadOptionsNew = (() => {
	/**
	 * Details of the page's panels and their various components.
	 */
	const panelsInfo: Array<Page.PanelInfo> = [
		{
			className: "panel-general",
			name: {
				text: "Highlighting",
			},
			sections: [
				{
					title: {
						text: "Highlight Style",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Color hues to cycle through" },
							"highlightLook",
							"hues",
							"textArray",
						),
						{
							className: "option",
							label: {
								text: "Accessibility options",
								tooltip: `${Manifest.getName()} lacks visibility and screen reader options.\nI have a few plans, but need ideas!`,
							},
						},
					],
				},
				{
					title: {
						text: "Suggest Usability Improvements",
						expands: true,
					},
					interactions: [
						{
							className: "action",
							submitters: [ {
								text: "Send suggestions",
								onClick: (messageText, formFields, onSuccess, onError) => {
									sendProblemReport(messageText, formFields)
										.then(onSuccess)
										.catch(onError);
								},
								message: {
									rows: 2,
									placeholder: `How can I make ${Manifest.getName()} more usable for you?`,
									required: true,
								},
								alerts: {
									success: {
										text: "Success",
									},
									failure: {
										text: "Status {status}: {text}",
									},
									pending: {
										text: "Pending, do not close popup",
									},
								},
							} ],
						},
					],
				},
				{
					title: {
						text: "Highlight Display",
					},
					interactions: [
						getControlOptionTemp(
							{
								text: "Show on activation",
								tooltip:
`This relates to automatic activation:
• when a search is detected
• when a Keyword List applies to the page`
								,
							},
							"showHighlights",
							"default",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Always show on search pages" },
							"showHighlights",
							"overrideSearchPages",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Always show on other pages" },
							"showHighlights",
							"overrideResearchPages",
							"checkbox",
						),
					],
				},
				{
					title: {
						text: "URL Blocklist",
					},
					interactions: [
						{
							className: "url",
							textbox: {
								className: "url-input",
								list: {
									getArray: () =>
										Config.get({ urlFilters: [ "noPageModify" ] }).then(config => //
											config.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										Config.get({ urlFilters: [ "noPageModify" ] }).then(config => {
											config.urlFilters.noPageModify = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											Config.set(config);
										})
									,
								},
								placeholder: "example.com/optional-path",
								spellcheck: false,
							},
						},
					],
				},
				{
					className: isWindowInFrame() ? undefined : "hidden",
					interactions: [
						{
							className: "link",
							anchor: {
								text: "Open in new tab",
								url: chrome.runtime.getURL("/pages/options.html"),
							},
						},
					],
				},
			],
		},
		{
			className: "panel-theme",
			name: {
				text: "Theme",
			},
			sections: [
				{
					title: {
						text: "Type",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Edition" },
							"theme",
							"edition",
							"text",
							{ onChange: pageReload },
						),
						getControlOptionTemp(
							{ text: "Variant" },
							"theme",
							"variant",
							"text",
							{ onChange: pageReload },
						),
					],
				},
				{
					title: {
						text: "Style",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Hue" },
							"theme",
							"hue",
							"textNumber",
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Contrast" },
							"theme",
							"contrast",
							"textNumber",
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Lightness" },
							"theme",
							"lightness",
							"textNumber",
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Saturation" },
							"theme",
							"saturation",
							"textNumber",
							{ onChange: pageThemeUpdate },
						),
					],
				},
				{
					title: {
						text: "Font",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Font scale" },
							"theme",
							"fontScale",
							"textNumber",
							{ onChange: pageThemeUpdate },
						),
					],
				},
			],
		},
		{
			className: "panel-toolbar",
			name: {
				text: "Toolbar",
			},
			sections: [
				{
					title: {
						text: "Style",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Font size" },
							"barLook",
							"fontSize",
							"textNumber",
						),
						getControlOptionTemp(
							{ text: "Opacity of keyword buttons" },
							"barLook",
							"opacityTerm",
							"textNumber",
						),
						getControlOptionTemp(
							{ text: "Opacity of control buttons" },
							"barLook",
							"opacityControl",
							"textNumber",
						),
						getControlOptionTemp(
							{ text: "Rounded corners" },
							"barLook",
							"borderRadius",
							"textNumber",
						),
					],
				},
				{
					title: {
						text: "Buttons",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "\"Deactivate in the current tab\"" },
							"barControlsShown",
							"disableTabResearch",
							"checkbox",
							{ command: { name: "toggle-research-tab" } },
						),
						getControlOptionTemp(
							{ text: "\"Web Search with these keywords\"" },
							"barControlsShown",
							"performSearch",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "\"Show/hide highlights\"" },
							"barControlsShown",
							"toggleHighlights",
							"checkbox",
							{ command: { name: "toggle-highlights" } },
						),
						getControlOptionTemp(
							{ text: "\"Add a new keyword\"" },
							"barControlsShown",
							"appendTerm",
							"checkbox",
							{ command: { name: "focus-term-append" } },
						),
						getControlOptionTemp(
							{ text: "\"Replace keywords with detected search\"" },
							"barControlsShown",
							"replaceTerms",
							"checkbox",
							{ command: { name: "terms-replace" } },
						),
					],
				},
				{
					title: {
						text: "Keyword Buttons",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Show edit pen" },
							"barLook",
							"showEditIcon",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Show options button" },
							"barLook",
							"showRevealIcon",
							"checkbox",
							{ command: { shortcut: "Shift+Space" } }, // Hardcoded in the content script.
						),
					],
				},
				{
					title: {
						text: "Collapse On Activation",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Collapse when a search is detected" },
							"barCollapse",
							"fromSearch",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Collapse when a Keyword List applies to the page" },
							"barCollapse",
							"fromTermListAuto",
							"checkbox",
						),
					],
				},
			],
		},
		{
			className: "panel-search",
			name: {
				text: "Search",
			},
			sections: [
				{
					title: {
						text: "Keywords",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "URL parameters containing keywords" },
							"autoFindOptions",
							"searchParams",
							"textArray",
						),
						getControlOptionTemp(
							{ text: "Keywords to exclude" },
							"autoFindOptions",
							"stoplist",
							"textArray",
						),
					],
				},
				{
					title: {
						text: "Search Engine Blocklist",
					},
					interactions: [
						{
							className: "url",
							textbox: {
								className: "url-input",
								list: {
									getArray: () =>
										Config.get({ urlFilters: [ "nonSearch" ] }).then(config => //
											config.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										Config.get({ urlFilters: [ "nonSearch" ] }).then(config => {
											config.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											Config.set(config);
										})
									,
								},
								placeholder: "example.com/optional-path",
								spellcheck: false,
							},
						},
					],
				},
			],
		},
		{
			className: "panel-term_lists",
			name: {
				text: "Keyword Lists",
			},
			sections: [
				{
					title: {
						text: "Keyword Lists",
					},
					interactions: [
						{
							className: "link",
							label: {
								text:
`Keyword Lists are available in the popup, but are glitchy and difficult to use.
Once fixed, they will be accessible here too.`
								,
							},
							anchor: {
								text: "Roadmap",
								url: "https://github.com/searchmarkers/mark-my-search/discussions/108",
							},
						},
					],
				},
			],
		},
		{
			className: "panel-advanced",
			name: {
				text: "Advanced",
			},
			sections: [
				{
					title: {
						text: "Highlighting Engine",
					},
					interactions: [
						getControlOptionTemp(
							{
								text: "Use CLASSIC highlighting",
								tooltip:
`${Manifest.getName()} has two highlighting methods. \
CLASSIC is a powerful variant of the model used by traditional highlighter extensions. \
PAINT is an alternate model invented for the Mark My Search browser extension.

CLASSIC
• Fairly efficient at idle time. Once highlighted, text is never re-highlighted until it changes.
	• Rendering is expensive, and makes the page sluggish when there are many highlights.
• Not efficient at matching time. The page can freeze for several seconds if many highlights are inserted.
• Causes parts of webpages to look different or break.

PAINT
• Not efficient at idle time. Highlight positions need to be recalculated on scrolling or layout changing.
	• Smooth but CPU heavy.
	• Large numbers of highlights are handled well.
• Very efficient at matching time. Matches are found instantly and almost never cause slowdown.
• Has no effect on webpages, but backgrounds which obscure highlights become hidden.`
								,
							},
							"highlighter",
							"engine",
							"text",
						),
						/*getControlOptionTemp(
							{
								text: "Use experimental browser APIs",
								tooltip:
`${getName()} can highlight using experimental APIs. The behavior of this flag will change over time.
Current effects:

CLASSIC
• None.

PAINT
• Firefox: The CSS element() function is used instead of SVG rendering.
• Chromium: The CSS [Houdini] Painting API is used instead of SVG rendering.`
								,
							},
							"highlightMethod",
							"paintUseExperimental",
							"checkbox",
						),*/
					],
				},
				{
					title: {
						text: "Matching Options for New Keywords",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Case sensitivity" },
							"matchModeDefaults",
							"case",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Word stemming" },
							"matchModeDefaults",
							"stem",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Whole word matching" },
							"matchModeDefaults",
							"whole",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Diacritics sensitivity" },
							"matchModeDefaults",
							"diacritics",
							"checkbox",
						),
						getControlOptionTemp(
							{ text: "Custom regular expression (regex)" },
							"matchModeDefaults",
							"regex",
							"checkbox",
						),
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, {
			titleText: "Options",
			tabsFill: isWindowInFrame(),
			borderShow: false,
			brandShow: !isWindowInFrame(),
			borderRadiusUse: !isWindowInFrame(),
			height: isWindowInFrame() ? 570 : undefined,
			width: (isWindowInFrame() && compatibility.browser === "chromium") ? 650 : undefined,
		});
	};
})();

(() => {
	return () => {
		loadOptionsNew();
	};
})()();
