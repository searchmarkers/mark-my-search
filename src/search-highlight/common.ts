/**
 * Add search term navigation UI to the page.
 * @param highlightRoot Ancestor node of search term highlighting
 * @param terms Array containing search terms to be highlighted
 * @returns Regex to select search term occurrences
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const addControls = (highlightRoot: Element, terms: Array<string>) => {
	const colors = [
		[255, 255, 0],
		[0, 255, 0],
		[0, 255, 255],
		[255, 0, 255],
		[255, 0, 0],
		[0, 0, 255],
	];

	const style = document.createElement("style");
	document.head.appendChild(style);
	highlightRoot.classList.add("highlight-search-all");
	
	const controls = document.createElement("div");
	controls.style.all = "revert";
	controls.style.position = "fixed";
	controls.style.zIndex = "10000";
	controls.style.width = "100%";
	document.body.insertAdjacentElement("beforebegin", controls);
	
	const checkbox = document.createElement("input");
	checkbox.style.all = "revert";
	checkbox.type = "checkbox";
	checkbox.checked = true;
	checkbox.addEventListener("change", () => {
		if (checkbox.checked) highlightRoot.classList.add("highlight-search-all");
		else highlightRoot.classList.remove("highlight-search-all");
	});
	checkbox.style.marginLeft = "10px";
	checkbox.style.marginRight = "10px";
	controls.appendChild(checkbox);

	for (let i = 0; i < terms.length; i++) {
		console.log(terms.length);
		const term = terms[i];
		const color = colors[i % colors.length];
		const ruleStyles = [
			`{background:rgba(${color.join(",")},0.3);}`,
			"{border-width:2px;border-block-color:#000}",
		];
		style.textContent += ".highlight-search-all .highlight-search-term-" + term + ruleStyles[0];
		style.textContent += ".highlight-search-control" + ruleStyles[1];
		
		const button = document.createElement("button");
		button.style.all = "revert";
		button.classList.add("highlight-search-control");
		button.textContent = term;
		button.addEventListener("change", () => { return; });
		button.style.backgroundColor = "#" + color.map(channel => channel === 255 ? "f" : "7").join("");
		controls.appendChild(button);
	}
	
	return new RegExp(`(${terms.join("|")})`, "gi"); // (?!([^<]+)?>)
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const highlightInNodes = (textNodes: Array<Node>) => {
	const pattern = addControls(document.body, searchDetails["terms"]);
	textNodes.forEach(textNode => {
		if (textNode && textNode.parentNode && textNode.nodeType === 3 && textNode.textContent.search(pattern) !== -1) {
			const element = document.createElement("span");
			element.innerHTML = textNode.textContent.replace(pattern,
				match => `<span class='highlight-search-term-${match.toLowerCase()}'>${match}</span>`);
			textNode.parentNode.insertBefore(element, textNode);
			textNode.parentNode.removeChild(textNode);
		}
	});
};

let searchDetails = {};

const receiveSearchDetails = (details: Record<string, unknown>) => {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	searchDetails = details;
	browser.runtime.onMessage.removeListener(receiveSearchDetails);
};

browser.runtime.onMessage.addListener(receiveSearchDetails);
