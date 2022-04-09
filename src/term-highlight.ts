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

	getCurrentElement() {
		this.#index %= this.#length;
		return Array.from(this.#elements)[this.#index];
	}

	nextElement(predicate = (element: HTMLElement) => !!element): HTMLElement {
		this.#index += 1;
		return predicate(this.getCurrentElement())
			? this.getCurrentElement()
			: this.nextElement(predicate)
		;
	}

	getElementCount(predicate = (element: HTMLElement) => !!element) {
		return Array.from(this.#elements).filter(predicate).length;
	}
}

enum ElementClass {
	TERM_ANY = "all",
	CONTROL = "control",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	MARKER_BLOCK = "marker-block",
}

enum ElementId {
	STYLE = "style",
	BAR = "bar",
	TOGGLE = "toggle",
	MARKER_GUTTER = "markers",
}

const getSelector = (element: ElementId | ElementClass, term = "") =>
	["searchhighlight", element, term].join("-").slice(0, term === "" ? -1 : undefined)
;

const Z_INDEX_MAX = 2147483647;

const STYLE_MAIN = `
@keyframes flash { 0% { background-color: rgba(160,160,160,1); } 100% { background-color: rgba(160,160,160,0); }; }
.${getSelector(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
.${getSelector(ElementClass.CONTROL)} { all: revert; position: relative; display: inline; }
.${getSelector(ElementClass.CONTROL_EXPAND)}, .${getSelector(ElementClass.CONTROL_EXPAND)}:hover {
all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
.${getSelector(ElementClass.CONTROL_EXPAND)}:hover { color: transparent; }
.${getSelector(ElementClass.CONTROL_EXPAND)}:hover .${getSelector(ElementClass.OPTION_LIST)} {
all: revert; position: absolute; display: inline; top: 5px; padding-left: inherit; left: -7px; z-index: 1; }
.${getSelector(ElementClass.CONTROL_BUTTON)}, .${getSelector(ElementClass.CONTROL_BUTTON)}:hover,
.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled {
all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.OPTION_LIST)} { all: revert; display: none; }
.${getSelector(ElementClass.OPTION)} { all: revert; display: block;
border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${getSelector(ElementClass.OPTION)}:hover { background-color: rgb(150,150,150); }
.${getSelector(ElementClass.CONTROL_EXPAND)}:hover, .${getSelector(ElementClass.OPTION)} {
background-color: rgb(190,190,190); }
#${getSelector(ElementId.BAR)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; color-scheme: light;
line-height: initial; left: 20px; font-size: 0; }
#${getSelector(ElementId.TOGGLE)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; }
.${getSelector(ElementClass.CONTROL_BUTTON)} {
all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${getSelector(ElementClass.CONTROL_BUTTON)}:disabled {
background-color: rgba(100,100,100,0.5) !important; }
.${getSelector(ElementClass.TERM_ANY)} {
background-color: unset; color: unset; }
#${getSelector(ElementId.MARKER_GUTTER)} { display: none; z-index: ${Z_INDEX_MAX};
right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${getSelector(ElementId.MARKER_GUTTER)} div:not(.${getSelector(ElementClass.MARKER_BLOCK)}) {
width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${getSelector(ElementId.MARKER_GUTTER)}, .${getSelector(ElementClass.MARKER_BLOCK)} {
position: fixed; background-color: rgba(0, 0, 0, 0.5); }
.${getSelector(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }
#${getSelector(ElementId.TOGGLE)}:checked ~ #${getSelector(ElementId.MARKER_GUTTER)} { display: block; }
`;

const BUTTON_COLORS: ReadonlyArray<ReadonlyArray<number>> = [
	[255, 255, 0],
	[0, 255, 0],
	[0, 255, 255],
	[255, 0, 255],
	[255, 0, 0],
	[0, 0, 255],
];

const HIGHLIGHT_TAGS: Record<string, ReadonlyArray<string>> = {
	FLOW: ["B", "I", "U", "STRONG", "EM", "BR", "CITE", "SPAN", "MARK", "WBR", "CODE", "DATA", "DFN", "INS"],
	SKIP: ["S", "DEL"], // TODO: use
	REJECT: ["META", "STYLE", "SCRIPT", "NOSCRIPT"],
};

const termsToPattern = (terms: Array<string>) =>
	new RegExp(`(${terms.map(term => term.replace(/(.)/g,"$1(-|‐|‐)?").slice(0, -8)).join(")|(")})`, "gi")
;

const termToPredicate = (term: string) =>
	(element: HTMLElement) =>
		element && element.offsetParent && element.textContent.match(termsToPattern([term])) !== null
;

const termFromMatch = (matchString: string) =>
	matchString.replace(/-|‐|‐/, "").toLowerCase()
;

const createTermOption = (title: string) => {
	const option = document.createElement("button");
	option.classList.add(getSelector(ElementClass.OPTION));
	option.textContent = title;
	return option;
};

const createTermControl = (focus: ElementSelect, style: HTMLStyleElement, term: string, COLOR: ReadonlyArray<number>) => {
	style.textContent += `
#${getSelector(ElementId.TOGGLE)}:checked ~ body .${getSelector(ElementClass.TERM_ANY)}.${getSelector(ElementClass.TERM, term)} {
background-color: rgba(${COLOR.join(",")},0.4); }
#${getSelector(ElementId.MARKER_GUTTER)} .${getSelector(ElementClass.TERM, term)} {
background-color: rgb(${COLOR.join(",")}); }
.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)} {
background-color: rgb(${COLOR.map(channel => channel ? channel : 140).join(",")}); }
.${getSelector(ElementClass.TERM, term)}.${getSelector(ElementClass.CONTROL_BUTTON)}:hover {
background-color: rgb(${COLOR.map(channel => channel ? channel : 200).join(",")}); }
	`;
	const button = document.createElement("button");
	button.classList.add(getSelector(ElementClass.CONTROL_BUTTON));
	button.classList.add(getSelector(ElementClass.TERM, term));
	if (focus.getElementCount(termToPredicate(term)) === 0) {
		//button.disabled = true;
	}
	button.textContent = term;
	button.title = focus.getElementCount(termToPredicate(term)).toString() + " [TODO: update tooltip]";
	button.onclick = () => {
		// TODO: make this work in blocks, e.g. paragraphs
		if (focus.isEmpty()) return;
		if (focus.getCurrentElement()) {
			focus.getCurrentElement().classList.remove(getSelector(ElementClass.FOCUS));
		}
		const selection = document.getSelection();
		const walk = document.createTreeWalker(selection.anchorNode, NodeFilter.SHOW_ELEMENT, (node: Element) =>
			node.classList.contains(getSelector(ElementClass.TERM_ANY)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP);
		const element = walk.nextNode() as Element;
		element.scrollIntoView({behavior: "smooth", block: "center"});
		element.classList.add(getSelector(ElementClass.FOCUS));
	};
	const menu = document.createElement("menu");
	menu.classList.add(getSelector(ElementClass.OPTION_LIST));
	menu.appendChild(createTermOption("Fuzzy"));
	menu.appendChild(createTermOption("Whole Word"));
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
	const bar = document.createElement("div");
	bar.id = getSelector(ElementId.BAR);
	const toggle = document.createElement("input");
	toggle.id = getSelector(ElementId.TOGGLE);
	toggle.type = "checkbox";
	toggle.checked = true;
	document.body.insertAdjacentElement("beforebegin", toggle);
	document.body.insertAdjacentElement("beforebegin", bar);
	for (let i = 0; i < terms.length; i++) {
		bar.appendChild(createTermControl(focus, style, terms[i], BUTTON_COLORS[i % BUTTON_COLORS.length]));
	}
	const gutter = document.createElement("div");
	gutter.id = getSelector(ElementId.MARKER_GUTTER);
	document.body.insertAdjacentElement("afterend", gutter);
};

const removeControls = () => {
	if (!document.getElementById(getSelector(ElementId.STYLE))) return;
	document.getElementById(getSelector(ElementId.BAR)).remove();
	document.getElementById(getSelector(ElementId.MARKER_GUTTER)).remove();
	document.getElementById(getSelector(ElementId.STYLE)).remove();
};

/*const highlightInNodes = (focus: ElementSelect, nodes: Array<Node>, pattern: RegExp) => {
	...
	const buttons = Array.from(document.getElementsByClassName(getSelector(ElementClass.CONTROL_BUTTON)));
	terms.forEach(term => {
		const pattern = termsToPattern([term]);
		buttons.forEach((button: HTMLButtonElement) => {
			if (button.textContent.match(pattern)) {
				button.disabled = false;
			}
		});
	});
};*/

const getOffset = (element: HTMLElement, elementTop: HTMLElement) =>
	element && element !== elementTop && "offsetTop" in element
		? element.offsetTop + getOffset(element.offsetParent as HTMLElement, elementTop)
		: 0
;

const getScrollContainer = (element: HTMLElement): HTMLElement =>
	element.scrollHeight > element.clientHeight &&
	(document.scrollingElement === element || ["scroll", "auto"].indexOf(getComputedStyle(element).overflowY) !== -1)
		? element
		: getScrollContainer(element.parentElement)
;

const addScrollMarkers = (terms: Array<string>) => {
	const gutter = document.getElementById(getSelector(ElementId.MARKER_GUTTER));
	const containerPairs: Array<[Element, HTMLElement]> = [[document.scrollingElement, gutter]];
	terms.forEach(term =>
		Array.from(document.body.getElementsByClassName(getSelector(ElementClass.TERM, term))).forEach((mark: Element) => {
			if (!("offsetTop" in mark)) return;
			const scrollContainer = getScrollContainer(mark as HTMLElement);
			const containerPair = containerPairs.find(containerPair => containerPair[0] === scrollContainer);
			const block = containerPair ? containerPair[1] : document.createElement("div");
			if (!containerPair) {
				block.classList.add(getSelector(ElementClass.MARKER_BLOCK));
				block.style.top = String(getOffset(scrollContainer, document.scrollingElement as HTMLElement) / document.scrollingElement.scrollHeight * 100) + "%";
				//block.style.height = "15%";
				gutter.appendChild(block);
				containerPairs.push([scrollContainer, block]);
			}
			// TOOD: add overlap strategy, add update strategy, check calculations
			const marker = document.createElement("div");
			marker.classList.add(getSelector(ElementClass.TERM, term));
			marker.style.top = String(getOffset(mark as HTMLElement, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
			block.appendChild(marker);
		})
	);
};

const highlightInNode = (textEnd: Node, start: number, end: number, term: string) => {
	// TODO: delete redundant nodes
	[start, end] = [Math.max(0, start), Math.min(textEnd.textContent.length, end)];
	const textStart = document.createTextNode(textEnd.textContent.slice(0, start));
	const mark = document.createElement("mark");
	mark.classList.add(getSelector(ElementClass.TERM_ANY));
	mark.classList.add(getSelector(ElementClass.TERM, term));
	mark.textContent = textEnd.textContent.slice(start, end);
	textEnd.textContent = textEnd.textContent.slice(end);
	textEnd.parentNode.insertBefore(textStart, textEnd);
	textEnd.parentNode.insertBefore(mark, textEnd);
};

const highlightAtBreakLevel = (unbrokenNodes: Array<Node>, pattern: RegExp) => {
	const matches = Array.from(unbrokenNodes.map(node => node.textContent).join("").matchAll(pattern));
	let i = 0;
	let thisNodeStart = 0;
	unbrokenNodes.forEach(node => {
		const nextNodeStart = thisNodeStart + node.textContent.length;
		matches.slice(i).every(match => {
			if (match.index >= nextNodeStart) {
				return false;
			}
			const textLength = node.textContent.length;
			highlightInNode(node, match.index - thisNodeStart, match.index - thisNodeStart + match[0].length, termFromMatch(match[0]));
			thisNodeStart += textLength - node.textContent.length;
			if (match.index + match[0].length >= nextNodeStart) {
				return false;
			}
			i++;
			return true;
		});
		thisNodeStart = nextNodeStart;
	});
	unbrokenNodes.splice(0, unbrokenNodes.length);
};

// TODO: find better alternative to hack
const canHighlightInNextSiblings = (node: Node): boolean => node.nodeType === Node.TEXT_NODE ||
	(node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.includes(node["tagName"])
	&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(getSelector(ElementClass.TERM_ANY))))
		|| (node.nextSibling && canHighlightInNextSiblings(node.nextSibling))
;

const highlightInNodes = (rootNode: Node, pattern: RegExp) => {
	const unbrokenNodes: Array<Node> = [];
	const breakLevels: Array<number> = [0];
	let acceptAny = false;
	let level = 0;
	const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node => {
		if (acceptAny) {
			return NodeFilter.FILTER_ACCEPT;
		}
		if (node.nodeType === Node.TEXT_NODE) {
			if (level > breakLevels.at(-1)) {
				unbrokenNodes.push(node);
			}
			return NodeFilter.FILTER_ACCEPT;
		}
		if (node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.includes(node["tagName"])
			&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(getSelector(ElementClass.TERM_ANY)))) {
			if (!HIGHLIGHT_TAGS.FLOW.includes(node["tagName"])) {
				if (node.hasChildNodes()) breakLevels.push(level);
				highlightAtBreakLevel(unbrokenNodes, pattern);
			}
			return NodeFilter.FILTER_ACCEPT;
		}
		return NodeFilter.FILTER_REJECT;
	}});
	let node = walk.currentNode;
	while (node) {
		level++;
		node = walk.firstChild();
		if (!node) {
			level--;
			while (!(walk.currentNode.nextSibling && canHighlightInNextSiblings(walk.currentNode.nextSibling)) && level > 0) {
				level--;
				acceptAny = true;
				node = walk.parentNode();
				acceptAny = false;
				if (level === breakLevels.at(-1)) {
					breakLevels.pop();
					highlightAtBreakLevel(unbrokenNodes, pattern);
				}
				if (level === 0) return;
			}
			node = walk.nextSibling();
		}
	}
};

const canHighlightNode = (node: Node): boolean =>
	!node || (node.nodeType !== Node.ELEMENT_NODE
		|| (!HIGHLIGHT_TAGS.REJECT.includes(node["tagName"]) && !node["classList"].contains(getSelector(ElementClass.TERM_ANY)))
	&& canHighlightNode(node.parentElement))
;

const highlightInNodesOnMutation = (pattern: RegExp) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		canHighlightNode(node) ? highlightInNodes(node, pattern) : undefined
	))).observe(document.body, {childList: true, subtree: true})
;

// TODO: term editing (+ from user-highlighted text context menu)
// TODO: configuration
// TODO: keyboard navigation

const receiveResearchDetails = (researchDetails: ResearchDetail) => {
	removeControls();
	if (!researchDetails.enabled) return;
	const focus = new ElementSelect;
	addControls(focus, researchDetails.terms);
	if (researchDetails.terms.length) {
		const pattern = termsToPattern(researchDetails.terms);
		highlightInNodes(document.body, pattern);
		highlightInNodesOnMutation(pattern);
		setTimeout(() => addScrollMarkers(researchDetails.terms), 1000);
	}
};

browser.runtime.onMessage.addListener(receiveResearchDetails);
