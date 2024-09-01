/* eslint-disable @typescript-eslint/no-unsafe-member-access */
//import { isWindowInFrame } from "/dist/modules/page/build.mjs";
import type {
	StoreImmediate, StoreList, StoreListInterface, ConfigValues, ConfigKey,
} from "../modules/storage.mjs";
import { StoreType, Config } from "../modules/storage.mjs";
import { compatibility, getIdSequential } from "/dist/modules/common.mjs";

const isWindowInFrame = () => (
	new URL(location.href).searchParams.get("frame") !== null
);

type OptionsInfo = Array<{
	label: string
	options: Partial<{[ConfigK in ConfigKey]: {
		label: string
		preferences?: Partial<{[GroupK in keyof ConfigValues[ConfigK]]: Preference}>
		special?: {
			preferenceKey: keyof ConfigValues[ConfigK]
			preferences: Record<string, Preference>
		}
	}}>
}>

interface Preference {
	label: string
	tooltip?: string
	type: PreferenceType
	valueSet?: Set<unknown>
	getPreviewElement?: (value: unknown) => HTMLElement
}

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
	PREFERENCE_ROW_CONTAINER = "preference-row-container",
	PREFERENCE_ROW = "preference-row",
	PREFERENCE_CELL_LABEL = "preference-cell",
	PREFERENCE_INPUT = "preference-input",
	PREFERENCE_REVERT = "preference-revert",
}

enum OptionSpecialClass {
	HIGHLIGHT_COLORS = "highlight-colors",
}

enum PreferenceType {
	BOOLEAN,
	ENUM,
	INTEGER,
	FLOAT,
	TEXT,
	ARRAY,
	ARRAY_NUMBER,
}

interface OptionsConfig {
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
.${OptionClass.TOOLBAR}
	{ position: relative; }
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
.${OptionClass.PREFERENCE_ROW_CONTAINER}
	{ display: flex; flex-direction: column; color: hsl(0 0% 21%); }
.${OptionClass.PREFERENCE_ROW_CONTAINER}:nth-child(even)
	{ background-color: hsl(0 0% 87%); }
.${OptionClass.PREFERENCE_ROW}
	{ display: flex; flex: 1; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL}
	{ flex: 1; margin-block: 2px; }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} > ::after
	{ content: ":" }
.${OptionClass.TABLE_PREFERENCES} .${OptionClass.PREFERENCE_CELL_LABEL} > *
	{ flex: 1; }
.${OptionClass.PREFERENCE_CELL_LABEL}
	{ display: flex; align-items: center; }
input[type=text]
	{ font-size: small; width: 110px; }
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
.${OptionSpecialClass.HIGHLIGHT_COLORS}
	{ display: flex; }
.${OptionSpecialClass.HIGHLIGHT_COLORS} > *
	{ background: hsl(var(--hue) 100% 50%); height: 16px; aspect-ratio: 1; border: 1px solid hsl(0 0% 0% / 0.5); }
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
		form.addEventListener("submit", async event => {
			event.preventDefault();
			setSavePending(true);
			const config = await Config.get({
				barCollapse: true,
				barControlsShown: true,
				barLook: true,
				highlightLook: true,
				highlighter: true,
				showHighlights: true,
				autoFindOptions: true,
				matchModeDefaults: true,
			});
			const configToUnset: Record<string, Array<string>> = {};
			// TODO remove code duplication using function
			for (const [ optionKey, optionInfo ] of Object.entries(tabInfo.options)) {
				const preferences = optionInfo.preferences ?? {};
				Object.entries(preferences).forEach(([ preferenceKey, preferenceInfo ]) => {
					const input: HTMLInputElement | null = document.querySelector(
						`.${OptionClass.PREFERENCE_INPUT}[data-key="${optionKey}-${preferenceKey}"]`
					);
					if (!input) {
						return;
					}
					const valueEnteredString = input.value;
					const valueEnteredBool = input.checked;
					const valueEntered = preferenceInfo.type === PreferenceType.BOOLEAN ? valueEnteredBool : valueEnteredString;
					const type: PreferenceType = preferenceInfo.type;
					switch (Config.getType({ [optionKey]: { [preferenceKey]: true } })[optionKey][preferenceKey]) {
					case StoreType.IMMEDIATE: {
						const configValue = (() => {
							switch (type) {
							case PreferenceType.BOOLEAN:
								return valueEnteredBool;
							case PreferenceType.ENUM:
								return valueEnteredString;
							case PreferenceType.INTEGER:
								return parseInt(valueEnteredString);
							case PreferenceType.FLOAT:
								return parseFloat(valueEnteredString);
							case PreferenceType.TEXT:
								return valueEnteredString;
							case PreferenceType.ARRAY:
								return valueEnteredString.split(",");
							case PreferenceType.ARRAY_NUMBER:
								return valueEnteredString.split(",").map(item => Number(item));
							}
						})();
						config[optionKey][preferenceKey] = configValue;
						if (configValue === Config.getDefault({ [optionKey]: { [preferenceKey]: true } })[optionKey][preferenceKey]) {
							configToUnset[optionKey] ??= [];
							configToUnset[optionKey].push(preferenceKey);
						}
						break;
					} case StoreType.LIST: {
						const list: Array<unknown> = (type === PreferenceType.ARRAY_NUMBER)
							? valueEnteredString.split(",").map(item => Number(item))
							: valueEnteredString.split(",");
						const storeList = Config.getDefault({ [optionKey]: { [preferenceKey]: true } }
						)[optionKey][preferenceKey] as StoreListInterface<unknown>;
						storeList.setList(list);
						config[optionKey][preferenceKey] = storeList;
						break;
					}}
					valuesCurrent[optionKey][preferenceKey] = valueEntered;
				});
				if (optionInfo.special) {
					const preferenceKey = optionInfo.special.preferenceKey;
					const inputs: Array<HTMLInputElement> = Array.from(document.querySelectorAll(
						`.${OptionClass.PREFERENCE_INPUT}[data-key="${optionKey}-${preferenceKey}"]`
					));
					const object = config[optionKey][preferenceKey] as Record<string, unknown>;
					for (const input of inputs) {
						const key = input.dataset.objectKey;
						if (!key) {
							continue;
						}
						object[key] = input.checked;
					}
					valuesCurrent[optionKey][preferenceKey] = object;
				}
			}
			for (const rowModified of document.querySelectorAll(`.${OptionClass.MODIFIED}`)) {
				rowModified.classList.remove(OptionClass.MODIFIED);
			}
			await Config.set(config);
			await Config.unset(configToUnset);
			setSavePending(false);
		});
		const config = await Config.get({
			barCollapse: true,
			barControlsShown: true,
			barLook: true,
			highlightLook: true,
			highlighter: true,
			showHighlights: true,
			autoFindOptions: true,
			matchModeDefaults: true,
		});
		// Construct and insert option elements from the option details.
		for (const [ optionKey, optionInfo ] of Object.entries(tabInfo.options)) {
			valuesCurrent[optionKey] = {};
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
			const preferences = optionInfo.preferences ?? {};
			const createRow = (
				label: string,
				tooltip: string,
				type: PreferenceType,
				valueSet: Set<unknown>,
				inputDataset: Record<string, string>,
				getPreviewElement: ((value: unknown) => HTMLElement) | undefined,
				setValueCurrent: (value: unknown) => void,
				getValueCurrent: () => unknown,
				configDefault: unknown,
				configType: StoreType,
				getConfigValue: () => unknown,
			) => {
				const rowContainer = document.createElement("div");
				rowContainer.classList.add(OptionClass.PREFERENCE_ROW_CONTAINER, OptionClass.IS_DEFAULT);
				const preferenceRow = document.createElement("div");
				preferenceRow.classList.add(OptionClass.PREFERENCE_ROW);
				rowContainer.appendChild(preferenceRow);
				const addCell = (node: Node, isInFirstColumn = false) => {
					const cell = document.createElement("div");
					cell.appendChild(node);
					if (isInFirstColumn) {
						cell.classList.add(OptionClass.PREFERENCE_CELL_LABEL);
					}
					preferenceRow.appendChild(cell);
				};
				const inputId = `input-${getIdSequential.next().value}`;
				const preferenceLabel = document.createElement("label");
				preferenceLabel.htmlFor = inputId;
				preferenceLabel.textContent = label;
				preferenceLabel.title = tooltip;
				let inputElement: HTMLSelectElement | HTMLInputElement;
				if (type === PreferenceType.ENUM) {
					const select = document.createElement("select");
					select.id = inputId;
					select.classList.add(OptionClass.PREFERENCE_INPUT);
					for (const [ key, value ] of Object.entries(inputDataset)) {
						select.dataset[key] = value;
					}
					for (const value of valueSet) {
						const option = document.createElement("option");
						option.textContent = String(value);
						select.appendChild(option);
					}
					inputElement = select;
				} else {
					const input = document.createElement("input");
					input.type = type === PreferenceType.BOOLEAN ? "checkbox" : "text";
					input.id = inputId;
					input.classList.add(OptionClass.PREFERENCE_INPUT);
					for (const [ key, value ] of Object.entries(inputDataset)) {
						input.dataset[key] = value;
					}
					inputElement = input;
				}
				const revertButton = document.createElement("button");
				revertButton.type = "button";
				revertButton.classList.add(OptionClass.PREFERENCE_REVERT);
				const revertImage = document.createElement("img");
				revertImage.src = chrome.runtime.getURL("/icons/refresh.svg");
				revertImage.draggable = false;
				revertButton.appendChild(revertImage);
				addCell(preferenceLabel, true);
				addCell(revertButton);
				addCell(inputElement);
				table.appendChild(rowContainer);
				const [ valueDefault, value ] = (() => {
					switch (configType) {
					case StoreType.IMMEDIATE: {
						const convert = (value: StoreImmediate<unknown>) =>
							type === PreferenceType.BOOLEAN ? value : String(value);
						return [
							convert(configDefault),
							convert(getConfigValue()),
						];
					} case StoreType.LIST: {
						const convert = (value: StoreList<unknown>) => value.getList().toString();
						return [
							convert(configDefault as StoreList<unknown>),
							convert(getConfigValue() as StoreList<unknown>),
						];
					}}
					return [];
				})();
				if (value === undefined) {
					preferenceLabel.classList.add(OptionClass.ERRONEOUS);
					inputElement.disabled = true;
				} else {
					const valueKey: "checked" | "value" = type === PreferenceType.BOOLEAN ? "checked" : "value";
					inputElement[valueKey] = value;
					setValueCurrent(inputElement[valueKey]);
					const previewRow = document.createElement("div");
					let previewElement = getPreviewElement && getPreviewElement(inputElement[valueKey]);
					if (previewElement) {
						const label = document.createElement("label");
						label.classList.add(OptionClass.PREFERENCE_CELL_LABEL);
						label.textContent = " ";
						previewRow.classList.add(OptionClass.PREFERENCE_ROW);
						previewRow.appendChild(label);
						previewRow.appendChild(previewElement);
						rowContainer.appendChild(previewRow);
					}
					const rowUpdateClasses = () => {
						rowContainer.classList.toggle(
							OptionClass.MODIFIED,
							inputElement[valueKey] !== getValueCurrent(),
						);
						rowContainer.classList.toggle(
							OptionClass.IS_DEFAULT,
							inputElement[valueKey] === valueDefault,
						);
						toolbarsUpdate();
						if (previewElement) {
							previewRow.removeChild(previewElement);
						}
						previewElement = getPreviewElement && getPreviewElement(inputElement[valueKey]);
						if (previewElement) {
							previewRow.appendChild(previewElement);
						}
					};
					inputElement.addEventListener("input", rowUpdateClasses);
					const discard = () => {
						inputElement[valueKey] = getValueCurrent();
						rowUpdateClasses();
					};
					const revert = () => {
						inputElement[valueKey] = valueDefault;
						rowUpdateClasses();
					};
					revertButton.addEventListener("click", () => {
						revert();
						inputElement.focus();
					});
					rowUpdateClasses();
					discardFns.push(discard);
					revertFns.push(revert);
				}
			};
			for (const [ preferenceKey, preferenceInfo ] of Object.entries(preferences)) {
				createRow(
					preferenceInfo.label,
					preferenceInfo.tooltip ?? "",
					preferenceInfo.type,
					preferenceInfo.valueSet ?? new Set(),
					{
						key: `${optionKey}-${preferenceKey}`,
					},
					preferenceInfo.getPreviewElement,
					(value) => { valuesCurrent[optionKey][preferenceKey] = value; },
					() => valuesCurrent[optionKey][preferenceKey],
					Config.getDefault({ [optionKey]: { [preferenceKey]: true } })[optionKey][preferenceKey],
					Config.getType({ [optionKey]: { [preferenceKey]: true } })[optionKey][preferenceKey] as StoreType,
					() => config[optionKey][preferenceKey],
				);
			}
			//if (optionInfo.special) {
			//	const preferenceKey = optionInfo.special.preferenceKey;
			//	(config[optionKey][preferenceKey] as MatchMode | undefined) ??= {
			//		case:
			//	};
			//	const object = config[optionKey][preferenceKey] as Record<string, unknown>;
			//	valuesCurrent[optionKey][preferenceKey] = object;
			//	for (const [ key, preferenceInfo ] of Object.entries(optionInfo.special.preferences)) {
			//		createRow(
			//			preferenceInfo.label,
			//			preferenceInfo.tooltip ?? "",
			//			preferenceInfo.type,
			//			preferenceInfo.valueSet ?? new Set(),
			//			{
			//				key: `${optionKey}-${preferenceKey}`,
			//				objectKey: key,
			//			},
			//			(value) => { valuesCurrent[optionKey][preferenceKey][key] = value; },
			//			() => valuesCurrent[optionKey][preferenceKey][key],
			//			configGetDefault({ [optionKey]: [ preferenceKey ] })[optionKey][preferenceKey][key],
			//			StoreType.IMMEDIATE,
			//			() => config[optionKey][preferenceKey][key],
			//		);
			//	}
			//}
		}
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
							label: "Deactivate in the current tab",
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
				highlightLook: {
					label: "Highlighting appearance",
					preferences: {
						hues: {
							label: "Highlight colour hue values",
							type: PreferenceType.ARRAY_NUMBER,
							getPreviewElement: huesString => {
								const container = document.createElement("div");
								container.classList.add(OptionSpecialClass.HIGHLIGHT_COLORS);
								for (const hue of (huesString as string).split(",").map(hueString => parseInt(hueString))) {
									const colorElement = document.createElement("div");
									colorElement.style.setProperty("--hue", hue.toString());
									container.appendChild(colorElement);
								}
								return container;
							},
						},
					},
				},
				highlighter: {
					label: "Keyword highlighting method and style",
					preferences: {
						engine: {
							label: "Highlighting engine (hover for details)",
							tooltip:
`Mark My Search has two highlighting engines. \
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
							type: PreferenceType.ENUM,
							valueSet: new Set([ "ELEMENT", "PAINT", "HIGHLIGHT" ]),
						},
						/*paintEngine: {
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
							label: "Default diacritics (accents) sensitivity",
							type: PreferenceType.BOOLEAN,
						},
						regex: {
							label: "Use custom regular expressions by default",
							type: PreferenceType.BOOLEAN,
						},
					},
				},
			},
		},
	];

	return () => {
		// TODO use storage.onChanged to refresh rather than manually updating page
		loadOptions(getOptionsInfo(), {
			height: isWindowInFrame() ? 570 : undefined,
			width: isWindowInFrame() && compatibility.browser === "chromium" ? 650 : undefined,
		});
	};
})()();
