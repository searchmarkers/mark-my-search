type TermJumpFunctions = Array<(reverse: boolean) => void>;

enum ElementClass {
	BAR_HIDDEN = "bar-hidden",
	CONTROL = "control",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM_ANY = "any",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_REVERT = "focus-revert",
	MARKER_BLOCK = "marker-block",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	HIGHLIGHT_TOGGLE = "highlight-toggle",
	MARKER_GUTTER = "markers",
}

class SelectTermPtr {
	selectTerm: (command: string) => void;

	constructor(selectTerm?: (command: string) => void) {
		this.selectTerm = selectTerm;
	}
}

class PatternPtr {
	pattern: RegExp;

	constructor(pattern?: RegExp) {
		this.pattern = pattern;
	}
}

const select = (element: ElementID | ElementClass, param?: string | number) =>
	["markmysearch", element, param].join("-").slice(0, param ? undefined : -1)
;

const Z_INDEX_MAX = 2147483647;

const STYLE_CONSTANT = `
.${select(ElementClass.TERM_ANY)} { background-color: unset; color: unset; }
`;

const STYLE_MAIN = `
@keyframes flash { 0% { background-color: hsla(0, 0%, 63%, 0.8); } 100% { background-color: hsla(0, 0%, 63%, 0); }; }
.${select(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
.${select(ElementClass.CONTROL)} { all: revert; position: relative; display: inline; }
.${select(ElementClass.CONTROL_EXPAND)}, .${select(ElementClass.CONTROL_EXPAND)}:hover {
all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
.${select(ElementClass.CONTROL_EXPAND)}:hover { color: transparent; }
.${select(ElementClass.CONTROL_EXPAND)}:hover .${select(ElementClass.OPTION_LIST)} {
all: revert; position: absolute; display: inline; top: 5px; padding-left: inherit; left: -7px; z-index: 1; }
.${select(ElementClass.CONTROL_BUTTON)}, .${select(ElementClass.CONTROL_BUTTON)}:hover,
.${select(ElementClass.CONTROL_BUTTON)}:disabled { all: revert; display: inline; border-width: 2px; border-block-color: black; }
.${select(ElementClass.CONTROL_BUTTON)}:disabled { background-color: hsla(0, 0%, 39%, 0.5) !important; }
.${select(ElementClass.OPTION_LIST)} { all: revert; display: none; }
.${select(ElementClass.OPTION)} { all: revert; display: block;
border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${select(ElementClass.OPTION)}:hover { all: revert; display: block; background-color: hsl(0, 0%, 59%);
border-style: none; border-bottom-style: ridge; border-left-style: ridge; translate: 3px; }
.${select(ElementClass.CONTROL_EXPAND)}:hover, .${select(ElementClass.OPTION)} {
background-color: hsl(0, 0%, 75%); }
#${select(ElementID.BAR)} { all: revert; position: fixed; left: 20px; z-index: ${Z_INDEX_MAX}; color-scheme: light;
line-height: initial; font-size: 0; display: none; }
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_HIDDEN)}) { display: inline; }
#${select(ElementID.HIGHLIGHT_TOGGLE)} { all: revert; position: fixed; z-index: ${Z_INDEX_MAX}; display: none; }
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_HIDDEN)}) + #${select(ElementID.HIGHLIGHT_TOGGLE)} {
display: inline; }
#${select(ElementID.HIGHLIGHT_TOGGLE)}:checked ~ #${select(ElementID.MARKER_GUTTER)} { display: block; }
#${select(ElementID.MARKER_GUTTER)} { display: none; z-index: ${Z_INDEX_MAX};
right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${select(ElementID.MARKER_GUTTER)} div:not(.${select(ElementClass.MARKER_BLOCK)}) {
width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${select(ElementID.MARKER_GUTTER)}, .${select(ElementClass.MARKER_BLOCK)} {
position: fixed; background-color: hsla(0, 0%, 0%, 0.5); }
.${select(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }
`;

const TERM_HUES: ReadonlyArray<number> = [60, 300, 111, 240, 0, 191, 28];

const HIGHLIGHT_TAGS: Record<string, ReadonlyArray<string>> = {
	FLOW: ["B", "I", "U", "STRONG", "EM", "BR", "CITE", "SPAN", "MARK", "WBR", "CODE", "DATA", "DFN", "INS"],
	SKIP: ["S", "DEL"], // TODO: use
	REJECT: ["META", "STYLE", "SCRIPT", "NOSCRIPT"],
};

const termsToPattern = (terms: MatchTerms) =>
	new RegExp(`(${terms.map(term => term.getPatternString()).join(")|(")})`, "gi") // TODO: per-term case sensitivity
;

const termFromMatch = (matchString: string) =>
	matchString.replace(/-|‐|‐/, "").toLocaleLowerCase()
;

const createTermOption = (terms: MatchTerms, term: MatchTerm, title: string) => {
	const option = document.createElement("button");
	option.classList.add(select(ElementClass.OPTION));
	option.tabIndex = -1;
	option.textContent = title;
	option.onclick = () => {
		console.log(term);
		const matchMode = "match" + (title.includes(" ") ? title.slice(0, title.indexOf(" ")) : title);
		console.log(matchMode);
		term[matchMode] = !term[matchMode];
		console.log(term);
		browser.runtime.sendMessage(terms);
	};
	return option;
};

const getTermOccurrenceBlock = (element: Element) =>
	HIGHLIGHT_TAGS.FLOW.includes(element.tagName) ? getTermOccurrenceBlock(element.parentElement) : element
;

const getLastDescendant = (element: Element) =>
	element.lastElementChild ? getLastDescendant(element.lastElementChild) : element
;

const jumpToTerm = (reverse: boolean, term?: MatchTerm) => {
	const termSelector = term ? select(ElementClass.TERM, term.getSelector()) : select(ElementClass.TERM_ANY);
	const focusElement = document.getElementsByClassName(select(ElementClass.FOCUS))[0] as HTMLElement;
	if (focusElement) {
		focusElement.classList.remove(select(ElementClass.FOCUS));
		if (focusElement.classList.contains(select(ElementClass.FOCUS_REVERT))) {
			focusElement.tabIndex = -1;
			focusElement.classList.remove(select(ElementClass.FOCUS_REVERT));
		}
	}
	const selection = document.getSelection();
	const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
		element.classList.contains(termSelector) && element.offsetParent
			? NodeFilter.FILTER_ACCEPT
			: NodeFilter.FILTER_SKIP);
	const anchor = selection.anchorNode;
	walk.currentNode = anchor
		? reverse
			? anchor
			: getLastDescendant(anchor.nodeType === Node.ELEMENT_NODE ? anchor as Element : anchor.parentElement)
		: document.body;
	const nextNodeMethod = reverse ? "previousNode" : "nextNode";
	let element = walk[nextNodeMethod]() as HTMLElement;
	if (!element) {
		walk.currentNode = reverse ? document.body.lastElementChild : document.body;
		element = walk[nextNodeMethod]() as HTMLElement;
		if (!element) return;
	}
	element = getTermOccurrenceBlock(element);
	element.classList.add(select(ElementClass.FOCUS));
	if (element.tabIndex === -1) {
		element.classList.add(select(ElementClass.FOCUS_REVERT));
		element.tabIndex = 0;
	}
	element.focus({ preventScroll: true }); // TODO: focus first focusable descendant instead?
	element.scrollIntoView({ behavior: "smooth", block: "center" });
	selection.setBaseAndExtent(element, 0, element, 0);
};

const createTermControl = (jumpToTerms: TermJumpFunctions, terms: MatchTerms, style: HTMLStyleElement,
	idx: number, hue: number) => {
	const term = terms[idx];
	jumpToTerms.push((reverse: boolean) => jumpToTerm(reverse, term));
	style.textContent += `
#${select(ElementID.HIGHLIGHT_TOGGLE)}:checked ~ body .${select(ElementClass.TERM_ANY)}.${select(ElementClass.TERM, term.getSelector())} {
background-color: hsla(${hue}, 100%, 60%, 0.4); }
#${select(ElementID.MARKER_GUTTER)} .${select(ElementClass.TERM, term.getSelector())} {
background-color: hsl(${hue}, 100%, 50%); }
.${select(ElementClass.TERM, term.getSelector())} > .${select(ElementClass.CONTROL_BUTTON)} {
background-color: hsl(${hue}, 50%, 60%); }
.${select(ElementClass.TERM, term.getSelector())} > .${select(ElementClass.CONTROL_BUTTON)}:hover {
background-color: hsl(${hue}, 60%, 40%) !important; }
.${select(ElementClass.CONTROL_BUTTON, idx)} > .${select(ElementClass.TERM, term.getSelector())}
> .${select(ElementClass.CONTROL_BUTTON)} {
background-color: hsl(${hue}, 100%, 80%); }
	`;
	const controlButton = document.createElement("button");
	controlButton.classList.add(select(ElementClass.CONTROL_BUTTON));
	//if (focus.getElementCount(termToPredicate(term)) === 0) {
	//	button.disabled = true;
	//}
	//controlButton.title = focus.getElementCount(termToPredicate(term)).toString() + " [TODO: update tooltip]";
	controlButton.textContent = term.exp;
	controlButton.onclick = () => jumpToTerm(false, term);
	const menu = document.createElement("menu");
	menu.classList.add(select(ElementClass.OPTION_LIST));
	menu.appendChild(createTermOption(terms, term, "Case Sensitive"));
	menu.appendChild(createTermOption(terms, term, "Exact"));
	menu.appendChild(createTermOption(terms, term, "Whole Word"));
	menu.appendChild(createTermOption(terms, term, "Regex"));
	const expand = document.createElement("button");
	expand.classList.add(select(ElementClass.CONTROL_EXPAND));
	expand.tabIndex = -1;
	expand.textContent = "⁝";
	expand.appendChild(menu);
	const div = document.createElement("div");
	div.classList.add(select(ElementClass.CONTROL));
	div.classList.add(select(ElementClass.TERM, term.getSelector()));
	div.appendChild(expand);
	div.appendChild(controlButton);
	return div;
};

const addControls = (jumpToTerms: TermJumpFunctions, terms: MatchTerms) => {
	let style = document.getElementById(select(ElementID.STYLE)) as HTMLStyleElement;
	if (!style) {
		style = style ? style : document.createElement("style");
		style.id = select(ElementID.STYLE);
		document.head.appendChild(style);
	}
	style.textContent = STYLE_CONSTANT + STYLE_MAIN;
	const bar = document.createElement("div");
	bar.id = select(ElementID.BAR);
	for (let i = 0; i < terms.length; i++) {
		bar.appendChild(createTermControl(jumpToTerms, terms, style, i, TERM_HUES[i % TERM_HUES.length]));
	}
	const highlightToggle = document.createElement("input");
	highlightToggle.id = select(ElementID.HIGHLIGHT_TOGGLE);
	highlightToggle.tabIndex = -1; // Checkbox cannot be toggled via keyboard for unknown reason.
	highlightToggle.type = "checkbox";
	highlightToggle.checked = true;
	document.body.insertAdjacentElement("beforebegin", bar);
	document.body.insertAdjacentElement("beforebegin", highlightToggle);
	const gutter = document.createElement("div");
	gutter.id = select(ElementID.MARKER_GUTTER);
	document.body.insertAdjacentElement("afterend", gutter);
};

const removeControls = () => {
	const style = document.getElementById(select(ElementID.STYLE));
	if (!style || style.textContent === STYLE_CONSTANT) return;
	document.getElementById(select(ElementID.BAR)).remove();
	document.getElementById(select(ElementID.HIGHLIGHT_TOGGLE)).remove();
	document.getElementById(select(ElementID.MARKER_GUTTER)).remove();
	document.getElementById(select(ElementID.STYLE)).textContent = STYLE_CONSTANT;
};

/*const highlightInNodes = (focus: ElementSelect, nodes: Array<Node>, pattern: RegExp) => {
	...
	const buttons = Array.from(document.getElementsByClassName(getSelector(ElementClass.CONTROL_BUTTON)));
	terms.forEach(term => {
		const pattern = new Regexp(termsToPattern([term]));
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

const addScrollMarkers = (terms: MatchTerms) => {
	const gutter = document.getElementById(select(ElementID.MARKER_GUTTER));
	const containerPairs: Array<[Element, HTMLElement]> = [[document.scrollingElement, gutter]];
	terms.forEach(term =>
		Array.from(document.body.getElementsByClassName(select(ElementClass.TERM, term.getSelector()))).forEach((highlight: Element) => {
			if (!("offsetTop" in highlight)) return;
			const scrollContainer = getScrollContainer(highlight as HTMLElement);
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
			marker.classList.add(select(ElementClass.TERM, term.getSelector()));
			marker.style.top = String(getOffset(highlight as HTMLElement, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
			block.appendChild(marker);
		})
	);
};

const highlightInNode = (textEnd: Node, start: number, end: number, term: string) => {
	start = Math.max(0, start);
	end = Math.min(textEnd.textContent.length, end);
	const textStart = document.createTextNode(textEnd.textContent.slice(0, start));
	const highlight = document.createElement("mark");
	highlight.classList.add(select(ElementClass.TERM_ANY));
	highlight.classList.add(select(ElementClass.TERM, term));
	highlight.textContent = textEnd.textContent.slice(start, end);
	textEnd.textContent = textEnd.textContent.slice(end);
	textEnd.parentNode.insertBefore(textStart, textEnd);
	textEnd.parentNode.insertBefore(highlight, textEnd);
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

const highlightInNodesOnMutation = (patternPtr: PatternPtr) =>
	new MutationObserver(mutations => mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
		canHighlightNode(node) ? highlightInNodes(node, patternPtr.pattern) : undefined
	))).observe(document.body, {childList: true, subtree: true})
;

const selectTermOnCommand = (jumpToTerms: TermJumpFunctions, selectTermPtr: SelectTermPtr) => {
	let selectModeFocus = false;
	let focusedIdx = 0;
	selectTermPtr.selectTerm = (command: string) => {
		const parts = command.split("-");
		const getFocusedIdx = (idx: number) => Math.min(jumpToTerms.length - 1, idx);
		focusedIdx = getFocusedIdx(focusedIdx);
		if (parts[0] === "toggle") {
			switch (parts[1]) {
			case "bar": {
				const bar = document.getElementById(select(ElementID.BAR));
				const operation = bar.classList.contains(select(ElementClass.BAR_HIDDEN)) ? "remove" : "add";
				bar.classList[operation](select(ElementClass.BAR_HIDDEN));
				break;
			}
			case "highlight": {
				const highlightToggle = document.getElementById(select(ElementID.HIGHLIGHT_TOGGLE)) as HTMLInputElement;
				highlightToggle.checked = !highlightToggle.checked;
				break;
			}
			case "select": {
				selectModeFocus = !selectModeFocus;
				break;
			}}
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
			focusedIdx = getFocusedIdx(Number(parts[2]));
			bar.classList.add(select(ElementClass.CONTROL_BUTTON, focusedIdx));
			if (!selectModeFocus) {
				jumpToTerms[focusedIdx](parts[3] === "reverse");
			}
		}
	};
};

// TODO: term/matching editing
// TODO: configuration

const activate = (terms: MatchTerms, enabled: boolean, selectTermPtr: SelectTermPtr, patternPtr: PatternPtr) => {
	removeControls();
	if (!enabled) return;
	if (!terms.length) {
		// TODO: restore page to original state first (e.g. when deactivating), communicate changes to background script
		terms = getSelection().toString().toLocaleLowerCase().replace(/\.|,/g, "").split(" ").filter(term => term !== "")
			.map(term => new MatchTerm(term));
		if (!terms.length) return;
	}
	const jumpToTerms: TermJumpFunctions = [];
	addControls(jumpToTerms, terms);
	selectTermOnCommand(jumpToTerms, selectTermPtr);
	console.log(terms);
	patternPtr.pattern = termsToPattern(terms);
	console.log(patternPtr.pattern);
	highlightInNodes(document.body, patternPtr.pattern);
	highlightInNodesOnMutation(patternPtr);
	setTimeout(() => addScrollMarkers(terms), 1000); // TODO: make dynamic
};

const actOnMessage = () => {
	const terms: MatchTerms = [];
	const selectTermPtr = new SelectTermPtr;
	const patternPtr = new PatternPtr;
	browser.runtime.onMessage.addListener((message: Message) => {
		console.log(message);
		if (message.terms) {
			terms.splice(0, terms.length);
			message.terms.forEach(term =>
				terms.push(Object.assign(new MatchTerm(""), term)));
			activate(terms, message.enabled, selectTermPtr, patternPtr); 
		} else if (message.command) {
			selectTermPtr.selectTerm(message.command);
		}
	});
};

actOnMessage();
