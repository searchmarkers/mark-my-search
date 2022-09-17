type PopupInteractionInfo = {
	className: string
	list?: {
		getLength: () => Promise<number>
		pushEmpty: () => void
		removeAt: (index: number) => void
	}
	label?: {
		text: string
		getText?: (index: number) => Promise<string>
		setText?: (text: string, index: number) => void
		textbox?: {
			placeholder: string
		}
	}
	object?: {
		className: string
		list: {
			getArray: (index: number) => Promise<Array<Record<string, unknown>>>
			setArray: (array: Array<Record<string, unknown>>, index: number) => void
		}
		name: {
			text: string
			textbox?: {
				placeholder: string
			}
		}
		columns: Array<{
			className: string
			rows: Array<{
				className: string
				key: string
				label?: PopupInteractionInfo["label"]
				textbox?: PopupInteractionInfo["textbox"]
				checkbox?: PopupInteractionInfo["checkbox"]
			}>
		}>
	}
	textbox?: {
		className: string
		list?: {
			getArray: (index: number) => Promise<Array<string>>
			setArray: (array: Array<string>, index: number) => void
		}
		placeholder: string
		spellcheck: boolean
		onChange?: (text: string) => void
		onSubmit?: (text: string) => void
	}
	anchor?: {
		url: string
		text: string
	}
	submitter?: {
		text: string
		onClick: (
			messageText: string,
			onSuccess: () => void,
			onError: (error: { status: number, text: string }) => void,
		) => void
		message?: {
			rows: number
			placeholder: string
		}
		alerts?: Record<PopupAlertType, PopupAlertInfo>
	}
	checkbox?: {
		id?: string
		onLoad?: (setChecked: (checked: boolean) => void) => Promise<void>
		onToggle?: (checked: boolean) => void
	}
	note?: {
		text: string
	}
}
type PopupSectionInfo = {
	title?: {
		text: string
	}
	interactions: Array<PopupInteractionInfo>
}
type PopupPanelInfo = {
	className: string
	name: {
		text: string
	}
	sections: Array<PopupSectionInfo>
}
type PopupAlertInfo = {
	text: string
}

enum PopupAlertType {
	SUCCESS = "success",
	FAILURE = "failure",
	PENDING = "pending",
}

//enum PopupButtonClass {
//	TOGGLE = "toggle",
//	ENABLED = "enabled",
//}

/**
 * Loads the popup into the page.
 * @param buttonsInfo Details of the buttons to present.
 */
const loadPopup = (() => {
	/**
	 * Fills and inserts a CSS stylesheet element to style the popup.
	 */
	const fillAndInsertStylesheet = () => {
		const style = document.createElement("style");
		style.textContent = `
body
	{ width: 300px; height: 530px; margin: 0; border: 2px solid hsl(300 100% 16%);
	font-family: ubuntu, sans-serif; background: hsl(300 100% 11%); user-select: none; }
*
	{ font-size: 16px; scrollbar-color: hsl(300 50% 40% / 0.5) transparent; }
::-webkit-scrollbar
	{ width: 6px; }
::-webkit-scrollbar-thumb
	{ background: hsl(300 50% 40% / 0.5); }
::-webkit-scrollbar-thumb:hover
	{ background: hsl(300 50% 60% / 0.5); }
::-webkit-scrollbar-thumb:active
	{ background: hsl(300 50% 80% / 0.5); }
textarea
	{ resize: none; }
#frame
	{ display: flex; flex-direction: column; height: 100%; border-radius: 8px; background: inherit; }
#frame > .filler
	{ flex: 1; }
.brand
	{ display: flex; }
.brand > *
	{ margin: 6px; }
.brand > .name
	{ flex: 1; align-self: center; text-align: right; font-weight: bold; color: hsl(0 0% 80%); }
.brand > .version
	{ align-self: center; font-size: 14px; color: hsl(0 0% 80% / 0.5); }
.brand > .logo
	{ width: 32px; height: 32px; }
.container-tab
	{ display: flex;
	border-top: 2px solid hsl(300 30% 36%); border-bottom-left-radius: inherit; border-bottom-right-radius: inherit; }
.container-tab > .tab
	{ flex: 1 1 auto; font-size: 14px; border: none; border-bottom: 2px solid transparent; border-radius: inherit;
	outline: none; background: hsl(300 20% 26%); color: hsl(300 20% 80%); }
.container-tab > .tab:focus
	{ color: hsl(0 0% 100%); }
#frame .container-tab > .tab:hover
	{ background: hsl(300 20% 30%); }
#frame .container-tab > .tab:active
	{ background: hsl(300 20% 18%); }
.container-panel
	{ border-top: 1px solid deeppink; border-top-left-radius: inherit; overflow-y: auto;
	background: hsl(300 100% 7%); }
@supports (overflow-y: overlay)
	{ .container-panel { overflow-y: overlay; }; }
.container-panel > .panel
	{ display: none; flex-direction: column; border-radius: inherit; }
.warning
	{ padding: 4px; margin: 4px; border-radius: 2px; background: hsl(60 60% 70% / 0.8); color: hsl(0 0% 8%); }
/**/

.panel-sites_search_research .container-tab > .tab.panel-sites_search_research,
.panel-term_lists .container-tab > .tab.panel-term_lists,
.panel-general .container-tab > .tab.panel-general
	{ border-bottom: 2px solid deeppink; background: hsl(300 20% 36%); }
.panel-sites_search_research .container-panel > .panel.panel-sites_search_research,
.panel-term_lists .container-panel > .panel.panel-term_lists,
.panel-general .container-panel > .panel.panel-general
	{ display: flex; }
/**/

.panel .section
	{ display: flex; flex-direction: column;
	border-bottom: 1px solid hsl(0 0% 100% / 0.3); border-radius: inherit; background: hsl(300 100% 7%); }
.panel .section > .title
	{ border: none; background: none; text-align: center; font-size: 15px; color: hsl(300 20% 60%); }
.panel.panel .section > .container
	{ display: flex; flex-direction: column; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel .section > .container { overflow-y: overlay; }; }
/**/

.panel.panel-general .section > .title
	{ padding-inline: 8px; padding-block: 4px; }
/**/

.panel .interaction
	{ display: flex; flex-direction: column; padding-inline: 8px; padding-block: 4px; }
.panel .list
	{ display: flex; flex-direction: column; margin: 0; border: 0; }
.panel .interaction.option
	{ flex-direction: row; padding-block: 0; }
.panel .interaction *
	{ margin-block: 2px; border-radius: 2px; padding-block: 4px; }
.panel .interaction input[type="text"],
.panel .interaction textarea,
.panel .interaction .submitter
	{ border: none; background: hsl(300 60% 16%); color: hsl(0 0% 90%); font-family: inherit; }
.panel .interaction:is(.action, .link, .organizer) > *
	{ padding-block: 0; }
.panel .interaction .label, .alert
	{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: hsl(300 10% 80%); }
.panel .interaction.option label.label[for]:hover
	{ color: hsl(300 10% 66%); }
.panel .interaction .submitter
	{ padding-block: 3px; }
.panel .interaction .submitter:disabled
	{ pointer-events: none; color: hsl(0 0% 60%); }
.panel .interaction .alert,
.panel .interaction .submitter
	{ padding-inline: 2px; }
.panel .interaction .submitter:hover
	{ background: hsl(300 60% 20%); }
.panel .interaction .submitter:active
	{ background: hsl(300 60% 14%); }
.panel .interaction .note
	{ font-size: 14px; color: hsl(300 6% 60%); }
.panel .interaction.option .label
	{ flex: 1; }
.panel .interaction.link a
	{ color: hsl(200 100% 80%); }
.panel .interaction.link a:visited
	{ color: hsl(260 100% 80%); }
.panel .interaction.link a:active
	{ color: hsl(0 100% 60%); }
/**/

.alert
	{ display: flex; align-items: center; height: 20px; transition-property: height, margin; transition-duration: 0.2s; }
#frame .alert:not(.shown)
	{ height: 0; margin-block: 0; }
.alert.success
	{ background: hsl(120 50% 24%); }
.alert.failure
	{ background: hsl(0 50% 24%); }
.alert.pending
	{ background: hsl(60 50% 24%); }
/**/

.panel .section > .title
	{ margin: 4px; }
.panel.panel-term_lists .section > .container
	{ padding: 4px; }
.panel.panel-term_lists .container-terms .term
	{ display: flex; padding: 4px; margin-block: 2px; border-radius: 10px; background: hsl(300 30% 15%); }
.panel.panel-term_lists .container-terms .term .phrase-input
	{ width: 80px; border: none; background: none; color: white; }
.panel.panel-term_lists .container-terms .term .matching
	{ flex: 1; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel-term_lists .container-terms .term .matching { overflow-y: overlay; }; }
.panel.panel-term_lists .container-terms .term .matching .type
	{ display: flex; }
.panel.panel-term_lists .container-terms .term .matching .type .label
	{ flex: 1; align-self: center; font-size: 11px; color: white; }
.panel.panel-term_lists .container-urls .url-input
	{ border: none; background: none; color: white; }
/**/
		`;
		document.head.appendChild(style);
	};

	const getId = (function* () {
		let id = 0;
		while (true) {
			yield `input-${id++}`;
		}
	})();

	const insertAlert = (alertType: PopupAlertType, alertsInfo: Record<PopupAlertType, PopupAlertInfo> | undefined,
		previousSibling: HTMLElement, timeout = -1,
		tooltip = "", formatText = (text: string) => text) => {
		if (!alertsInfo) {
			return;
		}
		const alert = document.createElement("label");
		alert.classList.add("alert");
		alert.classList.add(alertType);
		alert.textContent = formatText(alertsInfo[alertType].text);
		alert.title = tooltip;
		previousSibling.insertAdjacentElement("afterend", alert);
		setTimeout(() => {
			if (alert) {
				alert.classList.add("shown");
				if (timeout >= 0) {
					setTimeout(() => {
						if (alert) {
							clearAlert(alert);
						}
					}, timeout);
				}
			}
		});
		return alert;
	};

	const clearAlert = (alert: HTMLElement) => {
		alert.classList.remove("shown");
		setTimeout(() => {
			if (!alert) {
				return;
			}
			alert.remove();
		}, 1000);
	};

	const clearAlerts = (parent: HTMLElement, classNames: Array<string> = []) =>
		parent.querySelectorAll(classNames.length
			? `.alert:is(${classNames.map(className => `.${className}`).join(", ")})`
			: ".alert"
		).forEach((alert: HTMLElement) => clearAlert(alert))
	;

	const insertLabelAndLinkCheckbox = (container: HTMLElement,
		labelInfo: PopupInteractionInfo["label"], checkboxInfo: PopupInteractionInfo["checkbox"]) => {
		if (!labelInfo) {
			return;
		}
		const label = (() => {
			if (labelInfo.textbox) {
				const label = document.createElement("input");
				label.type = "text";
				label.placeholder = labelInfo.textbox.placeholder;
				label.value = labelInfo.text;
				return label;
			} else {
				const label = document.createElement("label");
				label.textContent = labelInfo.text;
				if (checkboxInfo) {
					checkboxInfo.id = getId.next().value;
					label.htmlFor = checkboxInfo.id as string;
				}
				return label;
			}
		})();
		label.classList.add("label");
		container.appendChild(label);
	};

	const createInteraction = (interactionInfo: PopupInteractionInfo, index: number) => {
		const interaction = document.createElement("div");
		interaction.classList.add("interaction");
		interaction.classList.add(interactionInfo.className);
		insertLabelAndLinkCheckbox(interaction, interactionInfo.label, interactionInfo.checkbox);
		if (interactionInfo.object) {
			const objectInfo = interactionInfo.object;
			const insertObjectElement = (container: HTMLElement, object: Record<string, unknown>) => {
				const objectElement = document.createElement("div");
				objectElement.classList.add("term");
				objectInfo.columns.forEach(columnInfo => {
					const column = document.createElement("div");
					column.classList.add(columnInfo.className);
					columnInfo.rows.forEach(rowInfo => {
						const row = document.createElement("div");
						row.classList.add(rowInfo.className);
						insertLabelAndLinkCheckbox(row, rowInfo.label, rowInfo.checkbox);
						column.appendChild(row);
					});
					objectElement.appendChild(column);
				});
				container.appendChild(objectElement);
			};
			const list = document.createElement("div");
			list.classList.add("organizer");
			list.classList.add("list");
			objectInfo.list.getArray(index).then(objects => {
				objects.forEach(object => {
					insertObjectElement(list, object);
				});
			});
			interaction.appendChild(list);
		}
		if (interactionInfo.anchor) {
			const anchor = document.createElement("a");
			anchor.href = interactionInfo.anchor.url;
			anchor.textContent = interactionInfo.anchor.text ?? anchor.href;
			interaction.appendChild(anchor);
		}
		if (interactionInfo.submitter) {
			const submitterInfo = interactionInfo.submitter;
			const button = document.createElement("button");
			button.type = "button";
			button.classList.add("submitter");
			button.textContent = interactionInfo.submitter.text;
			interaction.appendChild(button);
			let getMessageText = () => "";
			button.onclick = () => {
				button.disabled = true;
				clearAlerts(interaction, [ PopupAlertType.PENDING, PopupAlertType.FAILURE ]);
				submitterInfo.onClick(
					getMessageText(),
					() => {
						clearAlerts(interaction, [ PopupAlertType.PENDING ]);
						insertAlert(PopupAlertType.SUCCESS, (submitterInfo ?? {}).alerts, button, 3000);
						button.disabled = false;
					},
					error => {
						clearAlerts(interaction, [ PopupAlertType.PENDING ]);
						const errorText = error.text || "(no error message)";
						insertAlert(PopupAlertType.FAILURE, (submitterInfo ?? {}).alerts, button, -1,
							errorText, text => text.replace("{status}", error.status.toString()).replace("{text}", errorText));
						button.disabled = false;
					},
				);
				insertAlert(PopupAlertType.PENDING, submitterInfo.alerts, button);
			};
			if (interactionInfo.submitter.message) {
				const messageBox = document.createElement("textarea");
				messageBox.classList.add("message");
				messageBox.rows = interactionInfo.submitter.message.rows;
				messageBox.placeholder = interactionInfo.submitter.message.placeholder;
				messageBox.spellcheck = true;
				interaction.appendChild(messageBox);
				getMessageText = () => messageBox.value;
			}
		}
		if (interactionInfo.checkbox) {
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = interactionInfo.checkbox.id ?? "";
			checkbox.classList.add("checkbox");
			interaction.appendChild(checkbox);
			(async () => {
				const checkboxInfo = interactionInfo.checkbox ?? {};
				if (checkboxInfo.onLoad) {
					await checkboxInfo.onLoad(checked => checkbox.checked = checked);
				}
				if (checkboxInfo.onToggle) {
					checkbox.onchange = () => (checkboxInfo.onToggle ?? (() => undefined))(checkbox.checked);
				}
			})();
		}
		if (interactionInfo.textbox) {
			const textboxInfo = interactionInfo.textbox;
			const insertTextboxElement = (container: HTMLElement, value = ""): HTMLInputElement => {
				const textbox = document.createElement("input");
				textbox.type = "text";
				textbox.classList.add(textboxInfo.className);
				textbox.placeholder = textboxInfo.placeholder;
				textbox.spellcheck = textboxInfo.spellcheck;
				textbox.value = value;
				const onChangeInternal = () => {
					if (textboxInfo.list) {
						if (textbox.value && (container.lastElementChild as HTMLInputElement).value) {
							insertTextboxElement(container);
						} else if (!textbox.value && container.lastElementChild !== textbox && document.activeElement !== textbox) {
							textbox.remove();
						}
						if (textbox.parentElement) {
							// Parent is a list container because getArrayForList exists
							textboxInfo.list.setArray(
								Array.from(textbox.parentElement.children)
									.map((textbox: HTMLInputElement) => textbox.value)
									.filter(value => !!value),
								index,
							);
						}
					}
					if (textboxInfo.onChange) {
						textboxInfo.onChange(textbox.value);
					}
				};
				textbox.addEventListener("input", onChangeInternal);
				textbox.addEventListener("blur", onChangeInternal);
				container.appendChild(textbox);
				return textbox;
			};
			if (textboxInfo.list) {
				const list = document.createElement("div");
				list.classList.add("organizer");
				list.classList.add("list");
				textboxInfo.list.getArray(index).then(array => {
					array.concat("").forEach(value => {
						insertTextboxElement(list, value);
					});
				});
				interaction.appendChild(list);
			} else {
				insertTextboxElement(interaction);
			}
		}
		if (interactionInfo.note) {
			const note = document.createElement("div");
			note.classList.add("note");
			note.textContent = interactionInfo.note.text;
			interaction.appendChild(note);
		}
		return interaction;
	};

	const createSection = (sectionInfo: PopupSectionInfo) => {
		const section = document.createElement("div");
		section.classList.add("section");
		if (sectionInfo.title) {
			const title = document.createElement("div");
			title.classList.add("title");
			title.textContent = sectionInfo.title.text;
			section.appendChild(title);
		}
		const container = document.createElement("div");
		container.classList.add("container");
		sectionInfo.interactions.forEach((interactionInfo, i) => {
			container.appendChild(createInteraction(interactionInfo, i));
		});
		section.appendChild(container);
		return section;
	};

	const temp = () => {
		const panelsInfo: Array<PopupPanelInfo> = [
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
										const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
										setChecked(isTabResearchPage(session.researchInstances, tab.id as number));
									},
									onToggle: checked => {
										if (checked) {
											getStorageSession([ StorageSession.RESEARCH_INSTANCES ]).then(async session => {
												const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
												const researchInstance = session.researchInstances[tab.id as number];
												if (researchInstance && researchInstance.persistent) {
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
									text: "Restores keywords",
								},
								checkbox: {
									onLoad: async setChecked => {
										const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
										const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
										const researchInstance = session.researchInstances[tab.id as number];
										setChecked(researchInstance
											? researchInstance.persistent
											: (await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ])).persistResearchInstances
										);
									},
									onToggle: checked => {
										getStorageSession([ StorageSession.RESEARCH_INSTANCES ]).then(async session => {
											const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
											const researchInstance = session.researchInstances[tab.id as number];
											if (researchInstance) {
												researchInstance.persistent = checked;
												setStorageSession(session);
											}
										});
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
								submitter: {
									text: "Submit anonymously",
									onClick: (messageText, onSuccess, onError) => {
										sendProblemReport(messageText)
											.then(onSuccess)
											.catch(onError);
									},
									message: {
										rows: 3,
										placeholder: "Optional message",
									},
									alerts: {
										[PopupAlertType.SUCCESS]: {
											text: "Success",
										},
										[PopupAlertType.FAILURE]: {
											text: "Status {status}: {text}",
										},
										[PopupAlertType.PENDING]: {
											text: "Pending, do not close popup",
										},
									},
								},
								note: {
									text: "Submits: version, url, keywords, message",
								},
							},
							{
								className: "link",
								anchor: {
									url: "https://github.com/ator-dev/mark-my-search/issues/new",
									text: "File a bug report",
								},
							},
							{
								className: "link",
								anchor: {
									url: "https://github.com/ator-dev/mark-my-search",
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
							text: "Never Highlight",
						},
						interactions: [
							{
								className: "url",
								textbox: {
									className: "url-input",
									list: {
										getArray: () =>
											getStorageSync([ StorageSync.URL_FILTERS ]).then(sync =>
												sync.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname)
											)
										,
										setArray: array =>
											getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => {
												sync.urlFilters.noPageModify = array.map(value => {
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
					{
						title: {
							text: "Do Not Auto Highlight",
						},
						interactions: [
							{
								className: "url",
								textbox: {
									className: "url-input",
									list: {
										getArray: () =>
											getStorageSync([ StorageSync.URL_FILTERS ]).then(sync =>
												sync.urlFilters.nonSearch.map(({ hostname, pathname }) => hostname + pathname)
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
							text: "",
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
									pushEmpty: () =>
										getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => {
											sync.termLists.push({
												name: "",
												terms: [],
												urlFilter: [],
											});
											setStorageSync(sync);
										})
									,
									removeAt: index =>
										getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => {
											delete sync.termLists[index];
											setStorageSync(sync);
										})
									,
								},
								label: {
									text: "",
									getText: index =>
										getStorageSync([ StorageSync.TERM_LISTS ]).then(sync =>
											sync.termLists[index].name
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
													checkbox: {},
												},
												{
													className: "type",
													key: "matchMode.stem",
													label: {
														text: "Match Stems",
													},
													checkbox: {},
												},
												{
													className: "type",
													key: "matchMode.case",
													label: {
														text: "Match Case",
													},
													checkbox: {},
												},
												{
													className: "type",
													key: "matchMode.regex",
													label: {
														text: "Regular Expression",
													},
													checkbox: {},
												},
											],
										},
									],
								},
								textbox: {
									className: "TODOreplace",
									list: {
										getArray: index =>
											getStorageSync([ StorageSync.TERM_LISTS ]).then(sync =>
												sync.termLists[index].urlFilter.map(({ hostname, pathname }) => hostname + pathname)
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
							},
						],
					},
				],
			},
		];
		const frame = document.createElement("div");
		frame.id = "frame";
		document.body.appendChild(frame);
		const brand = document.createElement("div");
		const name = document.createElement("div");
		const version = document.createElement("div");
		const logo = document.createElement("img");
		name.classList.add("name");
		name.textContent = chrome.runtime.getManifest().name;
		version.classList.add("version");
		version.textContent = `v${chrome.runtime.getManifest().version}`;
		logo.classList.add("logo");
		logo.src = "/icons/mms.svg";
		brand.classList.add("brand");
		brand.appendChild(name);
		brand.appendChild(version);
		brand.appendChild(logo);
		frame.insertAdjacentElement("afterbegin", brand);
		const panelContainer = document.createElement("frame");
		panelContainer.classList.add("container-panel");
		frame.appendChild(panelContainer);
		const filler = document.createElement("div");
		filler.classList.add("filler");
		frame.appendChild(filler);
		const tabContainer = document.createElement("div");
		tabContainer.classList.add("container-tab");
		frame.appendChild(tabContainer);
		panelsInfo.forEach(panelInfo => {
			const panel = document.createElement("div");
			panel.classList.add("panel");
			panel.classList.add(panelInfo.className);
			panelInfo.sections.forEach(sectionInfo => {
				panel.appendChild(createSection(sectionInfo));
			});
			panelContainer.appendChild(panel);
			const tab = document.createElement("button");
			tab.type = "button";
			tab.classList.add("tab");
			tab.classList.add(panelInfo.className);
			tab.textContent = panelInfo.name.text;
			tabContainer.appendChild(tab);
		});
		const classNameIsPanel = (className: string) => className.split("-")[0] === "panel";
		const getPanelClassName = (classArray: Array<string>) =>
			classArray.find(className => classNameIsPanel(className)) ?? "";
		const focusActivePanel = () => {
			const className = getPanelClassName(Array.from(frame.classList));
			(document.querySelector(`.panel.${className} input`) as HTMLInputElement).focus();
		};
		const getTabs = () => document.querySelectorAll(".container-tab .tab");
		const shiftTabFromTab = (tabCurrent: HTMLButtonElement, toRight: boolean, cycle: boolean) => {
			const tabNext = (
				tabCurrent[toRight ? "nextElementSibling" : "previousElementSibling"]
				?? (cycle ? (tabCurrent.parentElement as HTMLElement)[toRight ? "firstElementChild" : "lastElementChild"] : null)
			) as HTMLButtonElement | null;
			if (tabNext) {
				tabNext.focus();
				tabNext.dispatchEvent(new MouseEvent("mousedown"));
			}
		};
		getTabs().forEach((tab: HTMLButtonElement) => {
			const onClick = () => {
				frame.classList.forEach(className => {
					if (classNameIsPanel(className)) {
						frame.classList.remove(className);
					}
				});
				frame.classList.add(getPanelClassName(Array.from(tab.classList)));
			};
			tab.addEventListener("click", onClick);
			tab.addEventListener("mousedown", onClick);
			tab.addEventListener("keydown", event => {
				if (event.key === "ArrowDown" || event.key === "ArrowRight") {
					shiftTabFromTab(tab, true, true);
				} else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
					shiftTabFromTab(tab, false, true);
				}
			});
		});
		document.addEventListener("keydown", event => {
			const shiftTab = (toRight: boolean, cycle: boolean) => {
				const currentTab = document
					.querySelector(`.container-tab .${getPanelClassName(Array.from(frame.classList))}`) as HTMLButtonElement;
				shiftTabFromTab(currentTab, toRight, cycle);
				focusActivePanel();
			};
			if (event.key === "PageDown") {
				shiftTab(true, true);
			} else if (event.key === "PageUp") {
				shiftTab(false, true);
			}
		});
		(getTabs()[0] as HTMLButtonElement).click();
		const reload = () => {
			panelsInfo.forEach(panelInfo => {
				panelInfo.sections.forEach(sectionInfo => {
					sectionInfo.interactions.forEach(interactionInfo => {
						if (!interactionInfo.checkbox) {
							return;
						}
						const checkbox = document.getElementById(interactionInfo.checkbox.id as string) as HTMLInputElement;
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						interactionInfo.checkbox.onLoad!(checked => checkbox.checked = checked);
					});
				});
			});
		};
		chrome.storage.onChanged.addListener(reload);
		chrome.tabs.onActivated.addListener(reload);
		// Unrelated
		const insertWarning = (panelName: string, text: string) => {
			const warning = document.createElement("div");
			warning.classList.add("warning");
			warning.textContent = text;
			document.querySelector(`.container-panel .panel-${panelName}`)?.insertAdjacentElement("afterbegin", warning);
		};
		insertWarning("sites_search_research", "This functionality is experimental. Please report bugs or give feedback!");
		insertWarning(
			"term_lists",
			`This interface will allow editing keyword lists
			which can be stored, highlighted, and assigned sites for automatic highlighting.`,
		);
	};

	/**
	 * An EmailJS library function which sends an email using the EmailJS service.
	 * @param service The name of a service category for the email.
	 * @param template The name of a template under the service for the email.
	 * @param details Custom template field entries.
	 * @param key The API key to use.
	 */
	const sendEmail: (
		service: string,
		template: string,
		details: { mmsVersion?: string, url?: string, phrases?: string, userMessage?: string, userEmail?: string },
		key: string,
	) => Promise<void> = window["libSendEmail"];

	/**
	 * Sends a problem report message to a dedicated inbox.
	 * @param userMessage An optional message string to send as a comment.
	 */
	const sendProblemReport = async (userMessage = "") => {
		const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		const phrases = session.researchInstances[tab.id as number]
			? session.researchInstances[tab.id as number].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		return sendEmail("service_mms_report", "template_mms_report", {
			mmsVersion: chrome.runtime.getManifest().version,
			url: tab.url,
			phrases,
			userMessage,
		}, "NNElRuGiCXYr1E43j");
	};

	return () => {
		fillAndInsertStylesheet();
		temp();
	};
})();

(() => {
	return () => {
		chrome.tabs.query = isBrowserChromium() // Running in Chromium
			? chrome.tabs.query
			: browser.tabs.query as typeof chrome.tabs.query;
		loadPopup();
	};
})()();
