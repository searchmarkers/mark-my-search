type OptionKey = "researchTogglePage" | "researchToggle" | "problemReportDescribe" | "problemReport"

enum OptionClass {
	TOGGLE = "toggle",
	ENABLED = "enabled",
}

const optionKeyToId = (key: OptionKey) =>
	Array.from(key).map(char => char === char.toLocaleLowerCase() ? char : `-${char.toLocaleLowerCase()}`).toString()
;

(() => {
	const style = document.createElement("style");
	style.textContent = `
body { margin: 0; padding: 0; border: 0; }
#${optionKeyToId("problemReportDescribe")} { display: grid; }
body > div { display: grid; }
button { background-color: hsl(0, 0%, 70%); text-align: left;
	border-radius: 0; border-style: none; border-bottom-style: solid; border-color: black; border-width: 1px; }
button:focus { outline-style: none; text-decoration: underline; }
button:hover { background-color: hsl(0, 0%, 85%); }
button:active { outline-style: none; background-color: hsl(0, 0%, 95%); }
.${OptionClass.TOGGLE}.${OptionClass.ENABLED} { background-color: hsl(90, 100%, 60%); }
.${OptionClass.TOGGLE}.${OptionClass.ENABLED}:hover { background-color: hsl(90, 100%, 75%); }
.${OptionClass.TOGGLE}.${OptionClass.ENABLED}:active { background-color: hsl(90, 100%, 85%); }
.${OptionClass.TOGGLE} { background-color: hsl(0, 100%, 75%); }
.${OptionClass.TOGGLE}:hover { background-color: hsl(0, 100%, 85%); }
.${OptionClass.TOGGLE}:active { background-color: hsl(0, 100%, 90%); }
input:active { outline-style: none; display: inline-block; }`
	;
	document.head.appendChild(style);
})();

const container = document.createElement("div");
document.body.appendChild(container);
const optionsInfo: Record<OptionKey, { text: string, classes: Array<string> }> = {
	researchTogglePage: {
		text: "Enable/Disable in Tab",
		classes: [],
	}, researchToggle: {
		text: "Mark My Search On/Off",
		classes: [ OptionClass.TOGGLE ],
	}, problemReportDescribe: {
		text: "Report a Problem",
		classes: [],
	}, problemReport: {
		text: "Instant Report",
		classes: [],
	},
};
const options: Record<OptionKey, HTMLButtonElement> = {
	researchTogglePage: undefined as unknown as HTMLButtonElement,
	researchToggle: undefined as unknown as HTMLButtonElement,
	problemReportDescribe: undefined as unknown as HTMLButtonElement,
	problemReport: undefined as unknown as HTMLButtonElement,
};

Object.keys(optionsInfo).forEach((key: OptionKey) => {
	const button = document.createElement("button");
	button.textContent = optionsInfo[key].text;
	optionsInfo[key].classes.forEach(classEl => button.classList.add(classEl));
	container.appendChild(button);
	options[key] = button;
});

const buttonArray = Object.values(options);

const emailSend: (service: string, template: string,
	details: { mmsVersion?: string, url?: string, phrases?: string, userMessage?: string, userEmail?: string },
	key: string) => Promise<void> = window["libEmailSend"]
;

getStorageLocal(StorageLocal.ENABLED).then(local =>
	local.enabled ? options.researchToggle.classList.add(OptionClass.ENABLED) : undefined
);

options.researchTogglePage.focus();
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

options.researchTogglePage.onclick = () =>
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) => tab.id === undefined ? undefined :
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => (tab.id as number) in local.researchInstances
			? browser.runtime.sendMessage({ disablePageResearch: true } as BackgroundMessage)
			: browser.runtime.sendMessage({ terms: [], makeUnique: true, toggleHighlightsOn: true } as BackgroundMessage)
		)
	)
;

options.researchToggle.onclick = () => {
	const toggleResearchOn = !options.researchToggle.classList.contains(OptionClass.ENABLED);
	options.researchToggle.classList[toggleResearchOn ? "add" : "remove"](OptionClass.ENABLED);
	browser.runtime.sendMessage({ toggleResearchOn });
};

const problemReport = (userMessage = "") => browser.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
	tab.id === undefined ? undefined : getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
		const phrases = local.researchInstances[tab.id ?? -1]
			? local.researchInstances[tab.id ?? -1].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		focusNext(-1, idx => (idx + 1) % buttonArray.length);
		options.problemReportDescribe.textContent = (options.problemReportDescribe.textContent as string)
			.replace(/🆗|!/g, "").trimEnd();
		options.problemReport.disabled = true;
		options.problemReportDescribe.disabled = true;
		emailSend("service_mms_report", "template_mms_report", {
			mmsVersion: browser.runtime.getManifest().version,
			url: tab.url,
			phrases,
			userMessage,
		}, "NNElRuGiCXYr1E43j").then(() => {
			options.problemReportDescribe.textContent += " 🆗";
		}, (error: { status: number, text: string }) => {
			options.problemReportDescribe.textContent += " !!";
			options.problemReportDescribe.title = `[STATUS ${error.status}] '${error.text}'`;
		}).then(() => {
			options.problemReport.disabled = false;
			options.problemReportDescribe.disabled = false;
		});
	})
);

options.problemReport.onclick = () =>
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

options.problemReportDescribe.onclick = () => {
	if (reportInput.parentElement) {
		problemReport(reportInput.value);
	} else {
		options.problemReportDescribe.appendChild(reportInput);
		reportInput.focus();
	}
};
