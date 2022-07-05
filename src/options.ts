enum OptionClass {
	OPTION = "option",
}

enum PreferenceType {
	BOOLEAN,
	TEXT,
	ARRAY,
}

(() => {
	const style = document.createElement("style");
	style.textContent = `
.${OptionClass.OPTION} { width: 100px; height: 10px; display: block; position: static; }
`
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
	tabButton.style.borderRadius = "0";
	tabContainer.appendChild(tabButton);
	const form = document.createElement("form");
	tabContainer.appendChild(form);
	const container = document.createElement("div");
	container.style.backgroundColor = "#ddd";
	container.style.padding = "10px";
	form.appendChild(container);
	const save = document.createElement("button");
	save.textContent = "Save Changes";
	form.appendChild(save);
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
				const value = preferenceInfo.type === PreferenceType.ARRAY
					? input["value"].split(",")
					: input["checked"] ?? input["value"];
				console.log(optionKey);
				console.log(preferenceKey);
				console.log(value);
				if (isSinglePreference) {
					sync[optionKey] = value;
				} else {
					sync[optionKey][preferenceKey] = value;
				}
			});
		});
		setStorageSync(sync);
	};
	Object.keys(tabInfo.options).forEach(optionKey => {
		const optionInfo = tabInfo.options[optionKey];
		const section = document.createElement("div");
		section.style.backgroundColor = "#eee";
		section.style.borderRadius = "6px";
		section.style.padding = "8px";
		section.style.marginBlock = "10px";
		section.style.width = "fit-content";
		const optionLabel = document.createElement("div");
		optionLabel.textContent = optionInfo.label;
		optionLabel.style.marginBottom = "4px";
		section.appendChild(optionLabel);
		const table = document.createElement("table");
		table.style.borderSpacing = "0";
		section.appendChild(table);
		container.appendChild(section);
		if (sync[optionKey] === undefined) {
			optionLabel.style.color = "#e11";
			return;
		}
		const preferences = optionInfo.preferences ?? { [optionKey]: optionInfo };
		Object.keys(preferences).forEach((preferenceKey, i) => {
			const preferenceInfo = preferences[preferenceKey];
			const isSinglePreference = optionKey === preferenceKey; // TODO: replace heuristic of 'optionKey === preferenceKey'
			const row = document.createElement("tr");
			const addCell = (node: Node) => {
				const cell = document.createElement("td");
				cell.appendChild(node);
				row.appendChild(cell);
			};
			const preferenceLabel = document.createElement("div");
			preferenceLabel.textContent = `${preferenceInfo.label}:`;
			const input = document.createElement("input");
			input.type = preferenceInfo.type === PreferenceType.BOOLEAN ? "checkbox" : "text";
			const inputDefault = input.cloneNode(true) as typeof input;
			inputDefault.disabled = true;
			input.classList.add(isSinglePreference ? optionKey : `${optionKey}-${preferenceKey}`);
			addCell(preferenceLabel);
			addCell(input);
			addCell(inputDefault);
			table.appendChild(row);
			row.style.backgroundColor = i % 2 ? "#ccc" : "#ddd";
			const valueDefault = isSinglePreference ? defaultOptions[optionKey] : defaultOptions[optionKey][preferenceKey];
			const value = isSinglePreference ? sync[optionKey] : sync[optionKey][preferenceKey];
			if (value === undefined) {
				preferenceLabel.style.color = "#e11";
				input.disabled = true;
			} else {
				const propertyKey = preferenceInfo.type === PreferenceType.BOOLEAN ? "checked" : "value";
				inputDefault[propertyKey as string] = valueDefault;
				input[propertyKey as string] = value;
			}
		});
	});
});

loadTab(document.body, 0);
