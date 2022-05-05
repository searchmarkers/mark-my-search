const buttons: Record<string, HTMLButtonElement> = {
	researchDisablePage: document.getElementById("research-disable-page") as HTMLButtonElement,
	researchToggle: document.getElementById("research-toggle") as HTMLButtonElement,
	problemReport: document.getElementById("problem-report") as HTMLButtonElement,
	problemReportDescribe: document.getElementById("problem-report-describe") as HTMLButtonElement,
};

browser.storage.local.get("enabled").then(local =>
	local.enabled ? buttons.researchToggle.classList.add("enabled") : undefined
);

buttons.researchDisablePage.focus();
const buttonArray = Object.values(buttons);
buttonArray.forEach((button, i) => button.onkeydown = event =>
	event.key === "ArrowDown" ? buttonArray[(i + 1) % buttonArray.length].focus()
		: event.key === "ArrowUp" ? buttonArray[(i + buttonArray.length - 1) % buttonArray.length].focus()
			: undefined)
;

buttons.researchDisablePage.onclick = () => {
	browser.runtime.sendMessage({ disablePageResearch: true } as BackgroundMessage);
};

buttons.researchToggle.onclick = () => {
	const toggleResearchOn = !buttons.researchToggle.classList.contains("enabled");
	buttons.researchToggle.classList[toggleResearchOn ? "add" : "remove"]("enabled");
	browser.runtime.sendMessage({ toggleResearchOn });
};

const problemReport = () => {
	buttons.problemReport.disabled = true;
	buttons.problemReportDescribe.disabled = true;
	browser.tabs.query({ active: true, lastFocusedWindow: true }).then(tabs => browser.storage.local.get("researchIds").then(local => {
		if (!local.researchIds[tabs[0].id])
			return;
		emailjs.send("service_mms_report", "template_mms_report", { reportType: "Simple", version: browser.runtime.getManifest().version, url: tabs[0].url, phrases: local.researchIds[tabs[0].id].terms.map(term => term.phrase).join(", ") }, "NNElRuGiCXYr1E43j").then(() => {
			buttons.problemReport.textContent = "SUCCESS";
		}, (error: { status: number, text: string }) => {
			buttons.problemReport.title = `[${error.status}] ${error.text}`;
			buttons.problemReport.textContent = "FAILURE (hover)";
			buttons.problemReport.disabled = false;
			buttons.problemReportDescribe.disabled = false;
		});
	}));
};

buttons.problemReport.onclick = () =>
	problemReport()
;

buttons.problemReportDescribe.onclick = () =>
	window.open("mailto:ator-dev@protonmail.com")
	//problemReport()
;
