class ElementSelect {
	#elements: Set<HTMLElement>;
	#length: number;
	#index: number;

	constructor(elements: Array<HTMLElement> = []) {
		this.#elements = new Set(elements);
		this.#length = elements.length;
		this.#index = -1;
	}

	isEmpty() {
		return this.#length === 0;
	}

	addElement(element: HTMLElement) {
		if (this.#elements.has(element)) return;
		this.#elements.add(element);
		this.#length += 1;
	}

	currentElement() {
		this.#index %= this.#length;
		return Array.from(this.#elements)[this.#index];
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	nextElement(filter = element => true) {
		console.log(this.#index);
		console.log(this.#length);
		this.#index += 1;
		return filter(this.currentElement())
			? this.currentElement()
			: this.nextElement(filter)
		;
	}
}

enum ElementClass {
	ALL = "all",
	CONTROL = "control",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "option-list",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
}

enum ElementId {
	STYLE = "style",
	BAR = "bar",
	TOGGLE = "toggle",
}

const getSelector = (element: ElementId | ElementClass, term = "") =>
	term === "" ? ["highlight-search", element].join("-") : ["highlight-search", element, term].join("-") // TODO: Fix.
;

const STYLE_MAIN =
`@keyframes flash { 0% { background-color: rgba(160,160,160,1); } 100% { background-color: rgba(160,160,160,0); }; }
.${getSelector(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
.${getSelector(ElementClass.CONTROL)} { all: revert; position: relative; display: inline; }
.${getSelector(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; display: inline; border: none; border-top-style: groove; border-left-style: groove; border-left-width: thick; }
.${getSelector(ElementClass.CONTROL_BUTTON)} { all: revert; display: inline; border-width: 2px; border-block-color: #000; margin: 0 0 0 0; }
.${getSelector(ElementClass.OPTION_LIST)} { all: revert; position: absolute; display: inline; margin-top: 20px; padding-left: inherit; }
.${getSelector(ElementClass.OPTION)} { all: revert; border-style: none; border-bottom-style: groove; border-left-style: groove; border-left-width: thick; translate: 2px; display: block; }
#${getSelector(ElementId.BAR)} { all: revert; position: fixed; z-index: 10000; width: 100%; }
#${getSelector(ElementId.TOGGLE)} { all: revert; left-margin: 10px; right-margin: 10px; }`;

const BUTTON_COLORS: ReadonlyArray<ReadonlyArray<number>> = [
	[255, 255, 0],
	[0, 255, 0],
	[0, 255, 255],
	[255, 0, 255],
	[255, 0, 0],
	[0, 0, 255],
];

const createOption = (title: string) => {
	const option = document.createElement("button");
	option.classList.add(getSelector(ElementClass.OPTION));
	option.textContent = title;
	return option;
};

const createButton = (focus: ElementSelect, term: string, COLOR: ReadonlyArray<number>) => {
	const button = document.createElement("button");
	button.classList.add(getSelector(ElementClass.CONTROL_BUTTON));
	button.style.backgroundColor = "#" + COLOR.map(channel => channel === 255 ? "f" : "7").join("");
	button.textContent = term;
	button.title = "TODO: count tooltip";
	button.onclick = () => {
		if (focus.isEmpty()) return;
		if (focus.currentElement())
			focus.currentElement().classList.remove(getSelector(ElementClass.FOCUS));
		const pattern = new RegExp(term.replace(/(.)/g,"$1-?"), "gi");
		const element = focus.nextElement(
			element => element && element.offsetParent !== null && element.textContent.match(pattern)
		);
		element.scrollIntoView({behavior: "smooth", block: "center"});
		element.classList.add(getSelector(ElementClass.FOCUS));
	};
	const menu = document.createElement("menu");
	menu.classList.add(getSelector(ElementClass.OPTION_LIST));
	menu.style.display = "none";
	menu.appendChild(createOption("Fuzzy"));
	menu.appendChild(createOption("Whole Word"));
	const arrow = document.createElement("button");
	arrow.classList.add(getSelector(ElementClass.CONTROL_EXPAND));
	arrow.textContent = "⋮";
	arrow.onclick = () => {
		arrow.textContent = menu.style.display === "" ?  "⋮" : " ";
		menu.style.display = menu.style.display === "" ?  "none" : "";
	};
	const div = document.createElement("div");
	div.classList.add(getSelector(ElementClass.CONTROL));
	div.appendChild(menu);
	div.appendChild(arrow);
	div.appendChild(button);
	return div;
};

const addControls = (highlightRoot: Element, terms: Array<string>, focus: ElementSelect) => {
	const style = document.createElement("style");
	style.id = getSelector(ElementId.STYLE);
	style.textContent = STYLE_MAIN;
	document.head.appendChild(style);
	highlightRoot.classList.add(getSelector(ElementClass.ALL));
	
	const bar = document.createElement("div");
	bar.id = getSelector(ElementId.BAR);
	document.body.insertAdjacentElement("beforebegin", bar);
	
	const checkbox = document.createElement("input");
	checkbox.id = getSelector(ElementId.TOGGLE);
	checkbox.type = "checkbox";
	checkbox.checked = true;
	checkbox.oninput = () =>
		highlightRoot.classList[checkbox.checked ? "add" : "remove"](getSelector(ElementClass.ALL));
	checkbox.style.marginLeft = "10px";
	checkbox.style.marginRight = "10px";
	bar.appendChild(checkbox);
	
	for (let i = 0; i < terms.length; i++) {
		const term = terms[i];
		const color = BUTTON_COLORS[i % BUTTON_COLORS.length];
		style.textContent += `.${getSelector(ElementClass.ALL)} .${getSelector(ElementClass.TERM, term)} { background: rgba(${color.join(",")},0.4) }`;
		bar.appendChild(createButton(focus, term, color));
	}
};

const removeControls = () => {
	document.getElementById(getSelector(ElementId.BAR)).remove();
	document.getElementById(getSelector(ElementId.STYLE)).remove();
};

const highlightInNodes = (textNodes: Array<Node>, pattern: RegExp, focus: ElementSelect) => {
	textNodes.forEach(textNode => {
		const element = document.createElement("span");
		element.innerHTML = textNode.textContent.replace(pattern,
			match => `<span class='${getSelector(ElementClass.TERM, match.replace("-","").toLowerCase())}'>${match}</span>`
		);
		textNode.parentNode.insertBefore(element, textNode);
		textNode.parentNode.removeChild(textNode);
		focus.addElement(element.parentElement.tagName === "P" || element.parentElement.parentElement.tagName !== "P" ? element.parentElement : element.parentElement.parentElement);
		element.outerHTML = element.innerHTML;
	});
};

const getNodesToHighlight = (rootNode: Node, pattern: RegExp, excludeHighlighted = true) => {
	const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node =>
		((!("tagName" in node)) || (node.parentElement.tagName !== "SCRIPT" && node["tagName"] !== "META"
		&& node["tagName"] !== "STYLE" && node.parentElement.tagName !== "NOSCRIPT"))
			? NodeFilter.FILTER_ACCEPT :  NodeFilter.FILTER_SKIP});
	const textNodes: Array<Node> = [];
	let textNode;
	do {
		textNode = walk.nextNode();
		if (textNode && textNode.parentNode && textNode.nodeType === Node.TEXT_NODE && textNode.textContent.search(pattern) !== -1
			&& (!excludeHighlighted || textNode.parentElement !== textNode.parentNode
				|| Array.from(textNode.parentElement.classList).every((className: string) => !className.includes("highlight-search-term-"))
			) && textNode.parentElement.tagName !== "NOSCRIPT" && textNode.parentElement.tagName !== "SCRIPT"
			&& textNode.parentElement.tagName !== "META" && textNode.parentElement.tagName !== "STYLE"
		) textNodes.push(textNode);
	} while (textNode);
	return textNodes;
};

const highlightNodeAdditions = (focus: ElementSelect, pattern: RegExp) => new MutationObserver(mutations =>
	mutations.forEach(mutation => mutation.addedNodes.forEach(textNode =>
		highlightInNodes(getNodesToHighlight(textNode, pattern), pattern, focus)
	))).observe(document.body, {childList: true, subtree: true})
;

const receiveSearchDetails = details => {
	if (details["terms"].length === 0 && details["engine"] === "") {
		removeControls();
		return;
	}
	const focus = new ElementSelect();
	if (details["terms"].length !== 0) {
		const pattern = new RegExp(`((${details["terms"].map(term => term.replace(/(.)/g,"$1-?")).join(")|(")}))`, "gi");
		highlightInNodes(getNodesToHighlight(document.body, pattern), pattern, focus);
		highlightNodeAdditions(focus, pattern);
	}
	addControls(document.body, details["terms"], focus);
};

browser.runtime.onMessage.addListener(receiveSearchDetails);
