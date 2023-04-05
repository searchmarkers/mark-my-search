const forInput = (input: HTMLInputElement, getText: (() => Promise<string | undefined>) | undefined, commandKey: string) => {
	input.type = "text";
	input.placeholder = "Type a shortcut";
	input.addEventListener("focus", () => {
		input.value = "";
	});
	const modifiers = {
		ctrl: false,
		alt: false,
		meta: false,
		shift: false,
	};
	const modifierEventKeys = new Set([
		"Alt", "AltGraph", "CapsLock", "Control", "Fn", "FnLock", "Hyper", "Meta",
		"NumLock", "ScrollLock", "Shift", "Super", "Symbol", "SymbolLock", "OS",
	]);
	const useMacKeys = navigator["userAgentData"]
		? navigator["userAgentData"].platform === "macOS"
		: navigator.platform.toLowerCase().includes("mac");
	let key = "";
	const inputUpdate = (event: KeyboardEvent) => {
		Object.keys(modifiers).forEach(mod => {
			modifiers[mod] = event[`${mod}Key`];
		});
		const modifierNames = {
			ctrl: useMacKeys ? "MacCtrl" : "Ctrl",
			alt: "Alt",
			meta: useMacKeys ? "Command" : "",
			shift: "Shift",
		};
		const keyName = (Object.entries({
			" ": "Space",
			".": "Period",
			",": "Comma",
			ArrowUp: "Up",
			ArrowDown: "Down",
			ArrowLeft: "Left",
			ArrowRight: "Right",
		}).find(([ character ]) => event.key === character) ?? [ key, key.length === 1 ? key.toUpperCase() : key ])[1];
		input.value = [
			Object.keys(modifiers).filter(mod => modifiers[mod]).map(mod => modifierNames[mod]).join("+"),
			keyName,
		].filter(part => part).join("+");
		if (input.value === "+") {
			input.value = "";
		}
		if (input.value && input.validity.valid) {
			inputCommit();
		}
	};
	const inputCommit = async () => {
		key = "";
		Object.keys(modifiers).forEach(mod => {
			modifiers[mod] = false;
		});
		await browser.commands.update({
			name: commandKey,
			shortcut: input.value,
		});
		input.blur();
	};
	const inputReset = async () => {
		if (getText) {
			input.value = await getText() ?? "";
		}
	};
	// Per Firefox spec for WebExtension key combinations at
	// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands
	const primaryMods = [ "Ctrl", "Alt", "Command", "MacCtrl" ];
	input.pattern = `^(${[
		// Does not protect against repeated modifiers.
		`(${
			primaryMods.join("|")
		})\\+((Shift|${
			primaryMods.join("|")
		})\\+)?([A-Z0-9]|F[1-9]|F1[0-2]|Comma|Period|Home|End|PageUp|PageDown|Space|Insert|Delete|Up|Down|Left|Right)`,
		"Media(NextTrack|PlayPause|PrevTrack|Stop)",
	].map(pattern => `(${pattern})`).join("|")})$|^\\s*$`;
	input.addEventListener("keydown", event => {
		if (event.key === "Tab") {
			return;
		}
		event.preventDefault();
		event.cancelBubble = true;
		if (event.key === "Backspace") {
			input.value = "";
			inputCommit();
			return;
		}
		if (!modifierEventKeys.has(event.key)) {
			key = event.key;
		}
		inputUpdate(event);
	});
	input.addEventListener("keyup", event => {
		if (event.key === "Tab") {
			return;
		}
		event.preventDefault();
		event.cancelBubble = true;
		if (event.key === key) {
			key = "";
		}
		inputUpdate(event);
	});
	input.addEventListener("focusout", () => {
		inputReset();
	});
};

const getControlOptionTemp = (labelText: string, configKey: ConfigKey, key: string,
	commandInfo?: { key?: string, shortcut?: string }): PageInteractionInfo => ({
	className: "option",
	label: {
		text: labelText,
	},
	note: {
		text: commandInfo?.shortcut,
		getText: commandInfo?.key
			? async () =>
				(await chrome.commands.getAll()).find(command => command.name === commandInfo.key)?.shortcut ?? ""
			: undefined,
		forInput: commandInfo?.key ? (input, getText) => forInput(input, getText, commandInfo.key as string) : undefined,
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
							{ key: "toggle-research-tab" },
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
							{ key: "toggle-highlights" },
						),
						getControlOptionTemp(
							"Append a new keyword to the toolbar",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"appendTerm",
							{ key: "focus-term-append" },
						),
						getControlOptionTemp(
							"Apply detected search keywords",
							ConfigKey.BAR_CONTROLS_SHOWN,
							"replaceTerms",
							{ key: "terms-replace" },
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
