type OptionsInfo = Array<{
	label: string
	options: Partial<Record<keyof ConfigValues, {
		label: string
		preferences?: Partial<Record<
			| keyof ConfigValues["barCollapse"]
			| keyof ConfigValues["barControlsShown"]
			| keyof ConfigValues["barLook"]
			| keyof ConfigValues["highlightMethod"]
			| keyof ConfigValues["showHighlights"]
			| keyof ConfigValues["autoFindOptions"]
			| keyof ConfigValues["matchingDefaults"],
		{
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
	IS_DEFAULT = "is-default",
	TAB_BUTTON = "tab-button",
	CONTAINER_TAB = "container-tab",
	SAVE_PENDING = "save-pending",
	TOOLBAR = "toolbar",
	SAVE_BUTTON = "save-button",
	DISCARD_BUTTON = "discard-button",
	REVERT_ALL_BUTTON = "revert-all-button",
	OPTION_SECTION = "option-section",
	OPTION_LABEL = "option-label",
	TABLE_PREFERENCES = "table-preferences",
	PREFERENCE_ROW = "preference-row",
	PREFERENCE_CELL_LABEL = "preference-cell",
	PREFERENCE_INPUT = "preference-input",
	PREFERENCE_DEFAULT = "preference-default",
	PREFERENCE_REVERT = "preference-revert",
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
 * Loads the sendoff page content into the page.
 * This presents the user with an offboarding form with detail, for use when the user has uninstalled the extension.
 */
const loadOptions = (() => {
	/**
	 * Details of the page's panels and their various components.
	 */
	const fillAndInsertStylesheet = (config: OptionsConfig) => {
		const style = document.createElement("style");
		style.textContent = `
body
	{ padding-inline: 6px; padding-block: 2px; margin: 0; background: #bbb; user-select: none;
	overflow-y: auto;
	min-height: ${config.height ? `${config.height}px` : "unset"}; width: ${config.width ? `${config.width}px` : "unset"}; }
*
	{ font-family: sans; font-size: medium; }
.${OptionClass.ERRONEOUS}
	{ color: #e11; }
.${OptionClass.MODIFIED} label
	{ text-decoration: underline; font-style: italic; }
.${OptionClass.TAB_BUTTON}
	{ border-radius: 0; display: none; }
.${OptionClass.TOOLBAR} *
	{ padding: 4px; }
.${OptionClass.SAVE_BUTTON}[data-modification-count]::after
	{ content: "Save Changes: " attr(data-modification-count); }
.${OptionClass.SAVE_BUTTON}:disabled::after
	{ content: "No Unsaved Changes"; }
body.${OptionClass.SAVE_PENDING} .${OptionClass.SAVE_BUTTON}::after
	{ content: "Saving..."; }
.${OptionClass.DISCARD_BUTTON}
	{ color: red; }
.${OptionClass.DISCARD_BUTTON}:disabled
	{ display: none; }
.${OptionClass.DISCARD_BUTTON}::after
	{ content: "Discard Changes"; }
.${OptionClass.REVERT_ALL_BUTTON}
	{ position: absolute; right: 0; }
.${OptionClass.REVERT_ALL_BUTTON}::after
	{ content: "Reset All"; }
.${OptionClass.OPTION_SECTION}, .${OptionClass.TOOLBAR} *
	{ border-radius: 6px; }
.${OptionClass.OPTION_SECTION}
	{ padding: 6px; margin-block: 8px; background-color: #eee; }
.${OptionClass.OPTION_LABEL}
	{ margin-bottom: 4px; font-weight: bold; color: hsl(0 0% 40%); }
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
.${OptionClass.PREFERENCE_ROW}
	{ display: flex; color: hsl(0 0% 21%); }
.${OptionClass.PREFERENCE_ROW}:nth-child(even)
	{ background-color: hsl(0 0% 87%); }
input[type=text]
	{ font-size: small; width: 110px; }
.${OptionClass.PREFERENCE_DEFAULT}
	{ display: none; }
.${OptionClass.IS_DEFAULT} .${OptionClass.PREFERENCE_REVERT}
	{ display: none; }
.${OptionClass.PREFERENCE_REVERT}
	{ border: none; padding: 0.2em; outline-offset: -0.2em; display: flex; align-items: center; background: none; }
.${OptionClass.PREFERENCE_REVERT}:hover
	{ background: #ccc; }
.${OptionClass.PREFERENCE_REVERT}:active
	{ background: #999; }
.${OptionClass.PREFERENCE_REVERT} img
	{ height: 1em; filter: invert() brightness(0.3); }
label
	{ color: hsl(0 0% 28%); }
label[for]:hover
	{ color: hsl(0 0% 6%); }
		`;
		document.head.appendChild(style);
	};

	const getPreferenceInputs = () =>
		document.querySelectorAll(`.${OptionClass.PREFERENCE_INPUT}`) as NodeListOf<HTMLInputElement>
	;

	const createToolbar = (discardFns: Array<() => void>, revertFns: Array<() => void>) => {
		const toolbar = document.createElement("div");
		toolbar.classList.add(OptionClass.TOOLBAR);
		const saveButton = document.createElement("button");
		saveButton.type = "submit";
		saveButton.classList.add(OptionClass.SAVE_BUTTON);
		const discardButton = document.createElement("button");
		discardButton.type = "button";
		discardButton.classList.add(OptionClass.DISCARD_BUTTON);
		discardButton.addEventListener("click", () => {
			discardFns.forEach(discardFn => discardFn());
		});
		const revertAllButton = document.createElement("button");
		revertAllButton.type = "button";
		revertAllButton.classList.add(OptionClass.REVERT_ALL_BUTTON);
		revertAllButton.addEventListener("click", () => {
			revertFns.forEach(revertFn => revertFn());
		});
		const toolbarUpdate = () => {
			const changeCount = document.querySelectorAll(`.${OptionClass.MODIFIED}`).length;
			const changeActionsDisabled = changeCount === 0 || document.body.classList.contains(OptionClass.SAVE_PENDING);
			saveButton.disabled = changeActionsDisabled;
			saveButton.dataset.modificationCount = changeCount.toString();
			if (changeCount === 0) {
				delete saveButton.dataset.modificationCount;
			}
			discardButton.disabled = changeActionsDisabled;
		};
		toolbar.append(saveButton, discardButton, revertAllButton);
		return { toolbar, toolbarUpdate };
	};

	/**
	 * Loads a tab of options into a container.
	 * @param tabIdx The index of the tab content in `optionsInfo` to load.
	 * @param tabContainer A parent element for the tab.
	 * @param optionsInfo Details of the options to present.
	 */
	const loadTab = async (tabIdx: number, tabContainer: HTMLElement, optionsInfo: OptionsInfo) => {
		const config = await configGet({
			barCollapse: true,
			barControlsShown: true,
			barLook: true,
			highlightMethod: true,
			showHighlights: true,
			autoFindOptions: true,
			matchingDefaults: true,
		});
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
		const discardFns: Array<() => void> = [];
		const revertFns: Array<() => void> = [];
		const { toolbar: toolbarTop, toolbarUpdate: toolbarTopUpdate } = createToolbar(discardFns, revertFns);
		const { toolbar: toolbarBottom, toolbarUpdate: toolbarBottomUpdate } = createToolbar(discardFns, revertFns);
		form.insertAdjacentElement("afterbegin", toolbarTop);
		form.appendChild(toolbarBottom);
		const toolbarsUpdate = () => {
			toolbarTopUpdate();
			toolbarBottomUpdate();
		};
		toolbarsUpdate();
		const setSavePending = (pending: boolean) => {
			//document.body.classList.toggle(OptionClass.SAVE_PENDING, pending);
			for (const input of getPreferenceInputs()) {
				input.disabled = pending;
			}
			toolbarsUpdate();
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
					const valueDefault = configDefault[optionKey][preferenceKey];
					type StorageV = StorageValue<unknown, StorageContext.SCHEMA>
					type StorageListV = StorageListValue<unknown, StorageContext.SCHEMA>
					const type: PreferenceType = preferenceInfo.type;
					if ((valueDefault as StorageV).w_value) {
						(config[optionKey][preferenceKey] as StorageValue<unknown>) =
							(type === PreferenceType.INTEGER || type === PreferenceType.FLOAT)
								? Number(valueEnteredString)
								: (type === PreferenceType.ARRAY)
									? valueEnteredString.split(",")
									: (type === PreferenceType.ARRAY_NUMBER)
										? valueEnteredString.split(",").map(item => Number(item))
										: valueEnteredString;
					} else if ((valueDefault as StorageListV).listBase) {
						const list: Array<unknown> = (type === PreferenceType.ARRAY_NUMBER)
							? valueEnteredString.split(",").map(item => Number(item))
							: valueEnteredString.split(",");
						const listBase = (valueDefault as StorageListV).listBase;
						(config[optionKey][preferenceKey] as StorageListValue<unknown>) = {
							listBase,
							w_listIn: list.filter(item => !listBase.includes(item)),
							w_listOut: listBase.filter(item => !list.includes(item)),
						};
					}
					valuesCurrent[optionKey][preferenceKey] = valueEntered;
				});
			});
			for (const rowModified of document.querySelectorAll(`.${OptionClass.MODIFIED}`)) {
				rowModified.classList.remove(OptionClass.MODIFIED);
			}
			setSavePending(true);
			configSet(config).then(() => {
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
			if (config[optionKey] === undefined) {
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
				inputDefault.classList.add(OptionClass.PREFERENCE_DEFAULT);
				inputDefault.disabled = true;
				const input = document.createElement("input");
				input.type = inputDefault.type;
				input.id = inputId;
				input.classList.add(OptionClass.PREFERENCE_INPUT);
				input.dataset.key = `${optionKey}-${preferenceKey}`;
				const revertButton = document.createElement("button");
				revertButton.type = "button";
				revertButton.classList.add(OptionClass.PREFERENCE_REVERT);
				const revertImage = document.createElement("img");
				revertImage.src = chrome.runtime.getURL("/icons/refresh.svg");
				revertImage.draggable = false;
				revertButton.appendChild(revertImage);
				addCell(preferenceLabel, true);
				addCell(revertButton);
				addCell(input);
				addCell(inputDefault);
				table.appendChild(row);
				row.classList.add(OptionClass.PREFERENCE_ROW, OptionClass.IS_DEFAULT);
				const valueDefaultObject = configDefault[optionKey][preferenceKey];
				type StorageV = StorageValue<unknown, StorageContext.SCHEMA>;
				type StorageListV = StorageListValue<unknown, StorageContext.SCHEMA>;
				const isList = (valueDefaultObject as StorageListV).listBase;
				const valueDefault = isList
					? (valueDefaultObject as StorageListV).listBase
					: (valueDefaultObject as StorageV).w_value;
				const value = isList
					? (() => {
						const value = config[optionKey][preferenceKey] as StorageListValue<unknown>;
						return value.listBase.filter(item => !value.w_listOut.includes(item)).concat(value.w_listIn);
					})() : (config[optionKey][preferenceKey] as StorageValue<unknown>);
				if (value === undefined) {
					preferenceLabel.classList.add(OptionClass.ERRONEOUS);
					input.disabled = true;
				} else {
					const valueKey: string = preferenceInfo.type === PreferenceType.BOOLEAN ? "checked" : "value";
					inputDefault[valueKey] = valueDefault;
					input[valueKey] = value;
					valuesCurrent[optionKey][preferenceKey] = input[valueKey];
					const rowUpdateClasses = () => {
						row.classList.toggle(
							OptionClass.MODIFIED,
							input[valueKey] !== valuesCurrent[optionKey][preferenceKey],
						);
						row.classList.toggle(
							OptionClass.IS_DEFAULT,
							input[valueKey] === inputDefault[valueKey],
						);
						toolbarsUpdate();
					};
					input.addEventListener("input", rowUpdateClasses);
					const discard = () => {
						input[valueKey] = valuesCurrent[optionKey][preferenceKey];
						rowUpdateClasses();
					};
					const revert = () => {
						input[valueKey] = inputDefault[valueKey];
						rowUpdateClasses();
					};
					revertButton.addEventListener("click", () => {
						revert();
						input.focus();
					});
					rowUpdateClasses();
					discardFns.push(discard);
					revertFns.push(revert);
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
				matchingDefaults: {
					label: "Matching options for new terms",
					preferences: {
						//case: {
						//	label: "Default case sensitivity",
						//	type: PreferenceType.BOOLEAN,
						//},
						//stem: {
						//	label: "Default word stemming",
						//	type: PreferenceType.BOOLEAN,
						//},
						//whole: {
						//	label: "Default whole word matching",
						//	type: PreferenceType.BOOLEAN,
						//},
						//diacritics: {
						//	label: "Default diacritics matching (ignore accents)",
						//	type: PreferenceType.BOOLEAN,
						//},
						//regex: {
						//	label: "Use custom regular expressions by default (advanced)",
						//	type: PreferenceType.BOOLEAN,
						//},
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
