type TermJumpFunctions = Array<(reverse: boolean) => void>;
type SelectTermPtr = Record<string, (command: string) => void>;

enum ElementClass {
	BAR_MINIMAL = "bar-minimal",
	CONTROL = "control",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM_ANY = "any",
	TERM = "term",
	FOCUS = "focus",
	MARKER_BLOCK = "marker-block",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	BAR_TOGGLE = "bar-toggle",
	MARK_TOGGLE = "mark-toggle",
	MARKER_GUTTER = "markers",
}

const select = (element: ElementID | ElementClass, param?: string | number) =>
	["searchhighlight", element, param].join("-").slice(0, param ? undefined : -1)
;

const Z_INDEX_MAX = 2147483647;

const STYLE_MAIN = `
@keyframes flash { 0% { background-color: rgba(160,160,160,1); } 100% { background-color: rgba(160,160,160,0); }; }
.${select(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
.${select(ElementClass.CONTROL)} { all: revert; display: none; }
#${select(ElementID.BAR)}:hover > .${select(ElementClass.CONTROL)},
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_MINIMAL)}) > .${select(ElementClass.CONTROL)} {
position: relative; display: inline; }
.${select(ElementClass.CONTROL_EXPAND)}, .${select(ElementClass.CONTROL_EXPAND)}:hover {
all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
.${select(ElementClass.CONTROL_EXPAND)}:hover { color: transparent; }
.${select(ElementClass.CONTROL_EXPAND)}:hover .${select(ElementClass.OPTION_LIST)} {
all: revert; position: absolute; display: inline; top: 5px; padding-left: inherit; left: -7px; z-index: 1; }
.${select(ElementClass.CONTROL_BUTTON)}, .${select(ElementClass.CONTROL_BUTTON)}:hover,
.${select(ElementClass.CONTROL_BUTTON)}:disabled {
all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${select(ElementClass.CONTROL_BUTTON)}:disabled {
background-color: rgba(100,100,100,0.5) !important; }
.${select(ElementClass.OPTION_LIST)} { all: revert; display: none; }
.${select(ElementClass.OPTION)} { all: revert; display: block;
border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${select(ElementClass.OPTION)}:hover { all: revert; display: block; background-color: rgb(150,150,150);
border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${select(ElementClass.CONTROL_EXPAND)}:hover, .${select(ElementClass.OPTION)} {
background-color: rgb(190,190,190); }
#${select(ElementID.BAR)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; color-scheme: light;
line-height: initial; font-size: 0; }
#${select(ElementID.BAR_TOGGLE)} { all: revert; border: 0; border-bottom: 3px inset; padding: 0; margin: 0; margin-right: 20px;
height: 24px; font-size: 16px; }
#${select(ElementID.MARK_TOGGLE)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; left: 14px; }
#${select(ElementID.MARK_TOGGLE)}:checked ~ #${select(ElementID.MARKER_GUTTER)} { display: block; }
.${select(ElementClass.TERM_ANY)} {
background-color: unset; color: unset; }
#${select(ElementID.MARKER_GUTTER)} { display: none; z-index: ${Z_INDEX_MAX};
right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${select(ElementID.MARKER_GUTTER)} div:not(.${select(ElementClass.MARKER_BLOCK)}) {
width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${select(ElementID.MARKER_GUTTER)}, .${select(ElementClass.MARKER_BLOCK)} {
position: fixed; background-color: rgba(0, 0, 0, 0.5); }
.${select(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }
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

const termFromMatch = (matchString: string) =>
	matchString.replace(/-|‐|‐/, "").toLowerCase()
;

const createTermOption = (title: string) => {
	const option = document.createElement("button");
	option.classList.add(select(ElementClass.OPTION));
	option.tabIndex = -1;
	option.textContent = title;
	return option;
};

const jumpToTerm = (reverse: boolean, term = "") => {
	// TODO: make this work in blocks, e.g. paragraphs
	const termSelector = term ? select(ElementClass.TERM, term) : select(ElementClass.TERM_ANY);
	const focusElement = document.getElementsByClassName(select(ElementClass.FOCUS))[0];
	if (focusElement) focusElement.classList.remove(select(ElementClass.FOCUS));
	const selection = document.getSelection();
	const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
		element.classList.contains(termSelector) && element.offsetParent
			? NodeFilter.FILTER_ACCEPT
			: NodeFilter.FILTER_SKIP);
	walk.currentNode = selection.anchorNode ? selection.anchorNode : document.body;
	const nextNodeMethod = reverse ? "previousNode" : "nextNode";
	let element = walk[nextNodeMethod]() as Element;
	if (!element) {
		walk.currentNode = reverse ? document.body.lastElementChild : document.body;
		element = walk[nextNodeMethod]() as Element;
		if (!element) return;
	}
	element.scrollIntoView({behavior: "smooth", block: "center"});
	element.classList.add(select(ElementClass.FOCUS));
	selection.setBaseAndExtent(element, 0, element, 0);
};

const createTermControl = (jumpToTerms: TermJumpFunctions, style: HTMLStyleElement,
	term: string, idx: number, COLOR: ReadonlyArray<number>) => {
	jumpToTerms.push((reverse: boolean) => jumpToTerm(reverse, term));
	style.textContent += `
#${select(ElementID.MARK_TOGGLE)}:checked ~ body .${select(ElementClass.TERM_ANY)}.${select(ElementClass.TERM, term)} {
background-color: rgba(${COLOR.join(",")},0.4); }
#${select(ElementID.MARKER_GUTTER)} .${select(ElementClass.TERM, term)} {
background-color: rgb(${COLOR.join(",")}); }
.${select(ElementClass.TERM, term)} > .${select(ElementClass.CONTROL_BUTTON)} {
background-color: rgb(${COLOR.map(channel => channel ? channel : 140).join(",")}); }
.${select(ElementClass.TERM, term)} > .${select(ElementClass.CONTROL_BUTTON)}:hover {
background-color: rgb(${COLOR.map(channel => channel ? channel : 200).join(",")}); }
.${select(ElementClass.CONTROL_BUTTON, idx)} > .${select(ElementClass.TERM, term)} > button {
	background-color: rgb(${COLOR.map(channel => channel ? channel : 220).join(",")}); }
	`;
	const controlButton = document.createElement("button");
	controlButton.classList.add(select(ElementClass.CONTROL_BUTTON));
	//if (focus.getElementCount(termToPredicate(term)) === 0) {
	//	button.disabled = true;
	//}
	//controlButton.title = focus.getElementCount(termToPredicate(term)).toString() + " [TODO: update tooltip]";
	controlButton.textContent = term;
	controlButton.onclick = () => jumpToTerm(false, term);
	const menu = document.createElement("menu");
	menu.classList.add(select(ElementClass.OPTION_LIST));
	menu.appendChild(createTermOption("Fuzzy"));
	menu.appendChild(createTermOption("Whole Word"));
	const expand = document.createElement("button");
	expand.classList.add(select(ElementClass.CONTROL_EXPAND));
	expand.tabIndex = -1;
	expand.textContent = "⁝";
	expand.appendChild(menu);
	const div = document.createElement("div");
	div.classList.add(select(ElementClass.CONTROL));
	div.classList.add(select(ElementClass.TERM, term));
	div.appendChild(expand);
	div.appendChild(controlButton);
	return div;
};

const addControls = (jumpToTerms: TermJumpFunctions, terms: Array<string>) => {
	const style = document.createElement("style");
	style.id = select(ElementID.STYLE);
	style.textContent = STYLE_MAIN;
	document.head.appendChild(style);
	const bar = document.createElement("div");
	const TOGGLE_MIN = "⇱";
	const TOGGLE_MAX = "⇲";
	const barToggle = document.createElement("button");
	barToggle.id = select(ElementID.BAR_TOGGLE);
	barToggle.tabIndex = 998;
	barToggle.textContent = TOGGLE_MIN;
	barToggle.onclick = () => {
		const minimal = !bar.classList.contains(select(ElementClass.BAR_MINIMAL));
		bar.classList[minimal ? "add" : "remove"](select(ElementClass.BAR_MINIMAL));
		barToggle.textContent = minimal ? TOGGLE_MAX : TOGGLE_MIN;
	};
	bar.id = select(ElementID.BAR);
	bar.appendChild(barToggle);
	for (let i = 0; i < terms.length; i++) {
		bar.appendChild(createTermControl(jumpToTerms, style, terms[i], i, BUTTON_COLORS[i % BUTTON_COLORS.length]));
	}
	const markToggle = document.createElement("input");
	markToggle.id = select(ElementID.MARK_TOGGLE);
	markToggle.tabIndex = 999;
	markToggle.type = "checkbox";
	markToggle.checked = true;
	document.body.insertAdjacentElement("beforebegin", bar);
	document.body.insertAdjacentElement("beforebegin", markToggle);
	const gutter = document.createElement("div");
	gutter.id = select(ElementID.MARKER_GUTTER);
	document.body.insertAdjacentElement("afterend", gutter);
};

const removeControls = () => {
	if (!document.getElementById(select(ElementID.STYLE))) return;
	document.getElementById(select(ElementID.BAR)).remove();
	document.getElementById(select(ElementID.MARKER_GUTTER)).remove();
	document.getElementById(select(ElementID.STYLE)).remove();
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
	const gutter = document.getElementById(select(ElementID.MARKER_GUTTER));
	const containerPairs: Array<[Element, HTMLElement]> = [[document.scrollingElement, gutter]];
	terms.forEach(term =>
		Array.from(document.body.getElementsByClassName(select(ElementClass.TERM, term))).forEach((mark: Element) => {
			if (!("offsetTop" in mark)) return;
			const scrollContainer = getScrollContainer(mark as HTMLElement);
			const containerPair = containerPairs.find(containerPair => containerPair[0] === scrollContainer);
			const block = containerPair ? containerPair[1] : document.createElement("div");
			if (!containerPair) {
				block.classList.add(select(ElementClass.MARKER_BLOCK));
				block.style.top = String(getOffset(scrollContainer, document.scrollingElement as HTMLElement) / document.scrollingElement.scrollHeight * 100) + "%";
				//block.style.height = "15%";
				gutter.appendChild(block);
				containerPairs.push([scrollContainer, block]);
			}
			// TOOD: add overlap strategy, add update strategy, check calculations
			const marker = document.createElement("div");
			marker.classList.add(select(ElementClass.TERM, term));
			marker.style.top = String(getOffset(mark as HTMLElement, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
			block.appendChild(marker);
		})
	);
};

const highlightInNode = (textEnd: Node, start: number, end: number, term: string) => {
	// TODO: delete redundant nodes
	start = Math.max(0, start);
	end = Math.min(textEnd.textContent.length, end);
	const textStart = document.createTextNode(textEnd.textContent.slice(0, start));
	const mark = document.createElement("mark");
	mark.classList.add(select(ElementClass.TERM_ANY));
	mark.classList.add(select(ElementClass.TERM, term));
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
			if (match.index + match[0].length > nextNodeStart) {
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
	&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(select(ElementClass.TERM_ANY))))
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
			&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(select(ElementClass.TERM_ANY)))) {
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
		|| (!HIGHLIGHT_TAGS.REJECT.includes(node["tagName"]) && !node["classList"].contains(select(ElementClass.TERM_ANY)))
	&& canHighlightNode(node.parentElement))
;

const highlightInNodesOnMutation = (pattern: RegExp) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		canHighlightNode(node) ? highlightInNodes(node, pattern) : undefined
	))).observe(document.body, {childList: true, subtree: true})
;

const selectTermOnCommand = (jumpToTerms: TermJumpFunctions, selectTermPtr: SelectTermPtr) => {
	let selectModeFocus = false;
	let focusedIdx = 0;
	selectTermPtr.selectTerm = (command: string) => {
		const parts = command.split("-");
		if (parts[0] === "toggle" && parts[1] === "select") {
			selectModeFocus = !selectModeFocus;
		} else if (parts[0] === "advance" && parts[1] === "global") {
			const reverse = parts[2] === "reverse";
			if (selectModeFocus) {
				jumpToTerms[focusedIdx](reverse);
			} else {
				jumpToTerm(reverse);
			}
		} else if (parts[0] === "select" && parts[1] === "term") {
			const bar = document.getElementById(select(ElementID.BAR));
			bar.classList.remove(select(ElementClass.CONTROL_BUTTON, focusedIdx));
			focusedIdx = Math.min(jumpToTerms.length, Number(parts[2]));
			bar.classList.add(select(ElementClass.CONTROL_BUTTON, focusedIdx));
			if (!selectModeFocus) {
				jumpToTerms[focusedIdx](parts[3] === "reverse");
			}
		}
	};
};

// TODO: term editing (+ from user-highlighted text context menu)
// TODO: configuration

const receiveResearchDetails = (terms: Array<string>, enabled: boolean, selectTermPtr: SelectTermPtr) => {
	removeControls();
	if (!enabled) return;
	const jumpToTerms: TermJumpFunctions = [];
	addControls(jumpToTerms, terms);
	selectTermOnCommand(jumpToTerms, selectTermPtr);
	if (terms.length) {
		const pattern = termsToPattern(terms);
		highlightInNodes(document.body, pattern);
		highlightInNodesOnMutation(pattern);
		setTimeout(() => addScrollMarkers(terms), 1000);
	}
};

const actionOnMessage = () => {
	const selectTermPtr = { selectTerm: undefined };
	browser.runtime.onMessage.addListener((message: Message) => {
		if (message.terms) {
			receiveResearchDetails(message.terms, message.enabled, selectTermPtr);
		} else if (message.command) {
			console.log(message);
			selectTermPtr.selectTerm(message.command);
		}
	});
};

actionOnMessage();
