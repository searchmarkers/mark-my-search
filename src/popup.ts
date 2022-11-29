const loadPopup = (() => {
	const panelsInfo: Array<PagePanelInfo> = [
		{
			className: "panel-general",
			name: {
				text: "Options",
			},
			sections: [
				{
					title: {
						text: "Settings",
					},
					interactions: [
						{
							className: "option",
							label: {
								text: "Highlight web searches",
							},
							checkbox: {
								onLoad: async setChecked => {
									const local = await getStorageLocal([ StorageLocal.ENABLED ]);
									setChecked(local.enabled);
								},
								onToggle: checked => {
									chrome.runtime.sendMessage({
										toggleResearchOn: checked,
									} as BackgroundMessage);
								},
							},
						},
						{
							className: "option",
							label: {
								text: "Follow links",
							},
							checkbox: {
								onLoad: async setChecked => {
									const local = await getStorageLocal([ StorageLocal.FOLLOW_LINKS ]);
									setChecked(local.followLinks);
								},
								onToggle: checked => {
									setStorageLocal({
										followLinks: checked
									} as StorageLocalValues);
								},
							},
						},
						{
							className: "option",
							label: {
								text: "Restore keywords in tabs",
							},
							checkbox: {
								onLoad: async setChecked => {
									const local = await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ]);
									setChecked(local.persistResearchInstances);
								},
								onToggle: checked => {
									setStorageLocal({
										persistResearchInstances: checked
									} as StorageLocalValues);
								},
							},
						},
						{
							className: "action",
							submitters: [
								{
									text: "Startpage",
									onClick: (messageText, formFields, onSuccess) => {
										chrome.tabs.create({ url: chrome.runtime.getURL("/pages/startpage.html") });
										onSuccess();
									},
								},
								{
									text: "More options",
									onClick: (messageText, formFields, onSuccess) => {
										chrome.runtime.openOptionsPage();
										onSuccess();
									},
								},
							],
						},
					],
				},
				{
					title: {
						text: "Current Tab Activation",
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
									setChecked(tab.id === undefined ? false :
										isTabResearchPage(
											(await getStorageSession([ StorageSession.RESEARCH_INSTANCES ])).researchInstances, tab.id));
								},
								onToggle: checked => {
									if (checked) {
										getStorageSession([ StorageSession.RESEARCH_INSTANCES ]).then(async session => {
											const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
											if (tab.id === undefined) {
												return;
											}
											const local = await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ]);
											const researchInstance = session.researchInstances[tab.id];
											if (researchInstance && local.persistResearchInstances) {
												researchInstance.enabled = true;
											}
											chrome.runtime.sendMessage({
												terms: (researchInstance && researchInstance.enabled) ? researchInstance.terms : [],
												makeUnique: true,
												toggleHighlightsOn: true,
											} as BackgroundMessage);
										});
									} else {
										chrome.runtime.sendMessage({
											disableTabResearch: true,
										} as BackgroundMessage);
									}
								}
							},
						},
						{
							className: "option",
							label: {
								text: "Keywords stored",
							},
							checkbox: {
								onLoad: async setChecked => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									setChecked(tab.id === undefined ? false :
										!!(await getStorageSession([ StorageSession.RESEARCH_INSTANCES ])).researchInstances[tab.id]);
								},
								onToggle: async checked => {
									const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
									if (tab.id === undefined) {
										return;
									}
									const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
									if (checked) {
										session.researchInstances[tab.id] = {
											enabled: false,
											autoOverwritable: false,
											highlightsShown: true,
											terms: [],
										};
									} else {
										delete session.researchInstances[tab.id];
										chrome.runtime.sendMessage({
											disableTabResearch: true,
										} as BackgroundMessage);
									}
									setStorageSession(session);
								},
							},
						},
					],
				},
				{
					title: {
						text: "Contributing",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "Report a problem",
							},
							submitters: [ {
								text: "Submit anonymously",
								onClick: (messageText, formFields, onSuccess, onError) => {
									sendProblemReport(messageText, formFields)
										.then(onSuccess)
										.catch(onError);
								},
								message: {
									rows: 2,
									placeholder: "Optional message",
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
								text: "File a bug report",
							},
						},
						{
							className: "link",
							anchor: {
								url: "https://github.com/searchmarkers/mark-my-search",
								text: "Get involved!",
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
						text: "Sites to Not Detect As Search Engines",
					},
					interactions: [
						{
							className: "url",
							textbox: {
								className: "url-input",
								list: {
									getArray: () =>
										getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => //
											sync.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: array =>
										getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => {
											sync.urlFilters.nonSearch = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											setStorageSync(sync);
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
							className: "TODOreplace",
							list: {
								getLength: () =>
									getStorageSync([ StorageSync.TERM_LISTS ]).then(sync =>
										sync.termLists.length
									)
								,
								pushWithName: name =>
									getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
										sync.termLists.push({
											name,
											terms: [],
											urlFilter: [],
										});
										setStorageSync(sync);
									})
								,
								removeAt: index =>
									getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
										sync.termLists.splice(index, 1);
										setStorageSync(sync);
									})
								,
							},
							label: {
								text: "",
								getText: index =>
									getStorageSync([ StorageSync.TERM_LISTS ]).then(sync =>
										sync.termLists[index] ? sync.termLists[index].name : ""
									)
								,
								setText: (text, index) =>
									getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
										sync.termLists[index].name = text;
										setStorageSync(sync);
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
										getStorageSync([ StorageSync.TERM_LISTS ]).then(sync =>
											sync.termLists[index].terms as unknown as Array<Record<string, unknown>>
										)
									,
									setArray: (array, index) =>
										getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
											sync.termLists[index].terms = array as unknown as typeof sync["termLists"][number]["terms"];
											setStorageSync(sync);
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
										className: "TODOreplace",
										rows: [
											{
												className: "TODOreplace",
												key: "phrase",
												textbox: {
													className: "phrase-input",
													placeholder: "keyword",
													spellcheck: false,
													onLoad: async (setText, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setText(sync.termLists[containerIndex].terms[objectIndex] ? sync.termLists[containerIndex].terms[objectIndex].phrase : "");
													},
													onChange: (text, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].phrase = text;
															setStorageSync(sync);
														});
													},
												},
											},
										],
									},
									{
										className: "matching",
										rows: [
											{
												className: "type",
												key: "matchMode.whole",
												label: {
													text: "Match Whole Words",
												},
												checkbox: {
													onLoad: async (setChecked, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode.whole);
													},
													onToggle: (checked, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].matchMode.whole = checked;
															setStorageSync(sync);
														});
													},
												},
											},
											{
												className: "type",
												key: "matchMode.stem",
												label: {
													text: "Match Stems",
												},
												checkbox: {
													onLoad: async (setChecked, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode.stem);
													},
													onToggle: (checked, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].matchMode.stem = checked;
															setStorageSync(sync);
														});
													},
												},
											},
											{
												className: "type",
												key: "matchMode.case",
												label: {
													text: "Match Case",
												},
												checkbox: {
													onLoad: async (setChecked, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode.case);
													},
													onToggle: (checked, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].matchMode.case = checked;
															setStorageSync(sync);
														});
													},
												},
											},
											{
												className: "type",
												key: "matchMode.diacritics",
												label: {
													text: "Match Diacritics",
												},
												checkbox: {
													onLoad: async (setChecked, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode.diacritics);
													},
													onToggle: (checked, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].matchMode.diacritics = checked;
															setStorageSync(sync);
														});
													},
												},
											},
											{
												className: "type",
												key: "matchMode.regex",
												label: {
													text: "Regular Expression",
												},
												checkbox: {
													onLoad: async (setChecked, objectIndex, containerIndex) => {
														const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
														setChecked(sync.termLists[containerIndex].terms[objectIndex].matchMode.regex);
													},
													onToggle: (checked, objectIndex, containerIndex) => {
														getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
															sync.termLists[containerIndex].terms[objectIndex].matchMode.regex = checked;
															setStorageSync(sync);
														});
													},
												},
											},
										],
									},
								],
							},
							textbox: {
								className: "TODOreplace",
								list: {
									getArray: index =>
										getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => //
											sync.termLists[index].urlFilter.map(({ hostname, pathname }) => hostname + pathname) //
										)
									,
									setArray: (array, index) =>
										getStorageSync([ StorageSync.TERM_LISTS ]).then(sync => {
											sync.termLists[index].urlFilter = array.map(value => {
												const pathnameStart = value.includes("/") ? value.indexOf("/") : value.length;
												return {
													hostname: value.slice(0, pathnameStart),
													pathname: value.slice(pathnameStart),
												};
											});
											setStorageSync(sync);
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
										const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
										const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
										const researchInstance = session.researchInstances[tab.id];
										if (researchInstance && !researchInstance.enabled) {
											researchInstance.enabled = true;
											await setStorageSession(session);
										}
										chrome.runtime.sendMessage({
											terms: researchInstance
												? researchInstance.terms.concat(
													sync.termLists[index].terms.filter(termFromList =>
														!researchInstance.terms.find(term => term.phrase === termFromList.phrase)
													)
												)
												: sync.termLists[index].terms,
											makeUnique: true,
											toggleHighlightsOn: true,
										} as BackgroundMessage);
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
	{ width: 300px; height: 540px; user-select: none; }
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
