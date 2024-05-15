import { type Page, loadPage, pageInsertWarning, sendProblemReport } from "/dist/modules/page/build.mjs";
import {
	type StorageAreaName, type StorageArea,
	type StorageLocalValues,
	storageGet, storageSet,
} from "/dist/modules/privileged/storage.mjs";
import { sendBackgroundMessage } from "/dist/modules/messaging/background.mjs";
import { isTabResearchPage } from "/dist/modules/privileged/tabs.mjs";
import { type MatchMode, MatchTerm } from "/dist/modules/match-term.mjs";

/**
 * Loads the popup content into the page.
 * This presents the user with common options and actions (usually those needed while navigating), to be placed in a popup.
 */
const loadPopup = (() => {
	/**
	 * Creates info for a checkbox assigned to a particular match mode.
	 * @param mode The key of the match mode.
	 * @param labelText Text to display in the checkbox label.
	 * @returns The resulting info object.
	 */
	const getMatchModeInteractionInfo = (mode: keyof MatchMode, labelText: string): Page.Interaction.ObjectRowInfo => ({
		className: "type",
		key: `matchMode.${mode}`,
		label: {
			text: labelText,
		},
		checkbox: {
			onLoad: async (setChecked, objectIndex, containerIndex) => {
				const sync = await storageGet("sync", [ "termLists" ]);
				setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode[mode]);
			},
			onToggle: (checked, objectIndex, containerIndex) => {
				storageGet("sync", [ "termLists" ]).then(sync => {
					sync.termLists[containerIndex].terms[objectIndex].matchMode[mode] = checked;
					storageSet("sync", sync);
				});
			},
		},
	});

	/**
	 * Creates info for a checkbox handling a basic storage field.
	 * @param storageArea The name of the storage area to use.
	 * @param storageKey The key for the field within the storage area.
	 * @returns The resulting info object.
	 */
	const getStorageFieldCheckboxInfo = (storageArea: StorageAreaName, storageKey: StorageArea<typeof storageArea>): Page.Interaction.CheckboxInfo => ({
		onLoad: async setChecked => {
			const store = await storageGet(storageArea, [ storageKey ]);
			setChecked(store[storageKey]);
		},
		onToggle: checked => {
			storageSet(storageArea, {
				[storageKey]: checked
			} as StorageLocalValues);
		},
	});

	/**
	 * Details of the page's panels and their various components.
	 */
	const panelsInfo: Array<Page.PanelInfo> = [
		{
			className: "panel-general",
			name: {
				text: "Controls",
			},
			sections: [
				{
					interactions: [
						{
							className: "action",
							submitters: [
								{
									text: "Get started",
									onClick: (messageText, formFields, onSuccess) => {
										chrome.tabs.create({ url: chrome.runtime.getURL("/pages/startpage.html") });
										onSuccess();
									},
								},
								{
									text: "Options",
									onClick: (messageText, formFields, onSuccess) => {
										chrome.runtime.openOptionsPage();
										onSuccess();
									},
								},
							],
						},
					]
				},
				{
					title: {
						text: "Tabs",
					},
					interactions: [
						{
							className: "option",
							label: {
								text: "Detect search engines",//"Highlight web searches",
							},
							checkbox: {
								onLoad: async setChecked => {
									const local = await storageGet("local", [ "enabled" ]);
									setChecked(local.enabled);
								},
								onToggle: checked => {
									storageSet("local", {
										enabled: checked,
									} as StorageLocalValues);
								},
							},
						},
						{
							className: "option",
							label: {
								text: "Restore keywords on reactivation",
							},
							checkbox: getStorageFieldCheckboxInfo("local", "persistResearchInstances"),
						},
					],
				},
				{
					title: {
						text: "This Tab",
					},
					interactions: [
						{
							className: "option",
							label: {
								text: "Active",
							},
							checkbox: {
								onLoad: async setChecked => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									setChecked(tab.id === undefined ? false : await isTabResearchPage(tab.id));
								},
								onToggle: checked => {
									if (checked) {
										storageGet("session", [ "researchInstances" ]).then(async session => {
											const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
											if (tab.id === undefined) {
												return;
											}
											const local = await storageGet("local", [ "persistResearchInstances" ]);
											const researchInstance = session.researchInstances[tab.id];
											if (researchInstance && local.persistResearchInstances) {
												researchInstance.enabled = true;
											}
											sendBackgroundMessage({
												terms: (researchInstance && researchInstance.enabled) ? researchInstance.terms : [],
												termsSend: true,
												toggle: {
													highlightsShownOn: true,
												},
											});
										});
									} else {
										sendBackgroundMessage({
											deactivateTabResearch: true,
										});
									}
								}
							},
						},
						{
							className: "action",
							submitters: [ {
								text: "Delete keywords",
								id: "keyword-delete",
								onLoad: async setEnabled => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									setEnabled(tab.id === undefined ? false :
										!!(await storageGet("session", [ "researchInstances" ])).researchInstances[tab.id]);
								},
								onClick: async () => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									if (tab.id === undefined) {
										return;
									}
									const session = await storageGet("session", [ "researchInstances" ]);
									delete session.researchInstances[tab.id];
									await storageSet("session", session);
									sendBackgroundMessage({
										deactivateTabResearch: true,
									});
								},
							} ],
						},
					],
				},
				{
					title: {
						text: "I Have A Problem",
						expands: true,
					},
					interactions: [
						{
							className: "action",
							submitters: [ {
								text: "Send anonymous feedback",
								onClick: (messageText, formFields, onSuccess, onError) => {
									sendProblemReport(messageText, formFields)
										.then(onSuccess)
										.catch(onError);
								},
								message: {
									rows: 2,
									placeholder: "Message",
									required: true,
								},
								alerts: {
									success: {
										text: "Success",
									},
									failure: {
										text: "Status {status}: {text}",
									},
									pending: {
										text: "Pending, do not close popup",
									},
								},
							} ],
							note: {
								text: "Submits: version, url, keywords, message",
							},
						},
						{
							className: "link",
							anchor: {
								url: "https://github.com/searchmarkers/mark-my-search/issues/new",
								text: "File an issue (GitHub)",
							},
						},
						{
							className: "link",
							anchor: {
								url: "mailto:ator-dev@protonmail.com?subject=Mark%20My%20Search%20support",
								text: "Contact the developer",
							},
						},
					],
				},
			],
		},
		{
			className: "panel-sites_search_research",
			name: {
				text: "Highlight",
			},
			sections: [
				{
					title: {
						text: "Sites to Never Highlight",
					},
					interactions: [
						{
							className: "url",
							textbox: {
								className: "url-input",
								list: {
									getArray: () =>
										storageGet("sync", [ "urlFilters" ]).then(sync => //
											sync.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										storageGet("sync", [ "urlFilters" ]).then(sync => {
											sync.urlFilters.noPageModify = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											storageSet("sync", sync);
										})
									,
								},
								placeholder: "example.com/optional-path",
								spellcheck: false,
							},
						},
					],
				},
				{
					title: {
						text: "Sites to Not Detect As Search Engines",
					},
					interactions: [
						{
							className: "url",
							textbox: {
								className: "url-input",
								list: {
									getArray: () =>
										storageGet("sync", [ "urlFilters" ]).then(sync => //
											sync.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										storageGet("sync", [ "urlFilters" ]).then(sync => {
											sync.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											storageSet("sync", sync);
										})
									,
								},
								placeholder: "example.com/optional-path",
								spellcheck: false,
							},
						},
					],
				},
			],
		},
		{
			className: "panel-term_lists",
			name: {
				text: "Keyword Lists",
			},
			sections: [
				{
					title: {
						text: "Keyword Lists",
					},
					interactions: [
						{
							className: "temp-class",
							list: {
								getLength: () =>
									storageGet("sync", [ "termLists" ]).then(sync =>
										sync.termLists.length
									)
								,
								pushWithName: name =>
									storageGet("sync", [ "termLists" ]).then(sync => {
										sync.termLists.push({
											name,
											terms: [],
											urlFilter: [],
										});
										storageSet("sync", sync);
									})
								,
								removeAt: index =>
									storageGet("sync", [ "termLists" ]).then(sync => {
										sync.termLists.splice(index, 1);
										storageSet("sync", sync);
									})
								,
							},
							label: {
								text: "",
								getText: index =>
									storageGet("sync", [ "termLists" ]).then(sync =>
										sync.termLists[index] ? sync.termLists[index].name : ""
									)
								,
								setText: (text, index) =>
									storageGet("sync", [ "termLists" ]).then(sync => {
										sync.termLists[index].name = text;
										storageSet("sync", sync);
									})
								,
								textbox: {
									placeholder: "List Name",
								},
							},
							object: {
								className: "term",
								list: {
									getArray: index =>
										storageGet("sync", [ "termLists" ]).then(sync =>
											sync.termLists[index].terms as unknown as Array<Record<string, unknown>>
										)
									,
									setArray: (array, index) =>
										storageGet("sync", [ "termLists" ]).then(sync => {
											sync.termLists[index].terms = array as unknown as typeof sync["termLists"][number]["terms"];
											storageSet("sync", sync);
										})
									,
									getNew: text =>
										new MatchTerm(text) as unknown as Record<string, unknown>
									,
								},
								name: {
									text: "",
									textbox: {
										placeholder: "keyword",
									},
								},
								columns: [
									{
										className: "temp-class",
										rows: [
											{
												className: "temp-class",
												key: "phrase",
												textbox: {
													className: "phrase-input",
													placeholder: "keyword",
													spellcheck: false,
													onLoad: async (setText, objectIndex, containerIndex) => {
														const sync = await storageGet("sync", [ "termLists" ]);
														setText(sync.termLists[containerIndex].terms[objectIndex] ? sync.termLists[containerIndex].terms[objectIndex].phrase : "");
													},
													onChange: (text, objectIndex, containerIndex) => {
														storageGet("sync", [ "termLists" ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].phrase = text;
															storageSet("sync", sync);
														});
													},
												},
											},
										],
									},
									{
										className: "matching",
										rows: [
											getMatchModeInteractionInfo("stem", "Stemming"),
											getMatchModeInteractionInfo("whole", "Whole Words"),
											getMatchModeInteractionInfo("case", "Case Sensitive"),
											getMatchModeInteractionInfo("diacritics", "Diacritics Insensitive"),
											getMatchModeInteractionInfo("regex", "Regular Expression"),
										],
									},
								],
							},
							textbox: {
								className: "temp-class",
								list: {
									getArray: index =>
										storageGet("sync", [ "termLists" ]).then(sync => //
											sync.termLists[index].urlFilter.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: (array, index) =>
										storageGet("sync", [ "termLists" ]).then(sync => {
											sync.termLists[index].urlFilter = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											storageSet("sync", sync);
										})
									,
								},
								placeholder: "example.com/optional-path",
								spellcheck: false,
							},
							submitters: [
								{
									text: "Highlight in current tab",
									onClick: async (messageText, formFields, onSuccess, onError, index) => {
										const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
										if (tab.id === undefined) {
											return;
										}
										const sync = await storageGet("sync", [ "termLists" ]);
										const session = await storageGet("session", [ "researchInstances" ]);
										const researchInstance = session.researchInstances[tab.id];
										if (researchInstance) {
											researchInstance.enabled = true;
											await storageSet("session", session);
										}
										sendBackgroundMessage({
											terms: researchInstance
												? researchInstance.terms.concat(
													sync.termLists[index].terms.filter(termFromList =>
														!researchInstance.terms.find(term => term.phrase === termFromList.phrase)
													)
												)
												: sync.termLists[index].terms,
											termsSend: true,
											toggle: {
												highlightsShownOn: true,
											},
										});
										onSuccess();
									},
								},
							],
						},
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, `
body
	{ width: 300px; height: 500px; user-select: none; }
.container-panel > .panel, .brand
	{ margin-inline: 0; }
		`, false);
		pageInsertWarning(
			document.querySelector(".container-panel .panel-sites_search_research") ?? document.body,
			"List entries are saved as you type them. This will be more clear in future.",
		);
		pageInsertWarning(
			document.querySelector(".container-panel .panel-term_lists") ?? document.body,
			"Keyword lists are highly experimental. Please report any issues.",
		);
	};
})();

(() => {
	return () => {
		loadPopup();
	};
})()();