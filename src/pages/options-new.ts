const getControlOptionTemp = <ConfigK extends ConfigKey>(
	labelInfo: { text: string, tooltip?: string },
	configKey: ConfigK,
	key: keyof ConfigValues[ConfigK],
	inputType: InputType,
	details?: {
		onChange?: () => unknown
		command?: { name?: string, shortcut?: string }
	}
): PageInteractionInfo => ({
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
			forInput: details?.command?.name && (chrome.commands["update"] || (this["browser"] && browser.commands["update"]))
				? (input, getText, setFloatingText) => forInput(input, getText, setFloatingText, details?.command?.name as string)
				: undefined,
		},
		input: {
			getType: () => inputType,
			onLoad: async setValue => {
				const config = await configGet({ [configKey]: [ key ] });
				const value = config[configKey][key];
				switch (configGetType({ [configKey]: [ key ] })[configKey][key]) {
				case StorageType.VALUE: {
					setValue(value as StorageValue<unknown> as unknown as boolean);
					break;
				} case StorageType.LIST_VALUE: {
					setValue((value as StorageListValue<unknown>).getList() as unknown as boolean);
					break;
				}}
			},
			onChange: async (value, objectIndex, containerIndex, store) => {
				if (store) {
					const config = await configGet({ [configKey]: [ key ] });
					const valueTransformed = (inputType === InputType.TEXT_ARRAY)
						? (value as unknown as string).split(",")
						: inputType === InputType.TEXT_NUMBER
							? parseFloat(value as unknown as string)
							: value;
					switch (configGetType({ [configKey]: [ key ] })[configKey][key]) {
					case StorageType.VALUE: {
						(config[configKey][key] as unknown) = valueTransformed as StorageValue<unknown>;
						break;
					} case StorageType.LIST_VALUE: {
						const valueDefault = configGetDefault({ [configKey]: [ key ] })[configKey][key] as StorageListInterface<unknown>;
						const listV = new StorageListInterface(valueDefault.baseList);
						listV.setList(valueTransformed as Array<unknown>);
						(config[configKey][key] as unknown) = listV;
						break;
					}}
					await configSet(config);
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
	const panelsInfo: Array<PagePanelInfo> = [
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
							"highlightMethod",
							"hues",
							InputType.TEXT_ARRAY,
						),
						{
							className: "option",
							label: {
								text: "Accessibility options",
								tooltip: `${getName()} lacks visibility and screen reader options.\nI have a few plans, but need ideas!`,
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
									placeholder: `How can I make ${getName()} more usable for you?`,
									required: true,
								},
								alerts: {
									[PageAlertType.SUCCESS]: {
										text: "Success",
									},
									[PageAlertType.FAILURE]: {
										text: "Status {status}: {text}",
									},
									[PageAlertType.PENDING]: {
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
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Always show on search pages" },
							"showHighlights",
							"overrideSearchPages",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Always show on other pages" },
							"showHighlights",
							"overrideResearchPages",
							InputType.CHECKBOX,
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
										configGet({ urlFilters: [ "noPageModify" ] }).then(config => //
											config.urlFilters.noPageModify.getList().map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet({ urlFilters: [ "noPageModify" ] }).then(config => {
											config.urlFilters.noPageModify.setList(array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											}));
											configSet(config);
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
							InputType.TEXT,
							{ onChange: pageReload },
						),
						getControlOptionTemp(
							{ text: "Variant" },
							"theme",
							"variant",
							InputType.TEXT,
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
							InputType.TEXT_NUMBER,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Contrast" },
							"theme",
							"contrast",
							InputType.TEXT_NUMBER,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Lightness" },
							"theme",
							"lightness",
							InputType.TEXT_NUMBER,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Saturation" },
							"theme",
							"saturation",
							InputType.TEXT_NUMBER,
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
							InputType.TEXT_NUMBER,
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
							InputType.TEXT_NUMBER,
						),
						getControlOptionTemp(
							{ text: "Opacity of keyword buttons" },
							"barLook",
							"opacityTerm",
							InputType.TEXT_NUMBER,
						),
						getControlOptionTemp(
							{ text: "Opacity of control buttons" },
							"barLook",
							"opacityControl",
							InputType.TEXT_NUMBER,
						),
						getControlOptionTemp(
							{ text: "Rounded corners" },
							"barLook",
							"borderRadius",
							InputType.TEXT_NUMBER,
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
							InputType.CHECKBOX,
							{ command: { name: "toggle-research-tab" } },
						),
						getControlOptionTemp(
							{ text: "\"Web Search with these keywords\"" },
							"barControlsShown",
							"performSearch",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "\"Show/hide highlights\"" },
							"barControlsShown",
							"toggleHighlights",
							InputType.CHECKBOX,
							{ command: { name: "toggle-highlights" } },
						),
						getControlOptionTemp(
							{ text: "\"Add a new keyword\"" },
							"barControlsShown",
							"appendTerm",
							InputType.CHECKBOX,
							{ command: { name: "focus-term-append" } },
						),
						getControlOptionTemp(
							{ text: "\"Replace keywords with detected search\"" },
							"barControlsShown",
							"replaceTerms",
							InputType.CHECKBOX,
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
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Show options button" },
							"barLook",
							"showRevealIcon",
							InputType.CHECKBOX,
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
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Collapse when a Keyword List applies to the page" },
							"barCollapse",
							"fromTermListAuto",
							InputType.CHECKBOX,
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
							InputType.TEXT_ARRAY,
						),
						getControlOptionTemp(
							{ text: "Keywords to exclude" },
							"autoFindOptions",
							"stoplist",
							InputType.TEXT_ARRAY,
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
										configGet({ urlFilters: [ "nonSearch" ] }).then(config => //
											config.urlFilters.nonSearch.getList().map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet({ urlFilters: [ "nonSearch" ] }).then(config => {
											config.urlFilters.nonSearch.setList(array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											}));
											configSet(config);
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
`${getName()} has two highlighting methods. \
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
							"highlightMethod",
							"paintReplaceByElement",
							InputType.CHECKBOX,
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
							InputType.CHECKBOX,
						),*/
					],
				},
				{
					title: {
						text: "Matching Options for New Keywords",
					},
					interactions: [
						//getControlOptionTemp(
						//	{ text: "Case sensitivity" },
						//	"matchingDefaults",
						//	"case",
						//	InputType.CHECKBOX,
						//),
						//getControlOptionTemp(
						//	{ text: "Word stemming" },
						//	"matchingDefaults",
						//	"stem",
						//	InputType.CHECKBOX,
						//),
						//getControlOptionTemp(
						//	{ text: "Whole word matching" },
						//	"matchingDefaults",
						//	"whole",
						//	InputType.CHECKBOX,
						//),
						//getControlOptionTemp(
						//	{ text: "Diacritics sensitivity" },
						//	"matchingDefaults",
						//	"diacritics",
						//	InputType.CHECKBOX,
						//),
						//getControlOptionTemp(
						//	{ text: "Custom regular expression (regex)" },
						//	"matchingDefaults",
						//	"regex",
						//	InputType.CHECKBOX,
						//),
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
			width: isWindowInFrame() && useChromeAPI() ? 650 : undefined,
		});
	};
})();

(() => {
	return () => {
		loadOptionsNew();
	};
})()();
