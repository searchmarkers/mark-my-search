type BrowserCommands = Array<browser.commands.Command>;
type FunctionCallControlsRefresh = (termsUpdate: MatchTerms, termUpdate: MatchTerm, termToUpdateIdx: number) => void;

enum ElementClass {
	BAR_HIDDEN = "bar-hidden",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM_ANY = "any",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	MARKER_BLOCK = "marker-block",
	DISABLED = "disabled",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	HIGHLIGHT_TOGGLE = "highlight-toggle",
	MARKER_GUTTER = "markers",
}

enum CommandType {
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHT,
	TOGGLE_SELECT,
	ADVANCE_GLOBAL,
	SELECT_TERM,
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface SelectTermPtr {
	selectTerm: (command: string) => void
}

const select = (element: ElementID | ElementClass, param?: string | number) =>
	["markmysearch", element, param].join("-").slice(0, param ? undefined : -1)
;

const TERM_HUES: ReadonlyArray<number> = [60, 300, 110, 220, 0, 190, 30];

const HIGHLIGHT_TAGS: Record<string, ReadonlySet<string>> = {
	FLOW: new Set(["B", "I", "U", "STRONG", "EM", "BR", "CITE", "SPAN", "MARK", "WBR", "CODE", "DATA", "DFN", "INS"]),
	//SKIP: new Set(["S", "DEL"]), Perhaps too complex.
	REJECT: new Set(["META", "STYLE", "SCRIPT", "NOSCRIPT"]),
};

const jumpToTerm = (() => {
	const getTermOccurrenceBlock = (element: HTMLElement): HTMLElement =>
		HIGHLIGHT_TAGS.FLOW.has(element.tagName) ? getTermOccurrenceBlock(element.parentElement) : element
	;

	const isVisible = (element: HTMLElement) =>
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& window.getComputedStyle(element).visibility !== "hidden"
	;

	return (reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? select(ElementClass.TERM, term.selector) : select(ElementClass.TERM_ANY);
		const focusBase = document.getElementsByClassName(select(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.getElementsByClassName(select(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		if (focusBase) {
			focusContainer.classList.remove(select(ElementClass.FOCUS_CONTAINER));
			focusBase.classList.remove(select(ElementClass.FOCUS));
			if (focusContainer.classList.contains(select(ElementClass.FOCUS_REVERT))) {
				focusContainer.tabIndex = -1;
				focusContainer.classList.remove(select(ElementClass.FOCUS_REVERT));
			}
			if (focusBase.classList.contains(select(ElementClass.FOCUS_REVERT))) {
				focusBase.tabIndex = -1;
				focusBase.classList.remove(select(ElementClass.FOCUS_REVERT));
			}
		}
		const selection = document.getSelection();
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.classList.contains(termSelector) && isVisible(element) && getTermOccurrenceBlock(element) !== focusContainer
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		const anchor = selection.anchorNode;
		walk.currentNode = anchor
			? anchor
			: document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let element = walk[nextNodeMethod]() as HTMLElement;
		if (!element) {
			walk.currentNode = reverse ? document.body.lastElementChild : document.body;
			element = walk[nextNodeMethod]() as HTMLElement;
			if (!element) return;
		}
		const container = getTermOccurrenceBlock(element);
		container.classList.add(select(ElementClass.FOCUS_CONTAINER));
		element.classList.add(select(ElementClass.FOCUS));
		const elementToSelect = Array.from(container.getElementsByClassName(select(ElementClass.TERM_ANY)))
			.every(thisElement => getTermOccurrenceBlock(thisElement as HTMLElement) === container)
			? container
			: element;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(select(ElementClass.FOCUS_REVERT));
			elementToSelect.tabIndex = 0;
		}
		elementToSelect.focus({ preventScroll: true });
		elementToSelect.scrollIntoView({ behavior: "smooth", block: "center" });
		selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
	};
})();

const createTermInput = (terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
	termButton: HTMLButtonElement, idx: number) => {
	const term = terms[idx];
	const replaces = idx !== TermChange.CREATE;
	const termInput = document.createElement("input");
	termInput.type = "text";
	termInput.disabled = true;
	termButton.appendChild(termInput);
	const show = (event: MouseEvent) => {
		event.preventDefault();
		termInput.value = replaces ? termButton.textContent : "";
		termButton.disabled = true;
		termInput.disabled = false;
		termInput.select();
	};
	const hide = () => {
		termInput.disabled = true;
		termButton.disabled = false;
	};
	const hideAndCommit = () => {
		hide();
		let message: BackgroundMessage;
		if (replaces) {
			if (termInput.value === "") {
				terms.splice(idx, 1);
				message = {
					terms,
					termChanged: term,
					termChangedIdx: TermChange.REMOVE,
				};
			} else if (termInput.value !== term.phrase) {
				term.phrase = termInput.value;
				term.compile();
				message = {
					terms,
					termChanged: term,
					termChangedIdx: idx,
				};
			}
		} else if (termInput.value !== "") {
			terms.push(new MatchTerm(termInput.value));
			message = {
				terms,
				termChanged: terms.at(-1),
				termChangedIdx: TermChange.CREATE,
			};
		}
		if (message) {
			callRefreshTermControls(message.terms, message.termChanged, message.termChangedIdx);
			browser.runtime.sendMessage(message);
		}
	};
	termButton.oncontextmenu = show;
	if (!replaces)
		termButton.onclick = show;
	termInput.onblur = hideAndCommit;
	termInput.onkeydown = event => event.key === "Enter" ? hideAndCommit() : event.key === "Escape" ? hide() : undefined;
};

const insertStyle = (terms: MatchTerms, style: HTMLStyleElement, styleConstant: string, hues: ReadonlyArray<number>) => {
	const zIndexMax = 2147483647;
	style.textContent = styleConstant + `
@keyframes flash { 0% { background-color: hsla(0, 0%, 65%, 0.8); } 100% {}; }
.${select(ElementClass.FOCUS_CONTAINER)} { animation-name: flash; animation-duration: 1s; }
#${select(ElementID.BAR)} > div { all: revert; position: relative; display: inline-block; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)} {
all: revert; position: relative; font-weight: bold; height: 19px;
border: none; margin-left: 3px; width: 15px; background-color: transparent; color: white; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active { color: transparent; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover > .${select(ElementClass.OPTION_LIST)},
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active > .${select(ElementClass.OPTION_LIST)} {
all: revert; position: absolute; top: 5px; padding-left: inherit; left: -7px; z-index: 1; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)},
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}:disabled,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}.${select(ElementClass.DISABLED)} {
all: revert; border-width: 2px; border-block-color: hsl(0, 0%, 20%); border-style: dotted; border-radius: 4px; color: black; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)}.${select(ElementClass.DISABLED)} {
background-color: hsla(0, 0%, 80%, 0.6) !important; color: black; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)} > input,
#${select(ElementID.BAR)} > button > input {
all: revert; padding-block: 0; margin-left: 6px; border: 0; width: 100px; }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_BUTTON)} > input:disabled,
#${select(ElementID.BAR)} > button > input:disabled { display: none; }
#${select(ElementID.BAR)} > button { all: revert; border: 0; border-radius: 4px; margin-left: 4px; background-color: hsl(0, 0%, 80%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION_LIST)} { all: revert; display: none; }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)} { all: revert; display: block; translate: 3px;
border-style: none; border-bottom-style: solid; border-bottom-width: 1px; border-color: hsl(0, 0%, 50%); }
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:hover,
#${select(ElementID.BAR)} .${select(ElementClass.CONTROL_EXPAND)}:active,
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)} { background-color: hsl(0, 0%, 75%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)}:hover,
#${select(ElementID.BAR)} > button:hover { background-color: hsl(0, 0%, 65%); }
#${select(ElementID.BAR)} .${select(ElementClass.OPTION)}:hover:active,
#${select(ElementID.BAR)} > button:active { background-color: hsl(0, 0%, 50%); }
#${select(ElementID.BAR)} { all: revert; position: fixed; left: 20px; z-index: ${zIndexMax}; color-scheme: light;
line-height: initial; font-size: 0; display: none; }
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_HIDDEN)}) { display: inline; }
#${select(ElementID.HIGHLIGHT_TOGGLE)} { all: revert; position: fixed; z-index: ${zIndexMax}; display: none; }
#${select(ElementID.BAR)}:not(.${select(ElementClass.BAR_HIDDEN)}) + #${select(ElementID.HIGHLIGHT_TOGGLE)} {
display: inline; }
#${select(ElementID.HIGHLIGHT_TOGGLE)}:checked ~ #${select(ElementID.MARKER_GUTTER)} { display: block; }
#${select(ElementID.MARKER_GUTTER)} { display: none; z-index: ${zIndexMax};
right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${select(ElementID.MARKER_GUTTER)} div:not(.${select(ElementClass.MARKER_BLOCK)}) {
width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${select(ElementID.MARKER_GUTTER)}, .${select(ElementClass.MARKER_BLOCK)} {
position: fixed; background-color: hsla(0, 0%, 0%, 0.5); }
.${select(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }
	`;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		style.textContent += `
#${select(ElementID.HIGHLIGHT_TOGGLE)}:checked
~ body .${select(ElementClass.TERM_ANY)}.${select(ElementClass.TERM, term.selector)} {
background-color: hsla(${hue}, 100%, 60%, 0.4); }
#${select(ElementID.MARKER_GUTTER)} .${select(ElementClass.TERM, term.selector)} {
background-color: hsl(${hue}, 100%, 50%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
> .${select(ElementClass.CONTROL_BUTTON)} { background-color: hsl(${hue}, 50%, 60%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
> .${select(ElementClass.CONTROL_BUTTON)}:hover { background-color: hsl(${hue}, 70%, 70%); }
#${select(ElementID.BAR)} > .${select(ElementClass.TERM, term.selector)}
> .${select(ElementClass.CONTROL_BUTTON)}:active { background-color: hsl(${hue}, 70%, 50%); }
#${select(ElementID.BAR)}.${select(ElementClass.CONTROL_BUTTON, i)}
> .${select(ElementClass.TERM, term.selector)} > .${select(ElementClass.CONTROL_BUTTON)} {
background-color: hsl(${hue}, 100%, 85%); }
		`;
	});
};

const getTermControl = (term: MatchTerm, idx?: number) => {
	const bar = document.getElementById(select(ElementID.BAR));
	return idx === undefined
		? bar.getElementsByClassName(select(ElementClass.TERM, term.selector))[0] as HTMLDivElement
		: bar.children[idx] as HTMLDivElement;
};

const updateTermTooltip = (term: MatchTerm) => {
	const controlButton = getTermControl(term)
		.getElementsByClassName(select(ElementClass.CONTROL_BUTTON))[0] as HTMLButtonElement;
	const occurrenceCount = document.getElementsByClassName(
		select(ElementClass.TERM_ANY) + " " + select(ElementClass.TERM, term.selector)).length;
	controlButton.classList[occurrenceCount === 0 ? "add" : "remove"](select(ElementClass.DISABLED));
	controlButton.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !term.command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${term.command}, ${term.commandReverse}`
				: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`}`;
};

const getTermOptionMatchType = (text: string, fromText = false) =>
	(fromText
		? text.substring(0, text.indexOf("\u00A0"))
		: text.slice(0, text.indexOf("\u00A0"))).toLocaleLowerCase()
;

const getTermOptionText = (term: MatchTerm, title: string, matchType: string) =>
	term.matchMode[matchType]
		? title.includes("✅") ? title : `${title}\u00A0✅`
		: title.includes("✅") ? title.slice(0, -2) : title
;

const refreshTermControl = (term: MatchTerm, idx: number) => {
	const control = getTermControl(undefined, idx);
	control.className = "";
	control.classList.add(select(ElementClass.TERM, term.selector));
	(control.getElementsByClassName(select(ElementClass.CONTROL_BUTTON))[0] as HTMLButtonElement)
		.firstChild.textContent = term.phrase;
	Array.from(control.getElementsByClassName(select(ElementClass.OPTION))).forEach((option) =>
		option.textContent = getTermOptionText(term, option.textContent,
			getTermOptionMatchType(option.textContent, true)));
};

const addTermControl = (() => {
	const createTermOption = (terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
		idx: number, title: string) => {
		const matchType = getTermOptionMatchType(title);
		const onActivated = () => {
			const term = terms[idx];
			term.matchMode[matchType] = !term.matchMode[matchType];
			term.compile();
			const message: BackgroundMessage = {
				terms,
				termChanged: term,
				termChangedIdx: idx,
			};
			callRefreshTermControls(message.terms, message.termChanged, message.termChangedIdx);
			browser.runtime.sendMessage(message);
		};
		const option = document.createElement("button");
		option.classList.add(select(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = getTermOptionText(terms[idx], title, matchType);
		option.onclick = onActivated;
		return option;
	};

	return (terms: MatchTerms, callRefreshTermControls: FunctionCallControlsRefresh,
		idx: number, command: string, commandReverse: string, buttonAppend?: HTMLButtonElement) => {
		const term = terms[idx];
		const controlButton = document.createElement("button");
		controlButton.classList.add(select(ElementClass.CONTROL_BUTTON));
		controlButton.classList.add(select(ElementClass.DISABLED));
		controlButton.tabIndex = -1;
		controlButton.textContent = term.phrase;
		controlButton.onclick = () => jumpToTerm(false, term);
		createTermInput(terms, callRefreshTermControls, controlButton, idx);
		term.command = command;
		term.commandReverse = commandReverse;
		const menu = document.createElement("menu");
		menu.classList.add(select(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Case\u00A0Match"));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, callRefreshTermControls, idx, "Whole\u00A0Word"));
		const expand = document.createElement("button");
		expand.classList.add(select(ElementClass.CONTROL_EXPAND));
		expand.tabIndex = -1;
		expand.textContent = "⁝";
		expand.appendChild(menu);
		const control = document.createElement("div");
		control.classList.add(select(ElementClass.TERM, term.selector));
		control.appendChild(expand);
		control.appendChild(controlButton);
		if (!buttonAppend) {
			buttonAppend = (document.getElementById(select(ElementID.BAR)) as HTMLDivElement)
				.lastElementChild as HTMLButtonElement;
		}
		buttonAppend.insertAdjacentElement("beforebegin", control);
	};
})();

const getTermCommands = (commands: BrowserCommands) => {
	const commandsDetail = commands
		.map(command => ({ info: parseCommand(command.name), shortcut: command.shortcut }));
	return {
		down: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

const addControls = (commands: BrowserCommands, terms: MatchTerms,
	callRefreshTermControls: FunctionCallControlsRefresh, style: HTMLStyleElement, styleConstant: string) => {
	insertStyle(terms, style, styleConstant, TERM_HUES);
	const bar = document.createElement("div");
	bar.id = select(ElementID.BAR);
	const buttonAppend = document.createElement("button");
	buttonAppend.textContent = "➕";
	buttonAppend.tabIndex = -1;
	createTermInput(terms, callRefreshTermControls, buttonAppend, TermChange.CREATE);
	bar.appendChild(buttonAppend);
	const termCommands = getTermCommands(commands);
	terms.forEach((term, i) => addTermControl(terms, callRefreshTermControls,
		i, termCommands.down[i], termCommands.up[i], buttonAppend));
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

const removeControls = (styleConstant: string) => {
	const style = document.getElementById(select(ElementID.STYLE));
	if (!style || style.textContent === styleConstant)
		return;
	document.getElementById(select(ElementID.BAR)).remove();
	document.getElementById(select(ElementID.HIGHLIGHT_TOGGLE)).remove();
	document.getElementById(select(ElementID.MARKER_GUTTER)).remove();
	document.getElementById(select(ElementID.STYLE)).textContent = styleConstant;
};

const addScrollMarkers = (() => {
	const getOffset = (element: HTMLElement, elementTop: HTMLElement) =>
		element && element !== elementTop && "offsetTop" in element
			? element.offsetTop + getOffset(element.offsetParent as HTMLElement, elementTop)
			: 0
	;

	const getScrollContainer = (element: HTMLElement): HTMLElement =>
		element.scrollHeight > element.clientHeight
		&& (document.scrollingElement === element
			|| ["scroll", "auto"].indexOf(window.getComputedStyle(element).overflowY) !== -1)
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
					block.style.top = String(
						getOffset(scrollContainer, document.scrollingElement as HTMLElement) / document.scrollingElement.scrollHeight * 100
					) + "%";
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
	interface UnbrokenNodeListItem {
		next?: UnbrokenNodeListItem
		value: Node
	}
	
	class UnbrokenNodeList {
		first: UnbrokenNodeListItem
		last: UnbrokenNodeListItem
	
		push (value: Node) {
			if (this.last) {
				this.last.next = { value };
				this.last = this.last.next;
			} else {
				this.first = { value };
				this.last = this.first;
			}
		}
	
		insertAfter (value: Node, itemBefore: UnbrokenNodeListItem) {
			if (value) {
				if (itemBefore) {
					const itemAfter = itemBefore.next;
					itemBefore.next = { value };
					itemBefore.next.next = itemAfter;
				} else {
					const itemAfter = this.first;
					this.first = { value };
					this.first.next = itemAfter;
				}
			}
		}
	
		getText () {
			let text = "";
			let current = this.first;
			do {
				text += current.value.textContent;
			// eslint-disable-next-line no-cond-assign
			} while (current = current.next);
			return text;
		}
	
		clear () {
			this.first = undefined;
			this.last = undefined; 
		}

		*[Symbol.iterator] () {
			let current = this.first;
			do {
				yield current;
			// eslint-disable-next-line no-cond-assign
			} while (current = current.next);
		}
	}

	const highlightInNode = (wordRightPattern: RegExp, term: MatchTerm, textEndNode: Node, start: number, end: number) => {
		// TODO: add strategy for mitigating damage (caused by programmatic changes by the website).
		const text = textEndNode.textContent;
		start = Math.max(0, start);
		end = Math.min(text.length, end);
		if (term.matchMode.stem && end !== text.length) {
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
				const matches = textFlow.matchAll(term.pattern);
				let currentNodeStart = 0;
				let match: RegExpMatchArray = matches.next().value;
				let nodeItemPrevious: UnbrokenNodeListItem;
				for (const nodeItem of unbrokenNodes) {
					const nextNodeStart = currentNodeStart + nodeItem.value.textContent.length;
					while (match && match.index < nextNodeStart) {
						if ((term.matchMode.whole && term.matchMode.stem && !term.matchWholeStem(textFlow, match.index))
							|| match.index + match[0].length < currentNodeStart)
							continue;
						const textLengthOriginal = nodeItem.value.textContent.length;
						unbrokenNodes.insertAfter(
							highlightInNode(wordRightPattern, term,
								nodeItem.value, match.index - currentNodeStart, match.index - currentNodeStart + match[0].length),
							nodeItemPrevious);
						currentNodeStart += textLengthOriginal - nodeItem.value.textContent.length;
						if (match.index + match[0].length > nextNodeStart)
							break;
						match = matches.next().value;
					}
					currentNodeStart = nextNodeStart;
					nodeItemPrevious = nodeItem;
				}
			}
		}
		unbrokenNodes.clear();
	};

	return (rootNode: Node, terms: MatchTerms) => {
		const wordRightPattern = /[^^]\b/;
		const unbrokenNodes: UnbrokenNodeList = new UnbrokenNodeList;
		const breakLevels: Array<number> = [0];
		let level = 0;
		const walkHandleBreaks = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, {acceptNode: node => {
			switch (node.nodeType) {
			case (1): { // NODE.ELEMENT_NODE
				if (node.nodeType === Node.ELEMENT_NODE && !HIGHLIGHT_TAGS.REJECT.has(node["tagName"])
					&& !node["classList"].contains(select(ElementClass.TERM_ANY))) {
					if (!HIGHLIGHT_TAGS.FLOW.has(node["tagName"])) {
						if (node.hasChildNodes())
							breakLevels.push(level);
						highlightAtBreakLevel(wordRightPattern, unbrokenNodes, terms);
					}
					return 1; // NodeFilter.FILTER_ACCEPT
				}
				return 2; // NodeFilter.FILTER_REJECT
			} case (3): { // Node.TEXT_NODE
				if (level > breakLevels.at(-1))
					unbrokenNodes.push(node);
				return 1; // NodeFilter.FILTER_ACCEPT
			}}
			return 2; // NodeFilter.FILTER_REJECT
		}});
		const walk = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node =>
			node.nodeType === 1 // Node.ELEMENT_NODE
				? !HIGHLIGHT_TAGS.REJECT.has((node as Element).tagName)
					&& ((node as Element).tagName !== "MARK"
					|| !(node as Element).classList.contains(select(ElementClass.TERM_ANY)))
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
				: node.nodeType === 3 // Node.TEXT_NODE
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
		});
		let node = walkHandleBreaks.currentNode;
		while (node) {
			level++;
			node = walkHandleBreaks.firstChild();
			if (!node) {
				level--;
				walk.currentNode = walkHandleBreaks.currentNode;
				node = walk.nextSibling();
				while (!node) {
					level--;
					walk.parentNode();
					walkHandleBreaks.currentNode = walk.currentNode;
					if (level === breakLevels.at(-1)) {
						breakLevels.pop();
						highlightAtBreakLevel(wordRightPattern, unbrokenNodes, terms);
					}
					if (level <= 0) return;
					node = walk.nextSibling();
				}
				node = walkHandleBreaks.nextSibling();
			}
		}
	};
})();

const purgeClass = (className: string) =>
	Array.from(document.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

const restoreNodes = () => {
	const highlights = document.getElementsByClassName(select(ElementClass.TERM_ANY));
	if (!highlights.length)
		return;
	Array.from(highlights).forEach(element => {
		element.childNodes.forEach(childNode => element.parentNode.insertBefore(childNode, element));
		element.remove();
	});
	document.body.normalize();
	purgeClass(select(ElementClass.FOCUS));
	purgeClass(select(ElementClass.FOCUS_REVERT));
};

const getObserverNodeHighlighter = (() => {
	const canHighlightNode = (node: Element): boolean =>
		!node.closest(Array.from(HIGHLIGHT_TAGS.REJECT).join(", "))
		&& !node.classList.contains(select(ElementClass.TERM_ANY))
	;

	return (terms: MatchTerms) =>
		new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node.nodeType === Node.ELEMENT_NODE && canHighlightNode(node as Element))
						highlightInNodes(node, terms);
				}
			}
			terms.forEach(term => updateTermTooltip(term));
		})
	;
})();

const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {childList: true, subtree: true})
;

const insertHighlighting = (() => {
	const selectTermOnCommand = (terms: MatchTerms, selectTermPtr: SelectTermPtr) => {
		let selectModeFocus = false;
		let focusedIdx = 0;
		selectTermPtr.selectTerm = (commandString: string) => {
			const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
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
					jumpToTerm(commandInfo.reversed, terms[focusedIdx]);
				else
					jumpToTerm(commandInfo.reversed);
				break;
			} case CommandType.SELECT_TERM: {
				const bar = document.getElementById(select(ElementID.BAR));
				bar.classList.remove(select(ElementClass.CONTROL_BUTTON, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx);
				bar.classList.add(select(ElementClass.CONTROL_BUTTON, focusedIdx));
				if (!selectModeFocus)
					jumpToTerm(commandInfo.reversed, terms[focusedIdx]);
				break;
			}}
		};
	};

	return (terms: MatchTerms, disable: boolean,
		selectTermPtr: SelectTermPtr, observer: MutationObserver) => {
		observer.disconnect();
		restoreNodes();
		if (disable) return;
		if (!terms.length) {
			terms = document.getSelection().toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
				.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
			document.getSelection().collapseToStart();
			browser.runtime.sendMessage({ terms, makeUnique: true } as BackgroundMessage);
			return;
		}
		selectTermOnCommand(terms, selectTermPtr);
		highlightInNodes(document.body, terms);
		terms.forEach(term => updateTermTooltip(term));
		highlightInNodesOnMutation(observer);
		//addScrollMarkers(terms); // TODO: make dynamic
	};
})();

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

(() => {
	// TODO: configuration
	const refreshTermControls = (() => {
		const insertInterface = (commands: BrowserCommands, terms: MatchTerms,
			callRefreshTermControls: FunctionCallControlsRefresh, style: HTMLStyleElement, styleConstant: string) => {
			removeControls(styleConstant);
			addControls(commands, terms, callRefreshTermControls, style, styleConstant);
		};
	
		return (terms: MatchTerms, commands: BrowserCommands, style: HTMLStyleElement, styleConstant: string,
			observer: MutationObserver, selectTermPtr: SelectTermPtr, callRefreshTermControls: FunctionCallControlsRefresh,
			termsUpdate: MatchTerms, termUpdate: MatchTerm, termToUpdateIdx: number) => {
			if (termToUpdateIdx !== undefined && termToUpdateIdx !== TermChange.REMOVE) {
				// 'message.disable' assumed false.
				if (termToUpdateIdx === TermChange.CREATE) {
					let idx = terms.length - 1;
					const termCommands = getTermCommands(commands);
					if (termUpdate !== terms[idx]) {
						terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
						idx++;
					}
					addTermControl(terms, callRefreshTermControls, idx, termCommands.down[idx], termCommands.up[idx]);
				} else {
					const term = terms[termToUpdateIdx];
					if (termUpdate !== term) {
						term.phrase = termUpdate.phrase;
						term.matchMode = termUpdate.matchMode;
						term.compile();
					}
					refreshTermControl(term, termToUpdateIdx);
				}
			} else if (termsUpdate) {
				// TODO: retain colours
				if (termsUpdate !== terms) { // If called from the same script, 'termsUpdate' is a shallow copy of 'terms' and is correct.
					terms.splice(0, terms.length);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
				}
				insertInterface(commands, terms, callRefreshTermControls, style, styleConstant);
			} else {
				return;
			}
			insertStyle(terms, style, styleConstant, TERM_HUES);
			setTimeout(() => insertHighlighting(terms, false, selectTermPtr, observer));
		};
	})();

	const insertStyleElement = (styleConstant: string) => {
		let style = document.getElementById(select(ElementID.STYLE)) as HTMLStyleElement;
		if (!style) {
			style = style ? style : document.createElement("style");
			style.id = select(ElementID.STYLE);
			style.textContent = styleConstant;
			document.head.appendChild(style);
		}
		return style;
	};

	return (() => {
		const commands: BrowserCommands = [];
		const selectTermPtr: SelectTermPtr = { selectTerm: command => { command; } };
		const terms: MatchTerms = [];
		const observer = getObserverNodeHighlighter(terms);
		const styleConstant = `.${select(ElementClass.TERM_ANY)} { background-color: unset; color: unset; }`;
		const style = insertStyleElement(styleConstant);
		const callRefreshTermControls: FunctionCallControlsRefresh = (termsUpdate: MatchTerms,
			termUpdate: MatchTerm, termToUpdateIdx: number) => // For highly responsive controls, but requires nasty special cases.
			refreshTermControls(terms, commands, style, styleConstant, observer, selectTermPtr, callRefreshTermControls,
				termsUpdate, termUpdate, termToUpdateIdx);
		browser.runtime.onMessage.addListener((message: HighlightMessage) => {
			if (message.extensionCommands) {
				commands.splice(0, commands.length);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			if (message.command) {
				selectTermPtr.selectTerm(message.command);
			}
			callRefreshTermControls(message.terms, message.termUpdate, message.termToUpdateIdx);
		});
	});
})()();
