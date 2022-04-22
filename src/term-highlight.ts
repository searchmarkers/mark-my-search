type TermJumpFunctions = Array<(reverse: boolean) => void>;
type ControlUpdateFunctions = Array<() => void>;

enum ElementClass {
	BAR_HIDDEN = "bar-hidden",
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

const select = (element: ElementID | ElementClass, param?: string | number) =>
	["markmysearch", element, param].join("-").slice(0, param ? undefined : -1)
;

const Z_INDEX_MAX = 2147483647;

const STYLE_CONSTANT = `
.${select(ElementClass.TERM_ANY)} { background-color: unset; color: unset; }
`;

const STYLE_MAIN = `
@keyframes flash { 0% { background-color: hsla(0, 0%, 65%, 0.8); } 100% {}; }
.${select(ElementClass.FOCUS)} { animation-name: flash; animation-duration: 1s; }
#${select(ElementID.BAR)} > div { all: revert; position: relative; display: inline; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)} {
all: revert; position: relative; display: inline; font-weight: bold; height: 19px;
border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active { color: transparent; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover > .${select(ElementClass.OPTION_LIST)},
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active > .${select(ElementClass.OPTION_LIST)} {
all: revert; position: absolute; display: inline; top: 5px; padding-left: inherit; left: -7px; z-index: 1; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)},
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:disabled {
all: revert; display: inline; border-width: 2px; border-block-color: hsl(0, 0%, 20%); border-style: dotted; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:disabled {
background-color: hsla(0, 0%, 80%, 0.6) !important; color: black; }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION_LIST)} { all: revert; display: none; }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)} { all: revert; display: block; translate: 3px;
border-style: none; border-bottom-style: solid; border-bottom-width: 1px; border-color: hsl(0, 0%, 50%); }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active,
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)} { background-color: hsl(0, 0%, 75%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)}:hover { background-color: hsl(0, 0%, 65%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)}:hover:active { background-color: hsl(0, 0%, 50%); }
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

const HIGHLIGHT_TAGS: Record<string, ReadonlySet<string>> = {
	FLOW: new Set(["B", "I", "U", "STRONG", "EM", "BR", "CITE", "SPAN", "MARK", "WBR", "CODE", "DATA", "DFN", "INS"]),
	//SKIP: new Set(["S", "DEL"]), Perhaps too complex.
	REJECT: new Set(["META", "STYLE", "SCRIPT", "NOSCRIPT"]),
};

const jumpToTerm = (() => {
	const getTermOccurrenceBlock = (element: Element) =>
		HIGHLIGHT_TAGS.FLOW.has(element.tagName) ? getTermOccurrenceBlock(element.parentElement) : element
	;

	const getLastDescendant = (element: Element) =>
		element.lastElementChild ? getLastDescendant(element.lastElementChild) : element
	;

	const isVisible = (element: HTMLElement) =>
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& getComputedStyle(element).visibility !== "hidden"
	;

	return (reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? select(ElementClass.TERM, term.selector) : select(ElementClass.TERM_ANY);
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
			element.classList.contains(termSelector) && isVisible(element)
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
		element.focus({ preventScroll: true });
		element.scrollIntoView({ behavior: "smooth", block: "center" });
		selection.setBaseAndExtent(element, 0, element, 0);
	};
})();

const addControls = (() => {
	const createTermOption = (terms: MatchTerms, term: MatchTerm, title: string) => {
		const onActivated = () => {
			const matchMode = "matches" + (title.includes(" ") ? title.slice(0, title.indexOf(" ")) : title);
			term[matchMode] = !term[matchMode];
			term.compile();
			browser.runtime.sendMessage({ terms, makeUnique: false } as BackgroundMessage);
		};
		const option = document.createElement("button");
		option.classList.add(select(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = title;
		option.onclick = onActivated;
		return option;
	};

	const createTermControl = (jumpToTerms: TermJumpFunctions, updateTermControls: ControlUpdateFunctions,
		terms: MatchTerms, style: HTMLStyleElement, idx: number, hue: number, shortcut: string, shortcutReverse: string) => {
		const term = terms[idx];
		jumpToTerms.push((reverse: boolean) => jumpToTerm(reverse, term));
		style.textContent += `
#${select(ElementID.HIGHLIGHT_TOGGLE)}:checked ~ body .${select(ElementClass.TERM_ANY)}.${select(ElementClass.TERM, term.selector)} {
background-color: hsla(${hue}, 100%, 60%, 0.4); }
#${select(ElementID.MARKER_GUTTER)} .${select(ElementClass.TERM, term.selector)} {
background-color: hsl(${hue}, 100%, 50%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)} > .${select(ElementClass.CONTROL_BUTTON)} {
background-color: hsl(${hue}, 50%, 60%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)} > .${select(ElementClass.CONTROL_BUTTON)}:hover {
background-color: hsl(${hue}, 60%, 40%); }
#${select(ElementID.BAR)}.${select(ElementClass.CONTROL_BUTTON, idx)}
> .${select(ElementClass.TERM, term.selector)} > .${select(ElementClass.CONTROL_BUTTON)} {
background-color: hsl(${hue}, 100%, 80%); }
		`;
		const controlButton = document.createElement("button");
		controlButton.classList.add(select(ElementClass.CONTROL_BUTTON));
		controlButton.textContent = term.phrase;
		controlButton.onclick = () => jumpToTerm(false, term);
		updateTermControls.push(() => {
			const occurrenceCount = document.getElementsByClassName(
				select(ElementClass.TERM_ANY) + " " + select(ElementClass.TERM, term.selector)).length;
			controlButton.disabled = occurrenceCount === 0;
			controlButton.title =
				`${occurrenceCount.toString()} matches found\nJump to next: ${shortcut}\nJump to previous: ${shortcutReverse}`;
		});
		const menu = document.createElement("menu");
		menu.classList.add(select(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, term, "Case Match"));
		menu.appendChild(createTermOption(terms, term, "Stem Word"));
		menu.appendChild(createTermOption(terms, term, "Whole Word"));
		const expand = document.createElement("button");
		expand.classList.add(select(ElementClass.CONTROL_EXPAND));
		expand.tabIndex = -1;
		expand.textContent = "⁝";
		expand.appendChild(menu);
		const div = document.createElement("div");
		div.classList.add(select(ElementClass.TERM, term.selector));
		div.appendChild(expand);
		div.appendChild(controlButton);
		return div;
	};

	return (jumpToTerms: TermJumpFunctions, updateTermControls: ControlUpdateFunctions,
		commands: Array<browser.commands.Command>, terms: MatchTerms) => {
		let style = document.getElementById(select(ElementID.STYLE)) as HTMLStyleElement;
		if (!style) {
			style = style ? style : document.createElement("style");
			style.id = select(ElementID.STYLE);
			document.head.appendChild(style);
		}
		style.textContent = STYLE_CONSTANT + STYLE_MAIN;
		const bar = document.createElement("div");
		bar.id = select(ElementID.BAR);
		const commandsDetail = commands.map(command =>
			({ info: parseCommand(command.name), shortcut: command.shortcut })).filter(commandDetail =>
			commandDetail.info.type === CommandType.SELECT_TERM);
		const termCommands = commandsDetail.filter(
			commandDetail => !commandDetail.info.reversed).map(commandDetail => commandDetail.shortcut);
		const termCommandsReverse = commandsDetail.filter(
			commandDetail => commandDetail.info.reversed).map(commandDetail => commandDetail.shortcut);
		terms.forEach((term, i) =>
			bar.appendChild(createTermControl(jumpToTerms, updateTermControls, terms, style,
				i, TERM_HUES[i % TERM_HUES.length], termCommands[i], termCommandsReverse[i])));
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
})();

const removeControls = () => {
	const style = document.getElementById(select(ElementID.STYLE));
	if (!style || style.textContent === STYLE_CONSTANT) return;
	document.getElementById(select(ElementID.BAR)).remove();
	document.getElementById(select(ElementID.HIGHLIGHT_TOGGLE)).remove();
	document.getElementById(select(ElementID.MARKER_GUTTER)).remove();
	document.getElementById(select(ElementID.STYLE)).textContent = STYLE_CONSTANT;
};

const addScrollMarkers = (() => {
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

	return (terms: MatchTerms) => {
		const gutter = document.getElementById(select(ElementID.MARKER_GUTTER));
		const containerPairs: Array<[Element, HTMLElement]> = [[document.scrollingElement, gutter]];
		terms.forEach(term =>
			Array.from(document.body.getElementsByClassName(select(ElementClass.TERM, term.selector))).forEach((highlight: Element) => {
				if (!("offsetTop" in highlight))
					return;
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
				marker.classList.add(select(ElementClass.TERM, term.selector));
				marker.style.top = String(getOffset(highlight as HTMLElement, scrollContainer) / scrollContainer.scrollHeight * 100) + "%";
				block.appendChild(marker);
			})
		);
	};
})();

const highlightInNodes = (() => {
	class UnbrokenNodeListItem {
		next: UnbrokenNodeListItem;
		value: Node;

		constructor(value: Node) {
			this.value = value;
		}
	}

	class UnbrokenNodeList {
		first: UnbrokenNodeListItem;
		last: UnbrokenNodeListItem;
	
		push(value: Node) {
			if (this.last) {
				this.last.next = new UnbrokenNodeListItem(value);
				this.last = this.last.next;
			} else {
				this.first = new UnbrokenNodeListItem(value);
				this.last = this.first;
			}
		}
	
		insertAfter(value: Node, itemBefore: UnbrokenNodeListItem) {
			if (itemBefore) {
				const itemAfter = itemBefore.next;
				itemBefore.next = new UnbrokenNodeListItem(value);
				itemBefore.next.next = itemAfter;
			} else {
				const itemAfter = this.first;
				this.first = new UnbrokenNodeListItem(value);
				this.first.next = itemAfter;
			}
		}
	
		getText() {
			let text = "";
			let current = this.first;
			while (current) {
				text += current.value.textContent;
				current = current.next;
			}
			return text;
		}
	
		clear() {
			this.first = undefined;
			this.last = undefined; 
		}
	}

	const highlightInNode = (wordRightPattern: RegExp, term: MatchTerm, textEndNode: Node, start: number, end: number) => {
		const text = textEndNode.textContent;
		start = Math.max(0, start);
		end = Math.min(text.length, end);
		if (term.matchesStem && end !== text.length) {
			end += text.substring(end - 1).search(wordRightPattern);
		}
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mark");
		highlight.classList.add(select(ElementClass.TERM_ANY));
		highlight.classList.add(select(ElementClass.TERM, term.selector));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		textEndNode.parentNode.insertBefore(highlight, textEndNode);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			textEndNode.parentNode.insertBefore(textStartNode, highlight);
			return textStartNode;
		}
	};

	const highlightAtBreakLevel = (wordRightPattern: RegExp, unbrokenNodes: UnbrokenNodeList, terms: MatchTerms) => {
		if (unbrokenNodes.first) {
			for (const term of terms) {
				const textFlow = unbrokenNodes.getText();
				const matches = Array.from(textFlow.matchAll(term.pattern));
				let matchIdx = 0;
				let currentNodeStart = 0;
				let nodeItemPrevious: UnbrokenNodeListItem;
				let nodeItem = unbrokenNodes.first;
				while (nodeItem) {
					const nextNodeStart = currentNodeStart + nodeItem.value.textContent.length;
					for (; matchIdx < matches.length; matchIdx++) {
						const match = matches[matchIdx];
						if (match.index >= nextNodeStart)
							break;
						if (match.index + match[0].length < currentNodeStart || (term.matchesWhole && term.matchesStem
							&& !term.matchWholeStem(textFlow, match.index)))
							continue;
						const textLengthOriginal = nodeItem.value.textContent.length;
						const newTextNode = highlightInNode(wordRightPattern, term,
							nodeItem.value, match.index - currentNodeStart, match.index - currentNodeStart + match[0].length);
						if (newTextNode) {
							unbrokenNodes.insertAfter(newTextNode, nodeItemPrevious);
						}
						currentNodeStart += textLengthOriginal - nodeItem.value.textContent.length;
						// TODO: check page restoration can cope with nested highlights / other elements
						if (match.index + match[0].length > nextNodeStart)
							break;
					}
					currentNodeStart = nextNodeStart;
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next;
				}
			}
		}
		unbrokenNodes.clear();
	};

	const canHighlightInNextSiblings = (node: Node): boolean => node.nodeType === Node.TEXT_NODE ||
		(node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.has(node["tagName"])
		&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(select(ElementClass.TERM_ANY))))
			|| (node.nextSibling && canHighlightInNextSiblings(node.nextSibling))
	; // TODO: find better alternative to hack

	return (rootNode: Node, terms: MatchTerms) => {
		const wordRightPattern = /[^^]\b/;
		const unbrokenNodes: UnbrokenNodeList = new UnbrokenNodeList();
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
			if (node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.has(node["tagName"])
				&& (node.nodeType !== Node.ELEMENT_NODE || !node["classList"].contains(select(ElementClass.TERM_ANY)))) {
				if (!HIGHLIGHT_TAGS.FLOW.has(node["tagName"])) {
					if (node.hasChildNodes()) breakLevels.push(level);
					highlightAtBreakLevel(wordRightPattern, unbrokenNodes, terms);
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
						highlightAtBreakLevel(wordRightPattern, unbrokenNodes, terms);
					}
					if (level === 0) return;
				}
				node = walk.nextSibling();
			}
		}
	};
})();

const purgeClass = (className: string) =>
	Array.from(document.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

const restoreNodes = () => {
	Array.from(document.getElementsByClassName(select(ElementClass.TERM_ANY))).forEach(element => {
		const textNode = document.createTextNode(element.textContent);
		element.parentNode.insertBefore(textNode, element); // TODO: merge nodes?
		element.remove();
	});
	purgeClass(select(ElementClass.FOCUS));
	purgeClass(select(ElementClass.FOCUS_REVERT));
};

const getObserverNodeHighlighter = (() => {
	const canHighlightNode = (node: Node): boolean =>
		!node || (node.nodeType !== Node.ELEMENT_NODE
			|| (!HIGHLIGHT_TAGS.REJECT.has(node["tagName"]) && !node["classList"].contains(select(ElementClass.TERM_ANY)))
		&& canHighlightNode(node.parentElement))
	;

	return (terms: MatchTerms, updateAllControls: () => void) =>
		new MutationObserver(mutations => {
			mutations.forEach(mutation => mutation.addedNodes.forEach(node =>
				node.nodeType === Node.ELEMENT_NODE && canHighlightNode(node) ? highlightInNodes(node, terms) : undefined));
			updateAllControls();
		})
	; // TODO: investigate observer inefficiency
})();

const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {childList: true, subtree: true})
;

enum CommandType {
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHT,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
}

const parseCommand = (commandString: string): { type: CommandType, termIdx?: number, reversed?: boolean } => {
	const parts = commandString.split("-");
	return parts[0] === "toggle"
		? parts[1] === "bar"
			? { type: CommandType.TOGGLE_BAR }
			: parts[1] === "highlight"
				? { type: CommandType.TOGGLE_HIGHLIGHT }
				: parts[1] === "select"
					? { type: CommandType.TOGGLE_SELECT } : undefined
		: parts[0] === "advance" && parts[1] === "global"
			? { type: CommandType.ADVANCE_GLOBAL, reversed: parts[2] === "reverse" }
			: parts[0] === "select" && parts[1] === "term"
				? { type: CommandType.SELECT_TERM, termIdx: Number(parts[2]), reversed: parts[3] === "reverse" } : undefined;
};

const selectTermOnCommand = (jumpToTerms: TermJumpFunctions, selectTermPtr: SelectTermPtr) => {
	let selectModeFocus = false;
	let focusedIdx = 0;
	selectTermPtr.selectTerm = (commandString: string) => {
		const getFocusedIdx = (idx: number) => Math.min(jumpToTerms.length - 1, idx);
		focusedIdx = getFocusedIdx(focusedIdx);
		const commandInfo = parseCommand(commandString);
		switch (commandInfo.type) {
		case CommandType.TOGGLE_BAR: {
			const bar = document.getElementById(select(ElementID.BAR));
			bar.classList[bar.classList.contains(select(ElementClass.BAR_HIDDEN))
				? "remove" : "add"](select(ElementClass.BAR_HIDDEN));
			break;
		} case CommandType.TOGGLE_HIGHLIGHT: {
			const highlightToggle = document.getElementById(select(ElementID.HIGHLIGHT_TOGGLE)) as HTMLInputElement;
			highlightToggle.checked = !highlightToggle.checked;
			break;
		} case CommandType.TOGGLE_SELECT: {
			selectModeFocus = !selectModeFocus;
			break;
		} case CommandType.ADVANCE_GLOBAL: {
			if (selectModeFocus)
				jumpToTerms[focusedIdx](commandInfo.reversed);
			else
				jumpToTerm(commandInfo.reversed);
			break;
		} case CommandType.SELECT_TERM: {
			const bar = document.getElementById(select(ElementID.BAR));
			bar.classList.remove(select(ElementClass.CONTROL_BUTTON, focusedIdx));
			focusedIdx = getFocusedIdx(commandInfo.termIdx);
			bar.classList.add(select(ElementClass.CONTROL_BUTTON, focusedIdx));
			if (!selectModeFocus)
				jumpToTerms[focusedIdx](commandInfo.reversed);
			break;
		}}
	};
};

// TODO: configuration

const activate = (commands: Array<browser.commands.Command>,
	terms: MatchTerms, disable: boolean, selectTermPtr: SelectTermPtr,
	updateTermControls: ControlUpdateFunctions, updateAllControls: () => void, observer: MutationObserver) => {
	observer.disconnect();
	removeControls();
	restoreNodes();
	if (disable) return;
	if (!terms.length) {
		terms = getSelection().toString().replace(/\.|,/g, "").split(" ").filter(phrase => phrase !== "")
			.map(phrase => new MatchTerm(phrase));
		getSelection().collapseToStart();
		browser.runtime.sendMessage({ terms: terms, makeUnique: true } as BackgroundMessage);
		return;
	}
	const jumpToTerms: TermJumpFunctions = [];
	addControls(jumpToTerms, updateTermControls, commands, terms);
	selectTermOnCommand(jumpToTerms, selectTermPtr);
	highlightInNodes(document.body, terms);
	highlightInNodesOnMutation(observer);
	updateAllControls();
	addScrollMarkers(terms); // TODO: make dynamic
};

const actOnMessage = () => {
	let commands: Array<browser.commands.Command>;
	const selectTermPtr = new SelectTermPtr;
	const updateTermControls: ControlUpdateFunctions = [];
	const terms: MatchTerms = [];
	const updateAllControls = () => updateTermControls.forEach(updateTermControl => updateTermControl());
	const observer = getObserverNodeHighlighter(terms, updateAllControls);
	browser.runtime.onMessage.addListener((message: HighlightMessage) => {
		if (message.terms) {
			if (message.commands)
				commands = message.commands;
			terms.splice(0, terms.length);
			message.terms.forEach(term => terms.push(Object.assign(new MatchTerm(""), term)));
			updateTermControls.splice(0, updateTermControls.length);
			activate(commands, terms, message.disable, selectTermPtr, updateTermControls, updateAllControls, observer); 
		} else if (message.command) {
			selectTermPtr.selectTerm(message.command);
		}
	});
};

actOnMessage();
