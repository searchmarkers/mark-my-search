type BrowserCommands = Array<browser.commands.Command>;
type HighlightTags = Record<string, RegExp>;
type ButtonInfo = {
	label: string
	containerId: ElementID
	onclick?: () => void
	setUp?: (button: HTMLButtonElement) => void
};

enum ElementClass {
	HIGHLIGHTS_SHOWN = "highlights-shown",
	BAR_HIDDEN = "bar-hidden",
	CONTROL_EXPAND = "control-expand",
	CONTROL_BUTTON = "control-button",
	BAR_CONTROL = "control",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	MARKER_BLOCK = "marker-block",
	DISABLED = "disabled",
	TERM_MATCH_CASE = "match-case",
	TERM_MATCH_STEM = "match-stem",
	TERM_MATCH_WHOLE = "match-whole",
}

enum ElementID {
	STYLE = "style",
	BAR = "bar",
	BAR_OPTIONS = "bar-options",
	BAR_TERMS = "bar-terms",
	BAR_CONTROLS = "bar-controls",
	MARKER_GUTTER = "markers",
}

enum TermChange {
	REMOVE = -1,
	CREATE = -2,
}

interface FnProcessCommand {
	call: (command: CommandInfo) => void
}

interface ControlsInfo {
	highlightsShown: boolean
	[StorageSync.BAR_CONTROLS_SHOWN]: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
}

if (browser) {
	self["chrome" as string] = browser;
}

const getSel = (element: ElementID | ElementClass, param?: string | number) =>
	[ "markmysearch", element, param ].join("-").slice(0, param ? undefined : -1)
;

const TERM_HUES: ReadonlyArray<number> = [ 60, 300, 110, 220, 0, 190, 30 ];

const jumpToTerm = (() => {
	const getContainerBlock = (highlightTags: HighlightTags, element: HTMLElement): HTMLElement =>
		highlightTags.flow.test(element.tagName) && element.parentElement
			? getContainerBlock(highlightTags, element.parentElement)
			: element
	;

	const isVisible = (element: HTMLElement) => // TODO: improve
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& window.getComputedStyle(element).visibility !== "hidden"
	;

	return (highlightTags: HighlightTags, reverse: boolean, term?: MatchTerm) => {
		const termSelector = term ? getSel(ElementClass.TERM, term.selector) : "";
		const focusBase = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS))[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(getSel(ElementClass.FOCUS_CONTAINER))[0] as HTMLElement;
		const selection = document.getSelection();
		const anchor = selection && (!document.activeElement
			|| document.activeElement === document.body || !document.body.contains(document.activeElement)
			|| document.activeElement === focusBase || document.activeElement.contains(focusContainer))
			? selection.anchorNode
			: document.activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(getSel(ElementClass.FOCUS));
			purgeClass(getSel(ElementClass.FOCUS_CONTAINER));
			Array.from(document.body.getElementsByClassName(getSel(ElementClass.FOCUS_REVERT)))
				.forEach((element: HTMLElement) => {
					element.tabIndex = -1;
					element.classList.remove(getSel(ElementClass.FOCUS_REVERT));
				})
			;
		}
		const anchorContainer = anchor
			? getContainerBlock(highlightTags, anchor.nodeType === Node.ELEMENT_NODE || !anchor.parentElement
				? anchor as HTMLElement
				: anchor.parentElement)
			: undefined;
		const acceptInAnchorContainer = { value: false };
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H" && (termSelector ? element.classList.contains(termSelector) : true) && isVisible(element)
				&& (getContainerBlock(highlightTags, element) !== anchorContainer || acceptInAnchorContainer.value)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walk.currentNode = anchor ? anchor : document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walk[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			walk.currentNode = reverse && document.body.lastElementChild ? document.body.lastElementChild : document.body;
			elementTerm = walk[nextNodeMethod]() as HTMLElement;
			if (!elementTerm) {
				acceptInAnchorContainer.value = true;
				elementTerm = walk[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return;
				}
			}
		}
		const container = getContainerBlock(highlightTags, elementTerm.parentElement as HTMLElement);
		container.classList.add(getSel(ElementClass.FOCUS_CONTAINER));
		elementTerm.classList.add(getSel(ElementClass.FOCUS));
		let elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
			.every(thisElement => getContainerBlock(highlightTags, thisElement.parentElement as HTMLElement) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			if (!this.browser) { // Attempt to focus parent link in Chromium (FIrefox considers link focused when child is focused).
				(elementToSelect.parentElement as HTMLElement).focus({ preventScroll: true });
				if (document.activeElement === elementToSelect.parentElement) {
					elementToSelect = elementToSelect.parentElement as HTMLElement;
				}
			}
			elementToSelect.classList.add(getSel(ElementClass.FOCUS_REVERT));
			elementToSelect.tabIndex = 0;
		}
		elementToSelect.focus({ preventScroll: true });
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(getSel(ElementClass.REMOVE));
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			elementToSelect.focus({ preventScroll: true });
		}
		elementToSelect.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection)
			selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
		Array.from(document.body.getElementsByClassName(getSel(ElementClass.REMOVE)))
			.forEach((element: HTMLElement) => {
				element.remove();
			})
		;
	};
})();

const createTermInput = (terms: MatchTerms, termButton: HTMLButtonElement, idx: number) => {
	const term = terms[idx];
	const replaces = idx !== TermChange.CREATE;
	const termInput = document.createElement("input");
	termInput.type = "text";
	termInput.disabled = true;
	termButton.appendChild(termInput);
	const show = (event: MouseEvent) => {
		event.preventDefault();
		termInput.value = replaces ? termButton.textContent as string : "";
		termButton.disabled = true;
		termInput.disabled = false;
		termInput.select();
	};
	const hide = () => {
		termInput.disabled = true;
		termButton.disabled = false;
	};
	const hideAndCommit = () => {
		if (termInput.disabled)
			return;
		hide();
		let message: BackgroundMessage | null = null;
		// TODO: clean up following code and associated handling
		if (replaces) {
			const termsUpdate: MatchTerms = [];
			terms.forEach(termOriginal => termsUpdate.push(termOriginal));
			if (termInput.value === "") {
				termsUpdate.splice(idx, 1);
				message = {
					terms: termsUpdate,
					termChanged: term,
					termChangedIdx: TermChange.REMOVE,
				};
			} else if (termInput.value !== term.phrase) {
				termsUpdate[idx] = new MatchTerm(termInput.value, term.matchMode);
				message = {
					terms: termsUpdate,
					termChanged: termsUpdate[idx],
					termChangedIdx: idx,
				};
			}
		} else if (termInput.value !== "") {
			const termsUpdate: MatchTerms = [];
			terms.forEach(termOriginal => termsUpdate.push(termOriginal));
			termsUpdate.push(new MatchTerm(termInput.value));
			message = {
				terms: termsUpdate,
				termChanged: termsUpdate.at(-1),
				termChangedIdx: TermChange.CREATE,
			};
		}
		if (message) {
			browser.runtime.sendMessage(message);
		}
	};
	termButton.oncontextmenu = show;
	if (!replaces)
		termButton.onclick = show;
	termInput.onblur = hideAndCommit;
	termInput.onkeydown = event => event.key === "Enter" ? hideAndCommit() : event.key === "Escape" ? hide() : undefined;
};

const insertStyle = (terms: MatchTerms, style: HTMLElement, hues: ReadonlyArray<number>) => {
	const zIndexMax = 2147483647;
	style.textContent = `
@keyframes flash { 0% { background-color: hsla(0, 0%, 65%, 0.8); } 100% {}; }
.${getSel(ElementClass.FOCUS_CONTAINER)} { animation-name: flash; animation-duration: 1s; }
#${getSel(ElementID.BAR)}
	.${getSel(ElementClass.CONTROL_BUTTON)}:active:not(.${getSel(ElementClass.CONTROL_BUTTON)}:hover)
	+ .${getSel(ElementClass.OPTION_LIST)} { all: revert; position: absolute; top: 17px; left: -40px; z-index: 1; }
#${getSel(ElementID.BAR)} > span > button,
	.${getSel(ElementClass.CONTROL_BUTTON)},
	.${getSel(ElementClass.CONTROL_BUTTON)}:hover,
	.${getSel(ElementClass.CONTROL_BUTTON)}:disabled,
	.${getSel(ElementClass.CONTROL_BUTTON)}.${getSel(ElementClass.DISABLED)} {
	all: revert; color: #111; border-style: none; box-shadow: 1px 1px 5px; border-radius: 4px; }
.${getSel(ElementClass.TERM_MATCH_CASE)} .${getSel(ElementClass.CONTROL_BUTTON)} {
	padding-top: 0; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)} :not(.${getSel(ElementClass.TERM_MATCH_STEM)}) .${getSel(ElementClass.CONTROL_BUTTON)} {
	text-decoration: underline; }
.${getSel(ElementClass.TERM_MATCH_WHOLE)} .${getSel(ElementClass.CONTROL_BUTTON)} {
	padding-inline: 2px; border-inline: 2px solid hsla(0, 0%, 0%, 0.6); }
#${getSel(ElementID.BAR)} > span > button { background-color: hsl(0, 0%, 80%); font-weight: bold; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_BUTTON)}.${getSel(ElementClass.DISABLED)} {
	background-color: hsla(0, 0%, 80%, 0.6) !important; color: #111; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_BUTTON)} > input,
	#${getSel(ElementID.BAR)} > span > button > input {
	all: revert; padding-block: 0; margin-left: 6px; border-style: none; width: 100px; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_BUTTON)} > input:disabled,
	#${getSel(ElementID.BAR)} > span > button > input:disabled { display: none; }
#${getSel(ElementID.BAR_TERMS)} > span { all: revert; position: relative; display: inline-block; }
#${getSel(ElementID.BAR)} > span > span, #${getSel(ElementID.BAR)} > span > button { margin-left: 8px; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)} { all: revert; position: relative; font-weight: bold;
	border: none; margin-left: 3px; width: 15px; height: 18px; background-color: transparent; color: white; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)}:hover,
	#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)}:active { color: transparent; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)} { all: revert; display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)} { all: revert; margin-left: 3px;
	border-style: none; border-bottom-style: solid; border-bottom-width: 1px; border-left-style: solid;
	border-color: hsl(0, 0%, 50%); background-color: hsl(0, 0%, 75%); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover { background-color: hsl(0, 0%, 100%); }
#${getSel(ElementID.BAR)} > span > button:hover { background-color: hsl(0, 0%, 65%); }
#${getSel(ElementID.BAR)} > span > button:active { background-color: hsl(0, 0%, 50%); }
#${getSel(ElementID.BAR)} > span > button.${getSel(ElementClass.DISABLED)}:not(:active) { display: none; }
#${getSel(ElementID.BAR)} { all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light;
	line-height: initial; font-size: 0; display: none; }
#${getSel(ElementID.BAR)}:not(.${getSel(ElementClass.BAR_HIDDEN)}) { display: inline; }
#${getSel(ElementID.MARKER_GUTTER)} { z-index: ${zIndexMax}; display: block;
	right: 0; top: 0; width: 12px; height: 100%; margin-left: -4px; }
#${getSel(ElementID.MARKER_GUTTER)} div:not(.${getSel(ElementClass.MARKER_BLOCK)}) {
	width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; }
#${getSel(ElementID.MARKER_GUTTER)}, .${getSel(ElementClass.MARKER_BLOCK)} {
	position: fixed; background: linear-gradient(to right, transparent, hsla(0, 0%, 0%, 0.7) 70%); }
.${getSel(ElementClass.MARKER_BLOCK)} { width: inherit; z-index: -1; }`
	;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		style.textContent += `
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
	~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
	#${getSel(ElementID.BAR)}
	~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background-color: hsla(${hue}, 100%, 60%, 0.4); }
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)} {
	background-color: hsl(${hue}, 100%, 50%); }
#${getSel(ElementID.BAR_TERMS)} > .${getSel(ElementClass.TERM, term.selector)}
	> .${getSel(ElementClass.CONTROL_BUTTON)} { background-color: hsl(${hue}, 50%, 60%); }
#${getSel(ElementID.BAR_TERMS)} > .${getSel(ElementClass.TERM, term.selector)}
	> .${getSel(ElementClass.CONTROL_BUTTON)}:hover { background-color: hsl(${hue}, 70%, 70%); }
#${getSel(ElementID.BAR_TERMS)} > .${getSel(ElementClass.TERM, term.selector)}
	> .${getSel(ElementClass.CONTROL_BUTTON)}:active { background-color: hsl(${hue}, 70%, 50%); }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_BUTTON, i)}
	> .${getSel(ElementClass.TERM, term.selector)} > .${getSel(ElementClass.CONTROL_BUTTON)} {
	background-color: hsl(${hue}, 100%, 85%); }`
		;
	});
};

const getTermControl = (term?: MatchTerm, idx = -1): HTMLElement => {
	const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
	return (idx === -1 && term
		? barTerms.getElementsByClassName(getSel(ElementClass.TERM, term.selector))[0]
		: barTerms.children[idx]
	) as HTMLElement;
};

const updateTermTooltip = (term: MatchTerm) => {
	const controlButton = getTermControl(term)
		.getElementsByClassName(getSel(ElementClass.CONTROL_BUTTON))[0] as HTMLElement;
	const occurrenceCount = document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)).length;
	controlButton.classList[occurrenceCount === 0 ? "add" : "remove"](getSel(ElementClass.DISABLED));
	// TODO: do not count parts of single matches individually
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

const getTermOptionText = (optionIsActive: boolean, title: string) =>
	optionIsActive
		? title.includes("✅") ? title : `${title}\u00A0✅`
		: title.includes("✅") ? title.slice(0, -2) : title
;

const updateTermMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList[mode.case ? "add" : "remove"](getSel(ElementClass.TERM_MATCH_CASE));
	classList[mode.stem ? "add" : "remove"](getSel(ElementClass.TERM_MATCH_STEM));
	classList[mode.whole ? "add" : "remove"](getSel(ElementClass.TERM_MATCH_WHOLE));
};

const refreshTermControl = (term: MatchTerm, idx: number) => {
	const control = getTermControl(undefined, idx);
	control.className = "";
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	updateTermMatchModeClassList(term.matchMode, control.classList);
	const controlButton = control.getElementsByClassName(getSel(ElementClass.CONTROL_BUTTON))[0] as HTMLElement;
	if (controlButton.firstChild)
		controlButton.firstChild.textContent = term.phrase;
	Array.from(control.getElementsByClassName(getSel(ElementClass.OPTION))).forEach((option) =>
		option.textContent = getTermOptionText(
			term.matchMode[getTermOptionMatchType(option.textContent as string, true)], (option.textContent as string)));
};

const insertTermControl = (() => {
	const createTermOption = (terms: MatchTerms, idx: number, title: string) => {
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
			browser.runtime.sendMessage(message);
		};
		const option = document.createElement("button");
		option.classList.add(getSel(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = getTermOptionText(terms[idx].matchMode[matchType], title);
		option.onmouseup = onActivated;
		return option;
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, idx: number, command: string, commandReverse: string) => {
		const term = terms[idx];
		const controlButton = document.createElement("button");
		controlButton.classList.add(getSel(ElementClass.CONTROL_BUTTON));
		controlButton.classList.add(getSel(ElementClass.DISABLED));
		controlButton.tabIndex = -1;
		controlButton.textContent = term.phrase;
		controlButton.onclick = () => jumpToTerm(highlightTags, false, term);
		createTermInput(terms, controlButton, idx);
		term.command = command;
		term.commandReverse = commandReverse;
		const menu = document.createElement("menu");
		menu.classList.add(getSel(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, idx, "Case\u00A0Sensitive"));
		menu.appendChild(createTermOption(terms, idx, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, idx, "Whole\u00A0Word"));
		const control = document.createElement("span");
		control.classList.add(getSel(ElementClass.TERM, term.selector));
		control.appendChild(controlButton);
		control.appendChild(menu);
		updateTermMatchModeClassList(term.matchMode, control.classList);
		(document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement).appendChild(control);
	};
})();

const getTermCommands = (commands: BrowserCommands) => {
	const commandsDetail = commands.map(command => ({
		info: command.name ? parseCommand(command.name) : { type: CommandType.NONE },
		shortcut: command.shortcut ?? "",
	}));
	return {
		down: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail => commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

const addControls = (() => {
	const createButton = (() => {
		const create = (id: BarControl, info: ButtonInfo, hideWhenInactive: boolean) => {
			const button = document.createElement("button"); // look into how it knows the type produced by the argument
			button.classList.add(getSel(ElementClass.BAR_CONTROL, id));
			if (hideWhenInactive) {
				button.classList.add(getSel(ElementClass.DISABLED));
			}
			button.tabIndex = -1;
			button.textContent = info.label;
			button.onclick = info.onclick ?? null;
			if (info.setUp) {
				info.setUp(button);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(button);
		};

		return (terms: MatchTerms, barControl: BarControl, hideWhenInactive: boolean) =>
			create(barControl, ({
				[BarControl.DISABLE_PAGE_RESEARCH]: {
					label: "X",
					containerId: ElementID.BAR_OPTIONS,	
					onclick: () => browser.runtime.sendMessage({
						disablePageResearch: true,
					} as BackgroundMessage),
				},
				[BarControl.PERFORM_SEARCH]: {
					label: "search",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => browser.runtime.sendMessage({
						performSearch: true,
					} as BackgroundMessage),
				},
				[BarControl.APPEND_TERM]: {
					label: "+",
					containerId: ElementID.BAR_CONTROLS,
					setUp: button => createTermInput(terms, button, TermChange.CREATE),
				},
			} as Record<BarControl, ButtonInfo>)[barControl], hideWhenInactive)
		;
	})();

	return (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
		style: HTMLElement, controlsInfo: ControlsInfo) => {
		insertStyle(terms, style, TERM_HUES);
		const bar = document.createElement("div");
		bar.id = getSel(ElementID.BAR);
		if (controlsInfo.highlightsShown) {
			bar.classList.add(getSel(ElementClass.HIGHLIGHTS_SHOWN));
		}
		const barOptions = document.createElement("span");
		barOptions.id = getSel(ElementID.BAR_OPTIONS);
		const barTerms = document.createElement("span");
		barTerms.id = getSel(ElementID.BAR_TERMS);
		const barControls = document.createElement("span");
		barControls.id = getSel(ElementID.BAR_CONTROLS);
		bar.appendChild(barOptions);
		bar.appendChild(barTerms);
		bar.appendChild(barControls);
		document.body.insertAdjacentElement("beforebegin", bar);
		Object.keys(controlsInfo.barControlsShown).forEach((barControl: BarControl) =>
			createButton(terms, barControl, !controlsInfo.barControlsShown[barControl]));
		const termCommands = getTermCommands(commands);
		terms.forEach((term, i) => insertTermControl(highlightTags, terms, i, termCommands.down[i], termCommands.up[i]));
		const gutter = document.createElement("div");
		gutter.id = getSel(ElementID.MARKER_GUTTER);
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

const removeControls = () => {
	const style = document.getElementById(getSel(ElementID.STYLE));
	if (!style || style.textContent === "")
		return;
	style.textContent = "";
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar)
		bar.remove();
	if (gutter)
		gutter.remove();
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
			|| [ "scroll", "auto" ].includes(window.getComputedStyle(element).overflowY)) || !element.parentElement
			? element
			: getScrollContainer(element.parentElement)
	;

	return (terms: MatchTerms) => {
		const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		if (!document.scrollingElement)
			return;
		const containerPairs: Array<[Element, HTMLElement]> = [ [ document.scrollingElement, gutter ] ];
		terms.forEach(term =>
			Array.from(document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector))).forEach((highlight: Element) => {
				if (!("offsetTop" in highlight))
					return;
				const scrollContainer = getScrollContainer(highlight as HTMLElement);
				const containerPair = containerPairs.find(containerPair => containerPair[0] === scrollContainer);
				const block = containerPair ? containerPair[1] : document.createElement("div");
				if (!containerPair) {
					block.classList.add(getSel(ElementClass.MARKER_BLOCK));
					block.style.top = String(
						getOffset(scrollContainer, document.scrollingElement as HTMLElement)
							/ (document.scrollingElement as Element).scrollHeight * 100
					) + "%";
					//block.style.height = "15%";
					gutter.appendChild(block);
					containerPairs.push([ scrollContainer, block ]);
				}
				// TOOD: add overlap strategy, add update strategy, check calculations
				const marker = document.createElement("div");
				marker.classList.add(getSel(ElementClass.TERM, term.selector));
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
		first?: UnbrokenNodeListItem;
		last?: UnbrokenNodeListItem;
	
		push (value: Node) {
			if (this.last) {
				this.last.next = { value };
				this.last = this.last.next;
			} else {
				this.first = { value };
				this.last = this.first;
			}
		}
	
		insertAfter (value?: Node, itemBefore?: UnbrokenNodeListItem | null) {
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
				text += (current as UnbrokenNodeListItem).value.textContent;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as UnbrokenNodeListItem).next);
			return text;
		}
	
		clear () {
			this.first = undefined;
			this.last = undefined; 
		}

		*[Symbol.iterator] () {
			let current = this.first;
			do {
				yield current as UnbrokenNodeListItem;
			// eslint-disable-next-line no-cond-assign
			} while (current = (current as UnbrokenNodeListItem).next);
		}
	}

	const highlightInNode = (term: MatchTerm, textEndNode: Node, start: number, end: number) => {
		// TODO: add strategy for mitigating damage (caused by programmatic changes by the website).
		const text = textEndNode.textContent as string;
		start = Math.max(0, start);
		end = Math.min(text.length, end);
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mms-h");
		highlight.classList.add(getSel(ElementClass.TERM, term.selector));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		(textEndNode.parentNode as Node).insertBefore(highlight, textEndNode);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			(textEndNode.parentNode as Node).insertBefore(textStartNode, highlight);
			return textStartNode;
		}
	};

	const highlightInBlock = (nodeItems: UnbrokenNodeList, terms: MatchTerms) => {
		for (const term of terms) {
			const textFlow = nodeItems.getText();
			const matches = textFlow.matchAll(term.pattern);
			let currentNodeStart = 0;
			let match: RegExpMatchArray = matches.next().value;
			let nodeItemPrevious: UnbrokenNodeListItem | null = null;
			for (const nodeItem of nodeItems) {
				const nextNodeStart = currentNodeStart + (nodeItem.value.textContent as string).length;
				while (match && match.index as number < nextNodeStart) {
					if (match.index as number + match[0].length >= currentNodeStart) {
						const textLengthOriginal = (nodeItem.value.textContent as string).length;
						nodeItems.insertAfter(
							highlightInNode(
								term,
								nodeItem.value,
								match.index as number - currentNodeStart, match.index as number - currentNodeStart + match[0].length),
							nodeItemPrevious);
						currentNodeStart += textLengthOriginal - (nodeItem.value.textContent as string).length;
						if ((match.index as number) + match[0].length > nextNodeStart) {
							break;
						}
					}
					match = matches.next().value;
				}
				currentNodeStart = nextNodeStart;
				nodeItemPrevious = nodeItem;
			}
		}
		nodeItems.clear();
	};

	return (rootNode: Node, highlightTags: HighlightTags, terms: MatchTerms) => {
		const nodeItems: UnbrokenNodeList = new UnbrokenNodeList;
		const breakLevels: Array<number> = [ 0 ];
		let level = 0;
		const walkerBreakHandler = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node => {
			switch (node.nodeType) {
			case (1): // NODE.ELEMENT_NODE
			case (11): { // NODE.DOCUMENT_FRAGMENT_NODE
				if (!highlightTags.reject.test((node as Element).tagName)) {
					if (!highlightTags.flow.test((node as Element).tagName)) {
						if (node.hasChildNodes())
							breakLevels.push(level);
						if (nodeItems.first)
							highlightInBlock(nodeItems, terms);
					}
					return 1; // NodeFilter.FILTER_ACCEPT
				}
				return 2; // NodeFilter.FILTER_REJECT
			} case (3): { // Node.TEXT_NODE
				if (level > (breakLevels.at(-1) as number))
					nodeItems.push(node);
				return 1; // NodeFilter.FILTER_ACCEPT
			}}
			return 2; // NodeFilter.FILTER_REJECT
		} });
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node =>
			(node.nodeType === 1 || node.nodeType === 11) // Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
				? !highlightTags.reject.test((node as Element).tagName)
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
				: node.nodeType === 3 // Node.TEXT_NODE
					? 1 : 2 // NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
		});
		let node: Node | null = walkerBreakHandler.currentNode;
		while (node) {
			level++; // Down to child level.
			node = walkerBreakHandler.firstChild();
			if (!node) {
				level--; // Up to sibling level.
				walker.currentNode = walkerBreakHandler.currentNode;
				node = walker.nextSibling();
				while (!node) {
					level--; // Up to parent level.
					walker.parentNode();
					walkerBreakHandler.currentNode = walker.currentNode;
					if (level === breakLevels.at(-1)) {
						breakLevels.pop();
						if (nodeItems.first)
							highlightInBlock(nodeItems, terms);
					}
					if (level <= 0)
						return;
					node = walker.nextSibling();
				}
				node = walkerBreakHandler.nextSibling();
			}
		}
	};
})();

const purgeClass = (className: string) =>
	Array.from(document.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

const restoreNodes = () => {
	const highlights = document.body.getElementsByTagName("mms-h");
	if (!highlights.length)
		return;
	Array.from(highlights).forEach(element => {
		element.childNodes.forEach(childNode =>
			element.parentNode ? element.parentNode.insertBefore(childNode, element) : undefined
		);
		element.remove();
	});
	purgeClass(getSel(ElementClass.FOCUS));
	purgeClass(getSel(ElementClass.FOCUS_REVERT));
};

const getObserverNodeHighlighter = (() => {
	const canHighlightNode = (rejectSelector: string, node: Element): boolean =>
		!node.closest(rejectSelector)
	;

	return (highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = highlightTags.reject.source.slice(5, -3).split("|").join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightNode(rejectSelector, node as Element)) {
						highlightInNodes(node, highlightTags, terms);
					}
				}
			}
			terms.forEach(term => updateTermTooltip(term));
		});
	};
})();

const highlightInNodesOnMutation = (observer: MutationObserver) =>
	observer.observe(document.body, {childList: true, subtree: true})
;

const insertHighlighting = (() => {
	const selectTermOnCommand = (highlightTags: HighlightTags, terms: MatchTerms, processCommand: FnProcessCommand) => {
		let selectModeFocus = false;
		let focusedIdx = 0;
		processCommand.call = (commandInfo: CommandInfo) => {
			const getFocusedIdx = (idx: number) => Math.min(terms.length - 1, idx);
			focusedIdx = getFocusedIdx(focusedIdx);
			switch (commandInfo.type) {
			case CommandType.TOGGLE_BAR: {
				const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
				bar.classList[bar.classList.contains(getSel(ElementClass.BAR_HIDDEN))
					? "remove" : "add"](getSel(ElementClass.BAR_HIDDEN));
				break;
			} case CommandType.TOGGLE_SELECT: {
				selectModeFocus = !selectModeFocus;
				break;
			} case CommandType.ADVANCE_GLOBAL: {
				if (selectModeFocus)
					jumpToTerm(highlightTags, commandInfo.reversed ?? false, terms[focusedIdx]);
				else
					jumpToTerm(highlightTags, commandInfo.reversed ?? false);
				break;
			} case CommandType.SELECT_TERM: {
				const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
				barTerms.classList.remove(getSel(ElementClass.CONTROL_BUTTON, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				barTerms.classList.add(getSel(ElementClass.CONTROL_BUTTON, focusedIdx));
				if (!selectModeFocus)
					jumpToTerm(highlightTags, commandInfo.reversed as boolean, terms[focusedIdx]);
				break;
			}}
		};
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, disable: boolean, termsFromSelection: boolean,
		selectTermPtr: FnProcessCommand, observer: MutationObserver) => {
		observer.disconnect();
		restoreNodes();
		if (disable) {
			removeControls();
			return;
		}
		if (termsFromSelection) {
			const selection = document.getSelection();
			if (!selection)
				return;
			terms = selection.toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
				.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
			selection.collapseToStart();
			browser.runtime.sendMessage({ terms, makeUnique: true } as BackgroundMessage);
			return;
		}
		selectTermOnCommand(highlightTags, terms, selectTermPtr);
		highlightInNodes(document.body, highlightTags, terms);
		terms.forEach(term => updateTermTooltip(term));
		highlightInNodesOnMutation(observer);
		addScrollMarkers(terms); // TODO: make dynamic
	};
})();

(() => {
	// TODO: configuration
	const refreshTermControls = (() => {
		const insertInterface = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
			style: HTMLElement, controlsInfo: ControlsInfo) => {
			removeControls();
			addControls(highlightTags, commands, terms, style, controlsInfo);
		};
	
		return (highlightTags: HighlightTags, terms: MatchTerms, commands: BrowserCommands, style: HTMLElement,
			observer: MutationObserver, selectTermPtr: FnProcessCommand, termsFromSelection: boolean, disable: boolean,
			controlsInfo: ControlsInfo, termsUpdate?: MatchTerms, termUpdate?: MatchTerm, termToUpdateIdx?: number) => {
			if (termsUpdate && termToUpdateIdx !== undefined && termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				// 'message.disable' assumed false.
				terms.splice(0);
				termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
				if (termToUpdateIdx === TermChange.CREATE) {
					const termCommands = getTermCommands(commands);
					const idx = terms.length - 1;
					insertTermControl(highlightTags, terms, idx, termCommands.down[idx], termCommands.up[idx]);
				} else {
					refreshTermControl(terms[termToUpdateIdx], termToUpdateIdx);
				}
			} else if (termsUpdate) {
				// TODO: retain colours?
				terms.splice(0);
				termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
				insertInterface(highlightTags, commands, terms, style, controlsInfo);
			} else if (!disable && !termsFromSelection) {
				return;
			}
			if (!disable) {
				insertStyle(terms, style, TERM_HUES);
			}
			// Timeout seems to reduce freezing impact (by causing threading?)
			setTimeout(() => insertHighlighting(highlightTags, terms, disable, termsFromSelection, selectTermPtr, observer));
		};
	})();

	const insertStyleElement = () => {
		let style = document.getElementById(getSel(ElementID.STYLE)) as HTMLElement;
		if (!style) {
			style = style ? style : document.createElement("style");
			style.id = getSel(ElementID.STYLE);
			document.head.appendChild(style);
		}
		return style;
	};

	return (() => {
		const commands: BrowserCommands = [];
		const processCommand: FnProcessCommand = { call: command => { command; } };
		const terms: MatchTerms = [];
		const controlsInfo: ControlsInfo = {
			highlightsShown: false,
			barControlsShown: {
				disablePageResearch: true,
				performSearch: true,
				appendTerm: true,
			},
		};
		const highlightTags: HighlightTags = {
			reject: /\b(?:meta|style|script|noscript|mms-h)\b/i,
			skip: /\b(?:s|del)\b/i, // Implementation would likely be overly complex.
			flow: /\b(?:b|i|u|strong|em|cite|span|mark|wbr|code|data|dfn|ins|mms-h)\b/i,
			// break: any other class of element
		};
		const observer = getObserverNodeHighlighter(highlightTags, terms);
		const style = insertStyleElement();
		browser.runtime.onMessage.addListener((message: HighlightMessage, sender, sendResponse) => {
			if (message.extensionCommands) {
				commands.splice(0);
				message.extensionCommands.forEach(command => commands.push(command));
			}
			if (message.command) {
				processCommand.call(message.command);
			}
			if (message.barControlsShown) {
				controlsInfo.barControlsShown = message.barControlsShown;
			}
			if (message.toggleHighlightsOn !== undefined) {
				controlsInfo.highlightsShown = message.toggleHighlightsOn;
			}
			if (message.disable || message.termsFromSelection || message.termUpdate || (message.terms
				&& !itemsMatchLoosely(terms, message.terms, (a: MatchTerm, b: MatchTerm) => a.phrase === b.phrase))) {
				refreshTermControls(
					highlightTags, terms, commands, style, observer, processCommand,
					message.termsFromSelection ?? false, message.disable ?? false, controlsInfo,
					message.terms, message.termUpdate, message.termToUpdateIdx
				);
			}
			// TODO: improve handling of highlight setting
			const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
			bar.classList[controlsInfo.highlightsShown ? "add" : "remove"](getSel(ElementClass.HIGHLIGHTS_SHOWN));
			sendResponse(); // Manifest V3 bug.
		});
	});
})()();
