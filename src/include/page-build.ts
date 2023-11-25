type PageInteractionObjectRowInfo = {
	className: string
	key: string
	label?: PageInteractionInfo["label"]
	textbox?: PageInteractionInfo["textbox"]
	input?: PageInteractionInputInfo
}
type PageInteractionObjectColumnInfo = {
	className: string
	rows: Array<PageInteractionObjectRowInfo>
}
type PageInteractionSubmitterLoad = (setEnabled: (enabled: boolean) => void) => void
type PageInteractionSubmitterInfo = {
	text: string
	id?: string
	onLoad?: PageInteractionSubmitterLoad
	onClick: (
		messageText: string,
		formFields: Array<FormField>,
		onSuccess: () => void,
		onError: (error?: { status: number, text: string }) => void,
		index: number,
	) => void
	formFields?: Array<PageInteractionInfo>
	message?: {
		singleline?: boolean
		rows: number
		placeholder: string
		required?: boolean
	}
	alerts?: Record<PageAlertType, PageAlertInfo>
}
type PageInteractionInputFetch = () => InputType
type PageInteractionInputLoad = (setValue: (value: boolean) => void, objectIndex: number, containerIndex: number) => Promise<void>
type PageInteractionInputToggle = (checked: boolean, objectIndex: number, containerIndex: number, store: boolean) => void
type PageInteractionInputInfo = {
	autoId?: string
	getType?: PageInteractionInputFetch
	onLoad?: PageInteractionInputLoad
	onChange?: PageInteractionInputToggle
}
type PageInteractionInfo = {
	className: string
	list?: {
		getLength: () => Promise<number>
		pushWithName: (name: string) => Promise<void>
		removeAt: (index: number) => void
	}
	label?: {
		text: string
		getText?: (index: number) => Promise<string>
		setText?: (text: string, index: number) => void
		textbox?: {
			placeholder: string
		}
		tooltip?: string
	}
	object?: {
		className: string
		list: {
			getArray: (index: number) => Promise<Array<Record<string, unknown>>>
			setArray: (array: Array<Record<string, unknown>>, index: number) => Promise<void>
			getNew: (text: string) => Record<string, unknown>
		}
		name: {
			text: string
			textbox?: {
				placeholder: string
			}
		}
		columns: Array<PageInteractionObjectColumnInfo>
	}
	textbox?: {
		className: string
		list?: {
			getArray: (index: number) => Promise<Array<string>>
			setArray: (array: Array<string>, index: number) => void
		}
		placeholder: string
		spellcheck: boolean
		onLoad?: (setText: (text: string) => void, objectIndex: number, containerIndex: number) => Promise<void>
		onChange?: (text: string, objectIndex: number, containerIndex: number) => void
	}
	anchor?: {
		url: string
		text: string
	}
	submitters?: Array<PageInteractionSubmitterInfo>
	input?: PageInteractionInputInfo
	note?: {
		text?: string
		getText?: () => Promise<string | undefined>
		forInput?: (
			input: HTMLInputElement,
			getText: (() => Promise<string | undefined>) | undefined,
			setFloatingText: (text: string) => void,
		) => void
	}
}
type PageSectionInfo = {
	className?: string
	title?: {
		text: string
		expands?: boolean
	}
	interactions: Array<PageInteractionInfo>
}
type PagePanelInfo = {
	className: string
	name: {
		text: string
	}
	sections: Array<PageSectionInfo>
}
type PageAlertInfo = {
	text: string
	timeout?: number
}
type FormField = {
	question: string
	response: string
}

enum InputType {
	CHECKBOX = "checkbox",
	TEXT = "text",
	TEXT_ARRAY = "textArray",
	TEXT_NUMBER = "textNumber",
}

enum PageAlertType {
	SUCCESS = "success",
	FAILURE = "failure",
	PENDING = "pending",
}

chrome.tabs.query = useChromeAPI()
	? chrome.tabs.query
	: browser.tabs.query as typeof chrome.tabs.query;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isWindowInFrame = () =>
	new URL(location.href).searchParams.get("frame") !== null
;

/**
 * An EmailJS library function which sends an email using the EmailJS service.
 * @param service The name of a service category for the email.
 * @param template The name of a template under the service for the email.
 * @param details Custom template field entries.
 * @param key The API key to use.
 */
const sendEmail: (
	service: string,
	template: string,
	details: {
		addon_version?: string
		url?: string
		phrases?: string
		user_message?: string
		user_email?: string
		item_0_question?: string
		item_1_question?: string
		item_2_question?: string
		item_3_question?: string
		item_4_question?: string
		item_5_question?: string
		item_6_question?: string
		item_7_question?: string
		item_8_question?: string
		item_9_question?: string
		item_0_response?: string
		item_1_response?: string
		item_2_response?: string
		item_3_response?: string
		item_4_response?: string
		item_5_response?: string
		item_6_response?: string
		item_7_response?: string
		item_8_response?: string
		item_9_response?: string
	},
	key: string,
) => Promise<void> = window["libSendEmail"];

/**
 * Sends a problem report message to a dedicated inbox.
 * @param userMessage An optional message string to send as a comment.
	*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sendProblemReport = async (userMessage = "", formFields: Array<FormField>) => {
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const bank = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
	const phrases = bank.researchInstances[tab.id as number]
		? bank.researchInstances[tab.id as number].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
		: "";
	const message = {
		addon_version: getVersion(),
		url: tab.url,
		phrases,
		user_message: userMessage,
	};
	(formFields ?? []).forEach((formField, i) => {
		message[`item_${i}_question`] = formField.question;
		message[`item_${i}_response`] = formField.response === "true" ? "yes" : "";
	});
	return sendEmail(
		"service_mms_ux",
		formFields.length ? "template_mms_ux_form" : "template_mms_ux_report",
		message,
		"NNElRuGiCXYr1E43j",
	);
};

// TODO document functions

const getOrderedShortcut = (keys: Array<string>): Array<string> => {
	keys = keys.slice();
	keys.sort((a, b) => (
		(!b.endsWith("Ctrl") && b !== "Alt" && b !== "Command" && b !== "Shift") ||
		a.endsWith("Ctrl") || (a === "Alt" && !b.endsWith("Ctrl")) || (a === "Command" && b === "Shift")
	) ? -1 : 1);
	return keys;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pageInsertWarning = (container: HTMLElement, text: string) => {
	const warning = document.createElement("div");
	warning.classList.add("warning");
	warning.textContent = text;
	container.appendChild(warning);
};

const pageFocusScrollContainer = () =>
	(document.querySelector(".container.panel") as HTMLElement).focus()
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pageReload = () => {
	location.reload();
};

const pageThemeUpdate = async () => {
	const config = await configGet([ ConfigKey.THEME ]);
	const styleTheme = document.getElementById("style-theme") as HTMLStyleElement;
	styleTheme.textContent =
`:root {
	--hue: ${config.theme.hue};
	--contrast: ${config.theme.contrast};
	--lightness: ${config.theme.lightness};
	--saturation: ${config.theme.saturation};
	--font-scale: ${config.theme.fontScale};
}`
	;
};

/**
 * 
 * @param panelsInfo 
 * @param additionalStyleText 
 * @param shiftModifierIsRequired 
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadPage = (() => {
	/**
	 * Fills and inserts a CSS stylesheet element to style the page.
	 */
	const fillAndInsertStylesheet = (additionalStyleText = "") => {
		const style = document.createElement("style");
		style.id = "style";
		const getHsl = (hue: number, saturation: number, lightness: number, alpha?: number) =>
			`hsl(${hue === -1 ? "var(--hue)" : hue} calc(${saturation}% * var(--saturation)) calc((((${lightness}% - 50%) * var(--contrast)) + 50%) * var(--lightness))${
				alpha === undefined ? "" : ` / ${alpha}`
			})`;
		const getHslUnthemed = (hue: number, saturation: number, lightness: number, alpha?: number) =>
			`hsl(${hue === -1 ? "var(--hue)" : hue} ${saturation}% ${lightness}%${
				alpha === undefined ? "" : ` / ${alpha}`
			})`;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const getColor = (colorDark: string, colorLight?: string) => colorDark;
		const color = {
			border: {
				frame: getColor(getHslUnthemed(-1, 100, 14)),
				tab: getColor(getHslUnthemed(-1, 30, 32)),
				tabBottom: getColor(getHslUnthemed(-1, 100, 50)),
			},
			bg: {
				frame: getColor(getHslUnthemed(-1, 100, 6)),
				panelContainer: getColor(getHsl(-1, 30, 14), getHsl(-1, 20, 38)),
				sectionGap: getColor(getHsl(-1, 28, 20)),
				section: getColor(getHsl(-1, 100, 7), getHsl(-1, 20, 50)),
				alert: {
					success: getColor(getHsl(120, 50, 24)),
					pending: getColor(getHsl(0, 50, 24)),
					failure: getColor(getHsl(60, 50, 24)),
				},
				input: {
					any: getColor(getHsl(-1, 60, 16), getHsl(-1, 20, 46)),
					hover: getColor(getHsl(-1, 60, 20), getHsl(-1, 20, 48)),
					active: getColor(getHsl(-1, 60, 14), getHsl(-1, 20, 40)),
				},
			},
			text: {
				title: getColor(getHsl(-1, 20, 60), getHsl(-1, 20, 7)),
				label: {
					any: getColor(getHsl(-1, 0, 72), getHsl(-1, 0, 6)),
					hover: getColor(getHsl(-1, 0, 66), getHsl(-1, 0, 12)),
				},
				note: getColor(getHsl(-1, 6, 54), getHsl(-1, 6, 20)),
				anchor: {
					any: getColor(getHslUnthemed(200, 100, 80), "revert"),
					visited: getColor(getHslUnthemed(260, 100, 80), "revert"),
					active: getColor(getHslUnthemed(0, 100, 60), "revert"),
				},
				input: {
					any: getColor(getHsl(0, 0, 90), getHsl(0, 0, 0)),
					disabled: getColor(getHsl(0, 0, 100, 0.6), getHsl(0, 0, 0, 0.6)),
				},
			},
			widget: {
				collapse: getColor("white", "black"),
			},
		};
		style.textContent =
`:root {
	--hue: ${configDefault.theme.hue.w_value};
	--contrast: ${configDefault.theme.contrast.w_value};
	--lightness: ${configDefault.theme.lightness.w_value};
	--saturation: ${configDefault.theme.saturation.w_value};
	--font-scale: ${configDefault.theme.fontScale.w_value};
}
body
	{ height: 100vh; margin: 0; box-sizing: border-box; border: 2px solid ${color.border.frame}; overflow: hidden;
	font-family: ubuntu, sans-serif; background: ${color.bg.frame}; user-select: none; }
body, .container.tab .tab
	{ border-radius: 8px; }
.container.tab .tab
	{ padding-block: 1px; text-align: center; text-decoration: none; }
*
	{ font-size: 16px; scrollbar-color: hsl(var(--hue) 50% 40% / 0.5) transparent; }
::-webkit-scrollbar
	{ width: 5px; }
::-webkit-scrollbar-thumb
	{ background: hsl(var(--hue) 50% 40% / 0.5); }
::-webkit-scrollbar-thumb:hover
	{ background: hsl(var(--hue) 50% 60% / 0.5); }
::-webkit-scrollbar-thumb:active
	{ background: hsl(var(--hue) 50% 80% / 0.5); }
textarea
	{ resize: none; }
#frame .hidden
	{ display: none; }
.hidden-caret
	{ caret-color: transparent; }
#frame
	{ display: flex; flex-direction: column; height: 100%; border-radius: inherit;
	background: inherit; }
.brand
	{ display: flex; }
.brand > *
	{ margin: 6px; }
.brand .name
	{ flex: 1; align-self: center; text-align: right; font-weight: bold; color: hsl(0 0% 74%); }
.brand .version
	{ align-self: center; font-size: 14px; color: hsl(0 0% 80% / 0.5); }
.brand .logo
	{ width: 32px; height: 32px; }
.container.tab
	{ display: flex; justify-content: center;
	border-top: 2px solid ${color.border.tab}; border-bottom-left-radius: inherit; border-bottom-right-radius: inherit; }
.container.tab .tab
	{ flex: 1 1 auto; font-size: 14px; padding-inline: 10px; border: none; border-bottom: 2px solid transparent;
	border-top-left-radius: 0; border-top-right-radius: 0; background: transparent; color: hsl(var(--hue) 20% 90%); }
.container.tab .tab:hover
	{ background: hsl(var(--hue) 30% 22%); }
.container.panel
	{ flex: 1 1 auto; border-top: 2px ridge hsl(var(--hue) 50% 30%); border-top-left-radius: inherit; overflow-y: auto;
	outline: none; background: ${color.bg.panelContainer}; }
@supports (overflow-y: overlay)
	{ .container.panel { overflow-y: overlay; }; }
.container.panel > .panel
	{ display: none; position: relative; flex-direction: column; gap: 1px;
	border-bottom-left-radius: inherit; border-bottom-right-radius: inherit;
	background: ${color.bg.sectionGap}; box-shadow: 0 0 10px; }
.container.panel > .panel, .brand
	{ margin-inline: max(0px, calc((100vw - 700px)/2)); }
.warning
	{ padding: 4px; border-radius: 2px; background: hsl(60 39% 71%); color: hsl(0 0% 8%); white-space: break-spaces; }
/**/

.panel-sites_search_research .container.tab .tab.panel-sites_search_research,
.panel-term_lists .container.tab .tab.panel-term_lists,
.panel-features .container.tab .tab.panel-features,
.panel-search .container.tab .tab.panel-search,
.panel-theme .container.tab .tab.panel-theme,
.panel-toolbar .container.tab .tab.panel-toolbar,
.panel-advanced .container.tab .tab.panel-advanced,
.panel-general .container.tab .tab.panel-general
	{ border-bottom: 2px solid ${color.border.tabBottom}; background: ${color.border.tab}; }
.panel-sites_search_research .container.panel > .panel.panel-sites_search_research,
.panel-term_lists .container.panel > .panel.panel-term_lists,
.panel-features .container.panel > .panel.panel-features,
.panel-search .container.panel > .panel.panel-search,
.panel-theme .container.panel > .panel.panel-theme,
.panel-toolbar .container.panel > .panel.panel-toolbar,
.panel-advanced .container.panel > .panel.panel-advanced,
.panel-general .container.panel > .panel.panel-general
	{ display: flex; }
/**/

.panel .section
	{ display: flex; flex-direction: column; width: 100%; background: ${color.bg.section}; }
.panel .section > .title, .panel .section > .title-row, .panel .section > .title-row > .title
	{ border: none; background: none; text-align: center; font-size: 15px; color: ${color.text.title}; }
.panel .section > .title-row > .title
	{ flex: 1; }
.panel.panel .section > .container
	{ display: flex; flex-direction: column; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel .section > .container { overflow-y: overlay; }; }
/**/

.panel .interaction
	{ display: flex; flex-direction: column; padding-inline: 8px; padding-block: 4px; }
.panel .list
	{ display: flex; margin: 0; border: 0; }
.panel .list.column
	{ flex-direction: column; }
.panel .list.row
	{ flex-direction: row; gap: 8px; }
.panel .list.row > *
	{ flex: 1; }
.panel .interaction.option
	{ flex-direction: row; padding-block: 0; user-select: none; }
.panel .interaction > *, .panel .organizer > *, .panel .term
	{ margin-block: 2px; border-radius: 2px; padding-block: 4px; }
.panel .interaction input[type="text"],
.panel .interaction textarea,
.panel .interaction .submitter
	{ border: none; background: ${color.bg.input.any}; color: ${color.text.input.any}; font-family: inherit; }
.panel .interaction input[type="checkbox"]
	{ align-self: center; }
.panel .interaction:is(.action, .link, .organizer) > *
	{ padding-block: 0; }
.panel .interaction .label, .alert
	{ white-space: pre-line; color: ${color.text.label.any}; }
.panel .interaction.option .label[title]
	{ cursor: help; }
.panel .interaction.option .label[title]:hover::after
	{ /* content: "(hover for details)"; margin-left: 0.5em; color: hsl(var(--hue) 0% 72% / 0.6); */ }
.panel .interaction.option label.label[for]:hover
	{ color: ${color.text.label.hover}; }
.panel .interaction .submitter
	{ padding-block: 3px; }
.panel .interaction .submitter:disabled
	{ pointer-events: none; color: ${color.text.input.disabled}; }
.panel .interaction .alert,
.panel .interaction .submitter
	{ padding-inline: 2px; }
.panel .interaction .submitter:hover
	{ background: ${color.bg.input.hover}; }
.panel .interaction .submitter:active
	{ background: ${color.bg.input.active}; }
.panel .interaction .note
	{ font-size: 14px; color: ${color.text.note}; white-space: break-spaces; }
.panel .interaction input.note
	{ width: 140px; text-align: right; border: none; background: none; }
.panel .interaction input.note:invalid
	{ background: hsl(0 50% 50% / 0.5); }
.panel .interaction.option .note
	{ align-self: center; }
.panel .interaction.option .note-container
	{ display: flex; flex-direction: row-reverse; } /* Make sure any contained floating label is aligned to the right. */
.panel .interaction .note-container .floating-frame
	{ position: absolute; padding: 4px; border-radius: 2px; margin-top: 1.5em; background: hsl(60 90% 70%); }
.panel .interaction .note-container .floating-frame:empty
	{ display: none; }
.panel .interaction.option .label
	{ flex: 1; }
.panel .interaction.link a
	{ color: ${color.text.anchor.any}; }
.panel .interaction.link a:visited
	{ color: ${color.text.anchor.visited}; }
.panel .interaction.link a:active
	{ color: ${color.text.anchor.active}; }
/**/

#frame .alert
	{ height: 20px; padding-block: 0;
	transition-property: height, margin; transition-duration: 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#frame .alert:not(.shown)
	{ height: 0; margin-block: 0; }
.alert.success
	{ background: ${color.bg.alert.success}; }
.alert.failure
	{ background: ${color.bg.alert.pending}; }
.alert.pending
	{ background: ${color.bg.alert.failure}; }
/**/

.panel .section > .title, .panel .section > .title-row > .title
	{ margin: 4px; }
.panel.panel-term_lists .section > .container
	{ padding: 4px; }
.panel.panel-term_lists .container-terms .term
	{ display: flex; background: hsl(var(--hue) 30% 15%); }
.panel.panel-term_lists .container-terms .term .phrase-input
	{ width: 120px; background: none; }
.panel.panel-term_lists .container-terms .term .phrase-input:not(:focus, :hover, :placeholder-shown)
	{ background-image: linear-gradient(90deg, hsl(0 0% 90%) 85%, transparent);
	-webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.panel.panel-term_lists .container-terms .term .matching
	{ flex: 1; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel-term_lists .container-terms .term .matching { overflow-y: overlay; }; }
.panel.panel-term_lists .container-terms .term .matching .type
	{ display: flex; }
.panel.panel-term_lists .container-terms .term .matching .type .label
	{ flex: 1; align-self: center; font-size: 12px; }
.panel.panel-term_lists .container-urls .url-input
	{ border: none; background: none; color: hsl(0 0% 90%); }
/**/

#frame .panel .collapse-toggle
	{ display: none; }
#frame .panel .collapse-toggle + label[tabindex]::before, #frame .panel .collapse-toggle + * > label[tabindex]::before
	{ display: inline-block; vertical-align: middle; translate: 0.3em; content: " ";
	border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 5px solid currentColor;
	rotate: 90deg; transition: rotate .2s ease-out; }
#frame .panel .collapse-toggle:not(:checked) + label[tabindex]::before, #frame .panel .collapse-toggle:not(:checked) + * > label[tabindex]::before
	{ rotate: 0deg; }
#frame .panel .collapse-toggle + label[tabindex], #frame .panel .collapse-toggle + * > label[tabindex]
	{ display: block; align-self: start; background: transparent; color: ${color.widget.collapse}; cursor: pointer; width: 1.2em; height: 1.2em; }
#frame .panel .collapse-toggle:not(:checked) + label ~ *
	{ display: none; }

#frame .panel .section > .title-row
	{ display: flex; flex-direction: row; }
#frame .panel .section > .title-row label
	{ position: absolute; align-self: center; }
/**/`
		+ additionalStyleText;
		pageThemeUpdate();
		const styleTheme = document.createElement("style");
		styleTheme.id = "style-theme";
		document.head.appendChild(style);
		document.head.appendChild(styleTheme);
	};

	const classNameIsPanel = (className: string) =>
		className.split("-")[0] === "panel"
	;

	const getPanelClassName = (classArray: Array<string>) =>
		classArray.find(className => classNameIsPanel(className)) ?? ""
	;

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const focusActivePanel = () => {
		const frame = document.getElementById("frame") as HTMLElement;
		const className = getPanelClassName(Array.from(frame.classList));
		const inputFirst = document.querySelector(`.panel.${className} input`) as HTMLInputElement | null;
		if (inputFirst) {
			inputFirst.focus();
			if (inputFirst.type === "text") {
				inputFirst.select();
			}
		} else {
			pageFocusScrollContainer();
		}
	};

	const getTabs = () =>
		document.querySelectorAll(".container.tab .tab")
	;

	const shiftTabFromTab = (tabCurrent: HTMLButtonElement, toRight: boolean, cycle: boolean) => {
		const tabNext = ( //
			tabCurrent[toRight ? "nextElementSibling" : "previousElementSibling"] //
				?? (cycle //
					? (tabCurrent.parentElement as HTMLElement)[toRight ? "firstElementChild" : "lastElementChild"] //
					: null //
				)
		) as HTMLButtonElement | null;
		if (tabNext) {
			tabNext.click();
		}
	};

	const handleTabs = () => {
		const frame = document.getElementById("frame") as HTMLElement;
		document.addEventListener("keydown", event => {
			if (event.ctrlKey || event.metaKey) {
				return;
			}
			const shiftTab = (toRight: boolean, cycle: boolean) => {
				const currentTab = document
					.querySelector(`.container.tab .${getPanelClassName(Array.from(frame.classList))}`) as HTMLButtonElement;
				shiftTabFromTab(currentTab, toRight, cycle);
			};
			if (event.key === "PageDown") {
				shiftTab(true, true);
				event.preventDefault();
			} else if (event.key === "PageUp") {
				shiftTab(false, true);
				event.preventDefault();
			}
		});
	};

	const reload = (panelsInfo: Array<PagePanelInfo>) => {
		panelsInfo.forEach(panelInfo => {
			panelInfo.sections.forEach(sectionInfo => {
				sectionInfo.interactions.forEach(interactionInfo => {
					if (interactionInfo.input && interactionInfo.input.autoId) {
						const input = document.getElementById(interactionInfo.input.autoId) as HTMLInputElement;
						if (interactionInfo.input.onLoad) {
							interactionInfo.input.onLoad(value => {
								const attribute = typeof value === "boolean" ? "checked" : "value";
								if (input[attribute] !== value) {
									input[attribute] = value as never;
									if (interactionInfo.input?.onChange) {
										interactionInfo.input?.onChange(value, -1, -1, false);
									}
								}
							}, 0, 0); // Make function.
						}
					}
					(interactionInfo.submitters ?? []).forEach(submitterInfo => {
						if (submitterInfo.onLoad) {
							const submitter = document.getElementById(submitterInfo.id ?? "") as HTMLButtonElement;
							submitterInfo.onLoad(enabled => submitter.disabled = !enabled);
						}
					});
				});
			});
		});
	};

	const insertAlert = (alertType: PageAlertType, alertsInfo: Record<PageAlertType, PageAlertInfo> | undefined,
		previousSibling: HTMLElement, timeoutDefault = -1, tooltip = "", formatText = (text: string) => text) => {
		if (!alertsInfo) {
			return;
		}
		const timeout = alertsInfo[alertType].timeout ?? timeoutDefault;
		const alert = document.createElement("label");
		alert.classList.add("alert", alertType);
		alert.textContent = formatText(alertsInfo[alertType].text);
		alert.title = tooltip;
		previousSibling.insertAdjacentElement("afterend", alert);
		setTimeout(() => {
			if (alert) {
				alert.classList.add("shown");
				if (timeout >= 0) {
					setTimeout(() => {
						if (alert) {
							clearAlert(alert);
						}
					}, timeout);
				}
			}
		});
		return alert;
	};

	const clearAlert = (alert: HTMLElement) => {
		alert.classList.remove("shown");
		setTimeout(() => {
			if (!alert) {
				return;
			}
			alert.remove();
		}, 1000);
	};

	const clearAlerts = (parent: HTMLElement, classNames: Array<string> = []) =>
		parent.querySelectorAll(classNames.length
			? `.alert:is(${classNames.map(className => `.${className}`).join(", ")})`
			: ".alert"
		).forEach((alert: HTMLElement) => clearAlert(alert))
	;

	const createSection = (() => {
		const insertLabel = (container: HTMLElement, labelInfo: PageInteractionInfo["label"], containerIndex: number) => {
			if (!labelInfo) {
				return;
			}
			const [ label, inputId ] = (() => {
				if (labelInfo.textbox) {
					const label = document.createElement("input");
					label.type = "text";
					label.placeholder = labelInfo.textbox.placeholder;
					label.value = labelInfo.text;
					if (labelInfo.getText) {
						labelInfo.getText(containerIndex).then(text => label.value = text);
					}
					return [ label, "" ];
				} else {
					const label = document.createElement("label");
					label.textContent = labelInfo.text;
					if (labelInfo.getText) {
						labelInfo.getText(containerIndex).then(text => label.textContent = text);
					}
					const inputId = `input-${getIdSequential.next().value}`;
					label.htmlFor = inputId;
					return [ label, inputId ];
				}
			})();
			if (labelInfo.tooltip) {
				label.title = labelInfo.tooltip;
			}
			label.classList.add("label");
			const onChangeInternal = () => {
				labelInfo.setText ? labelInfo.setText((label as HTMLInputElement).value, containerIndex) : undefined;
			};
			if (labelInfo.setText) {
				const labelTextbox = label as HTMLInputElement;
				labelTextbox.addEventListener("input", () => onChangeInternal());
				labelTextbox.addEventListener("blur", () => onChangeInternal());
			}
			container.appendChild(label);
			return inputId;
		};

		const insertInput = (container: HTMLElement, inputInfo: PageInteractionInputInfo | undefined, id = "",
			getObjectIndex: () => number, containerIndex: number) => {
			if (!inputInfo) {
				return;
			}
			inputInfo.autoId = id;
			const input = document.createElement("input");
			input.id = id;
			switch (inputInfo.getType ? inputInfo.getType() : undefined) {
			case InputType.CHECKBOX: {
				input.type = "checkbox";
				input.classList.add("checkbox");
				break;
			} case InputType.TEXT_ARRAY:
			case InputType.TEXT_NUMBER:
			case InputType.TEXT: {
				input.type = "text";
				break;
			}}
			container.appendChild(input);
			if (inputInfo.onLoad) {
				inputInfo.onLoad(value => {
					if (typeof value === "boolean") {
						input.checked = value;
					} else {
						input.value = value;
					}
				}, getObjectIndex(), containerIndex);
			}
			if (inputInfo.onChange) {
				input.addEventListener("change", async () =>
					inputInfo.onChange ? inputInfo.onChange((!inputInfo.getType || inputInfo.getType() === InputType.CHECKBOX) ? input.checked : (input.value as unknown as boolean), getObjectIndex(), containerIndex, true) : undefined
				);
			}
			return input;
		};

		const insertTextbox = (container: HTMLElement, textboxInfo: PageInteractionInfo["textbox"],
			getObjectIndex: () => number, containerIndex: number,
			containerOverall?: HTMLElement): HTMLInputElement | HTMLDivElement | undefined => {
			if (!textboxInfo) {
				return;
			}
			const insertTextboxElement = (container: HTMLElement, value = ""): HTMLInputElement => {
				const textbox = document.createElement("input");
				textbox.type = "text";
				textbox.classList.add(textboxInfo.className);
				textbox.placeholder = textboxInfo.placeholder;
				textbox.spellcheck = textboxInfo.spellcheck;
				textbox.value = value;
				if (textboxInfo.onLoad) {
					textboxInfo.onLoad(text => textbox.value = text, getObjectIndex(), containerIndex);
				}
				const onChangeInternal = (commitIfEmpty = false) => {
					if (textboxInfo.list) {
						// TODO make function
						if (textbox.value && (container.lastElementChild as HTMLInputElement).value) {
							insertTextboxElement(container);
						} else if (!textbox.value && container.lastElementChild !== textbox && commitIfEmpty) {
							textbox.remove();
						}
						if (textbox.parentElement) {
							// Parent is a list container because getArrayForList exists
							textboxInfo.list.setArray(
								Array.from(textbox.parentElement.children)
									.map((textbox: HTMLInputElement) => textbox.value)
									.filter(value => !!value),
								getObjectIndex(),
							);
						}
					}
					if (textboxInfo.onChange) {
						textboxInfo.onChange(textbox.value, getObjectIndex(), containerIndex);
					}
				};
				textbox.addEventListener("input", () => onChangeInternal());
				textbox.addEventListener("blur", () => onChangeInternal(true));
				textbox.addEventListener("keydown", event => {
					if (event.key === "Enter") {
						const textboxes = Array.from(
							(containerOverall ?? container).querySelectorAll("input[type=text]")
						) as Array<HTMLInputElement>;
						const textboxIndex = textboxes.indexOf(textbox) + (event.shiftKey ? -1 : 1);
						if (textboxIndex < 0 || textboxIndex >= textboxes.length) {
							onChangeInternal(true);
							return;
						}
						textboxes[textboxIndex].focus();
						textboxes[textboxIndex].select();
					}
				});
				container.appendChild(textbox);
				return textbox;
			};
			if (textboxInfo.list) {
				const list = document.createElement("div");
				list.classList.add("organizer", "list", "column");
				textboxInfo.list.getArray(getObjectIndex()).then(array => {
					array.concat("").forEach(value => {
						insertTextboxElement(list, value);
					});
				});
				container.appendChild(list);
				return list;
			} else {
				return insertTextboxElement(container);
			}
		};

		const insertObjectList = (container: HTMLElement, objectInfo: PageInteractionInfo["object"], containerIndex: number) => {
			if (!objectInfo) {
				return;
			}
			const getArray = (): Promise<Array<Record<string, unknown>>> =>
				objectInfo.list.getArray(containerIndex)
			;
			const insertObjectElement = (container: HTMLElement, deferContent = false) => {
				const objectElement = document.createElement("div");
				objectElement.classList.add("term");
				container.appendChild(objectElement);
				const getObjectIndex = () => Array.from(container.children).indexOf(objectElement);
				const insertColumn = (columnInfo: PageInteractionObjectColumnInfo) => {
					if (columnInfo.rows.length > 1) {
						const inputId = `input-${getIdSequential.next().value}`;
						const toggleCheckbox = document.createElement("input");
						toggleCheckbox.type = "checkbox";
						toggleCheckbox.id = inputId;
						toggleCheckbox.classList.add("collapse-toggle");
						const toggleButton = document.createElement("label");
						toggleButton.htmlFor = inputId;
						toggleButton.tabIndex = 0;
						toggleButton.addEventListener("keydown", event => {
							if (event.key === "Enter") {
								toggleCheckbox.checked = !toggleCheckbox.checked;
							}
						});
						objectElement.appendChild(toggleCheckbox);
						objectElement.appendChild(toggleButton);
					}
					const column = document.createElement("div");
					column.classList.add(columnInfo.className);
					const insertRow = (rowInfo: PageInteractionObjectRowInfo) => {
						const row = document.createElement("div");
						row.classList.add(rowInfo.className);
						insertTextbox(row, rowInfo.textbox, getObjectIndex, containerIndex, container);
						const inputId = insertLabel(row, rowInfo.label, containerIndex);
						insertInput(row, rowInfo.input, inputId, getObjectIndex, containerIndex);
						column.appendChild(row);
					};
					columnInfo.rows.forEach(rowInfo => insertRow(rowInfo));
					objectElement.appendChild(column);
				};
				if (deferContent) {
					insertColumn(objectInfo.columns[0]);
				} else {
					objectInfo.columns.forEach(columnInfo => insertColumn(columnInfo));
				}
				const inputMain = objectElement.querySelector("input") as HTMLInputElement;
				let newElementQueued = false;
				inputMain.addEventListener("input", () => {
					if (inputMain.value && ((container.lastElementChild as HTMLInputElement).querySelector("input") as HTMLInputElement).value && !newElementQueued) {
						newElementQueued = true;
						getArray().then(async array => {
							array.push(objectInfo.list.getNew(inputMain.value));
							await objectInfo.list.setArray(array, containerIndex);
							inputMain.dispatchEvent(new Event("input"));
							if (deferContent) {
								deferContent = false;
								objectInfo.columns.slice(1).forEach(columnInfo => insertColumn(columnInfo));
							}
							insertObjectElement(container, true);
							newElementQueued = false;
						});
					}
				});
				const onChangeInternal = (commitIfEmpty = false) => {
					if (!inputMain.value && commitIfEmpty) {
						getArray().then(array => {
							const index = getObjectIndex();
							if (index >= array.length) {
								return;
							}
							array.splice(index, 1);
							objectInfo.list.setArray(array, containerIndex);
							objectElement.remove();
						});
					}
				};
				inputMain.addEventListener("blur", () => onChangeInternal(container.lastElementChild !== objectElement));
				inputMain.addEventListener("keydown", event => {
					if (event.key === "Enter") {
						onChangeInternal(true);
					}
				});
			};
			const list = document.createElement("div");
			list.classList.add("organizer", "list", "column", "container-terms");
			getArray().then(array => {
				array.forEach(() => {
					insertObjectElement(list);
				});
				insertObjectElement(list, true);
			});
			container.appendChild(list);
		};

		const insertAnchor = (container: HTMLElement, anchorInfo: PageInteractionInfo["anchor"]) => {
			if (!anchorInfo) {
				return;
			}
			const anchor = document.createElement("a");
			anchor.href = anchorInfo.url;
			anchor.target = "_blank"; // New tab
			anchor.rel = "noopener noreferrer";
			anchor.textContent = anchorInfo.text ?? anchor.href;
			container.appendChild(anchor);
		};

		const insertSubmitter = (container: HTMLElement, submitterInfo: PageInteractionSubmitterInfo | undefined,
			getObjectIndex: () => number) => {
			if (!submitterInfo) {
				return;
			}
			let getFormFields = (): Array<FormField> => [];
			if (submitterInfo.formFields) {
				const list = document.createElement("div");
				list.classList.add("organizer", "list", "column");
				submitterInfo.formFields.forEach(interactionInfo => {
					insertInteraction(list, interactionInfo);
				});
				container.appendChild(list);
				getFormFields = () =>
					Array.from(list.querySelectorAll("label")).map((label): FormField => {
						const input = list.querySelector(`input#${label.htmlFor}`) as HTMLInputElement | null;
						return {
							question: label.textContent ?? "",
							response: input
								? input.checked === undefined ? input.value ?? "" : input.checked.toString()
								: "",
						};
					})
				;
			}
			const button = document.createElement("button");
			button.type = "button";
			button.id = submitterInfo.id ?? "";
			button.classList.add("submitter");
			button.textContent = submitterInfo.text;
			if (submitterInfo.onLoad) {
				submitterInfo.onLoad(enabled => button.disabled = !enabled);
			}
			container.appendChild(button);
			let getMessageText = () => "";
			// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
			let allowInputs = (allowed = true) => {};
			button.addEventListener("click", () => {
				button.disabled = true;
				allowInputs(false);
				clearAlerts(container, [ PageAlertType.PENDING, PageAlertType.FAILURE ]);
				submitterInfo.onClick(
					getMessageText(),
					getFormFields(),
					() => {
						if (submitterInfo.alerts) {
							clearAlerts(container, [ PageAlertType.PENDING ]);
							insertAlert(
								PageAlertType.SUCCESS, //
								submitterInfo.alerts, //
								button, //
								3000, //
							);
						}
						button.disabled = false;
						allowInputs(true);
					},
					error => {
						if (submitterInfo.alerts) {
							clearAlerts(container, [ PageAlertType.PENDING ]);
							const errorText = (error ? error.text : "") || "(no error message)";
							insertAlert(
								PageAlertType.FAILURE, //
								submitterInfo.alerts, //
								button, //
								-1, //
								errorText, //
								text => text.replace("{status}", error ? error.status.toString() : "-1").replace("{text}", errorText), //
							);
						}
						button.disabled = false;
						allowInputs(true);
					},
					getObjectIndex(),
				);
				insertAlert(
					PageAlertType.PENDING, //
					submitterInfo.alerts, //
					button, //
				);
			});
			if (submitterInfo.message) {
				const messageInfo = submitterInfo.message;
				const messageBox = (messageInfo.singleline
					? () => {
						const box = document.createElement("input");
						box.type = "text";
						return box;
					}
					: () => {
						const box = document.createElement("textarea");
						box.rows = messageInfo.rows;
						return box;
					}
				)();
				if (messageInfo.required) {
					allowInputs = (allowed = true) => {
						messageBox.disabled = !allowed;
					};
					button.disabled = true;
					messageBox.addEventListener("input", () => {
						button.disabled = messageBox.value === "";
					});
				}
				messageBox.classList.add("message");
				messageBox.placeholder = submitterInfo.message.placeholder;
				messageBox.spellcheck = true;
				messageBox.addEventListener("keypress", (event: KeyboardEvent) => {
					if (event.key === "Enter" && (messageInfo.singleline || event.ctrlKey)) {
						button.click();
					}
				});
				container.appendChild(messageBox);
				getMessageText = () => messageBox.value;
			}
		};

		const insertSubmitters = (container: HTMLElement, submittersInfo: PageInteractionInfo["submitters"],
			getObjectIndex: () => number) => {
			if (!submittersInfo) {
				return;
			}
			const list = document.createElement("div");
			list.classList.add("organizer", "list", submittersInfo.length > 1 ? "row" : "column");
			submittersInfo.forEach(submitterInfo => insertSubmitter(list, submitterInfo, getObjectIndex));
			container.appendChild(list);
		};

		const insertNote = async (container: HTMLElement, noteInfo: PageInteractionInfo["note"]) => {
			if (!noteInfo) {
				return;
			}
			const isInput = !!noteInfo.forInput;
			const noteContainer = document.createElement("div");
			noteContainer.classList.add("note-container");
			const note = document.createElement(isInput ? "input" : "div");
			noteContainer.appendChild(note);
			note.classList.add("note");
			if (noteInfo.forInput) {
				const input = note as HTMLInputElement;
				input.type = "text";
				const floatingPanel = document.createElement("div");
				floatingPanel.classList.add("floating-frame");
				noteContainer.appendChild(floatingPanel);
				noteInfo.forInput(input, noteInfo.getText, text => {
					floatingPanel.textContent = text;
					if (!text) {
						floatingPanel.replaceChildren();
					}
				});
				input.addEventListener("focusout", () => {
					floatingPanel.replaceChildren();
				});
			}
			container.appendChild(noteContainer);
			const text = (noteInfo.getText ? await noteInfo.getText() : undefined) ?? noteInfo.text;
			if (text !== undefined) {
				note[isInput ? "value" : "textContent"] = text;
			} else {
				note.remove();
			}
		};

		const insertInteraction = (container: HTMLElement, interactionInfo: PageInteractionInfo) => {
			let index = container.childElementCount;
			const interaction = document.createElement("div");
			interaction.classList.add("interaction", interactionInfo.className);
			const inputId = insertLabel(interaction, interactionInfo.label, index);
			const insertBody = () => {
				insertObjectList(interaction, interactionInfo.object, index);
				insertAnchor(interaction, interactionInfo.anchor);
				insertSubmitters(interaction, interactionInfo.submitters, () => index);
				insertTextbox(interaction, interactionInfo.textbox, () => index, 0);
				insertNote(interaction, interactionInfo.note);
				insertInput(interaction, interactionInfo.input, inputId, () => index, 0);
			};
			const labelTextbox = interaction.querySelector("input") as HTMLInputElement;
			if (interactionInfo.list) {
				const listInfo = interactionInfo.list;
				const onChangeInternal = (commitIfEmpty = false) => {
					index = Array.from(container.children).indexOf(interaction);
					if (labelTextbox.value && ((container.lastElementChild as HTMLElement).querySelector("input") as HTMLInputElement).value) {
						listInfo.pushWithName(labelTextbox.value).then(() => {
							insertBody();
							insertInteraction(container, interactionInfo);
						});
					} else if (!labelTextbox.value && container.lastElementChild !== interaction && commitIfEmpty) {
						interaction.remove();
						listInfo.removeAt(index);
					}
				};
				labelTextbox.addEventListener("input", () => onChangeInternal());
				labelTextbox.addEventListener("blur", () => onChangeInternal(true));
				labelTextbox.addEventListener("keydown", event => {
					if (event.key === "Enter") {
						const textboxes = Array.from(container.children)
							.map(child => child.querySelector("input[type=text]")) as Array<HTMLInputElement>;
						const textboxIndex = textboxes.indexOf(labelTextbox) + (event.shiftKey ? -1 : 1);
						if (textboxIndex < 0 || textboxIndex >= textboxes.length) {
							onChangeInternal(true);
							return;
						}
						textboxes[textboxIndex].focus();
						textboxes[textboxIndex].select();
					}
				});
				if (interactionInfo.label && interactionInfo.label.getText) {
					interactionInfo.label.getText(index).then(text => {
						if (text) {
							insertBody();
						}
					});
				} else {
					insertBody();
				}
			} else {
				insertBody();
			}
			container.appendChild(interaction);
			return interaction;
		};

		return (sectionInfo: PageSectionInfo) => {
			const section = document.createElement("div");
			section.classList.add("section");
			if (sectionInfo.className) {
				section.classList.add(sectionInfo.className);
			}
			if (sectionInfo.title) {
				const title = document.createElement("div");
				title.classList.add("title");
				title.textContent = sectionInfo.title.text;
				if (sectionInfo.title.expands) {
					// TODO make function
					const titleRow = document.createElement("label");
					titleRow.classList.add("title-row");
					const checkboxId = `input-${getIdSequential.next().value}`;
					titleRow.htmlFor = checkboxId;
					const toggleCheckbox = document.createElement("input");
					toggleCheckbox.type = "checkbox";
					toggleCheckbox.id = checkboxId;
					toggleCheckbox.classList.add("collapse-toggle");
					const toggleButton = document.createElement("label");
					toggleButton.htmlFor = checkboxId;
					toggleButton.tabIndex = 0;
					toggleButton.addEventListener("keydown", event => {
						if (event.key === "Enter") {
							toggleCheckbox.checked = !toggleCheckbox.checked;
						}
					});
					section.appendChild(toggleCheckbox);
					titleRow.appendChild(toggleButton);
					titleRow.appendChild(title);
					section.appendChild(titleRow);
				} else {
					section.appendChild(title);
				}
			}
			const container = document.createElement("div");
			container.classList.add("container");
			sectionInfo.interactions.forEach(async interactionInfo => {
				if (interactionInfo.list) {
					const length = await interactionInfo.list.getLength();
					for (let i = 0; i < length; i++) {
						insertInteraction(container, interactionInfo);
					}
					insertInteraction(container, interactionInfo);
				} else {
					insertInteraction(container, interactionInfo);
				}
			});
			section.appendChild(container);
			return section;
		};
	})();

	const createBrand = () => {
		const brand = document.createElement("div");
		const name = document.createElement("div");
		const version = document.createElement("div");
		const logo = document.createElement("img");
		name.classList.add("name");
		name.textContent = getName();
		version.classList.add("version");
		version.textContent = getVersion();
		logo.classList.add("logo");
		logo.src = "/icons/mms.svg";
		brand.classList.add("brand");
		brand.appendChild(name);
		brand.appendChild(version);
		brand.appendChild(logo);
		return brand;
	};

	const createFrameStructure = () => {
		const frame = document.createElement("div");
		frame.id = "frame";
		document.body.appendChild(frame);
		frame.appendChild(createBrand());
		const panelContainer = document.createElement("div");
		panelContainer.classList.add("container", "panel");
		panelContainer.tabIndex = -1;
		frame.appendChild(panelContainer);
		const tabContainer = document.createElement("div");
		tabContainer.classList.add("container", "tab");
		tabContainer.title = "Switch tabs with PageDown and PageUp";
		frame.appendChild(tabContainer);
		return frame;
	};

	const insertAndManageContent = (panelsInfo: Array<PagePanelInfo>) => {
		document.body.appendChild(createFrameStructure());
		const panelContainer = document.querySelector(".container.panel") as HTMLElement;
		const tabContainer = document.querySelector(".container.tab") as HTMLElement;
		panelsInfo.forEach(panelInfo => {
			const panel = document.createElement("div");
			panel.classList.add("panel", panelInfo.className);
			panelInfo.sections.forEach(sectionInfo => {
				panel.appendChild(createSection(sectionInfo));
			});
			panelContainer.appendChild(panel);
			const tabButton = document.createElement("a");
			tabButton.id = panelInfo.className;
			tabButton.classList.add("tab", panelInfo.className);
			tabButton.href = `#${panelInfo.className}`;
			tabButton.tabIndex = -1;
			tabButton.addEventListener("focusin", event => {
				event.preventDefault();
				tabButton.blur();
				pageFocusScrollContainer();
			});
			tabButton.textContent = panelInfo.name.text;
			tabContainer.appendChild(tabButton);
		});
		// TODO handle multiple tabs correctly
		// TODO visual indication of letter
		const lettersTaken: Set<string> = new Set;
		const info: Array<{ letter: string, inputInfo?: PageInteractionInputInfo }> = panelsInfo.flatMap(panelInfo => panelInfo.sections.flatMap(sectionInfo =>
			sectionInfo.interactions
				.map(interactionInfo => {
					if (interactionInfo.input && interactionInfo.label) {
						const letter = Array.from(interactionInfo.label.text).find(letter => !lettersTaken.has(letter));
						if (letter) {
							lettersTaken.add(letter);
							return { letter, inputInfo: interactionInfo.input };
						}
					}
					return { letter: "" };
				})
				.filter(info => info.letter !== "")
		));
		addEventListener("keydown", event => {
			if (!event.altKey || !event.shiftKey) {
				return;
			}
			info.some(info => {
				if (info.letter !== event.key) {
					return false;
				}
				if (info.inputInfo && info.inputInfo.autoId) {
					const input = document.getElementById(info.inputInfo.autoId) as HTMLInputElement;
					input.focus();
					event.preventDefault();
				}
				return true;
			});
		});
		handleTabs();
		chrome.storage.onChanged.addListener(() => reload(panelsInfo));
		chrome.tabs.onActivated.addListener(() => reload(panelsInfo));
	};

	return (panelsInfo: Array<PagePanelInfo>, info: {
		titleText: string
		tabsFill: boolean
		borderShow: boolean
		brandShow: boolean
		borderRadiusUse?: boolean
		height?: number
		width?: number
	}) => {
		const viewportMeta = document.createElement("meta");
		viewportMeta.name = "viewport";
		viewportMeta.content = "width=device-width, initial-scale=1";
		document.head.appendChild(viewportMeta);
		const title = document.createElement("title");
		title.text = `${info.titleText} - ${getName()}`;
		document.head.appendChild(title);
		const iconLink = document.createElement("link");
		iconLink.rel = "icon";
		iconLink.href = chrome.runtime.getURL("/icons/mms.svg");
		document.head.appendChild(iconLink);
		fillAndInsertStylesheet(`
body {
	overflow-y: auto;
	min-height: ${info.height ? `${info.height}px` : "unset"};
	width: ${info.width ? `${info.width}px` : "unset"};
	${info.borderShow ? "" : "border: none;"}
	${info.borderRadiusUse !== false ? "" : "border-radius: 0;"}
}
.container.tab .tab {
	${info.tabsFill ? "" : "flex: unset;"}
}
` + (info.brandShow ? "" : `
.brand {
	display: none;
}
.container.panel {
	border-top: none;
}
		`));
		insertAndManageContent(panelsInfo);
		pageFocusScrollContainer();
		const chooseTab = () => {
			const hash = (new URL(location.href)).hash;
			const tabButton = hash.length ? document.getElementById(hash.slice(1)) : getTabs()[0];
			if (tabButton) {
				const frame = document.getElementById("frame") as HTMLElement;
				frame.classList.forEach(className => {
					if (classNameIsPanel(className)) {
						frame.classList.remove(className);
					}
				});
				frame.classList.add(tabButton.id);
			}
		};
		chooseTab();
		addEventListener("hashchange", () => chooseTab());
	};
})();
