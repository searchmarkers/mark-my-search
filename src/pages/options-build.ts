const getControlOptionTemp = (
	labelInfo: { text: string, tooltip?: string },
	configKey: ConfigKey,
	key: string,
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
		forInput: details?.command?.name
			? (input, getText, setFloatingText) => forInput(input, getText, setFloatingText, details?.command?.name as string)
			: undefined,
	},
	input: {
		getType: () => inputType,
		onLoad: async setValue => {
			const config = await configGet([ configKey ]);
			setValue(config[configKey][key]);
		},
		onChange: async (value, objectIndex, containerIndex, store) => {
			if (store) {
				const config = await configGet([ configKey ]);
				config[configKey][key] = (inputType === InputType.TEXT_ARRAY) ? (value as unknown as string).split(",") : value;
				await configSet(config);
			}
			if (details?.onChange) {
				details.onChange();
			}
		},
	},
});

/**
 * Loads the sendoff page content into the page.
 * This presents the user with an offboarding form with detail, for use when the user has uninstalled the extension.
 */
const loadOptions = (() => {
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
							ConfigKey.HIGHLIGHT_METHOD,
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
							ConfigKey.SHOW_HIGHLIGHTS,
							"default",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Always show on search pages" },
							ConfigKey.SHOW_HIGHLIGHTS,
							"overrideSearchPages",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Always show on other pages" },
							ConfigKey.SHOW_HIGHLIGHTS,
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
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => //
											sync.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => {
											sync.urlFilters.noPageModify = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											configSet(sync);
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
							ConfigKey.THEME,
							"edition",
							InputType.TEXT,
							{ onChange: pageReload },
						),
						getControlOptionTemp(
							{ text: "Variant" },
							ConfigKey.THEME,
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
							ConfigKey.THEME,
							"hue",
							InputType.TEXT,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Contrast" },
							ConfigKey.THEME,
							"contrast",
							InputType.TEXT,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Lightness" },
							ConfigKey.THEME,
							"lightness",
							InputType.TEXT,
							{ onChange: pageThemeUpdate },
						),
						getControlOptionTemp(
							{ text: "Saturation" },
							ConfigKey.THEME,
							"saturation",
							InputType.TEXT,
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
							ConfigKey.THEME,
							"fontScale",
							InputType.TEXT,
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
							ConfigKey.BAR_LOOK,
							"fontSize",
							InputType.TEXT,
						),
						getControlOptionTemp(
							{ text: "Opacity of keyword buttons" },
							ConfigKey.BAR_LOOK,
							"opacityTerm",
							InputType.TEXT,
						),
						getControlOptionTemp(
							{ text: "Opacity of control buttons" },
							ConfigKey.BAR_LOOK,
							"opacityControl",
							InputType.TEXT,
						),
						getControlOptionTemp(
							{ text: "Rounded corners" },
							ConfigKey.BAR_LOOK,
							"borderRadius",
							InputType.TEXT,
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
							ConfigKey.BAR_CONTROLS_SHOWN,
							"disableTabResearch",
							InputType.CHECKBOX,
							{ command: { name: "toggle-research-tab" } },
						),
						getControlOptionTemp(
							{ text: "\"Web Search with these keywords\"" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"performSearch",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "\"Show/hide highlights\"" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"toggleHighlights",
							InputType.CHECKBOX,
							{ command: { name: "toggle-highlights" } },
						),
						getControlOptionTemp(
							{ text: "\"Add a new keyword\"" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"appendTerm",
							InputType.CHECKBOX,
							{ command: { name: "focus-term-append" } },
						),
						getControlOptionTemp(
							{ text: "\"Replace keywords with detected search\"" },
							ConfigKey.BAR_CONTROLS_SHOWN,
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
							ConfigKey.BAR_LOOK,
							"showEditIcon",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Show options button" },
							ConfigKey.BAR_LOOK,
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
							ConfigKey.BAR_COLLAPSE,
							"fromSearch",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Collapse when a Keyword List applies to the page" },
							ConfigKey.BAR_COLLAPSE,
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
							ConfigKey.AUTO_FIND_OPTIONS,
							"searchParams",
							InputType.TEXT_ARRAY,
						),
						getControlOptionTemp(
							{ text: "Keywords to exclude" },
							ConfigKey.AUTO_FIND_OPTIONS,
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
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => //
											sync.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => {
											sync.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											configSet(sync);
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
							ConfigKey.HIGHLIGHT_METHOD,
							"paintReplaceByClassic",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
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
							ConfigKey.HIGHLIGHT_METHOD,
							"paintUseExperimental",
							InputType.CHECKBOX,
						),
					],
				},
				{
					title: {
						text: "Matching Options for New Keywords",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Case sensitivity" },
							ConfigKey.MATCH_MODE_DEFAULTS,
							"case",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Word stemming" },
							ConfigKey.MATCH_MODE_DEFAULTS,
							"stem",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Whole word matching" },
							ConfigKey.MATCH_MODE_DEFAULTS,
							"whole",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Diacritics sensitivity" },
							ConfigKey.MATCH_MODE_DEFAULTS,
							"diacritics",
							InputType.CHECKBOX,
						),
						getControlOptionTemp(
							{ text: "Custom regular expression (regex)" },
							ConfigKey.MATCH_MODE_DEFAULTS,
							"regex",
							InputType.CHECKBOX,
						),
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, (isWindowInFrame() ? `
body
	{ min-height: 570px; overflow-y: auto; border-radius: 0; }
.brand
	{ display: none; }
.container.panel
	{ border-top: none; }
` : "") + `
body
	{ border: none; }
.container.tab .tab
	{ flex: unset; }
		`);
	};
})();

(() => {
	return () => {
		loadOptions();
	};
})()();
