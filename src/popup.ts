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
		onLoad?: (setText: (text: string) => void, objectIndex: number, containerIndex: number) => Promise<void>
		onChange?: (text: string, objectIndex: number, containerIndex: number) => void
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
		autoId?: string
		onLoad?: (setChecked: (checked: boolean) => void, objectIndex: number, containerIndex: number) => Promise<void>
		onToggle?: (checked: boolean, objectIndex: number, containerIndex: number) => void
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
	{ display: flex; flex-direction: column; height: 100%; border-radius: inherit; background: inherit; }
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
	border-top: 2px solid hsl(300 30% 32%); border-bottom-left-radius: inherit; border-bottom-right-radius: inherit; }
.container-tab > .tab
	{ flex: 1 1 auto; font-size: 14px; border: none; border-bottom: 2px solid transparent; border-radius: inherit;
	background: transparent; color: hsl(300 20% 90%); }
.container-tab > .tab:hover
	{ background: hsl(300 30% 26%); }
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
	{ border-bottom: 2px solid deeppink; background: hsl(300 30% 32%); }
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
.panel .interaction > *, .panel .organizer > *
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
		} else if (document.activeElement) {
			(document.activeElement as HTMLElement).blur();
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

	const handleTabs = () => {
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

	const reload = (panelsInfo: Array<PopupPanelInfo>) => {
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

	const insertWarning = (panelName: string, text: string) => {
		const warning = document.createElement("div");
		warning.classList.add("warning");
		warning.textContent = text;
		document.querySelector(`.container-panel .panel-${panelName}`)?.insertAdjacentElement("afterbegin", warning);
	};

	const createSection = (() => {
		const insertLabel = (container: HTMLElement, labelInfo: PopupInteractionInfo["label"], containerIndex: number) => {
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
					const checkboxId = getId.next().value;
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

		const insertCheckbox = (container: HTMLElement, checkboxInfo: PopupInteractionInfo["checkbox"], id = "",
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

		const insertTextbox = (container: HTMLElement, textboxInfo: PopupInteractionInfo["textbox"],
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

		const insertObjectList = (container: HTMLElement, objectInfo: PopupInteractionInfo["object"], containerIndex: number) => {
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
			list.classList.add("container-terms");
			objectInfo.list.getArray(containerIndex).then(objects => {
				objects.concat({}).forEach((object, i) => {
					insertObjectElement(list, i);
				});
			});
			container.appendChild(list);
		};

		const insertAnchor = (container: HTMLElement, anchorInfo: PopupInteractionInfo["anchor"]) => {
			if (!anchorInfo) {
				return;
			}
			const anchor = document.createElement("a");
			anchor.href = anchorInfo.url;
			anchor.textContent = anchorInfo.text ?? anchor.href;
			container.appendChild(anchor);
		};

		const insertSubmitter = (container: HTMLElement, submitterInfo: PopupInteractionInfo["submitter"]) => {
			if (!submitterInfo) {
				return;
			}
			const button = document.createElement("button");
			button.type = "button";
			button.classList.add("submitter");
			button.textContent = submitterInfo.text;
			container.appendChild(button);
			let getMessageText = () => "";
			button.onclick = () => {
				button.disabled = true;
				clearAlerts(container, [ PopupAlertType.PENDING, PopupAlertType.FAILURE ]);
				submitterInfo.onClick(
					getMessageText(),
					() => {
						clearAlerts(container, [ PopupAlertType.PENDING ]);
						insertAlert(
							PopupAlertType.SUCCESS, //
							(submitterInfo ?? {}).alerts, //
							button, //
							3000, //
						);
						button.disabled = false;
					},
					error => {
						clearAlerts(container, [ PopupAlertType.PENDING ]);
						const errorText = error.text || "(no error message)";
						insertAlert(
							PopupAlertType.FAILURE, //
							(submitterInfo ?? {}).alerts, //
							button, //
							-1, //
							errorText, //
							text => text.replace("{status}", error.status.toString()).replace("{text}", errorText), //
						);
						button.disabled = false;
					},
				);
				insertAlert(
					PopupAlertType.PENDING, //
					submitterInfo.alerts, //
					button, //
				);
			};
			if (submitterInfo.message) {
				const messageBox = document.createElement("textarea");
				messageBox.classList.add("message");
				messageBox.rows = submitterInfo.message.rows;
				messageBox.placeholder = submitterInfo.message.placeholder;
				messageBox.spellcheck = true;
				container.appendChild(messageBox);
				getMessageText = () => messageBox.value;
			}
		};

		const insertNote = (container: HTMLElement, noteInfo: PopupInteractionInfo["note"]) => {
			if (!noteInfo) {
				return;
			}
			const note = document.createElement("div");
			note.classList.add("note");
			note.textContent = noteInfo.text;
			container.appendChild(note);
		};

		const createInteraction = (interactionInfo: PopupInteractionInfo, index: number) => {
			const interaction = document.createElement("div");
			interaction.classList.add("interaction");
			interaction.classList.add(interactionInfo.className);
			const checkboxId = insertLabel(interaction, interactionInfo.label, index);
			insertObjectList(interaction, interactionInfo.object, index);
			insertAnchor(interaction, interactionInfo.anchor);
			insertSubmitter(interaction, interactionInfo.submitter);
			insertCheckbox(interaction, interactionInfo.checkbox, checkboxId, index, 0);
			insertTextbox(interaction, interactionInfo.textbox, index, 0);
			insertNote(interaction, interactionInfo.note);
			return interaction;
		};

		return (sectionInfo: PopupSectionInfo) => {
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
		name.textContent = chrome.runtime.getManifest().name;
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
		frame.appendChild(panelContainer);
		const filler = document.createElement("div");
		filler.classList.add("filler");
		frame.appendChild(filler);
		const tabContainer = document.createElement("div");
		tabContainer.classList.add("container-tab");
		frame.appendChild(tabContainer);
		return frame;
	};

	const insertAndManageContent = (() => {
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
											getStorageSync([ StorageSync.URL_FILTERS ]).then(sync => //
												sync.urlFilters.noPageModify.map(({ hostname, pathname }) => hostname + pathname) //
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
														onLoad: async (setText, objectIndex, containerIndex) => {
															const sync = await getStorageSync([ StorageSync.TERM_LISTS ]);
															setText(sync.termLists[containerIndex].terms[objectIndex].phrase);
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
							},
						],
					},
				],
			},
		];

		return () => {
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
			handleTabs();
			chrome.storage.onChanged.addListener(() => reload(panelsInfo));
			chrome.tabs.onActivated.addListener(() => reload(panelsInfo));
			insertWarning("sites_search_research", "This functionality is experimental. Please report any issues!");
			insertWarning("term_lists", "This functionality is experimental, and only activates under special conditions.");
		};
	})();

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
		insertAndManageContent();
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
