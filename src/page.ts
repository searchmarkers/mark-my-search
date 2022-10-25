type PageInteractionSubmitterInfo = {
	text: string
	onClick: (
		messageText: string,
		formFields: Array<FormField>,
		onSuccess: () => void,
		onError: (error: { status: number, text: string }) => void,
	) => void
	formFields?: Array<PageInteractionInfo>
	message?: {
		singleline?: boolean
		rows: number
		placeholder: string
	}
	alerts?: Record<PageAlertType, PageAlertInfo>
}
type PageInteractionInfo = {
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
				label?: PageInteractionInfo["label"]
				textbox?: PageInteractionInfo["textbox"]
				checkbox?: PageInteractionInfo["checkbox"]
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
		onLoad?: (setText: (text: string) => void, objectIndex: number, containerIndex: number) => Promise<void>
		onChange?: (text: string, objectIndex: number, containerIndex: number) => void
	}
	anchor?: {
		url: string
		text: string
	}
	submitters?: Array<PageInteractionSubmitterInfo>
	checkbox?: {
		autoId?: string
		onLoad?: (setChecked: (checked: boolean) => void, objectIndex: number, containerIndex: number) => Promise<void>
		onToggle?: (checked: boolean, objectIndex: number, containerIndex: number) => void
	}
	note?: {
		text: string
	}
}
type PageSectionInfo = {
	title?: {
		text: string
	}
	interactions: Array<PageInteractionInfo>
}
type PagePanelInfo = {
	className: string
	name: {
		text: string
	}
	sections: Array<PageSectionInfo>
}
type PageAlertInfo = {
	text: string
}
type FormField = {
	question: string
	response: string
}

enum PageAlertType {
	SUCCESS = "success",
	FAILURE = "failure",
	PENDING = "pending",
}

//enum PageButtonClass {
//	TOGGLE = "toggle",
//	ENABLED = "enabled",
//}

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
	details: {
		addon_version?: string
		url?: string
		phrases?: string
		user_message?: string
		user_email?: string
		item_0_question?: string
		item_1_question?: string
		item_2_question?: string
		item_3_question?: string
		item_4_question?: string
		item_5_question?: string
		item_6_question?: string
		item_7_question?: string
		item_8_question?: string
		item_9_question?: string
		item_0_response?: string
		item_1_response?: string
		item_2_response?: string
		item_3_response?: string
		item_4_response?: string
		item_5_response?: string
		item_6_response?: string
		item_7_response?: string
		item_8_response?: string
		item_9_response?: string
	},
	key: string,
) => Promise<void> = window["libSendEmail"];

/**
 * Sends a problem report message to a dedicated inbox.
 * @param userMessage An optional message string to send as a comment.
	*/
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sendProblemReport = async (userMessage = "", formFields: Array<FormField>) => {
	const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
	const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
	const phrases = session.researchInstances[tab.id as number]
		? session.researchInstances[tab.id as number].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
		: "";
	const message = {
		addon_version: chrome.runtime.getManifest().version,
		url: tab.url,
		phrases,
		user_message: userMessage,
	};
	(formFields ?? []).forEach((formField, i) => {
		message[`item_${i}_question`] = formField.question;
		message[`item_${i}_response`] = formField.response;
	});
	return sendEmail(
		"service_mms_ux",
		formFields.length ? "template_mms_ux_form" : "template_mms_ux_report",
		message,
		"NNElRuGiCXYr1E43j",
	);
};

// TODO document functions

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const pageInsertWarning = (container: HTMLElement, text: string) => {
	const warning = document.createElement("div");
	warning.classList.add("warning");
	warning.textContent = text;
	container.appendChild(warning);
};

const pageFocusScrollContainer = () =>
	(document.querySelector(".container-panel") as HTMLElement).focus()
;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const loadPage = (() => {
	/**
	 * Fills and inserts a CSS stylesheet element to style the page.
	 */
	const fillAndInsertStylesheet = (additionalStyleText = "") => {
		const style = document.createElement("style");
		style.textContent = `
body
	{ height: 100vh; margin: 0; border: 2px solid hsl(300 100% 14%); border-radius: 8px; overflow: hidden;
	font-family: ubuntu, sans-serif; background: hsl(300 100% 6%); }
*
	{ font-size: 16px; scrollbar-color: hsl(300 50% 40% / 0.5) transparent; }
::-webkit-scrollbar
	{ width: 5px; }
::-webkit-scrollbar-thumb
	{ background: hsl(300 50% 40% / 0.5); }
::-webkit-scrollbar-thumb:hover
	{ background: hsl(300 50% 60% / 0.5); }
::-webkit-scrollbar-thumb:active
	{ background: hsl(300 50% 80% / 0.5); }
textarea
	{ resize: none; }
#frame
	{ display: flex; flex-direction: column; height: 100%; border-radius: inherit; background: inherit; }
.brand
	{ display: flex; }
.brand > *
	{ margin: 6px; }
.brand .name
	{ flex: 1; align-self: center; text-align: right; font-weight: bold; color: hsl(0 0% 74%); }
.brand .version
	{ align-self: center; font-size: 14px; color: hsl(0 0% 80% / 0.5); }
.brand .logo
	{ width: 32px; height: 32px; }
.container-tab
	{ display: flex; justify-content: center;
	border-top: 2px solid hsl(300 30% 32%); border-bottom-left-radius: inherit; border-bottom-right-radius: inherit; }
.container-tab > .tab
	{ flex: 1 1 auto; font-size: 14px; border: none; border-bottom: 2px solid transparent; border-radius: inherit;
	background: transparent; color: hsl(300 20% 90%); }
.container-tab > .tab:hover
	{ background: hsl(300 30% 22%); }
.container-panel
	{ flex: 1 1 auto; border-top: 1px solid deeppink; border-top-left-radius: inherit; overflow-y: auto;
	outline: none; background: hsl(300 100% 10%); }
@supports (overflow-y: overlay)
	{ .container-panel { overflow-y: overlay; }; }
.container-panel > .panel
	{ display: none; flex-direction: column; gap: 1px;
	border-radius: inherit; background: hsl(0 0% 100% / 0.26); box-shadow: 0 0 10px; }
.container-panel > .panel, .brand
	{ margin-inline: max(0px, calc((100vw - 700px)/2)); }
.warning
	{ padding: 4px; border-radius: 2px; background: hsl(60 36% 50% / 0.8); color: hsl(0 0% 8%); }
/**/

.panel-sites_search_research .container-tab > .tab.panel-sites_search_research,
.panel-term_lists .container-tab > .tab.panel-term_lists,
.panel-features .container-tab > .tab.panel-features,
.panel-general .container-tab > .tab.panel-general
	{ border-bottom: 2px solid deeppink; background: hsl(300 30% 32%); }
.panel-sites_search_research .container-panel > .panel.panel-sites_search_research,
.panel-term_lists .container-panel > .panel.panel-term_lists,
.panel-features .container-panel > .panel.panel-features,
.panel-general .container-panel > .panel.panel-general
	{ display: flex; }
/**/

.panel .section
	{ display: flex; flex-direction: column; width: 100%; background: hsl(300 100% 7%); }
.panel .section > .title
	{ border: none; background: none; text-align: center; font-size: 15px; color: hsl(300 20% 60%); }
.panel.panel .section > .container
	{ display: flex; flex-direction: column; height: auto; overflow-y: auto; }
@supports (overflow-y: overlay)
	{ .panel.panel .section > .container { overflow-y: overlay; }; }
/**/

.panel .interaction
	{ display: flex; flex-direction: column; padding-inline: 8px; padding-block: 4px; }
.panel .list
	{ display: flex; margin: 0; border: 0; }
.panel .list.column
	{ flex-direction: column; }
.panel .list.row
	{ flex-direction: row; gap: 8px; }
.panel .list.row > *
	{ flex: 1 1 auto; }
.panel .interaction.option
	{ flex-direction: row; padding-block: 0; user-select: none; }
.panel .interaction > *, .panel .organizer > *
	{ margin-block: 2px; border-radius: 2px; padding-block: 4px; }
.panel .interaction input[type="text"],
.panel .interaction textarea,
.panel .interaction .submitter
	{ border: none; background: hsl(300 60% 16%); color: hsl(0 0% 90%); font-family: inherit; }
.panel .interaction input[type="checkbox"]
	{ align-self: center; }
.panel .interaction:is(.action, .link, .organizer) > *
	{ padding-block: 0; }
.panel .interaction .label, .alert
	{ color: hsl(300 0% 72%); }
.panel .interaction.option label.label[for]:hover
	{ color: hsl(300 0% 66%); }
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
	{ font-size: 14px; color: hsl(300 6% 54%); white-space: break-spaces; }
.panel .interaction.option .label
	{ flex: 1; }
.panel .interaction.link a
	{ color: hsl(200 100% 80%); }
.panel .interaction.link a:visited
	{ color: hsl(260 100% 80%); }
.panel .interaction.link a:active
	{ color: hsl(0 100% 60%); }
/**/

#frame .alert
	{ display: flex; align-items: center; height: 20px; padding-block: 0;
	transition-property: height, margin; transition-duration: 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
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
		` + additionalStyleText;
		document.head.appendChild(style);
	};

	const classNameIsPanel = (className: string) =>
		className.split("-")[0] === "panel"
	;

	const getPanelClassName = (classArray: Array<string>) =>
		classArray.find(className => classNameIsPanel(className)) ?? ""
	;

	const focusActivePanel = () => {
		const frame = document.querySelector("#frame") as HTMLElement;
		const className = getPanelClassName(Array.from(frame.classList));
		const inputFirst = document.querySelector(`.panel.${className} input`) as HTMLInputElement | null;
		if (inputFirst) {
			if (inputFirst.type === "text") {
				inputFirst.select();
			} else {
				inputFirst.focus();
			}
		} else {
			pageFocusScrollContainer();
		}
	};

	const getTabs = () =>
		document.querySelectorAll(".container-tab .tab")
	;

	const shiftTabFromTab = (tabCurrent: HTMLButtonElement, toRight: boolean, cycle: boolean) => {
		const tabNext = ( //
			tabCurrent[toRight ? "nextElementSibling" : "previousElementSibling"] //
				?? (cycle //
					? (tabCurrent.parentElement as HTMLElement)[toRight ? "firstElementChild" : "lastElementChild"] //
					: null //
				)
		) as HTMLButtonElement | null;
		if (tabNext) {
			tabNext.focus();
			tabNext.dispatchEvent(new MouseEvent("mousedown"));
		}
	};

	const handleTabs = (shiftModifierIsRequired = true) => {
		const frame = document.querySelector("#frame") as HTMLElement;
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
			if (shiftModifierIsRequired && !event.shiftKey) {
				return;
			}
			const shiftTab = (toRight: boolean, cycle: boolean) => {
				const currentTab = document
					.querySelector(`.container-tab .${getPanelClassName(Array.from(frame.classList))}`) as HTMLButtonElement;
				shiftTabFromTab(currentTab, toRight, cycle);
				focusActivePanel();
			};
			if (event.key === "PageDown") {
				shiftTab(true, true);
				event.preventDefault();
			} else if (event.key === "PageUp") {
				shiftTab(false, true);
				event.preventDefault();
			}
		});
		(getTabs()[0] as HTMLButtonElement).click();
	};

	const reload = (panelsInfo: Array<PagePanelInfo>) => {
		panelsInfo.forEach(panelInfo => {
			panelInfo.sections.forEach(sectionInfo => {
				sectionInfo.interactions.forEach(interactionInfo => {
					if (!interactionInfo.checkbox) {
						return;
					}
					if (!interactionInfo.checkbox.autoId) {
						return;
					}
					const checkbox = document.getElementById(interactionInfo.checkbox.autoId) as HTMLInputElement;
					if (interactionInfo.checkbox.onLoad) {
						interactionInfo.checkbox.onLoad(checked => checkbox.checked = checked, 0, 0);
					}
				});
			});
		});
	};

	const insertAlert = (alertType: PageAlertType, alertsInfo: Record<PageAlertType, PageAlertInfo> | undefined,
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

	const createSection = (() => {
		const insertLabel = (container: HTMLElement, labelInfo: PageInteractionInfo["label"], containerIndex: number) => {
			if (!labelInfo) {
				return;
			}
			const [ label, checkboxId ] = (() => {
				if (labelInfo.textbox) {
					const label = document.createElement("input");
					label.type = "text";
					label.placeholder = labelInfo.textbox.placeholder;
					label.value = labelInfo.text;
					if (labelInfo.getText) {
						labelInfo.getText(containerIndex).then(text => label.value = text);
					}
					return [ label, "" ];
				} else {
					const label = document.createElement("label");
					label.textContent = labelInfo.text;
					if (labelInfo.getText) {
						labelInfo.getText(containerIndex).then(text => label.textContent = text);
					}
					const checkboxId = getIdSequential.next().value;
					label.htmlFor = checkboxId;
					return [ label, checkboxId ];
				}
			})();
			label.classList.add("label");
			const onChangeInternal = () => {
				labelInfo.setText ? labelInfo.setText((label as HTMLInputElement).value, containerIndex) : undefined;
			};
			if (labelInfo.setText) {
				label.addEventListener("input", onChangeInternal);
				label.addEventListener("blur", onChangeInternal);
			}
			container.appendChild(label);
			return checkboxId;
		};

		const insertCheckbox = (container: HTMLElement, checkboxInfo: PageInteractionInfo["checkbox"], id = "",
			objectIndex: number, containerIndex: number) => {
			if (!checkboxInfo) {
				return;
			}
			checkboxInfo.autoId = id;
			const checkbox = document.createElement("input");
			checkbox.type = "checkbox";
			checkbox.id = id;
			checkbox.classList.add("checkbox");
			container.appendChild(checkbox);
			if (checkboxInfo.onLoad) {
				checkboxInfo.onLoad(checked => checkbox.checked = checked, objectIndex, containerIndex);
			}
			if (checkboxInfo.onToggle) {
				checkbox.onchange = () =>
					checkboxInfo.onToggle ? checkboxInfo.onToggle(checkbox.checked, objectIndex, containerIndex) : undefined
				;
			}
			return checkbox;
		};

		const insertTextbox = (container: HTMLElement, textboxInfo: PageInteractionInfo["textbox"],
			objectIndex: number, containerIndex: number) => {
			if (!textboxInfo) {
				return;
			}
			const insertTextboxElement = (container: HTMLElement, value = ""): HTMLInputElement => {
				const textbox = document.createElement("input");
				textbox.type = "text";
				textbox.classList.add(textboxInfo.className);
				textbox.placeholder = textboxInfo.placeholder;
				textbox.spellcheck = textboxInfo.spellcheck;
				textbox.value = value;
				if (textboxInfo.onLoad) {
					textboxInfo.onLoad(text => textbox.value = text, objectIndex, containerIndex);
				}
				const onChangeInternal = () => {
					if (textboxInfo.list) {
						// TODO make function
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
								objectIndex,
							);
						}
					}
					if (textboxInfo.onChange) {
						textboxInfo.onChange(textbox.value, objectIndex, containerIndex);
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
				list.classList.add("column");
				textboxInfo.list.getArray(objectIndex).then(array => {
					array.concat("").forEach(value => {
						insertTextboxElement(list, value);
					});
				});
				container.appendChild(list);
				return list;
			} else {
				return insertTextboxElement(container);
			}
		};

		const insertObjectList = (container: HTMLElement, objectInfo: PageInteractionInfo["object"], containerIndex: number) => {
			if (!objectInfo) {
				return;
			}
			const insertObjectElement = (container: HTMLElement, objectIndex: number) => {
				const objectElement = document.createElement("div");
				objectElement.classList.add("term");
				objectInfo.columns.forEach(columnInfo => {
					const column = document.createElement("div");
					column.classList.add(columnInfo.className);
					columnInfo.rows.forEach(rowInfo => {
						const row = document.createElement("div");
						row.classList.add(rowInfo.className);
						const textboxOrList = insertTextbox(row, rowInfo.textbox, objectIndex, containerIndex);
						if (textboxOrList && textboxOrList.tagName === "INPUT") {
							//(textboxOrList as HTMLInputElement).value = objectGetValue(object, rowInfo.key);
						}
						const checkboxId = insertLabel(row, rowInfo.label, containerIndex);
						const checkbox = insertCheckbox(row, rowInfo.checkbox, checkboxId, objectIndex, containerIndex);
						if (checkbox) {
							//checkbox.checked = objectGetValue(object, rowInfo.key);
						}
						column.appendChild(row);
					});
					objectElement.appendChild(column);
					const inputFirst = objectElement.querySelector("input") as HTMLInputElement;
					inputFirst.addEventListener("input", () => {
						if (inputFirst.value && ((container.lastElementChild as HTMLInputElement).querySelector("input") as HTMLInputElement).value) {
							insertObjectElement(container, container.childElementCount);
						} else if (!inputFirst.value && container.lastElementChild !== objectElement && document.activeElement !== inputFirst) {
							objectElement.remove();
						}
					});
				});
				container.appendChild(objectElement);
			};
			const list = document.createElement("div");
			list.classList.add("organizer");
			list.classList.add("list");
			list.classList.add("column");
			list.classList.add("container-terms");
			objectInfo.list.getArray(containerIndex).then(objects => {
				objects.concat({}).forEach((object, i) => {
					insertObjectElement(list, i);
				});
			});
			container.appendChild(list);
		};

		const insertAnchor = (container: HTMLElement, anchorInfo: PageInteractionInfo["anchor"]) => {
			if (!anchorInfo) {
				return;
			}
			const anchor = document.createElement("a");
			anchor.href = anchorInfo.url;
			anchor.target = "_blank"; // New tab
			anchor.rel = "noopener noreferrer";
			anchor.textContent = anchorInfo.text ?? anchor.href;
			container.appendChild(anchor);
		};

		const insertSubmitter = (container: HTMLElement, submitterInfo: PageInteractionSubmitterInfo | undefined) => {
			if (!submitterInfo) {
				return;
			}
			let getFormFields = (): Array<FormField> => [];
			if (submitterInfo.formFields) {
				const list = document.createElement("div");
				list.classList.add("organizer");
				list.classList.add("list");
				list.classList.add("column");
				submitterInfo.formFields.forEach(interactionInfo => {
					const interaction = createInteraction(interactionInfo, -1);
					list.appendChild(interaction);
				});
				container.appendChild(list);
				getFormFields = () =>
					Array.from(list.querySelectorAll("label")).map((label): FormField => {
						const input = list.querySelector(`input#${label.htmlFor}`) as HTMLInputElement | null;
						return {
							question: label.textContent ?? "",
							response: input
								? input.checked === undefined ? input.value ?? "" : input.checked.toString()
								: "",
						};
					})
				;
			}
			const button = document.createElement("button");
			button.type = "button";
			button.classList.add("submitter");
			button.textContent = submitterInfo.text;
			container.appendChild(button);
			let getMessageText = () => "";
			button.onclick = () => {
				button.disabled = true;
				clearAlerts(container, [ PageAlertType.PENDING, PageAlertType.FAILURE ]);
				submitterInfo.onClick(
					getMessageText(),
					getFormFields(),
					() => {
						if (submitterInfo.alerts) {
							clearAlerts(container, [ PageAlertType.PENDING ]);
							insertAlert(
								PageAlertType.SUCCESS, //
								submitterInfo.alerts, //
								button, //
								3000, //
							);
						}
						button.disabled = false;
					},
					error => {
						if (submitterInfo.alerts) {
							clearAlerts(container, [ PageAlertType.PENDING ]);
							const errorText = error.text || "(no error message)";
							insertAlert(
								PageAlertType.FAILURE, //
								submitterInfo.alerts, //
								button, //
								-1, //
								errorText, //
								text => text.replace("{status}", error.status.toString()).replace("{text}", errorText), //
							);
						}
						button.disabled = false;
					},
				);
				insertAlert(
					PageAlertType.PENDING, //
					submitterInfo.alerts, //
					button, //
				);
			};
			if (submitterInfo.message) {
				const messageInfo = submitterInfo.message;
				const messageBox = (messageInfo.singleline
					? () => {
						const box = document.createElement("input");
						box.type = "text";
						return box;
					}
					: () => {
						const box = document.createElement("textarea");
						box.rows = messageInfo.rows;
						return box;
					}
				)();
				messageBox.classList.add("message");
				messageBox.placeholder = submitterInfo.message.placeholder;
				messageBox.spellcheck = true;
				messageBox.addEventListener("keypress", (event: KeyboardEvent) => {
					if (event.key === "Enter" && (messageInfo.singleline || event.ctrlKey)) {
						button.click();
					}
				});
				container.appendChild(messageBox);
				getMessageText = () => messageBox.value;
			}
		};

		const insertSubmitters = (container: HTMLElement, submittersInfo: PageInteractionInfo["submitters"]) => {
			if (!submittersInfo) {
				return;
			}
			const list = document.createElement("div");
			list.classList.add("organizer");
			list.classList.add("list");
			list.classList.add(submittersInfo.length > 1 ? "row" : "column");
			submittersInfo.forEach(submitterInfo => insertSubmitter(list, submitterInfo));
			container.appendChild(list);
		};

		const insertNote = (container: HTMLElement, noteInfo: PageInteractionInfo["note"]) => {
			if (!noteInfo) {
				return;
			}
			const note = document.createElement("div");
			note.classList.add("note");
			note.textContent = noteInfo.text;
			container.appendChild(note);
		};

		const createInteraction = (interactionInfo: PageInteractionInfo, index: number) => {
			const interaction = document.createElement("div");
			interaction.classList.add("interaction");
			interaction.classList.add(interactionInfo.className);
			const checkboxId = insertLabel(interaction, interactionInfo.label, index);
			insertObjectList(interaction, interactionInfo.object, index);
			insertAnchor(interaction, interactionInfo.anchor);
			insertSubmitters(interaction, interactionInfo.submitters);
			insertTextbox(interaction, interactionInfo.textbox, index, 0);
			insertNote(interaction, interactionInfo.note);
			insertCheckbox(interaction, interactionInfo.checkbox, checkboxId, index, 0);
			return interaction;
		};

		return (sectionInfo: PageSectionInfo) => {
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
			sectionInfo.interactions.forEach(async interactionInfo => {
				if (interactionInfo.list) {
					const length = await interactionInfo.list.getLength();
					for (let i = 0; i < length; i++) {
						container.appendChild(createInteraction(interactionInfo, i));
					}
				} else {
					container.appendChild(createInteraction(interactionInfo, 0));
				}
			});
			section.appendChild(container);
			return section;
		};
	})();

	const createBrand = () => {
		const brand = document.createElement("div");
		const name = document.createElement("div");
		const version = document.createElement("div");
		const logo = document.createElement("img");
		name.classList.add("name");
		name.textContent = getName();
		version.classList.add("version");
		version.textContent = `v${chrome.runtime.getManifest().version}`;
		logo.classList.add("logo");
		logo.src = "/icons/mms.svg";
		brand.classList.add("brand");
		brand.appendChild(name);
		brand.appendChild(version);
		brand.appendChild(logo);
		return brand;
	};

	const createFrameStructure = () => {
		const frame = document.createElement("div");
		frame.id = "frame";
		document.body.appendChild(frame);
		frame.appendChild(createBrand());
		const panelContainer = document.createElement("div");
		panelContainer.classList.add("container-panel");
		panelContainer.tabIndex = -1;
		frame.appendChild(panelContainer);
		const tabContainer = document.createElement("div");
		tabContainer.classList.add("container-tab");
		frame.appendChild(tabContainer);
		return frame;
	};

	const insertAndManageContent = (panelsInfo: Array<PagePanelInfo>, shiftModifierIsRequired = true) => {
		document.body.appendChild(createFrameStructure());
		const panelContainer = document.querySelector(".container-panel") as HTMLElement;
		const tabContainer = document.querySelector(".container-tab") as HTMLElement;
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
		handleTabs(shiftModifierIsRequired);
		chrome.storage.onChanged.addListener(() => reload(panelsInfo));
		chrome.tabs.onActivated.addListener(() => reload(panelsInfo));
	};

	return (panelsInfo: Array<PagePanelInfo>, additionalStyleText = "", shiftModifierIsRequired = true) => {
		chrome.tabs.query = useChromeAPI()
			? chrome.tabs.query
			: browser.tabs.query as typeof chrome.tabs.query;
		fillAndInsertStylesheet(additionalStyleText);
		insertAndManageContent(panelsInfo, shiftModifierIsRequired);
		pageFocusScrollContainer();
	};
})();