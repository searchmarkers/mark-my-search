type PopupButtons = Record<PopupButtonKey, HTMLButtonElement>
type PopupButtonsInfo = Record<PopupButtonKey, { text: string, classes: Array<string> }>

enum PopupButtonKey {
	RESEARCH_TOGGLE_PAGE = "researchTogglePage",
	RESEARCH_TOGGLE = "researchToggle",
	PROBLEM_REPORT_DESCRIBE = "problemReportDescribe",
	PROBLEM_REPORT = "problemReport",
}

enum PopupButtonClass {
	TOGGLE = "toggle",
	ENABLED = "enabled",
}

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
body { margin: 0; padding: 0; border: 0; width: max-content; }
#${PopupButtonKey.PROBLEM_REPORT_DESCRIBE} { display: grid; }
body > div { display: grid; }
button { background-color: hsl(0 0% 70%); text-align: left;
	border-radius: 0; border-style: none; border-bottom-style: solid; border-color: black; border-width: 1px; }
button:focus { outline-style: none; text-decoration: underline; }
button:hover { background-color: hsl(0 0% 85%); }
button:active { outline-style: none; background-color: hsl(0 0% 95%); }
.${PopupButtonClass.TOGGLE}.${PopupButtonClass.ENABLED} { background-color: hsl(90 100% 60%); }
.${PopupButtonClass.TOGGLE}.${PopupButtonClass.ENABLED}:hover { background-color: hsl(90 100% 75%); }
.${PopupButtonClass.TOGGLE}.${PopupButtonClass.ENABLED}:active { background-color: hsl(90 100% 85%); }
.${PopupButtonClass.TOGGLE} { background-color: hsl(0 100% 75%); }
.${PopupButtonClass.TOGGLE}:hover { background-color: hsl(0 100% 85%); }
.${PopupButtonClass.TOGGLE}:active { background-color: hsl(0 100% 90%); }
input:active { outline-style: none; display: inline-block; }
		`;
		document.head.appendChild(style);
	};

	/**
	 * Focuses the next popup button cyclically.
	 * @param idx Index of the currently focused button. The button need not actually have focus.
	 * @param increment A function called to increment the index.
	 * @param buttons Buttons to focus.
	 */
	const focusNext = (idx: number, increment: (idx: number) => number, buttons: PopupButtons) => {
		const buttonArray = Object.values(buttons);
		idx = increment(idx);
		buttonArray[idx].focus();
		if (document.activeElement !== buttonArray[idx]) {
			focusNext(idx, increment, buttons);
		}
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
	 * @param buttons The buttons in the popup.
	 * @param userMessage An optional message string to send as a comment.
	 */
	const sendProblemReport = async (buttons: PopupButtons, userMessage = "") => {
		const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
		if (tab.id === undefined) {
			return;
		}
		const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
		const phrases = session.researchInstances[tab.id ?? -1]
			? session.researchInstances[tab.id ?? -1].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		
		focusNext(-1, idx => (idx + 1) % Object.values(buttons).length, buttons);
		buttons.problemReportDescribe.textContent = (buttons.problemReportDescribe.textContent as string)
			.replace(/🆗|!/g, "").trimEnd();
		buttons.problemReport.disabled = true;
		buttons.problemReportDescribe.disabled = true;
		sendEmail("service_mms_report", "template_mms_report", {
			mmsVersion: chrome.runtime.getManifest().version,
			url: tab.url,
			phrases,
			userMessage,
		}, "NNElRuGiCXYr1E43j").then(() => {
			buttons.problemReportDescribe.textContent += " 🆗";
		}, (error: { status: number, text: string }) => {
			buttons.problemReportDescribe.textContent += " !!";
			buttons.problemReportDescribe.title = `[STATUS ${error.status}] '${error.text}'`;
		}).then(() => {
			buttons.problemReport.disabled = false;
			buttons.problemReportDescribe.disabled = false;
		});
	};

	/**
	 * Registers event handlers to the popup buttons to give them functionality.
	 * @param buttons The popup buttons with designated event handlers for which to register them.
	 * @param reportInput The text input for user messages when sending reports.
	 */
	const registerButtonsEventHandlers = (buttons: PopupButtons, reportInput: HTMLInputElement) => {
		buttons.researchTogglePage.onclick = async () => {
			const [ tab ] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (tab.id !== undefined) {
				const session = await getStorageSession([ StorageSession.RESEARCH_INSTANCES ]);
				if ((tab.id as number) in session.researchInstances) {
					chrome.runtime.sendMessage({
						disableTabResearch: true,
					} as BackgroundMessage);
				} else {
					chrome.runtime.sendMessage({
						terms: [],
						makeUnique: true,
						toggleHighlightsOn: true,
					} as BackgroundMessage);
				}
			}
		};
		buttons.researchToggle.onclick = () => {
			const toggleResearchOn = !buttons.researchToggle.classList.contains(PopupButtonClass.ENABLED);
			buttons.researchToggle.classList[toggleResearchOn ? "add" : "remove"](PopupButtonClass.ENABLED);
			chrome.runtime.sendMessage({ toggleResearchOn });
		};
		buttons.problemReport.onclick = () => {
			sendProblemReport(buttons);
		};
		buttons.problemReportDescribe.onclick = () => {
			if (reportInput.parentElement) {
				sendProblemReport(buttons, reportInput.value);
			} else {
				buttons.problemReportDescribe.appendChild(reportInput);
				reportInput.focus();
			}
		};
	};

	/**
	 * Loads the popup content into the page.
	 * @param buttonsInfo Details of the buttons to present.
	 */
	const loadContent = (buttonsInfo: PopupButtonsInfo) => {
		const popup = document.createElement("div");
		document.body.appendChild(popup);
		const buttons: PopupButtons = (() => {
			const buttons: Record<string, HTMLButtonElement> = {};
			Object.keys(buttonsInfo).forEach((key: PopupButtonKey) => {
				const button = document.createElement("button");
				button.textContent = buttonsInfo[key].text;
				buttonsInfo[key].classes.forEach(classEl => button.classList.add(classEl));
				popup.appendChild(button);
				buttons[key] = button;
			});
			return buttons as PopupButtons;
		})();
		getStorageLocal([ StorageLocal.ENABLED ]).then(local =>
			local.enabled ? buttons.researchToggle.classList.add(PopupButtonClass.ENABLED) : undefined
		);
		(popup.firstElementChild as HTMLElement).focus();
		Object.values(buttons).forEach((button, i) => {
			const buttonArray = Object.values(buttons);
			button.onmouseenter = () =>
				buttonArray.includes(document.activeElement as HTMLButtonElement) ? button.focus() : undefined;
			button.onkeydown = event => {
				if (event.key === "ArrowDown") {
					focusNext(i, idx => (idx + 1) % buttonArray.length, buttons);
				} else if (event.key === "ArrowUp") {
					focusNext(i, idx => (idx + buttonArray.length - 1) % buttonArray.length, buttons);
				}
			};
		});
		const reportInput = document.createElement("input");
		reportInput.type = "text";
		reportInput.style.width = "calc(100%)";
		reportInput.style.padding = "0";
		reportInput.onblur = () => reportInput.remove();
		reportInput.onkeydown = event => {
			if (event.key === "Escape") {
				reportInput.blur();
				reportInput.value = "";
			} else if (event.key === " ") {
				event.preventDefault();
				reportInput.value += " ";
			}
		};
		registerButtonsEventHandlers(buttons, reportInput);
	};

	return (buttonsInfo: PopupButtonsInfo) => {
		fillAndInsertStylesheet();
		loadContent(buttonsInfo);
	};
})();

(() => {
	/**
	 * Gets details of the buttons to be displayed in the popup.
	 * @returns Details of all popup buttons to be presented.
	 */
	const getButtonsInfo = (): PopupButtonsInfo => ({
		researchTogglePage: {
			text: "Enable/Disable in Tab",
			classes: [],
		}, researchToggle: {
			text: "Mark My Search On/Off",
			classes: [ PopupButtonClass.TOGGLE ],
		}, problemReportDescribe: {
			text: "Report a Problem",
			classes: [],
		}, problemReport: {
			text: "Instant Report",
			classes: [],
		},
	});

	return () => {
		chrome.tabs.query = isBrowserChromium() // Running in Chromium
			? chrome.tabs.query
			: browser.tabs.query as typeof chrome.tabs.query;
		loadPopup(getButtonsInfo());
	};
})()();
