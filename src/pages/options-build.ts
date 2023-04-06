const getOrderedShortcut = (keys: Array<string>): Array<string> => {
	keys = keys.slice();
	keys.sort((a, b) => (
		(!b.endsWith("Ctrl") && b !== "Alt" && b !== "Command" && b !== "Shift") ||
		a.endsWith("Ctrl") || (a === "Alt" && !b.endsWith("Ctrl")) || (a === "Command" && b === "Shift")
	) ? -1 : 1);
	return keys;
};

const forInput = (input: HTMLInputElement, getText: (() => Promise<string | undefined>) | undefined,
	setFloatingText: (text: string) => void, commandName: string) => {
	input.classList.add("hidden-caret");
	input.type = "text";
	input.placeholder = "Type a shortcut";
	input.addEventListener("focus", () => {
		input.value = "";
	});
	const useMacKeys = navigator["userAgentData"]
		? navigator["userAgentData"].platform === "macOS"
		: navigator.platform.toLowerCase().includes("mac");
	const getKeyName = (keyLetter: string) => (Object.entries({
		" ": "Space",
		".": "Period",
		",": "Comma",
		ArrowUp: "Up",
		ArrowDown: "Down",
		ArrowLeft: "Left",
		ArrowRight: "Right",
	}).find(([ letter ]) => keyLetter === letter) ?? [ keyLetter, keyLetter.length === 1 ? keyLetter.toUpperCase() : keyLetter ])[1];
	const getModifierName = (modifier: string) => ({
		ctrl: useMacKeys ? "MacCtrl" : "Ctrl",
		alt: "Alt",
		meta: useMacKeys ? "Command" : "",
		shift: "Shift",
	})[modifier];
	const commandKeySequences: Record<string, Array<string>> = {};
	const reservedShortcutPattern = new RegExp(`^(${
		[
			[ "F([3679]|1[12])" ],
			[ "Shift", "F([3579]|12)" ],
			[ "Alt", "[1-9]|D|F7|Left|Right|Home" ],
			[ "Ctrl", "0|[ABCDFGHIJKLMNOPQRSTUVWXZ]|F[457]|PageUp|PageDown" ],
			[ "Ctrl", "Shift", "[ABCDEGHIJKMNOPRSTWXYZ]|Delete|PageUp|PageDown" ],
			[ "Ctrl", "Alt", "R" ],
		].map(patternSequence => `(${patternSequence.map(pattern => `(${pattern})`).join("\\+")})`).join("|")
	})$`);
	const modifierEventKeys = new Set([
		"Alt", "AltGraph", "CapsLock", "Control", "Fn", "FnLock", "Hyper", "Meta",
		"NumLock", "ScrollLock", "Shift", "Super", "Symbol", "SymbolLock", "OS",
	]);
	// Per Firefox spec for WebExtension key combinations at
	// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/commands
	const primaryMods = [ "Ctrl", "Alt", "Command", "MacCtrl" ];
	const keyNamePatterns = {
		regular: "[A-Z0-9]|Comma|Period|Home|End|PageUp|PageDown|Space|Insert|Delete|Up|Down|Left|Right",
		function: "F[1-9]|F[1-9][0-9]",
		media: "Media(NextTrack|PlayPause|PrevTrack|Stop)",
	};
	let key = "";
	const modifiers = {
		ctrl: false,
		alt: false,
		meta: false,
		shift: false,
	};
	const modifiersUpdate = (event: KeyboardEvent) => {
		Object.keys(modifiers).forEach(mod => {
			modifiers[mod] = event[`${mod}Key`];
		});
	};
	const inputUpdate = () => {
		const modifierPart = Object.keys(modifiers).filter(mod => modifiers[mod])
			.map(mod => getModifierName(mod)).join("+");
		const keyPart = getKeyName(key);
		input.value = modifierPart + (modifierPart ? "+" : "") + keyPart;
		if (input.value) {
			if (input.validity.valid) {
				if (reservedShortcutPattern.test(input.value)) {
					setFloatingText("Can't override a Firefox shortcut");
					return;
				}
				const duplicates = Object.entries(commandKeySequences)
					.filter(([ key, shortcut ]) => key !== commandName && shortcut.join("+") === input.value);
				if (duplicates.length) {
					setFloatingText("This shortcut is already in use by Mark\u00A0My\u00A0Search");
					return;
				}
				setFloatingText("");
				inputCommit();
			} else {
				const keyNameRegex = new RegExp(
					`^(${Object.values(keyNamePatterns).map(pattern => `(${pattern})`).join("|")})$`
				);
				if (keyPart && !keyNameRegex.test(keyPart)) {
					setFloatingText("Invalid letter");
				} else if (input.value.startsWith("Shift+") || !modifierPart && keyPart) {
					setFloatingText("Include Ctrl or Alt");
				} else if (Object.keys(modifiers).filter(mod => modifiers[mod]).length > 2) {
					setFloatingText("No more than 2 modifiers");
				} else if (input.value.endsWith("+")) {
					setFloatingText("Type a letter");
				} else {
					setFloatingText("Invalid combination");
				}
			}
		} else {
			setFloatingText("");
		}
	};
	const inputCommit = async () => {
		const updating = browser.commands.update({
			name: commandName,
			shortcut: input.value,
		});
		if (input.value) {
			const container = input.parentElement?.parentElement?.parentElement as HTMLElement; // Hack
			const warning = container.querySelector(".warning");
			const text = "If a shortcut doesn't work, it might already be used by another add-on.";
			if (!warning || warning.textContent !== text) {
				pageInsertWarning(container, text);
			}
		}
		input.blur();
		await updating;
	};
	input.pattern = `^(${[
		// Does not protect against repeated modifiers.
		`(${
			primaryMods.join("|")
		})\\+((Shift|${
			primaryMods.join("|")
		})\\+)?(${keyNamePatterns.regular})`,
		`((${
			primaryMods.join("|")
		})\\+)?((Shift|${
			primaryMods.join("|")
		})\\+)?(${keyNamePatterns.function})`,
		keyNamePatterns.media,
	].map(pattern => `(${pattern})`).join("|")})$|^\\s*$`;
	input.addEventListener("keydown", event => {
		if (event.key === "Tab") {
			return;
		}
		if (event.key === "Escape") {
			input.blur();
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
		modifiersUpdate(event);
		inputUpdate();
	});
	input.addEventListener("keyup", event => {
		event.preventDefault();
		event.cancelBubble = true;
		const keyChanged = event.key === key;
		if (keyChanged) {
			key = "";
		}
		const getModifiersActive = () => Object.entries(modifiers).filter(({ 1: value }) => value).join(",");
		const modsActive = getModifiersActive();
		modifiersUpdate(event);
		if (keyChanged || getModifiersActive() !== modsActive) {
			inputUpdate();
		}
	});
	input.addEventListener("focusin", () => {
		chrome.commands.getAll().then(commands => {
			commands.forEach(command => {
				if (!command.name) {
					return;
				}
				commandKeySequences[command.name] = getOrderedShortcut(command.shortcut?.split("+") ?? []);
			});
		});
	});
	input.addEventListener("focusout", async () => {
		key = "";
		Object.keys(modifiers).forEach(mod => {
			modifiers[mod] = false;
		});
		if (getText) {
			input.value = await getText() ?? "";
		}
	});
};

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
