class ElementSelect {
	elements: Set<HTMLElement>;
	length: number;
	index: number;

	constructor(elements: Array<HTMLElement> = []) {
		this.elements = new Set(elements);
		this.length = elements.length;
		this.index = -1;
	}

	addElement(element: HTMLElement) {
		if (this.elements.has(element)) return;
		this.elements.add(element);
		this.length += 1;
	}

	currentElement() {
		this.index %= this.length;
		return Array.from(this.elements)[this.index];
	}

	nextElement(filter = element => true) {
		this.index += 1;
		return filter(this.currentElement())
			? this.currentElement()
			: this.nextElement(filter)
		;
	}
}

const createButton = (focus: ElementSelect, term: string, color: Array<number>) => {
	const button = document.createElement("button");
	button.style.all = "revert";
	button.classList.add("highlight-search-control");
	button.textContent = term;
	button.onclick = () => {
		if (focus.length === 0) return;
		if (focus.currentElement())
			focus.currentElement().classList.remove("highlight-search-focus")
		;
		const pattern = new RegExp(term.replace(/(.)/g,"$1(\-?)"), "gi");
		const element = focus.nextElement(
			element => element && element.offsetParent !== null && element.textContent.match(pattern)
		);
		element.scrollIntoView({behavior: "smooth", block: "center"});
		element.classList.add("highlight-search-focus");
	};
	button.style.backgroundColor = "#" + color.map(channel => channel === 255 ? "f" : "7").join("");
	return button;
}

const addControls = (highlightRoot: Element, terms: Array<string>, focus: ElementSelect) => {
	const colors = [
		[255, 255, 0],
		[0, 255, 0],
		[0, 255, 255],
		[255, 0, 255],
		[255, 0, 0],
		[0, 0, 255],
	];

	const style = document.createElement("style");
	style.textContent = `
@keyframes fadeOut { 0% { background-color: rgba(128,128,128,0.6) } 100% { background-color: rgba(128,128,128,0) } }
.highlight-search-focus { animation-name: fadeOut; animation-duration: 1s }
.highlight-search-control { border-width: 2px; border-block-color: #000 }`
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
		const term = terms[i];
		const color = colors[i % colors.length];
		style.textContent += `.highlight-search-all .highlight-search-term-${term} { background: rgba(${color.join(",")},0.4) }`;
		controls.appendChild(createButton(focus, term, color));
	}

	const cancel = document.createElement("input");
	cancel.style.all = "revert";
	cancel.type = "checkbox";
	cancel.onclick = () => {
		// TODO: Unlink research for the page.
		controls.remove();
	};
	cancel.style.marginLeft = "10px";
	cancel.style.marginRight = "10px";
	controls.appendChild(cancel);
};

const highlightInNodes = (textNodes: Array<Node>, pattern: RegExp, focus: ElementSelect) => {
	textNodes.forEach(textNode => {
		const element = document.createElement("span");
		element.innerHTML = textNode.textContent.replace(pattern,
			match => `<span class='highlight-search-term-${match.replace("-","").toLowerCase()}'>${match}</span>`
		);
		textNode.parentNode.insertBefore(element, textNode);
		textNode.parentNode.removeChild(textNode);
		focus.addElement(element.parentElement);
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
		if (textNode && textNode.parentNode && textNode.nodeType === 3 && textNode.textContent.search(pattern) !== -1
			&& (!excludeHighlighted || textNode.parentElement !== textNode.parentNode
				|| Array.from(textNode.parentElement.classList).every((className: string) => !className.includes("highlight-search-term-"))
			) && textNode.parentElement.tagName !== "NOSCRIPT" && textNode.parentElement.tagName !== "SCRIPT"
			&& textNode.parentElement.tagName !== "META" && textNode.parentElement.tagName !== "STYLE"
		) textNodes.push(textNode);
	} while (textNode);
	return textNodes;
}

const highlightNodeAdditions = (focus: ElementSelect, pattern: RegExp) => new MutationObserver(
	mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(
		textNode => highlightInNodes(getNodesToHighlight(textNode, pattern), pattern, focus)
	))).observe(document.getElementsByClassName("results")[0], {childList: true})
;

const receiveSearchDetails = details => {
	browser.runtime.onMessage.removeListener(receiveSearchDetails);
	const focus = new ElementSelect();
	const pattern = new RegExp(`((${details["terms"].map(term => term.replace(/(.)/g,"$1(\-?)")).join(")|(")}))`, "gi");
	highlightInNodes(getNodesToHighlight(document.body, pattern), pattern, focus);
	addControls(document.body, details["terms"], focus);
	if (details["engine"] === "duckduckgo.com") highlightNodeAdditions(focus, pattern);
};

browser.runtime.onMessage.addListener(receiveSearchDetails);
