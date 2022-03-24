const addControls = (highlightRoot: Element, terms: Array<string>, elementHighlights: Set<HTMLElement>) => {
	let elementIndex = -1;
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
	
	style.textContent += ".highlight-search-control" + "{border-width:2px;border-block-color:#000}";
	style.textContent += ".highlight-search-focus {animation-name:fadeOut;animation-duration:1s;}" + " @keyframes fadeOut {0% {background-color:rgba(255,255,255,0.6);}100% {background-color:rgba(255,255,255,0);}}";

	for (let i = 0; i < terms.length; i++) {
		const term = terms[i];
		const color = colors[i % colors.length];
		style.textContent += `.highlight-search-all .highlight-search-term-${term}` + `{background:rgba(${color.join(",")},0.4);}`;
		
		const button = document.createElement("button");
		button.style.all = "revert";
		button.classList.add("highlight-search-control");
		button.textContent = term;
		button.onclick = () => {
			const elementHighlightsArray = Array.from(elementHighlights);
			if (elementIndex >=  0) elementHighlightsArray[elementIndex].classList.remove("highlight-search-focus");
			while (elementIndex < elementHighlightsArray.length) {
				elementIndex += 1;
				const elementHighlight = elementHighlightsArray[elementIndex];
				if (elementHighlight && elementHighlight.textContent.match(new RegExp(term.replace(/(.)/g,"$1(\-?)"), "gi"))) {
					elementHighlight.scrollIntoView({behavior: "smooth", block: "center"});
					elementHighlight.classList.add("highlight-search-focus");
					return;
				}
			}
			elementIndex = -1;
		};
		button.style.backgroundColor = "#" + color.map(channel => channel === 255 ? "f" : "7").join("");
		controls.appendChild(button);
	}

	const cancel = document.createElement("input");
	cancel.style.all = "revert";
	cancel.type = "checkbox";
	cancel.onclick = () => {
		controls.remove();
	};
	cancel.style.marginLeft = "10px";
	cancel.style.marginRight = "10px";
	controls.appendChild(cancel);
};

const highlightInNodes = (textNodes: Array<Node>, pattern: RegExp, elementHighlights: Set<HTMLElement>) => {
	textNodes.forEach(textNode => {
		const element = document.createElement("span");
		element.innerHTML = textNode.textContent.replace(pattern,
			match => `<span class='highlight-search-term-${match.replace("-","").toLowerCase()}'>${match}</span>`
		);
		textNode.parentNode.insertBefore(element, textNode);
		textNode.parentNode.removeChild(textNode);
		elementHighlights.add(element.parentElement);
		element.outerHTML = element.innerHTML;
	});
};

const getNodesToHighlight = (rootNode: Node, pattern: RegExp, excludeHighlighted = true) => {
	const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node =>
		((!("tagName" in node)) || (node.parentElement.tagName !== "SCRIPT" && node["tagName"] !== "META" && node["tagName"] !== "STYLE" && node.parentElement.tagName !== "NOSCRIPT"))
		? NodeFilter.FILTER_ACCEPT :  NodeFilter.FILTER_SKIP});
	const textNodes: Array<Node> = [];
	let textNode;
	do {
		textNode = walk.nextNode();
		if (textNode && textNode.parentNode && textNode.nodeType === 3 && textNode.textContent.search(pattern) !== -1 && (!excludeHighlighted || textNode.parentElement !== textNode.parentNode || Array.from(textNode.parentElement.classList).every((className: string) => !className.includes("highlight-search-term-"))) && textNode.parentElement.tagName !== "NOSCRIPT" && textNode.parentElement.tagName !== "SCRIPT" && textNode.parentElement["tagName"] !== "META" && textNode.parentElement["tagName"] !== "STYLE") textNodes.push(textNode);
	} while (textNode);
	return textNodes;
}

const highlightNodeAdditions = (elementHighlights: Set<HTMLElement>, regex: RegExp) => new MutationObserver(
	mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(
		textNode => highlightInNodes(getNodesToHighlight(textNode, regex), regex, elementHighlights)))).observe(
			document.getElementsByClassName("results")[0], {childList: true})
;

const receiveSearchDetails = details => {
	browser.runtime.onMessage.removeListener(receiveSearchDetails);
	const elementHighlights: Set<HTMLElement> = new Set();
	const regex = new RegExp(`((${details["terms"].map(term => term.replace(/(.)/g,"$1(\-?)")).join(")|(")}))`, "gi");
	highlightInNodes(getNodesToHighlight(document.body, regex), regex, elementHighlights);
	addControls(document.body, details["terms"], elementHighlights);
	if (details["engine"] === "duckduckgo.com") highlightNodeAdditions(elementHighlights, regex);
};

browser.runtime.onMessage.addListener(receiveSearchDetails);
