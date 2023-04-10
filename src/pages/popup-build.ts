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
	const getMatchModeInteractionInfo = (mode: keyof MatchMode, labelText: string): PageInteractionObjectRowInfo => ({
		className: "type",
		key: `matchMode.${mode}`,
		label: {
			text: labelText,
		},
		input: {
			onLoad: async (setChecked, objectIndex, containerIndex) => {
				const sync = await configGet([ ConfigKey.TERM_LISTS ]);
				setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode[mode]);
			},
			onChange: (checked, objectIndex, containerIndex) => {
				configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
					sync.termLists[containerIndex].terms[objectIndex].matchMode[mode] = checked;
					configSet(sync);
				});
			},
		},
	});

	/**
	 * Details of the page's panels and their various components.
	 */
	const panelsInfo: Array<PagePanelInfo> = [
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
								getType: () => InputType.CHECKBOX,
								onLoad: async setChecked => {
									const local = await configGet([ ConfigKey.AUTO_FIND_OPTIONS ]);
									setChecked(local.autoFindOptions.enabled);
								},
								onChange: checked => {
									messageSendBackground({
										toggleResearchOn: checked,
									});
								},
							},
						},
						{
							className: "option",
							label: {
								text: "Restore keywords on reactivation",
							},
							input: {
								getType: () => InputType.CHECKBOX,
								onLoad: async setChecked => {
									const local = await configGet([ ConfigKey.AUTO_FIND_OPTIONS ]);
									setChecked(local.autoFindOptions.enabled);
								},
								onChange: async checked => {
									const local = await configGet([ ConfigKey.AUTO_FIND_OPTIONS ]);
									local.autoFindOptions.enabled = checked;
									await configSet(local);
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
								getType: () => InputType.CHECKBOX,
								onLoad: async setChecked => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
									setChecked(tab.id === undefined ? false :
										isTabResearchPage(
											session.researchInstances, tab.id));
								},
								onChange: checked => {
									if (checked) {
										bankGet([ BankKey.RESEARCH_INSTANCES ]).then(async session => {
											const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
											if (tab.id === undefined) {
												return;
											}
											const local = await configGet([ ConfigKey.RESEARCH_INSTANCE_OPTIONS ]);
											const researchInstance = session.researchInstances[tab.id];
											if (researchInstance && local.researchInstanceOptions.restoreLastInTab) {
												researchInstance.enabled = true;
											}
											messageSendBackground({
												terms: (researchInstance && researchInstance.enabled) ? researchInstance.terms : [],
												makeUnique: true,
												makeUniqueNoCreate: true,
												toggleHighlightsOn: true,
											});
										});
									} else {
										messageSendBackground({
											disableTabResearch: true,
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
										!!(await bankGet([ BankKey.RESEARCH_INSTANCES ])).researchInstances[tab.id]);
								},
								onClick: async () => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									if (tab.id === undefined) {
										return;
									}
									const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
									delete session.researchInstances[tab.id];
									await bankSet(session);
									messageSendBackground({
										disableTabResearch: true,
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
									[PageAlertType.SUCCESS]: {
										text: "Success",
									},
									[PageAlertType.FAILURE]: {
										text: "Status {status}: {text}",
									},
									[PageAlertType.PENDING]: {
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
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => //
											sync.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => {
											sync.urlFilters.noPageModify = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											configSet(sync);
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
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => //
											sync.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										configGet([ ConfigKey.URL_FILTERS ]).then(sync => {
											sync.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											configSet(sync);
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
									configGet([ ConfigKey.TERM_LISTS ]).then(sync =>
										sync.termLists.length
									)
								,
								pushWithName: name =>
									configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
										sync.termLists.push({
											name,
											terms: [],
											urlFilter: [],
										});
										configSet(sync);
									})
								,
								removeAt: index =>
									configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
										sync.termLists.splice(index, 1);
										configSet(sync);
									})
								,
							},
							label: {
								text: "",
								getText: index =>
									configGet([ ConfigKey.TERM_LISTS ]).then(sync =>
										sync.termLists[index] ? sync.termLists[index].name : ""
									)
								,
								setText: (text, index) =>
									configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
										sync.termLists[index].name = text;
										configSet(sync);
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
										configGet([ ConfigKey.TERM_LISTS ]).then(sync =>
											sync.termLists[index].terms as unknown as Array<Record<string, unknown>>
										)
									,
									setArray: (array, index) =>
										configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
											sync.termLists[index].terms = array as unknown as typeof sync["termLists"][number]["terms"];
											configSet(sync);
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
														const sync = await configGet([ ConfigKey.TERM_LISTS ]);
														setText(sync.termLists[containerIndex].terms[objectIndex] ? sync.termLists[containerIndex].terms[objectIndex].phrase : "");
													},
													onChange: (text, objectIndex, containerIndex) => {
														configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].phrase = text;
															configSet(sync);
														});
													},
												},
											},
										],
									},
									{
										className: "matching",
										rows: [
											getMatchModeInteractionInfo("whole", "Stemming"),
											getMatchModeInteractionInfo("stem", "Whole Words"),
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
										configGet([ ConfigKey.TERM_LISTS ]).then(sync => //
											sync.termLists[index].urlFilter.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: (array, index) =>
										configGet([ ConfigKey.TERM_LISTS ]).then(sync => {
											sync.termLists[index].urlFilter = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											configSet(sync);
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
										const sync = await configGet([ ConfigKey.TERM_LISTS ]);
										const session = await bankGet([ BankKey.RESEARCH_INSTANCES ]);
										const researchInstance = session.researchInstances[tab.id];
										if (researchInstance) {
											researchInstance.enabled = true;
											await bankSet(session);
										}
										messageSendBackground({
											terms: researchInstance
												? researchInstance.terms.concat(
													sync.termLists[index].terms.filter(termFromList =>
														!researchInstance.terms.find(term => term.phrase === termFromList.phrase)
													)
												)
												: sync.termLists[index].terms,
											makeUnique: true,
											toggleHighlightsOn: true,
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
