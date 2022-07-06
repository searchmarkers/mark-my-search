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

(() => {
	const style = document.createElement("style");
	style.textContent = `
body { background-color: #bbb; }
.${OptionClass.ERRONEOUS} { color: #e11; }
.${OptionClass.MODIFIED} { font-weight: bold; }
.${OptionClass.TAB_BUTTON} { border-radius: 0; display: none; }
.${OptionClass.CONTAINER_TAB} { padding: 10px; }
.${OptionClass.OPTION_SECTION} { background-color: #eee; box-shadow: 2px 2px 4px hsla(0, 0%, 0%, 0.4);
	border-radius: 6px; padding: 8px; margin-block: 10px; width: fit-content; }
.${OptionClass.OPTION_LABEL} { color: #111; margin-bottom: 4px; }
.${OptionClass.TABLE_PREFERENCES} { table-layout: fixed; border-spacing: 0; width: 100%; }
.${OptionClass.TABLE_PREFERENCES} td { width: min-content; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} { width: auto; }
.${OptionClass.PREFERENCE_ROW} { color: #353535; }
.${OptionClass.PREFERENCE_ROW}.${OptionClass.EVEN} { background-color: #ddd; }`
	;
	document.head.appendChild(style);
})();

const optionsInfo: Array<{
	label: string
	options: Record<string, {
		label: string
		preferences?: Record<string, {
			label: string
			type: PreferenceType
		}>
		type?: PreferenceType
	}>
}> = [
	{
		label: "Behaviour",
		options: {
			[StorageSync.BAR_CONTROLS_SHOWN]: {
				label: "Which controls to show in the toolbar",
				preferences: {
					[BarControl.DISABLE_TAB_RESEARCH]: {
						label: "Disable research in the current tab",
						type: PreferenceType.BOOLEAN,
					},
					[BarControl.PERFORM_SEARCH]: {
						label: "Perform a search using the current terms",
						type: PreferenceType.BOOLEAN,
					},
					[BarControl.APPEND_TERM]: {
						label: "Append a new term to the toolbar",
						type: PreferenceType.BOOLEAN,
					},
				},
			},
			[StorageSync.SHOW_HIGHLIGHTS]: {
				label: "When to make highlights visible automatically",
				preferences: {
					default: {
						label: "Highlights made visible for new searches",
						type: PreferenceType.BOOLEAN,
					},
					overrideSearchPages: {
						label: "Highlights are always visible on search pages",
						type: PreferenceType.BOOLEAN,
					},
					overrideResearchPages: {
						label: "Highlights are always visible on non-search pages",
						type: PreferenceType.BOOLEAN,
					},
				},
			},
			[StorageSync.LINK_RESEARCH_TABS]: {
				label: "Link research between tabs",
				type: PreferenceType.BOOLEAN,
			},
			[StorageSync.STOPLIST]: {
				label: "Words to ignore when performing searches",
				type: PreferenceType.ARRAY,
			},
			[StorageSync.IS_SET_UP]: {
				label: "First run setup completed",
				type: PreferenceType.BOOLEAN,
			},
		},
	},
];

const loadTab = (tabContainer: HTMLElement, tabIdx: number) => getStorageSync().then(sync => {
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
		// TODO: remove code duplication using function
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
		const table = document.createElement("table");
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
			const isSinglePreference = optionKey === preferenceKey; // TODO: replace heuristic of 'optionKey === preferenceKey'
			const row = document.createElement("tr");
			const addCell = (node: Node, isInFirstColumn = false) => {
				const cell = document.createElement("td");
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
});

loadTab(document.body, 0);
