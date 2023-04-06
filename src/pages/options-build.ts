const getControlOptionTemp = (labelText: string, configKey: ConfigKey, key: string,
	command?: { name?: string, shortcut?: string }): PageInteractionInfo => ({
	className: "option",
	label: {
		text: labelText,
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
				text: "Toolbar",
			},
			sections: [
				{
					title: {
						text: "Controls to Show",
					},
					interactions: [
						getControlOptionTemp(
							"Deactivate in the current tab",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"disableTabResearch",
							{ name: "toggle-research-tab" },
						),
						getControlOptionTemp(
							"Perform a search using the current keywords",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"performSearch",
						),
						getControlOptionTemp(
							"Toggle display of highlighting",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"toggleHighlights",
							{ name: "toggle-highlights" },
						),
						getControlOptionTemp(
							"Append a new keyword to the toolbar",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"appendTerm",
							{ name: "focus-term-append" },
						),
						getControlOptionTemp(
							"Apply detected search keywords",
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
							"Edit keyword",
							ConfigKey.BAR_LOOK,
							"showEditIcon",
						),
						getControlOptionTemp(
							"Select matching options",
							ConfigKey.BAR_LOOK,
							"showRevealIcon",
							{ shortcut: "Shift+Space" }, // Hardcoded in the content script.
						),
					],
				},
				{
					title: {
						text: "Style",
					},
					interactions: [
						getControlOptionTemp(
							"Font size",
							ConfigKey.BAR_LOOK,
							"fontSize",
						),
						getControlOptionTemp(
							"Opacity of keyword buttons",
							ConfigKey.BAR_LOOK,
							"opacityTerm",
						),
						getControlOptionTemp(
							"Opacity of control buttons",
							ConfigKey.BAR_LOOK,
							"opacityControl",
						),
						getControlOptionTemp(
							"Radius of rounded corners",
							ConfigKey.BAR_LOOK,
							"borderRadius",
						),
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, `
body
	{ height: 570px; border: none; border-radius: 0; }
.brand
	{ display: none; }
.container.panel
	{ border-top: none; }
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
