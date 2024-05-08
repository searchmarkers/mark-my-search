type OptionsInfo = Array<{
	label: string
	options: Partial<Record<keyof StorageSyncValues, {
		label: string
		preferences?: Partial<Record<keyof StorageSyncValues["barCollapse"]
			| keyof StorageSyncValues["barControlsShown"]
			| keyof StorageSyncValues["barLook"]
			| keyof StorageSyncValues["highlightMethod"]
			| keyof StorageSyncValues["showHighlights"]
			| keyof StorageSyncValues["autoFindOptions"]
			| keyof StorageSyncValues["matchModeDefaults"], {
			label: string
			tooltip?: string
			type: PreferenceType
		}>>
		type?: PreferenceType
	}>>
}>

enum OptionClass {
	ERRONEOUS = "erroneous",
	MODIFIED = "modified",
	TAB_BUTTON = "tab-button",
	CONTAINER_TAB = "container-tab",
	SAVE_BUTTON = "save-button",
	SAVE_PENDING = "save-pending",
	OPTION_SECTION = "option-section",
	OPTION_LABEL = "option-label",
	TABLE_PREFERENCES = "table-preferences",
	PREFERENCE_ROW = "preference-row",
	PREFERENCE_CELL_LABEL = "preference-cell",
	PREFERENCE_INPUT = "preference-input",
}

enum PreferenceType {
	BOOLEAN,
	INTEGER,
	FLOAT,
	TEXT,
	ARRAY,
	ARRAY_NUMBER,
}

type OptionsConfig = {
	height?: number
	width?: number
}

/**
 * Loads the options content into the page.
 * This presents the user with advanced options for customizing the extension.
 * @param optionsInfo Details of the options to present.
 */
const loadOptions = (() => {
	/**
	 * Fills and inserts a CSS stylesheet element to style all options and surrounding page structure.
	 */
	const fillAndInsertStylesheet = (config: OptionsConfig) => {
		const style = document.createElement("style");
		style.textContent = `
*
	{ font-family: sans; font-size: medium; }
input[type="text"]
	{ font-size: small; }
body
	{ padding-inline: 6px; padding-block: 2px; margin: 0; background: #bbb; user-select: none;
	overflow-y: auto;
	min-height: ${config.height ? `${config.height}px` : "unset"}; width: ${config.width ? `${config.width}px` : "unset"}; }
.${OptionClass.ERRONEOUS}
	{ color: #e11; }
.${OptionClass.MODIFIED}
	{ font-weight: bold; }
.${OptionClass.TAB_BUTTON}
	{ border-radius: 0; display: none; }
.${OptionClass.SAVE_BUTTON}
	{ padding: 4px; }
.${OptionClass.SAVE_BUTTON}[data-modification-count]::after
	{ content: "Save Changes: " attr(data-modification-count); }
.${OptionClass.SAVE_BUTTON}:disabled::after
	{ content: "No Unsaved Changes"; }
body.${OptionClass.SAVE_PENDING} .${OptionClass.SAVE_BUTTON}::after
	{ content: "Saving..." }
.${OptionClass.OPTION_SECTION}, .${OptionClass.SAVE_BUTTON}
	{ border-radius: 6px; }
.${OptionClass.OPTION_SECTION}
	{ padding: 6px; margin-block: 8px; background-color: #eee; }
.${OptionClass.OPTION_LABEL}
	{ color: hsl(0 0% 6%); margin-bottom: 4px; }
.${OptionClass.TABLE_PREFERENCES}
	{ display: flex; flex-flow: column; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_ROW} > *
	{ display: flex; align-items: center; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL}
	{ flex: 1; margin-block: 2px; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} > ::after
	{ content: ":" }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} > *
	{ flex: 1; }
.${OptionClass.TABLE_PREFERENCES} input[type=text]
	{ width: 110px; }
.${OptionClass.PREFERENCE_ROW}
	{ display: flex; color: hsl(0 0% 21%); }
.${OptionClass.PREFERENCE_ROW}:nth-child(even)
	{ background-color: hsl(0 0% 87%); }
label
	{ color: hsl(0 0% 28%); }
label[for]:hover
	{ color: hsl(0 0% 18%); }
		`;
		document.head.appendChild(style);
	};

	const getPreferenceInputs = () =>
		document.querySelectorAll(`.${OptionClass.PREFERENCE_INPUT}`) as NodeListOf<HTMLInputElement>
	;

	/**
	 * Loads a tab of options into a container.
	 * @param tabIdx The index of the tab content in `optionsInfo` to load.
	 * @param tabContainer A parent element for the tab.
	 * @param optionsInfo Details of the options to present.
	 */
	const loadTab = async (tabIdx: number, tabContainer: HTMLElement, optionsInfo: OptionsInfo) => {
		const sync = await storageGet("sync");
		const tabInfo = optionsInfo[tabIdx];
		const tabButton = document.createElement("button");
		tabButton.textContent = tabInfo.label;
		tabButton.classList.add(OptionClass.TAB_BUTTON);
		tabContainer.appendChild(tabButton);
		const form = document.createElement("form");
		tabContainer.appendChild(form);
		const container = document.createElement("div");
		container.classList.add(OptionClass.CONTAINER_TAB);
		form.appendChild(container);
		const saveButtonTop = document.createElement("button");
		form.insertAdjacentElement("afterbegin", saveButtonTop);
		const saveButtonBottom = document.createElement("button");
		form.appendChild(saveButtonBottom);
		const saveButtons = [ saveButtonTop, saveButtonBottom ];
		for (const saveButton of saveButtons) {
			saveButton.classList.add(OptionClass.SAVE_BUTTON);
			saveButton.type = "submit";
		}
		const saveButtonsUpdate = () => {
			const modificationCount = document.querySelectorAll(`.${OptionClass.MODIFIED}`).length;
			for (const saveButton of saveButtons) {
				saveButton.disabled = modificationCount === 0 || document.body.classList.contains(OptionClass.SAVE_PENDING);
				saveButton.dataset.modificationCount = modificationCount.toString();
				if (modificationCount === 0) {
					delete saveButton.dataset.modificationCount;
				}
			}
		};
		saveButtonsUpdate();
		const setSavePending = (pending: boolean) => {
			document.body.classList.toggle(OptionClass.SAVE_PENDING, pending);
			for (const input of getPreferenceInputs()) {
				input.disabled = pending;
			}
			saveButtonsUpdate();
		};
		const valuesCurrent = {};
		// Collect all values from inputs and commit them to storage on user form submission.
		form.addEventListener("submit", event => {
			event.preventDefault();
			// TODO remove code duplication using function
			Object.keys(tabInfo.options).forEach(optionKey => {
				const optionInfo = tabInfo.options[optionKey];
				const preferences = optionInfo.preferences ?? { [optionKey]: optionInfo };
				Object.keys(preferences).forEach(preferenceKey => {
					const preferenceInfo = preferences[preferenceKey];
					const input = document.querySelector(
						`.${OptionClass.PREFERENCE_INPUT}[data-key="${optionKey}-${preferenceKey}"]`
					) as HTMLInputElement;
					if (!input) {
						return;
					}
					const valueEnteredString = input["value"] as string;
					const valueEnteredBool = input["checked"] as boolean;
					const valueEntered = preferenceInfo.type === PreferenceType.BOOLEAN ? valueEnteredBool : valueEnteredString;
					sync[optionKey][preferenceKey] = ((type: PreferenceType) => { // Convert value for storage.
						if (type === PreferenceType.ARRAY || type === PreferenceType.ARRAY_NUMBER) {
							return valueEnteredString.split(",").map(item => type === PreferenceType.ARRAY_NUMBER ? Number(item) : item);
						} else if (type === PreferenceType.INTEGER || type === PreferenceType.FLOAT) {
							return Number(valueEnteredString);
						}
						return valueEntered;
					})(preferenceInfo.type);
					valuesCurrent[optionKey][preferenceKey] = valueEntered;
				});
			});
			for (const inputModified of document.querySelectorAll(`.${OptionClass.MODIFIED}`)) {
				inputModified.classList.remove(OptionClass.MODIFIED);
			}
			setSavePending(true);
			storageSet("sync", sync).then(() => {
				
				setSavePending(false);
			});
		});
		// Construct and insert option elements from the option details.
		Object.keys(tabInfo.options).forEach(optionKey => {
			valuesCurrent[optionKey] = {};
			const optionInfo = tabInfo.options[optionKey];
			const section = document.createElement("div");
			section.classList.add(OptionClass.OPTION_SECTION);
			const optionLabel = document.createElement("div");
			optionLabel.textContent = optionInfo.label;
			optionLabel.classList.add(OptionClass.OPTION_LABEL);
			section.appendChild(optionLabel);
			const table = document.createElement("div");
			table.classList.add(OptionClass.TABLE_PREFERENCES);
			section.appendChild(table);
			container.appendChild(section);
			if (sync[optionKey] === undefined) {
				optionLabel.classList.add(OptionClass.ERRONEOUS);
				return;
			}
			const preferences = optionInfo.preferences ?? { [optionKey]: optionInfo };
			Object.keys(preferences).forEach((preferenceKey) => {
				const preferenceInfo = preferences[preferenceKey];
				const row = document.createElement("div");
				const addCell = (node: Node, isInFirstColumn = false) => {
					const cell = document.createElement("div");
					cell.appendChild(node);
					if (isInFirstColumn) {
						cell.classList.add(OptionClass.PREFERENCE_CELL_LABEL);
					}
					row.appendChild(cell);
				};
				const inputId = `input-${getIdSequential.next().value}`;
				const preferenceLabel = document.createElement("label");
				preferenceLabel.htmlFor = inputId;
				preferenceLabel.textContent = preferenceInfo.label;
				preferenceLabel.title = preferenceInfo.tooltip ?? "";
				const inputDefault = document.createElement("input");
				inputDefault.type = preferenceInfo.type === PreferenceType.BOOLEAN ? "checkbox" : "text";
				inputDefault.disabled = true;
				const input = document.createElement("input");
				input.type = inputDefault.type;
				input.id = inputId;
				input.classList.add(OptionClass.PREFERENCE_INPUT);
				input.dataset.key = `${optionKey}-${preferenceKey}`;
				addCell(preferenceLabel, true);
				addCell(input);
				addCell(inputDefault);
				table.appendChild(row);
				row.classList.add(OptionClass.PREFERENCE_ROW);
				const valueDefault = optionsDefault[optionKey][preferenceKey];
				const value = sync[optionKey][preferenceKey];
				if (value === undefined) {
					preferenceLabel.classList.add(OptionClass.ERRONEOUS);
					input.disabled = true;
				} else {
					const propertyKey = preferenceInfo.type === PreferenceType.BOOLEAN ? "checked" : "value";
					inputDefault[propertyKey as string] = valueDefault;
					input[propertyKey as string] = value;
					valuesCurrent[optionKey][preferenceKey] = input[propertyKey];
					input.addEventListener("input", () => {
						preferenceLabel.classList.toggle(
							OptionClass.MODIFIED,
							input[propertyKey] !== valuesCurrent[optionKey][preferenceKey],
						);
						saveButtonsUpdate();
					});
				}
			});
		});
	};

	return (optionsInfo: OptionsInfo, config: OptionsConfig) => {
		fillAndInsertStylesheet(config);
		loadTab(0, document.body, optionsInfo);
	};
})();

(() => {
	/**
	 * Gets details of the options to present, in a defined structure with tabs at the top level.
	 * Corresponds exactly with extension storage items.
	 * @returns Details of all exposed options.
	 */
	const getOptionsInfo = (): OptionsInfo => [
		{
			label: "Behaviour",
			options: {
				barControlsShown: {
					label: "Controls to show in the toolbar",
					preferences: {
						disableTabResearch: {
							label: "Disable research in the current tab",
							type: PreferenceType.BOOLEAN,
						},
						performSearch: {
							label: "Perform a search using the current terms",
							type: PreferenceType.BOOLEAN,
						},
						toggleHighlights: {
							label: "Toggle display of highlighting",
							type: PreferenceType.BOOLEAN,
						},
						appendTerm: {
							label: "Append a new term to the toolbar",
							type: PreferenceType.BOOLEAN,
						},
						replaceTerms: {
							label: "Replace keywords with detected search keywords",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
				barLook: {
					label: "Toolbar style and icons",
					preferences: {
						showEditIcon: {
							label: "Display an edit button in controls with editable text",
							type: PreferenceType.BOOLEAN,
						},
						showRevealIcon: {
							label: "Display a menu button in controls with match options",
							type: PreferenceType.BOOLEAN,
						},
						fontSize: {
							label: "Font size",
							type: PreferenceType.TEXT,
						},
						opacityTerm: {
							label: "Opacity of keyword buttons",
							type: PreferenceType.FLOAT,
						},
						opacityControl: {
							label: "Opacity of other buttons",
							type: PreferenceType.FLOAT,
						},
						borderRadius: {
							label: "Radius of rounded corners",
							type: PreferenceType.TEXT,
						},
					},
				},
				highlightMethod: {
					label: "Keyword highlighting method and style",
					preferences: {
						paintReplaceByElement: {
							label: "Use ELEMENT highlighting (hover for details)",
							tooltip:
`Mark My Search has two highlighting methods. \
ELEMENT is a powerful variant of the model used by traditional highlighter extensions. \
PAINT is an alternate model invented for Mark My Search.

ELEMENT
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
							type: PreferenceType.BOOLEAN,
						},
						/*paintUseExperimental: {
							label: "Use experimental browser APIs (hover for details)",
							tooltip:
`Mark My Search can highlight using experimental APIs. The behavior of this flag will change over time.
Current effects:

ELEMENT
• None.

PAINT
• Firefox: The CSS element() function is used instead of SVG rendering.
• Chromium: The CSS [Houdini] Painting API is used instead of SVG rendering.`
							,
							type: PreferenceType.BOOLEAN,
						},*/
						hues: {
							label: "Highlight color hue cycle",
							type: PreferenceType.ARRAY_NUMBER,
						},
					},
				},
				showHighlights: {
					label: "Visibility when highlighting search engine keywords",
					preferences: {
						default: {
							label: "Highlights begin visible",
							type: PreferenceType.BOOLEAN,
						},
						overrideSearchPages: {
							label: "Highlights are always visible on search pages",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
				barCollapse: {
					label: "When to collapse the toolbar immediately",
					preferences: {
						fromSearch: {
							label: "Started from a search",
							type: PreferenceType.BOOLEAN,
						},
						fromTermListAuto: {
							label: "Started from a keyword list automatically",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
				autoFindOptions: {
					label: "Options for highlighting search engine keywords",
					preferences: {
						searchParams: {
							label: "URL parameters containing keywords",
							type: PreferenceType.ARRAY,
						},
						stoplist: {
							label: "Keywords to exclude",
							type: PreferenceType.ARRAY,
						},
					},
				},
				matchModeDefaults: {
					label: "Matching options for new terms",
					preferences: {
						case: {
							label: "Default case sensitivity",
							type: PreferenceType.BOOLEAN,
						},
						stem: {
							label: "Default word stemming",
							type: PreferenceType.BOOLEAN,
						},
						whole: {
							label: "Default whole word matching",
							type: PreferenceType.BOOLEAN,
						},
						diacritics: {
							label: "Default diacritics matching (ignore accents)",
							type: PreferenceType.BOOLEAN,
						},
						regex: {
							label: "Use custom regular expressions by default (advanced)",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
			},
		},
	];

	const isWindowInFrame = () => true;

	return () => {
		// TODO use storage.onChanged to refresh rather than manually updating page
		loadOptions(getOptionsInfo(), {
			height: isWindowInFrame() ? 570 : undefined,
			width: isWindowInFrame() && compatibility.browser === Browser.CHROMIUM ? 650 : undefined,
		});
	};
})()();
