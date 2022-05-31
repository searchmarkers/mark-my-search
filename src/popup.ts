if (browser) {
	self["chrome" + ""] = browser;
}

const emailSend: (service: string, template: string,
	details: { mmsVersion?: string, url?: string, phrases?: string, userMessage?: string, userEmail?: string },
	key: string) => Promise<void> = window["libEmailSend"]
;

const buttons: Record<string, HTMLButtonElement> = {
	researchDisablePage: document.getElementById("research-disable-page") as HTMLButtonElement,
	researchToggle: document.getElementById("research-toggle") as HTMLButtonElement,
	problemReportDescribe: document.getElementById("problem-report-describe") as HTMLButtonElement,
	problemReport: document.getElementById("problem-report") as HTMLButtonElement,
};

browser.storage.local.get("enabled").then(local =>
	local.enabled ? buttons.researchToggle.classList.add("enabled") : undefined
);

buttons.researchDisablePage.focus();
const buttonArray = Object.values(buttons);
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

buttons.researchDisablePage.onclick = () => {
	browser.runtime.sendMessage({ disablePageResearch: true } as BackgroundMessage);
};

buttons.researchToggle.onclick = () => {
	const toggleResearchOn = !buttons.researchToggle.classList.contains("enabled");
	buttons.researchToggle.classList[toggleResearchOn ? "add" : "remove"]("enabled");
	browser.runtime.sendMessage({ toggleResearchOn });
};

const problemReport = (userMessage = "") => browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs =>
	getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
		const phrases = local.researchInstances[tabs[0].id]
			? local.researchInstances[tabs[0].id].terms.map((term: MatchTerm) => term.phrase).join(" ∣ ")
			: "";
		buttonArray[0].focus();
		buttons.problemReportDescribe.textContent = buttons.problemReportDescribe.textContent.replace(/🆗|!/g, "").trimEnd();
		buttons.problemReport.disabled = true;
		buttons.problemReportDescribe.disabled = true;
		emailSend("service_mms_report", "template_mms_report", {
			mmsVersion: browser.runtime.getManifest().version,
			url: tabs[0].url,
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
