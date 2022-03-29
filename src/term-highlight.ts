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
	nextElement(predicate = (element: HTMLElement) => true): HTMLElement {
		console.log(this.#index);
		console.log(this.#length);
		this.#index += 1;
		return predicate(this.currentElement())
			? this.currentElement()
			: this.nextElement(predicate)
		;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	getElementCount(predicate = (element: HTMLElement) => true) {
		return Array.from(this.#elements).filter(predicate).length;
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

const STYLE_MAIN = `
	@keyframes flash { 0% { background-color: rgba(160,160,160,1); } 100% { background-color: rgba(160,160,160,0); }; }
	.${getSelector(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
	.${getSelector(ElementClass.CONTROL)} { all: revert; position: relative; display: inline; }
	.${getSelector(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; display: inline;
		border: none; border-left-style: groove; border-left-width: thick; padding-top: 3px; padding-bottom: 3px; }
	.${getSelector(ElementClass.CONTROL_BUTTON)} { all: revert; display: inline;
		border-width: 2px; border-block-color: #000; margin: 0 0 0 0; }
	.${getSelector(ElementClass.OPTION_LIST)} { all: revert; position: absolute; display: inline;
		margin-top: 20px; padding-left: inherit; }
	.${getSelector(ElementClass.OPTION)} { all: revert; display: block;
		border-style: none; border-bottom-style: groove; border-left-style: groove; border-left-width: thick; translate: 2px; }
	#${getSelector(ElementId.BAR)} { all: revert; position: fixed; z-index: 1000000000000000; width: 100%; }
	#${getSelector(ElementId.TOGGLE)} { all: revert; }
`;

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

const getTermPredicate = (term: string) => {
	const pattern = new RegExp(term.replace(/(.)/g,"$1-?"), "gi");
	return (element: HTMLElement) =>
		element && element.offsetParent !== null && element.textContent.match(pattern) !== null;
};

const createButton = (focus: ElementSelect, term: string, COLOR: ReadonlyArray<number>) => {
	const button = document.createElement("button");
	button.classList.add(getSelector(ElementClass.CONTROL_BUTTON));
	if (focus.getElementCount(getTermPredicate(term)) !== 0) {
		button.style.backgroundColor = "#" + COLOR.map(channel => channel === 255 ? "f" : "7").join("");
	} else {
		button.style.color = "#ddd";
		button.disabled = true;
	}
	button.textContent = term;
	button.title = "TODO: count tooltip";
	button.onclick = () => {
		if (focus.isEmpty()) return;
		if (focus.currentElement()) {
			focus.currentElement().classList.remove(getSelector(ElementClass.FOCUS));
		}
		const element = focus.nextElement(getTermPredicate(term));
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

const addControls = (focus: ElementSelect, termButtons: Array<HTMLElement>, terms: Array<string>) => {
	// TODO: Gap on websites like this: https://codesource.io/how-to-disable-button-in-javascript/.
	// TODO: Issue due to dark theme on Github.
	const style = document.createElement("style");
	style.id = getSelector(ElementId.STYLE);
	style.textContent = STYLE_MAIN;
	document.head.appendChild(style);
	document.body.classList.add(getSelector(ElementClass.ALL));
	
	const bar = document.createElement("div");
	bar.id = getSelector(ElementId.BAR);
	document.body.insertAdjacentElement("beforebegin", bar);
	
	const checkbox = document.createElement("input");
	checkbox.id = getSelector(ElementId.TOGGLE);
	checkbox.type = "checkbox";
	checkbox.checked = true;
	checkbox.oninput = () => {
		document.body.classList[checkbox.checked ? "add" : "remove"](getSelector(ElementClass.ALL));
	};
	bar.appendChild(checkbox);
	
	for (let i = 0; i < terms.length; i++) {
		const color = BUTTON_COLORS[i % BUTTON_COLORS.length];
		style.textContent += `.${getSelector(ElementClass.ALL)} .${getSelector(ElementClass.TERM, terms[i])}
			{ background: rgba(${color.join(",")},0.4) }`;
		const button = createButton(focus, terms[i], color);
		bar.appendChild(button);
		termButtons.push(button);
	}
};

const removeControls = () => {
	document.getElementById(getSelector(ElementId.BAR)).remove();
	document.getElementById(getSelector(ElementId.STYLE)).remove();
};

const highlightInNodes = (nodes: Array<Node>, pattern: RegExp, focus: ElementSelect) => {
	nodes.forEach(node => {
		const element = document.createElement("span");
		element.innerHTML = node.textContent.replace(pattern,
			match => `<span class='${getSelector(ElementClass.TERM, match.replace("-","").toLowerCase())}'>${match}</span>`
		);
		node.parentNode.insertBefore(element, node);
		node.parentNode.removeChild(node);
		focus.addElement(element.parentElement.tagName === "P" || element.parentElement.parentElement.tagName !== "P"
			? element.parentElement : element.parentElement.parentElement);
		element.outerHTML = element.innerHTML;
	});
};

const getNodesToHighlight = (rootNode: Node, pattern: RegExp, excludeHighlighted = true) => {
	const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node =>
		((!("tagName" in node)) || (node.parentElement.tagName !== "SCRIPT" && node["tagName"] !== "META"
		&& node["tagName"] !== "STYLE" && node.parentElement.tagName !== "NOSCRIPT"))
			? NodeFilter.FILTER_ACCEPT :  NodeFilter.FILTER_SKIP});
	const nodes: Array<Node> = [];
	let node: Node;
	do {
		node = walk.nextNode();
		if (node && node.parentNode && node.nodeType === Node.TEXT_NODE && node.textContent.search(pattern) !== -1
			&& (!excludeHighlighted || node.parentElement !== node.parentNode
				|| Array.from(node.parentElement.classList).every((className: string) => !className.includes("highlight-search-term-"))
				// TODO: Replace static string and improve concatenation in function.
			) && node.parentElement.tagName !== "NOSCRIPT" && node.parentElement.tagName !== "SCRIPT"
			&& node.parentElement.tagName !== "META" && node.parentElement.tagName !== "STYLE"
		) nodes.push(node);
	} while (node);
	return nodes;
};

const highlightNodeAdditions = (focus: ElementSelect, termButtons: Array<HTMLElement>, pattern: RegExp) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		highlightInNodes(getNodesToHighlight(node, pattern), pattern, focus)
	))).observe(document.body, {childList: true, subtree: true})
;

const receiveSearchDetails = (details: ResearchId) => {
	if (details.terms.length === 0 && details.engine === "") {
		removeControls();
		return;
	}
	const focus = new ElementSelect();
	const termButtons: Array<HTMLElement> = [];
	if (details.terms.length !== 0) {
		const pattern = new RegExp(`((${details.terms.map(term => term.replace(/(.)/g,"$1-?")).join(")|(")}))`, "gi");
		highlightInNodes(getNodesToHighlight(document.body, pattern), pattern, focus);
		highlightNodeAdditions(focus, termButtons, pattern);
	}
	addControls(focus, termButtons, details.terms);
};

browser.runtime.onMessage.addListener(receiveSearchDetails);
