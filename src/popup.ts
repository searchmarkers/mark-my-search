type PopupInteractionInfo = {
	className: string
	label?: {
		text: string
	}
	anchor?: {
		url: string
		text: string
	}
	submit?: {
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
		onLoad?: (checkbox: HTMLInputElement) => Promise<void>
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
	{ width: 300px; height: 530px; margin: 0; margin-bottom: 2px; font-family: ubuntu; background: black; user-select: none; }
*
	{ font-size: 16; scrollbar-color: hsl(300 50% 40% / 0.5) transparent; }
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
	{ display: flex; flex-direction: column; height: 100%;
	background: hsl(300 100% 11%); border: 1px solid black; border-radius: 10px; }
#frame > .filler
	{ flex: 1; }
.brand
	{ display: flex; }
.brand > .name
	{ flex: 1; align-self: center; text-align: center; font-weight: bold; color: hsl(0 0% 80%); }
.brand > .logo
	{ width: 32px; height: 32px; margin: 6px; }
.container-tab
	{ display: flex;
	border-top: 2px solid hsl(300 30% 36%); border-bottom-left-radius: inherit; border-bottom-right-radius: inherit; }
.container-tab > .tab
	{ flex: 1; font-size: 14; border: none; border-bottom: 2px solid transparent; border-radius: inherit; outline: none;
	background: hsl(300 20% 26%); color: hsl(300 20% 80%); }
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
/**/

.panel-general .container-tab > .tab.panel-general,
.panel-lists .container-tab > .tab.panel-lists
	{ border-bottom: 2px solid deeppink; background: hsl(300 20% 36%); }
.panel-general .container-panel > .panel.panel-general,
.panel-lists .container-panel > .panel.panel-lists
	{ display: flex; }
/**/

.panel.panel-general .section
	{ display: flex; flex-direction: column;
	border-bottom: 1px solid hsl(0 0% 100% / 0.3); border-radius: inherit; background: hsl(300 100% 7%); }
.panel.panel-general .section > .title
	{ padding-inline: 8px; padding-block: 4px; text-align: center; font-size: 15; white-space: nowrap; overflow: hidden;
	color: hsl(300 20% 60%); }
.panel.panel-general .section > .container
	{ height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel-general .section > .container { overflow-y: overlay; }; }
.panel.panel-general .interaction
	{ display: flex; padding-inline: 8px; }
.panel.panel-general .interaction > *
	{ margin-block: 2px; border-radius: 2px; padding-block: 4px; }
.panel.panel-general .interaction:is(.action, .link) > *
	{ padding-block: 0; }
.panel.panel-general .interaction .label, .alert
	{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: hsl(300 10% 80%); }
.panel.panel-general .interaction .submit
	{ padding-block: 3px; white-space: nowrap; overflow: hidden; }
.panel.panel-general .interaction .submit:disabled
	{ pointer-events: none; color: hsl(0 0% 60%); }
.panel.panel-general .interaction .message,
.panel.panel-general .interaction .submit
	{ border: none; background: hsl(300 60% 16%); color: hsl(0 0% 90%); }
.panel.panel-general .interaction .alert,
.panel.panel-general .interaction .submit
	{ padding-inline: 2px; }
.panel.panel-general .interaction .submit:hover
	{ background: hsl(300 60% 20%); }
.panel.panel-general .interaction .submit:active
	{ background: hsl(300 60% 14%); }
.panel.panel-general .interaction .note
	{ font-size: 14; color: hsl(300 6% 60%); }
.panel.panel-general .interaction.option .label
	{ flex: 1; }
.panel.panel-general .interaction:is(.action, .link)
	{ flex-direction: column; padding-block: 4px; }
.panel.panel-general .interaction.link a
	{ color: hsl(200 100% 80%); }
.panel.panel-general .interaction.link a:visited
	{ color: hsl(260 100% 80%); }
.panel.panel-general .interaction.link a:active
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

.panel.panel-lists .section
	{ display: flex; flex-direction: column;
	border-bottom: 1px solid hsl(0 0% 100% / 0.3); border-radius: inherit; background: hsl(300 100% 7%); }
.panel.panel-lists .section > .title
	{ margin: 4px; text-align: center; border: none; background: none; color: white; }
.panel.panel-lists .section > .container
	{ display: flex; flex-direction: column; padding: 4px; }
.panel.panel-lists .container-terms .term
	{ display: flex; padding: 4px; margin-block: 2px; border-radius: 10px; background: hsl(300 30% 15%); }
.panel.panel-lists .container-terms .term .phrase-input
	{ width: 80px; border: none; background: none; color: white; }
.panel.panel-lists .container-terms .term .matching
	{ flex: 1; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel-lists .container-terms .term .matching { overflow-y: overlay; }; }
.panel.panel-lists .container-terms .term .matching .type
	{ display: flex; }
.panel.panel-lists .container-terms .term .matching .type .label
	{ flex: 1; align-self: center; font-size: 11; color: white; }
.panel.panel-lists .container-urls .url-input
	{ border: none; background: none; color: white; }
/**/
		`;
		document.head.appendChild(style);
	};

	const getId = (function* () {
		let id = 0;
		while (true) {
			yield (id++).toString();
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

	const createInteraction = (interactionInfo: PopupInteractionInfo) => {
		const interaction = document.createElement("div");
		interaction.classList.add("interaction");
		interaction.classList.add(interactionInfo.className);
		if (interactionInfo.label) {
			const label = document.createElement("label");
			label.classList.add("label");
			label.textContent = interactionInfo.label.text;
			interaction.appendChild(label);
			if (interactionInfo.checkbox) {
				interactionInfo.checkbox.id = getId.next().value;
				label.htmlFor = interactionInfo.checkbox.id as string;
			}
		}
		if (interactionInfo.anchor) {
			const anchor = document.createElement("a");
			anchor.href = interactionInfo.anchor.url;
			anchor.textContent = interactionInfo.anchor.text ?? anchor.href;
			interaction.appendChild(anchor);
		}
		if (interactionInfo.submit) {
			const button = document.createElement("button");
			button.type = "button";
			button.classList.add("submit");
			button.textContent = interactionInfo.submit.text;
			interaction.appendChild(button);
			let getMessageText = () => "";
			button.onclick = () => {
				button.disabled = true;
				clearAlerts(interaction, [ "pending", "failure" ]);
				interactionInfo.submit = interactionInfo.submit as typeof interactionInfo.submit;
				interactionInfo.submit.onClick = interactionInfo.submit.onClick as typeof interactionInfo.submit.onClick;
				interactionInfo.submit.onClick(
					getMessageText(),
					() => {
						clearAlerts(interaction, [ "pending" ]);
						insertAlert(PopupAlertType.SUCCESS, (interactionInfo.submit ?? {}).alerts, button, 3000);
						button.disabled = false;
					},
					error => {
						clearAlerts(interaction, [ "pending" ]);
						const errorText = error.text || "(no error message)";
						insertAlert(PopupAlertType.FAILURE, (interactionInfo.submit ?? {}).alerts, button, -1,
							errorText, text => text.replace("{status}", error.status.toString()).replace("{text}", errorText));
						button.disabled = false;
					},
				);
				insertAlert(PopupAlertType.PENDING, interactionInfo.submit.alerts, button);
			};
			if (interactionInfo.submit.message) {
				const messageBox = document.createElement("textarea");
				messageBox.classList.add("message");
				messageBox.rows = interactionInfo.submit.message.rows;
				messageBox.placeholder = interactionInfo.submit.message.placeholder;
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
					await checkboxInfo.onLoad(checkbox);
				}
				if (checkboxInfo.onToggle) {
					checkbox.onchange = () => (checkboxInfo.onToggle ?? (() => undefined))(checkbox.checked);
				}
			})();
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
		sectionInfo.interactions.forEach(interactionInfo => {
			container.appendChild(createInteraction(interactionInfo));
		});
		section.appendChild(container);
		return section;
	};

	const temp = () => {
		const panel = document.querySelector(".panel.panel-general") as HTMLElement;
		const sectionsInfo: Array<PopupSectionInfo> = [
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
							onLoad: async checkbox => {
								const local = await getStorageLocal([ StorageLocal.ENABLED ]);
								checkbox.checked = local.enabled;
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
							onLoad: async checkbox => {
								const local = await getStorageLocal([ StorageLocal.FOLLOW_LINKS ]);
								checkbox.checked = local.followLinks;
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
							onLoad: async checkbox => {
								const local = await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ]);
								checkbox.checked = local.persistResearchInstances;
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
							onLoad: async checkbox => {
								const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
								const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
								checkbox.checked = isTabResearchPage(session.researchInstances, tab.id as number);
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
											terms: researchInstance && researchInstance.enabled ? researchInstance.terms : [],
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
							onLoad: async checkbox => {
								const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
								const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
								const researchInstance = session.researchInstances[tab.id as number];
								checkbox.checked = researchInstance
									? researchInstance.persistent
									: (await getStorageLocal([ StorageLocal.PERSIST_RESEARCH_INSTANCES ])).persistResearchInstances;
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
						submit: {
							text: "Submit anonymously",
							onClick: (messageText, onSuccess, onError) => {
								sendProblemReport(messageText)
									.then(onSuccess)
									.catch(onError);
							},
							message: {
								rows: 3,
								placeholder: "no message",
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
							text: "Submits: version, url, terms, optional message",
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
						}
					},
				],
			}
		];
		sectionsInfo.forEach(sectionInfo => {
			panel.appendChild(createSection(sectionInfo));
		});
		const frame = document.querySelector("#frame") as HTMLElement;
		const classNameIsPanel = (className: string) => className.split("-")[0] === "panel";
		const getPanelClassName = (classArray: Array<string>) =>
			classArray.find(className => classNameIsPanel(className)) ?? "";
		const focusActivePanel = () => {
			const className = getPanelClassName(Array.from(frame.classList));
			(document.querySelector(`.panel.${className} input`) as HTMLInputElement).focus();
		};
		const getTabs = () => document.querySelectorAll(".container-tab .tab");
		const shiftTabFromTab = (toRight: boolean, tabCurrent: HTMLButtonElement) => {
			const tabNext = (
				tabCurrent[toRight ? "nextElementSibling" : "previousElementSibling"]
				?? (tabCurrent.parentElement as HTMLElement)[toRight ? "firstElementChild" : "lastElementChild"]
			) as HTMLButtonElement;
			tabNext.focus();
			tabNext.click();
		};
		getTabs().forEach((tab: HTMLButtonElement) => {
			tab.addEventListener("click", () => {
				frame.classList.forEach(className => {
					if (classNameIsPanel(className)) {
						frame.classList.remove(className);
					}
				});
				frame.classList.add(getPanelClassName(Array.from(tab.classList)));
				tab.style.width = "60px";
			});
			tab.addEventListener("keydown", event => {
				if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
					shiftTabFromTab(false, tab);
				} else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
					shiftTabFromTab(true, tab);
				}
			});
		});
		document.addEventListener("keydown", event => {
			const shiftTab = (toRight: boolean) => {
				const currentTab = document
					.querySelector(`.container-tab .${getPanelClassName(Array.from(frame.classList))}`) as HTMLButtonElement;
				shiftTabFromTab(toRight, currentTab);
				focusActivePanel();
			};
			if (event.key === "PageUp") {
				shiftTab(false);
			}
			if (event.key === "PageDown") {
				shiftTab(true);
			}
		});
		focusActivePanel();
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
		if (tab.id === undefined) {
			return;
		}
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		const phrases = session.researchInstances[tab.id ?? -1]
			? session.researchInstances[tab.id ?? -1].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		//buttons.problemReportDescribe.textContent = (buttons.problemReportDescribe.textContent as string)
		//	.replace(/🆗|!/g, "").trimEnd();
		//buttons.problemReport.disabled = true;
		//buttons.problemReportDescribe.disabled = true;
		return sendEmail("service_mms_report", "template_mms_report", {
			mmsVersion: chrome.runtime.getManifest().version,
			url: tab.url,
			phrases,
			userMessage,
		}, "NNElRuGiCXYr1E43j");//.then(() => {
		//	buttons.problemReportDescribe.textContent += " 🆗";
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		//}, (error: { status: number, text: string }) => {
		//	buttons.problemReportDescribe.textContent += " !!";
		//	buttons.problemReportDescribe.title = `[STATUS ${error.status}] '${error.text}'`;
		//}).then(() => {
		//	buttons.problemReport.disabled = false;
		//	buttons.problemReportDescribe.disabled = false;
		//});
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
