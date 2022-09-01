type PopupInteractionInfo = {
	className: string
	label?: {
		text: string
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
	{ width: 300px; height: 520px; margin: 0; font-family: ubuntu; background: hsl(300 100% 11%); user-select: none; }
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
	{ display: flex; flex-direction: column; height: 100%; background: inherit; /* border-radius: 10px; */ }
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
	{ flex: 1 1 auto; font-size: 14; border: none; border-bottom: 2px solid transparent; border-radius: inherit;
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

.panel-sites_search .container-tab > .tab.panel-sites_search,
.panel-sites_research .container-tab > .tab.panel-sites_research,
.panel-term_lists .container-tab > .tab.panel-term_lists,
.panel-general .container-tab > .tab.panel-general
	{ border-bottom: 2px solid deeppink; background: hsl(300 20% 36%); }
.panel-sites_search .container-panel > .panel.panel-sites_search,
.panel-sites_research .container-panel > .panel.panel-sites_research,
.panel-term_lists .container-panel > .panel.panel-term_lists,
.panel-general .container-panel > .panel.panel-general
	{ display: flex; }
/**/

.panel .section
	{ display: flex; flex-direction: column;
	border-bottom: 1px solid hsl(0 0% 100% / 0.3); border-radius: inherit; background: hsl(300 100% 7%); }
.panel .section > .title
	{ border: none; background: none; text-align: center; font-size: 15; color: hsl(300 20% 60%); }
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
.panel .interaction.option
	{ flex-direction: row; padding-block: 0; }
.panel .interaction > *
	{ margin-block: 2px; border-radius: 2px; padding-block: 4px; }
.panel .interaction input[type=text],
.panel .interaction textarea,
.panel .interaction .submitter
	{ border: none; background: hsl(300 60% 16%); color: hsl(0 0% 90%); }
.panel .interaction:is(.action, .link) > *
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
	{ font-size: 14; color: hsl(300 6% 60%); }
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

.panel:not(.panel-general) .section > .title
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
	{ flex: 1; align-self: center; font-size: 11; color: white; }
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
								placeholder: "Message",
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
						}
					},
				],
			},
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
			tab.addEventListener("mousedown", () => {
				frame.classList.forEach(className => {
					if (classNameIsPanel(className)) {
						frame.classList.remove(className);
					}
				});
				frame.classList.add(getPanelClassName(Array.from(tab.classList)));
			});
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
				shiftTab(true, false);
			} else if (event.key === "PageUp") {
				shiftTab(false, false);
			}
		});
		(getTabs()[0] as HTMLButtonElement).dispatchEvent(new MouseEvent("mousedown"));
		const reload = () => {
			sectionsInfo.forEach(sectionInfo => {
				sectionInfo.interactions.forEach(interactionInfo => {
					if (!interactionInfo.checkbox) {
						return;
					}
					const checkbox = document.getElementById(interactionInfo.checkbox.id as string) as HTMLInputElement;
					// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
					interactionInfo.checkbox.onLoad!(checked => checkbox.checked = checked);
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
			document.querySelector(`.panel-${panelName}`)?.insertAdjacentElement("afterbegin", warning);
		};
		insertWarning("sites_search", "This interface is a work in progress.");
		insertWarning("sites_research", "This interface is a work in progress.");
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
