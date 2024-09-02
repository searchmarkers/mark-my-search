/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { type Page, loadPage, pageInsertWarning, sendProblemReport } from "/dist/modules/page/build.mjs";
import { Bank, Config } from "../modules/storage.mjs";
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
		input: {
			onLoad: async (setChecked, objectIndex, containerIndex) => {
				const config = await Config.get({ termListOptions: { termLists: true } });
				setChecked(config.termListOptions.termLists[containerIndex].terms[objectIndex].matchMode[mode]);
			},
			onChange: (checked, objectIndex, containerIndex) => {
				Config.get({ termListOptions: { termLists: true } }).then(config => {
					const termList = config.termListOptions.termLists[containerIndex];
					const matchMode = Object.assign({}, termList.terms[objectIndex].matchMode) as MatchMode;
					matchMode[mode] = checked;
					const term = new MatchTerm(termList.terms[objectIndex].phrase, matchMode);
					const terms = [ ...termList.terms ];
					terms[objectIndex] = term;
					termList.terms = terms;
					Config.set(config);
				});
			},
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
							input: {
								getType: () => "checkbox",
								onLoad: async setChecked => {
									const config = await Config.get({ autoFindOptions: { enabled: true } });
									setChecked(config.autoFindOptions.enabled);
								},
								onChange: async checked => {
									const config = await Config.get({ autoFindOptions: { enabled: true } });
									config.autoFindOptions.enabled = checked;
									await Config.set(config);
								},
							},
						},
						{
							className: "option",
							label: {
								text: "Restore keywords on reactivation",
							},
							input: {
								getType: () => "checkbox",
								onLoad: async setChecked => {
									const config = await Config.get({ researchInstanceOptions: { restoreLastInTab: true } });
									setChecked(config.researchInstanceOptions.restoreLastInTab);
								},
								onChange: async checked => {
									const config = await Config.get({ researchInstanceOptions: { restoreLastInTab: true } });
									config.researchInstanceOptions.restoreLastInTab = checked;
									await Config.set(config);
								},
							},
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
							input: {
								getType: () => "checkbox",
								onLoad: async setChecked => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									setChecked(tab.id === undefined ? false : await isTabResearchPage(tab.id));
								},
								onChange: checked => {
									if (checked) {
										Bank.get([ "researchInstances" ]).then(async bank => {
											const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
											if (tab.id === undefined) {
												return;
											}
											const config = await Config.get({ researchInstanceOptions: { restoreLastInTab: true } });
											const researchInstance = bank.researchInstances[tab.id];
											if (researchInstance && config.researchInstanceOptions.restoreLastInTab) {
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
										!!(await Bank.get([ "researchInstances" ])).researchInstances[tab.id]);
								},
								onClick: async () => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									if (tab.id === undefined) {
										return;
									}
									const bank = await Bank.get([ "researchInstances" ]);
									delete bank.researchInstances[tab.id];
									await Bank.set(bank);
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
										Config.get({ urlFilters: { noPageModify: true } }).then(config => //
											config.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										Config.get({ urlFilters: { noPageModify: true } }).then(config => {
											config.urlFilters.noPageModify = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											Config.set(config);
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
										Config.get({ urlFilters: { nonSearch: true } }).then(config => //
											config.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										Config.get({ urlFilters: { nonSearch: true } }).then(config => {
											config.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											Config.set(config);
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
									Config.get({ termListOptions: { termLists: true } }).then(config =>
										config.termListOptions.termLists.length
									)
								,
								pushWithName: name =>
									Config.get({ termListOptions: { termLists: true } }).then(config => {
										config.termListOptions.termLists.push({
											name,
											terms: [],
											urlFilter: [],
										});
										Config.set(config);
									})
								,
								removeAt: index =>
									Config.get({ termListOptions: { termLists: true } }).then(config => {
										config.termListOptions.termLists.splice(index, 1);
										Config.set(config);
									})
								,
							},
							label: {
								text: "",
								getText: index =>
									Config.get({ termListOptions: { termLists: true } }).then(config =>
										config.termListOptions.termLists[index] ? config.termListOptions.termLists[index].name : ""
									)
								,
								setText: (text, index) =>
									Config.get({ termListOptions: { termLists: true } }).then(config => {
										config.termListOptions.termLists[index].name = text;
										Config.set(config);
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
										Config.get({ termListOptions: { termLists: true } }).then(config =>
											config.termListOptions.termLists[index].terms as unknown as Array<Record<string, unknown>>
										)
									,
									setArray: (array, index) =>
										Config.get({ termListOptions: { termLists: true } }).then(config => {
											config.termListOptions.termLists[index].terms =
												array as unknown as typeof config["termListOptions"]["termLists"][number]["terms"];
											Config.set(config);
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
														const config = await Config.get({ termListOptions: { termLists: true } });
														setText(config.termListOptions.termLists[containerIndex].terms[objectIndex]
															? config.termListOptions.termLists[containerIndex].terms[objectIndex].phrase : "");
													},
													onChange: (text, objectIndex, containerIndex) => {
														Config.get({ termListOptions: { termLists: true } }).then(config => {
															const termList = config.termListOptions.termLists[containerIndex];
															const term = new MatchTerm(text, termList.terms[objectIndex].matchMode);
															const terms = [ ...termList.terms ];
															terms[objectIndex] = term;
															termList.terms = terms;
															Config.set(config);
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
											getMatchModeInteractionInfo("diacritics", "Diacritic Sensitive"),
											getMatchModeInteractionInfo("regex", "Regular Expression"),
										],
									},
								],
							},
							textbox: {
								className: "temp-class",
								list: {
									getArray: index =>
										Config.get({ termListOptions: { termLists: true } }).then(config => //
											config.termListOptions.termLists[index].urlFilter.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: (array, index) =>
										Config.get({ termListOptions: { termLists: true } }).then(config => {
											config.termListOptions.termLists[index].urlFilter = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											Config.set(config);
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
										const config = await Config.get({ termListOptions: { termLists: true } });
										const bank = await Bank.get([ "researchInstances" ]);
										const researchInstance = bank.researchInstances[tab.id];
										if (researchInstance) {
											researchInstance.enabled = true;
											await Bank.set(bank);
										}
										sendBackgroundMessage({
											terms: researchInstance
												? researchInstance.terms.concat(
													config.termListOptions.termLists[index].terms.filter(termFromList =>
														!researchInstance.terms.find(term => term.phrase === termFromList.phrase)
													)
												)
												: config.termListOptions.termLists[index].terms,
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
		loadPage(panelsInfo, {
			titleText: "Control",
			tabsFill: true,
			borderShow: true,
			brandShow: true,
			height: 520,
			width: 300,
		});
		pageInsertWarning(
			document.querySelector(".container.panel .panel-sites_search_research") ?? document.body,
			"List entries are saved as you type them. This will be more clear in future.",
		);
		pageInsertWarning(
			document.querySelector(".container.panel .panel-term_lists") ?? document.body,
			"Keyword lists are highly experimental. Please report any issues.",
		);
	};
})();

(() => {
	return () => {
		loadPopup();
	};
})()();