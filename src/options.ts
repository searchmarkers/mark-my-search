type OptionsInfo = Array<{
	label: string
	options: Partial<Record<keyof StorageSyncValues, {
		label: string
		preferences?: Partial<Record<keyof StorageSyncValues["barControlsShown"]
			| keyof StorageSyncValues["barLook"]
			| keyof StorageSyncValues["highlightLook"]
			| keyof StorageSyncValues["showHighlights"]
			| keyof StorageSyncValues["autoFindOptions"]
			| keyof StorageSyncValues["matchModeDefaults"], {
			label: string
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
	OPTION_SECTION = "option-section",
	OPTION_LABEL = "option-label",
	TABLE_PREFERENCES = "table-preferences",
	PREFERENCE_ROW = "preference-row",
	PREFERENCE_CELL_LABEL = "preference-cell",
	EVEN = "even",
	ODD = "odd",
}

enum PreferenceType {
	BOOLEAN,
	TEXT,
	ARRAY,
}

/**
 * Loads the options content into the page.
 * @param optionsInfo Details of the options to present.
 */
const loadOptions = (() => {
	/**
	 * Fills and inserts a CSS stylesheet element to style all options and surrounding page structure.
	 */
	const fillAndInsertStylesheet = () => {
		const style = document.createElement("style");
		style.textContent = `
body { padding: 6px; margin: 0; background: #bbb; }
.${OptionClass.ERRONEOUS} { color: #e11; }
.${OptionClass.MODIFIED} { font-weight: bold; }
.${OptionClass.TAB_BUTTON} { border-radius: 0; display: none; }
.${OptionClass.CONTAINER_TAB} { display: flex; flex-flow: column; }
.${OptionClass.OPTION_SECTION} { background-color: #eee; box-shadow: 2px 2px 4px hsla(0, 0%, 0%, 0.4);
	border-radius: 6px; padding: 6px; margin-block: 4px; }
.${OptionClass.OPTION_LABEL} { color: #111; margin-bottom: 4px; }
.${OptionClass.TABLE_PREFERENCES} { display: flex; flex-flow: column; width: 100%; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} { flex: 1; display: flex; align-items: center; }
.${OptionClass.TABLE_PREFERENCES} input[type=text] { width: 110px; }
.${OptionClass.PREFERENCE_ROW} { display: flex; color: #353535; }
.${OptionClass.PREFERENCE_ROW}.${OptionClass.EVEN} { background-color: #ddd; }
		`;
		document.head.appendChild(style);
	};

	/**
	 * Loads a tab of options into a container.
	 * @param tabIdx The index of the tab content in `optionsInfo` to load.
	 * @param tabContainer A parent element for the tab.
	 * @param optionsInfo Details of the options to present.
	 */
	const loadTab = async (tabIdx: number, tabContainer: HTMLElement, optionsInfo: OptionsInfo) => {
		const sync = await getStorageSync();
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
		const save = document.createElement("button");
		save.textContent = "Save Changes";
		form.appendChild(save);
		const valuesCurrent = {};
		form.onsubmit = event => {
			event.preventDefault();
			// TODO remove code duplication using function
			Object.keys(tabInfo.options).forEach(optionKey => {
				const optionInfo = tabInfo.options[optionKey];
				const preferences = optionInfo.preferences ?? { [optionKey]: optionInfo };
				Object.keys(preferences).forEach(preferenceKey => {
					const isSinglePreference = optionKey === preferenceKey;
					const preferenceInfo = isSinglePreference ? optionInfo : preferences[preferenceKey];
					const className = isSinglePreference ? optionKey : `${optionKey}-${preferenceKey}`;
					const input = document.getElementsByClassName(className)[0];
					if (!input) {
						return;
					}
					const valueNew = input["type"] === "checkbox" ? input["checked"] : input["value"];
					const value = preferenceInfo.type === PreferenceType.ARRAY
						? valueNew.split(",") : valueNew;
					if (isSinglePreference) {
						sync[optionKey] = value;
					} else {
						sync[optionKey][preferenceKey] = value;
					}
					valuesCurrent[optionKey][preferenceKey] = valueNew;
					Array.from(document.getElementsByClassName(OptionClass.MODIFIED))
						.forEach((preferenceLabel: HTMLElement) => preferenceLabel.classList.remove(OptionClass.MODIFIED));
				});
			});
			setStorageSync(sync);
		};
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
			Object.keys(preferences).forEach((preferenceKey, i) => {
				const preferenceInfo = preferences[preferenceKey];
				const isSinglePreference = optionKey === preferenceKey; // TODO replace heuristic of 'optionKey === preferenceKey'
				const row = document.createElement("div");
				const addCell = (node: Node, isInFirstColumn = false) => {
					const cell = document.createElement("div");
					cell.appendChild(node);
					if (isInFirstColumn) {
						cell.classList.add(OptionClass.PREFERENCE_CELL_LABEL);
					}
					row.appendChild(cell);
				};
				const preferenceLabel = document.createElement("div");
				preferenceLabel.textContent = `${preferenceInfo.label}:`;
				const inputDefault = document.createElement("input");
				inputDefault.type = preferenceInfo.type === PreferenceType.BOOLEAN ? "checkbox" : "text";
				inputDefault.disabled = true;
				const input = document.createElement("input");
				input.type = inputDefault.type;
				input.classList.add(isSinglePreference ? optionKey : `${optionKey}-${preferenceKey}`);
				addCell(preferenceLabel, true);
				addCell(input);
				addCell(inputDefault);
				table.appendChild(row);
				row.classList.add(OptionClass.PREFERENCE_ROW);
				row.classList.add(i % 2 ? OptionClass.ODD : OptionClass.EVEN);
				const valueDefault = isSinglePreference ? defaultOptions[optionKey] : defaultOptions[optionKey][preferenceKey];
				const value = isSinglePreference ? sync[optionKey] : sync[optionKey][preferenceKey];
				if (value === undefined) {
					preferenceLabel.classList.add(OptionClass.ERRONEOUS);
					input.disabled = true;
				} else {
					const propertyKey = preferenceInfo.type === PreferenceType.BOOLEAN ? "checked" : "value";
					inputDefault[propertyKey as string] = valueDefault;
					input[propertyKey as string] = value;
					valuesCurrent[optionKey][preferenceKey] = input[propertyKey];
					input.oninput = () =>
						preferenceLabel.classList[input[propertyKey] === valuesCurrent[optionKey][preferenceKey]
							? "remove" : "add"](OptionClass.MODIFIED);
				}
			});
		});
	};

	return (optionsInfo: OptionsInfo) => {
		fillAndInsertStylesheet();
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
						appendTerm: {
							label: "Append a new term to the toolbar",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
				barLook: {
					label: "Toolbar style and icons",
					preferences: {
						showEditIcon: {
							label: "Show a pen button in controls with editable text",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
				highlightLook: {
					label: "Keyword highlighting style",
					preferences: {
						hues: {
							label: "Keyword color hues to cycle through",
							type: PreferenceType.ARRAY,
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
					label: "Matching options for new manually-added terms",
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
						regex: {
							label: "Use custom regular expressions by default (advanced)",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
			},
		},
	];

	return () => {
		// TODO use storage.onChanged to refresh rather than manually updating page
		loadOptions(getOptionsInfo());
	};
})()();
