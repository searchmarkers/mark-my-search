const getControlOptionTemp = (labelInfo: { text: string, tooltip?: string }, configKey: ConfigKey, key: string,
	command?: { name?: string, shortcut?: string }): PageInteractionInfo => ({
	className: "option",
	label: {
		text: labelInfo.text,
		tooltip: labelInfo.tooltip,
	},
	note: {
		text: command?.shortcut,
		getText: command?.name
			? async () => getOrderedShortcut(
				(await chrome.commands.getAll())
					.find(commandOther => commandOther.name === command.name)?.shortcut?.split("+") ?? []
			).join("+") : undefined,
		forInput: command?.name
			? (input, getText, setFloatingText) => forInput(input, getText, setFloatingText, command.name as string)
			: undefined,
	},
	input: {
		getType: () => {
			return (typeof configDefault[configKey][key].wValue === "boolean") ? InputType.CHECKBOX : InputType.TEXT;
		},
		onLoad: async setChecked => {
			const config = await configGet([ configKey ]);
			setChecked(config[configKey][key]);
		},
		onToggle: async checked => {
			const config = await configGet([ configKey ]);
			config[configKey][key] = checked;
			await configSet(config);
		},
	}
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
				text: "General",
			},
			sections: ([] as Array<PageSectionInfo>).concat(isWindowInFrame() ? [
				{
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
			] : []),
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
						),
						getControlOptionTemp(
							{ text: "Opacity of keyword buttons" },
							ConfigKey.BAR_LOOK,
							"opacityTerm",
						),
						getControlOptionTemp(
							{ text: "Opacity of control buttons" },
							ConfigKey.BAR_LOOK,
							"opacityControl",
						),
						getControlOptionTemp(
							{ text: "Radius of rounded corners" },
							ConfigKey.BAR_LOOK,
							"borderRadius",
						),
					],
				},
				{
					title: {
						text: "Controls to Show",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Deactivate in the current tab" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"disableTabResearch",
							{ name: "toggle-research-tab" },
						),
						getControlOptionTemp(
							{ text: "Perform a search using the current keywords" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"performSearch",
						),
						getControlOptionTemp(
							{ text: "Toggle display of highlighting" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"toggleHighlights",
							{ name: "toggle-highlights" },
						),
						getControlOptionTemp(
							{ text: "Append a new keyword to the toolbar" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"appendTerm",
							{ name: "focus-term-append" },
						),
						getControlOptionTemp(
							{ text: "Apply detected search keywords" },
							ConfigKey.BAR_CONTROLS_SHOWN,
							"replaceTerms",
							{ name: "terms-replace" },
						),
					],
				},
				{
					title: {
						text: "Keyword Edit Buttons",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "Edit keyword" },
							ConfigKey.BAR_LOOK,
							"showEditIcon",
						),
						getControlOptionTemp(
							{ text: "Select matching options" },
							ConfigKey.BAR_LOOK,
							"showRevealIcon",
							{ shortcut: "Shift+Space" }, // Hardcoded in the content script.
						),
					],
				},
				{
					title: {
						text: "Collapse On Activation",
					},
					interactions: [
						getControlOptionTemp(
							{ text: "When a search is detected" },
							ConfigKey.BAR_COLLAPSE,
							"fromSearch",
						),
						getControlOptionTemp(
							{ text: "When a keyword list applies to the page" },
							ConfigKey.BAR_COLLAPSE,
							"fromTermListAuto",
						),
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
							},
							ConfigKey.HIGHLIGHT_METHOD,
							"paintReplaceByClassic",
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
							},
							ConfigKey.HIGHLIGHT_METHOD,
							"paintUseExperimental",
						),
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, (isWindowInFrame() ? `
body
	{ height: 570px; border-radius: 0; }
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
