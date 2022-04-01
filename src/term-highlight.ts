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
	.${getSelector(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
		border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
	.${getSelector(ElementClass.CONTROL_EXPAND)}:hover { all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
		border: none; margin-left: 3px; width: 15px; background-color: rgb(210,210,210); color: transparent; }
	.${getSelector(ElementClass.CONTROL_EXPAND)}:hover .${getSelector(ElementClass.OPTION_LIST)} { all: revert; position: absolute; display: inline;
		top: 5px; padding-left: inherit; left: -7px; }
	.${getSelector(ElementClass.CONTROL_BUTTON)} { all: revert; display: inline; border-width: 2px; border-block-color: black; }
	.${getSelector(ElementClass.CONTROL_BUTTON)}:hover { all: revert; display: inline; border-width: 2px; border-block-color: black; }
	.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled { all: revert; display: inline; color: #333; background-color: rgba(200,200,200,0.6);
		border-width: 2px; border-block-color: black; }
	.${getSelector(ElementClass.OPTION_LIST)} { all: revert; display: none; }
	.${getSelector(ElementClass.OPTION)} { all: revert; display: block; background-color: rgb(210,210,210);
		border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
	.${getSelector(ElementClass.OPTION)}:hover { all: revert; display: block; background-color: rgb(150,150,150);
		border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
	#${getSelector(ElementId.BAR)} { all: revert; position: fixed; z-index: 1000000000000000; width: 100%; color-scheme: light;
		line-height: initial; }
	#${getSelector(ElementId.TOGGLE)} { all: revert; }
`; // TODO: focus/hover effect curation, grey on disabled, combining hover/focus/normal rules [?]

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

const createButton = (focus: ElementSelect, style: HTMLStyleElement, term: string, COLOR: ReadonlyArray<number>) => {
	style.textContent += `
		.${getSelector(ElementClass.ALL)} .${getSelector(ElementClass.TERM, term)}
			{ background-color: rgba(${COLOR.join(",")},0.4) }
		.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)} {
			all: revert; display: inline; border-width: 2px; border-block-color: black; background-color: rgba(${COLOR.map(channel => channel ? channel : 140).join(",")},1); }
		.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)}:hover {
			all: revert; display: inline; border-width: 2px; border-block-color: black; background-color: rgba(${COLOR.map(channel => channel ? channel : 200).join(",")},1); }
		.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled {
			all: revert; display: inline; border-width: 2px; border-block-color: black; background-color: rgba(100,100,100,0.5); color: white; }
	`;
	const button = document.createElement("button");
	button.classList.add(getSelector(ElementClass.CONTROL_BUTTON));
	button.classList.add(getSelector(ElementClass.TERM, term));
	if (focus.getElementCount(getTermPredicate(term)) === 0) {
		button.disabled = true;
	}
	button.textContent = term;
	button.title = focus.getElementCount(getTermPredicate(term)).toString() + " [TODO: update tooltip]";
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
	menu.appendChild(createOption("Fuzzy"));
	menu.appendChild(createOption("Whole Word"));
	const expand = document.createElement("button");
	expand.classList.add(getSelector(ElementClass.CONTROL_EXPAND));
	expand.textContent = "⁝";
	expand.appendChild(menu);
	const div = document.createElement("div");
	div.classList.add(getSelector(ElementClass.CONTROL));
	div.appendChild(expand);
	div.appendChild(button);
	return div;
};

const addControls = (focus: ElementSelect, terms: Array<string>) => {
	const style = document.createElement("style");
	style.id = getSelector(ElementId.STYLE);
	style.textContent = STYLE_MAIN;
	document.head.appendChild(style);
	document.body.classList.add(getSelector(ElementClass.ALL)); // TODO: prevent removal on websites like https://codesource.io/how-to-disable-button-in-javascript/
	const bar = document.createElement("div");
	bar.id = getSelector(ElementId.BAR);
	document.body.insertAdjacentElement("beforebegin", bar);
	const toggle = document.createElement("input");
	toggle.id = getSelector(ElementId.TOGGLE);
	toggle.type = "checkbox";
	toggle.checked = true;
	toggle.oninput = () => {
		// TODO: Can work by CSS (elegant, would eliminate class removal problem)
		document.body.classList[toggle.checked ? "add" : "remove"](getSelector(ElementClass.ALL));
	};
	bar.appendChild(toggle);
	for (let i = 0; i < terms.length; i++) {
		bar.appendChild(createButton(focus, style, terms[i], BUTTON_COLORS[i % BUTTON_COLORS.length]));
	}
};

const removeControls = () => {
	if (!document.getElementById(getSelector(ElementId.STYLE))) return;
	document.getElementById(getSelector(ElementId.BAR)).remove();
	document.getElementById(getSelector(ElementId.STYLE)).remove();
};

const enableButton = (enable: boolean, button: HTMLButtonElement) => {
	button.disabled = !enable;
};

const highlightInNodes = (focus: ElementSelect, nodes: Array<Node>, pattern: RegExp) => {
	const terms: Set<string> = new Set;
	nodes.forEach(node => {
		const element = document.createElement("span");
		element.innerHTML = node.textContent.replace(pattern, match => {
			const term = match.replace("-","").toLowerCase();
			terms.add(term);
			return `<span class='${getSelector(ElementClass.TERM, term)}'>${match}</span>`;
		});
		node.parentNode.insertBefore(element, node);
		node.parentNode.removeChild(node);
		focus.addElement(element.parentElement.tagName === "P" || element.parentElement.parentElement.tagName !== "P"
			? element.parentElement : element.parentElement.parentElement);
		element.outerHTML = element.innerHTML;
	});
	const buttons = Array.from(document.getElementsByClassName(getSelector(ElementClass.CONTROL_BUTTON)));
	//const termButtons: Record<string, HTMLButtonElement> = buttons.red
	terms.forEach(term => {
		const pattern = new RegExp(term.replace(/(.)/g,"$1-?"), "gi");
		buttons.forEach((button: HTMLButtonElement) => {
			if (button.textContent.match(pattern)) {
				enableButton(true, button);
			}
		});
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

const highlightNodeAdditions = (focus: ElementSelect, pattern: RegExp) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		highlightInNodes(focus, getNodesToHighlight(node, pattern), pattern)
	))).observe(document.body, {childList: true, subtree: true})
;

const receiveResearchDetails = (researchDetails: ResearchDetail) => {
	removeControls();
	if (!researchDetails.enabled) return;
	const focus = new ElementSelect;
	if (researchDetails.terms.length !== 0) {
		const pattern = new RegExp(`((${researchDetails.terms.map(term => term.replace(/(.)/g,"$1-?")).join(")|(")}))`, "gi");
		highlightInNodes(focus, getNodesToHighlight(document.body, pattern), pattern);
		highlightNodeAdditions(focus, pattern);
	}
	addControls(focus, researchDetails.terms);
};

browser.runtime.onMessage.addListener(receiveResearchDetails);
