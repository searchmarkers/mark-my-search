type ButtonKey = "researchTogglePage" | "researchToggle" | "problemReportDescribe" | "problemReport"

enum ButtonClass {
	TOGGLE = "toggle",
	ENABLED = "enabled",
}

const buttonKeyToId = (key: ButtonKey) =>
	Array.from(key).map(char => char === char.toLocaleLowerCase() ? char : `-${char.toLocaleLowerCase()}`).toString()
;

(() => {
	const style = document.createElement("style");
	style.textContent = `
body { margin: 0; padding: 0; border: 0; }
#${buttonKeyToId("problemReportDescribe")} { display: grid; }
body > div { display: grid; }
button { background-color: hsl(0, 0%, 70%); text-align: left;
	border-radius: 0; border-style: none; border-bottom-style: solid; border-color: black; border-width: 1px; }
button:focus { outline-style: none; text-decoration: underline; }
button:hover { background-color: hsl(0, 0%, 85%); }
button:active { outline-style: none; background-color: hsl(0, 0%, 95%); }
.${ButtonClass.TOGGLE}.${ButtonClass.ENABLED} { background-color: hsl(90, 100%, 60%); }
.${ButtonClass.TOGGLE}.${ButtonClass.ENABLED}:hover { background-color: hsl(90, 100%, 75%); }
.${ButtonClass.TOGGLE}.${ButtonClass.ENABLED}:active { background-color: hsl(90, 100%, 85%); }
.${ButtonClass.TOGGLE} { background-color: hsl(0, 100%, 75%); }
.${ButtonClass.TOGGLE}:hover { background-color: hsl(0, 100%, 85%); }
.${ButtonClass.TOGGLE}:active { background-color: hsl(0, 100%, 90%); }
input:active { outline-style: none; display: inline-block; }`
	;
	document.head.appendChild(style);
})();

const popup = document.createElement("div");
document.body.appendChild(popup);
const buttonsInfo: Record<ButtonKey, { text: string, classes: Array<string> }> = {
	researchTogglePage: {
		text: "Enable/Disable in Tab",
		classes: [],
	}, researchToggle: {
		text: "Mark My Search On/Off",
		classes: [ ButtonClass.TOGGLE ],
	}, problemReportDescribe: {
		text: "Report a Problem",
		classes: [],
	}, problemReport: {
		text: "Instant Report",
		classes: [],
	},
};
const buttons: Record<ButtonKey, HTMLButtonElement> = {
	researchTogglePage: undefined as unknown as HTMLButtonElement,
	researchToggle: undefined as unknown as HTMLButtonElement,
	problemReportDescribe: undefined as unknown as HTMLButtonElement,
	problemReport: undefined as unknown as HTMLButtonElement,
};

Object.keys(buttonsInfo).forEach((key: ButtonKey) => {
	const button = document.createElement("button");
	button.textContent = buttonsInfo[key].text;
	buttonsInfo[key].classes.forEach(classEl => button.classList.add(classEl));
	popup.appendChild(button);
	buttons[key] = button;
});

const buttonArray = Object.values(buttons);

const emailSend: (service: string, template: string,
	details: { mmsVersion?: string, url?: string, phrases?: string, userMessage?: string, userEmail?: string },
	key: string) => Promise<void> = window["libEmailSend"]
;

getStorageLocal(StorageLocal.ENABLED).then(local =>
	local.enabled ? buttons.researchToggle.classList.add(ButtonClass.ENABLED) : undefined
);

buttons.researchTogglePage.focus();
const focusNext = (idx: number, increment: (idx: number) => number) => {
	idx = increment(idx);
	buttonArray[idx].focus();
	if (document.activeElement !== buttonArray[idx]) {
		focusNext(idx, increment);
	}
};
buttonArray.forEach((button, i) => {
	button.onmouseenter = () =>
		buttonArray.includes(document.activeElement as HTMLButtonElement) ? button.focus() : undefined;
	button.onkeydown = event => {
		if (event.key === "ArrowDown") {
			focusNext(i, idx => (idx + 1) % buttonArray.length);
		} else if (event.key === "ArrowUp") {
			focusNext(i, idx => (idx + buttonArray.length - 1) % buttonArray.length);
		}
	};
});

buttons.researchTogglePage.onclick = () =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) => tab.id === undefined ? undefined :
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => (tab.id as number) in local.researchInstances
			? browser.runtime.sendMessage({ disableTabResearch: true } as BackgroundMessage)
			: browser.runtime.sendMessage({ terms: [], makeUnique: true, toggleHighlightsOn: true } as BackgroundMessage)
		)
	)
;

buttons.researchToggle.onclick = () => {
	const toggleResearchOn = !buttons.researchToggle.classList.contains(ButtonClass.ENABLED);
	buttons.researchToggle.classList[toggleResearchOn ? "add" : "remove"](ButtonClass.ENABLED);
	browser.runtime.sendMessage({ toggleResearchOn });
};

const problemReport = (userMessage = "") => browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
	tab.id === undefined ? undefined : getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
		const phrases = local.researchInstances[tab.id ?? -1]
			? local.researchInstances[tab.id ?? -1].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		focusNext(-1, idx => (idx + 1) % buttonArray.length);
		buttons.problemReportDescribe.textContent = (buttons.problemReportDescribe.textContent as string)
			.replace(/🆗|!/g, "").trimEnd();
		buttons.problemReport.disabled = true;
		buttons.problemReportDescribe.disabled = true;
		emailSend("service_mms_report", "template_mms_report", {
			mmsVersion: browser.runtime.getManifest().version,
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
	})
);

buttons.problemReport.onclick = () =>
	problemReport()
;

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

buttons.problemReportDescribe.onclick = () => {
	if (reportInput.parentElement) {
		problemReport(reportInput.value);
	} else {
		buttons.problemReportDescribe.appendChild(reportInput);
		reportInput.focus();
	}
};
