type BrowserCommands = Array<browser.commands.Command>
type HighlightTags = Record<string, RegExp>
type TermHues = ReadonlyArray<number>
type ButtonInfo = {
	label: string
	containerId: ElementID
	onclick?: () => void
	setUp?: (button: HTMLButtonElement) => void
}
type RequestRefreshMarkers = Generator<undefined, never, unknown>

enum Keyframes {
	FLASH = "flash",
	MARKER_ON = "marker-on",
	MARKER_OFF = "marker-off",
}

enum ElementClass {
	HIGHLIGHTS_SHOWN = "highlights-shown",
	BAR_HIDDEN = "bar-hidden",
	CONTROL = "control",
	CONTROL_PAD = "control-pad",
	CONTROL_EXPAND = "control-expand",
	CONTROL_CONTENT = "control-content",
	CONTROL_EDIT = "control-edit",
	BAR_CONTROL = "bar-control",
	OPTION_LIST = "options",
	OPTION = "option",
	TERM = "term",
	FOCUS = "focus",
	FOCUS_CONTAINER = "focus-contain",
	FOCUS_REVERT = "focus-revert",
	REMOVE = "remove",
	DISABLED = "disabled",
	MATCH_CASE = "match-case",
	MATCH_STEM = "match-stem",
	MATCH_WHOLE = "match-whole",
	PRIMARY = "primary",
	SECONDARY = "secondary",
	ACTIVE = "active",
	OVERRIDE_VISIBILITY = "override-visibility",
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
	[StorageSync.BAR_LOOK]: StorageSyncValues[StorageSync.BAR_LOOK]
}

if (browser) {
	self["chrome" as string] = browser;
}

// Get a selector for element identification / classification / styling. Abbreviated due to prolific use.
const getSel = (identifier: ElementID | ElementClass | Keyframes, argument?: string | number) =>
	argument === undefined ? `markmysearch-${identifier}` : `markmysearch-${identifier}-${argument}`
;

const getContainerBlock = (highlightTags: HighlightTags, element: HTMLElement): HTMLElement =>
	highlightTags.flow.test(element.tagName) && element.parentElement
		? getContainerBlock(highlightTags, element.parentElement)
		: element
;

const jumpToTerm = (() => {
	const isVisible = (element: HTMLElement) => // TODO: improve
		(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
		&& getComputedStyle(element).visibility !== "hidden"
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
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
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
		if (selection) {
			selection.setBaseAndExtent(elementToSelect, 0, elementToSelect, 0);
		}
		Array.from(document.body.getElementsByClassName(getSel(ElementClass.REMOVE)))
			.forEach((element: HTMLElement) => {
				element.remove();
			})
		;
		const scrollMarkerGutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		purgeClass(getSel(ElementClass.FOCUS), scrollMarkerGutter);
		// eslint-disable-next-line no-constant-condition
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getSel(ElementClass.TERM, term.selector)}` : ""}[top^="${
					Math.trunc(getRectYRelative(container.getBoundingClientRect()) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(getSel(ElementClass.FOCUS));
				return true;
			}
			return false;
		});
	};
})();

const createTermInput = (terms: MatchTerms, controlPad: HTMLElement, idx: number) => {
	const controlContent = controlPad
		.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement ?? controlPad;
	const controlEdit = controlPad
		.getElementsByClassName(getSel(ElementClass.CONTROL_EDIT))[0] as HTMLElement | undefined;
	const term = terms[idx];
	const replaces = idx !== TermChange.CREATE;
	const termInput = document.createElement("input");
	termInput.type = "text";
	termInput.disabled = true;
	const show = (event: MouseEvent) => {
		event.preventDefault();
		purgeClass(getSel(ElementClass.ACTIVE), document.getElementById(getSel(ElementID.BAR)) as HTMLElement);
		termInput.classList.add(getSel(ElementClass.ACTIVE));
		termInput.value = replaces ? controlContent.textContent as string : "";
		termInput.disabled = false;
		termInput.select();
	};
	const hide = () => {
		termInput.blur();
		termInput.disabled = true;
	};
	const hideAndCommit = (inputValue?: string) => {
		hide();
		let message: BackgroundMessage | null = null;
		inputValue = inputValue ?? termInput.value;
		// TODO: clean up following code and associated handling
		if (replaces) {
			const termsUpdate: MatchTerms = [];
			terms.forEach(termOriginal => termsUpdate.push(termOriginal));
			if (inputValue === "") {
				termsUpdate.splice(idx, 1);
				message = {
					terms: termsUpdate,
					termChanged: term,
					termChangedIdx: TermChange.REMOVE,
				};
			} else if (inputValue !== term.phrase) {
				termsUpdate[idx] = new MatchTerm(inputValue, term.matchMode);
				message = {
					terms: termsUpdate,
					termChanged: termsUpdate[idx],
					termChangedIdx: idx,
				};
			}
		} else if (inputValue !== "") {
			const termsUpdate: MatchTerms = [];
			terms.forEach(termOriginal => termsUpdate.push(termOriginal));
			termsUpdate.push(new MatchTerm(inputValue));
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
	if (controlEdit) {
		controlEdit.onclick = event => termInput.disabled ? show(event) : hideAndCommit("");
		controlEdit.oncontextmenu = event => {
			event.preventDefault();
			hideAndCommit("");
		};
		controlEdit.ondragstart = event => event.preventDefault();
		controlContent.oncontextmenu = show;
	} else if (!replaces) {
		controlPad.onclick = show;
		controlPad.oncontextmenu = controlPad.onclick;
	}
	(new ResizeObserver(entries =>
		entries.forEach(entry =>
			entry.contentRect.width === 0 && !termInput.disabled ? hideAndCommit() : undefined
		)
	)).observe(termInput);
	termInput.onkeydown = event => {
		if (event.key === "Enter") {
			hideAndCommit();
		} else if (event.key === "Escape") {
			hide();
		} else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
			const shiftLeft = event.key.includes("Left");
			if ((shiftLeft && idx === 0)
				|| (!shiftLeft && !replaces)
				|| termInput.selectionStart !== termInput.selectionEnd
				|| termInput.selectionStart !== (shiftLeft ? 0 : termInput.value.length)) {
				return;
			}
			const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
			const activateInput = (button: HTMLElement, inputField: HTMLElement) => {
				inputField.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
				button.click();
				inputField.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
			};
			if (!shiftLeft && idx === terms.length - 1) {
				const appendTerm = (document.getElementById(getSel(ElementID.BAR_CONTROLS)) as HTMLElement)
					.firstElementChild as HTMLElement;
				activateInput(appendTerm, appendTerm.querySelector("input") as HTMLElement);
				return;
			}
			const control = bar.getElementsByClassName(getSel(ElementClass.TERM, terms[replaces
				? shiftLeft ? idx - 1 : idx + 1
				: terms.length - 1].selector))[0];
			activateInput(
				control.getElementsByClassName(getSel(ElementClass.CONTROL_EDIT))[0] as HTMLElement,
				control.querySelector("input") as HTMLElement,
			);
		} else if (event.key === " ") {
			// Pressing space unaccountably clears the input for the term-append button, workaround is a custom implementation.
			event.preventDefault();
			const selectionStart = termInput.selectionStart ?? -1;
			termInput.value = `${termInput.value.slice(0, selectionStart)} ${termInput.value.slice(termInput.selectionEnd ?? -1)}`;
			termInput.selectionStart = selectionStart + 1;
			termInput.selectionEnd = selectionStart + 1;
		}
	};
	return termInput;
};

const insertStyle = (terms: MatchTerms, style: HTMLElement, hues: ReadonlyArray<number>) => {
	const zIndexMax = 2147483647;
	style.textContent = `
@keyframes ${getSel(Keyframes.FLASH)}
	{ from { background-color: hsla(0, 0%, 65%, 0.8); } to {}; }
@keyframes ${getSel(Keyframes.MARKER_ON)}
	{ from {} to { padding-right: 16px; }; }
@keyframes ${getSel(Keyframes.MARKER_OFF)}
	{ from { padding-right: 16px; } to { padding-right: 0; }; }
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(Keyframes.FLASH)} 1s; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover)
+ .${getSel(ElementClass.OPTION_LIST)}
	{ all: revert; position: absolute; display: grid; width: max-content; left: -40px; z-index: 1; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
	{ all: revert; display: inline-flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ all: revert; display: grid; grid-template-columns: repeat(3, auto); grid-auto-rows: 1fr; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:hover,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ color: #000 !important; border-style: none; box-shadow: 1px 1px 5px; border-radius: 4px; align-items: center; }
.${getSel(ElementClass.CONTROL_PAD)} button
	{ background: transparent; border: none; padding-inline: 0; margin-block: 0; font: revert; line-height: 120%;
	vertical-align: initial; color: #000 !important; cursor: initial; height: fit-content; letter-spacing: normal; transition: unset; }
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_CONTENT)},
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)}
	{ padding: 0 1px 0 1px !important; border: inherit; border-radius: inherit; text-transform: revert; height: 100%; margin: 0; }
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} img
	{ display: flex; height: 1.1em; }
.${getSel(ElementClass.CONTROL_PAD)} input:not(:disabled) + .${getSel(ElementClass.CONTROL_EDIT)}
.${getSel(ElementClass.PRIMARY)}
	{ display: none; }
.${getSel(ElementClass.CONTROL_PAD)} input:disabled + .${getSel(ElementClass.CONTROL_EDIT)}
.${getSel(ElementClass.SECONDARY)}
	{ display: none; }
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 4px; padding: 1px 2px 1px 2px !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_CASE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-top: 0 !important; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_WHOLE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 2px !important; border-inline: 2px solid hsla(0, 0%, 0%, 0.4); }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
	{ background: hsl(0, 0%, 80%) !important; line-height: 120%; padding: revert !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} *
	{ filter: grayscale(100%) contrast(10000%); font-family: revert; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ background: hsla(0, 0%, 80%, 0.6) !important; color: #000; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input
	{ all: revert; padding: 0 2px 0 2px !important; margin-left: 4px; border: none !important; width: 100px; line-height: 120%;
	box-sizing: unset !important; font-family: revert !important; color: #000 !important; height: fit-content; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus):not(.${getSel(ElementClass.OVERRIDE_VISIBILITY)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
input:not(:focus):not(.${getSel(ElementClass.ACTIVE)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:disabled,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROL)}
input:not(:focus):not(.${getSel(ElementClass.OVERRIDE_VISIBILITY)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
input:not(:focus):not(.${getSel(ElementClass.ACTIVE)}),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input:disabled
	{ display: none; }
#${getSel(ElementID.BAR_TERMS)} > *
	{ all: revert; position: relative; display: inline-block; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}
	{ margin-left: 8px; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)}
	{ all: revert; position: relative; font-weight: bold;
	border: none; margin-left: 3px; width: 15px; height: 18px; background: transparent; color: white; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)}:hover,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_EXPAND)}:active
	{ color: transparent; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ all: revert; display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ all: revert; margin-left: 3px; background: hsl(0, 0%, 75%) !important; filter: grayscale(100%);
	line-height: 120%; text-align: left; color: #111 !important;
	border-color: hsl(0, 0%, 50%) !important; border-bottom-width: 1px !important;
	border-style: none none solid solid !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0, 0%, 90%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}:hover
	{ background: hsl(0, 0%, 65%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}:active
	{ background: hsl(0, 0%, 50%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)}.${getSel(ElementClass.DISABLED)}:not(:active)
	{ display: none; }
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light; line-height: initial; font-size: 0; display: none; }
#${getSel(ElementID.BAR)}:not(.${getSel(ElementClass.BAR_HIDDEN)})
	{ display: inline; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ z-index: ${zIndexMax}; display: block; right: 0; top: 0; width: 12px; height: 100%; }
#${getSel(ElementID.MARKER_GUTTER)} div
	{ width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; border-left: solid black 1px; box-sizing: unset;
	padding-right: 0; transition: padding-right 600ms; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ position: fixed; background: linear-gradient(to right, transparent, hsla(0, 0%, 0%, 0.7) 70%); }
#${getSel(ElementID.MARKER_GUTTER)} div.${getSel(ElementClass.FOCUS)}
	{ padding-right: 16px; transition: unset; }`
	;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const getBackgroundStyle = (colorA: string, colorB: string) =>
			i < hues.length ? colorA : `repeating-linear-gradient(-45deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`;
		style.textContent += `
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
#${getSel(ElementID.BAR)}
~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsla(${hue}, 100%, 60%, 0.4)`, `hsla(${hue}, 100%, 90%, 0.4)`)} !important;
	border-radius: 2px !important; box-shadow: 0 0 0 1px hsla(${hue}, 100%, 20%, 0.35) !important; }
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue}, 100%, 50%); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(`hsla(${hue}, 70%, 70%, 0.8)`, `hsla(${hue}, 70%, 90%, 0.8)`)}; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:hover,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:hover:not(:disabled)
	{ background: hsl(${hue}, 70%, 80%); }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:active,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:active:not(:disabled)
	{ background: hsl(${hue}, 70%, 70%); }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_PAD, i)}
.${getSel(ElementClass.TERM, term.selector)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(${hue}, 100%, 90%); }`
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
	const controlPad = getTermControl(term)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	const controlContent = controlPad
		.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	const occurrenceCount = document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)).length;
	controlPad.classList[occurrenceCount === 0 ? "add" : "remove"](getSel(ElementClass.DISABLED));
	// TODO: do not count parts of single matches individually
	controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
		!occurrenceCount || !term.command ? ""
			: occurrenceCount === 1 ? `\nJump to: ${term.command}, ${term.commandReverse}`
				: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
	}`;
};

const getTermOptionMatchType = (text: string, fromText = false) =>
	(fromText
		? text.substring(0, text.indexOf("\u00A0"))
		: text.slice(0, text.indexOf("\u00A0"))).toLocaleLowerCase()
;

const getTermOptionText = (optionIsActive: boolean, title: string) =>
	optionIsActive
		? title.includes("🗹") ? title : `${title}\u00A0🗹`
		: title.includes("🗹") ? title.slice(0, -2) : title
;

const updateTermMatchModeClassList = (mode: MatchMode, classList: DOMTokenList) => {
	classList[mode.case ? "add" : "remove"](getSel(ElementClass.MATCH_CASE));
	classList[mode.stem ? "add" : "remove"](getSel(ElementClass.MATCH_STEM));
	classList[mode.whole ? "add" : "remove"](getSel(ElementClass.MATCH_WHOLE));
};

const refreshTermControl = (highlightTags: HighlightTags, term: MatchTerm, idx: number) => {
	const control = getTermControl(undefined, idx);
	control.className = "";
	control.classList.add(getSel(ElementClass.CONTROL));
	control.classList.add(getSel(ElementClass.TERM, term.selector));
	updateTermMatchModeClassList(term.matchMode, control.classList);
	const controlContent = control.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
	controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
	controlContent.textContent = term.phrase;
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

	return (highlightTags: HighlightTags, terms: MatchTerms, idx: number, command: string, commandReverse: string,
		controlsInfo: ControlsInfo) => {
		const term = terms[idx];
		const controlPad = document.createElement("span");
		controlPad.classList.add(getSel(ElementClass.CONTROL_PAD));
		controlPad.classList.add(getSel(ElementClass.DISABLED));
		controlPad.tabIndex = -1;
		const controlContent = document.createElement("button");
		controlContent.classList.add(getSel(ElementClass.CONTROL_CONTENT));
		controlContent.tabIndex = -1;
		controlContent.textContent = term.phrase;
		controlContent.onclick = () => jumpToTerm(highlightTags, false, term);
		controlPad.appendChild(controlContent);
		const controlEdit = document.createElement("button");
		controlEdit.classList.add(getSel(ElementClass.CONTROL_EDIT));
		if (!controlsInfo.barLook.showEditIcon) {
			controlEdit.disabled = true;
		}
		controlEdit.tabIndex = -1;
		const controlEditChange = document.createElement("img");
		const controlEditRemove = document.createElement("span");
		controlEditChange.src = browser.runtime.getURL("/icons/edit.svg");
		controlEditRemove.textContent = " ☓ ";
		controlEditChange.classList.add(getSel(ElementClass.PRIMARY));
		controlEditRemove.classList.add(getSel(ElementClass.SECONDARY));
		controlEdit.appendChild(controlEditChange);
		controlEdit.appendChild(controlEditRemove);
		controlPad.appendChild(controlEdit);
		const termInput = createTermInput(terms, controlPad, idx);
		controlPad.insertBefore(termInput, controlEdit);
		term.command = command;
		term.commandReverse = commandReverse;
		const menu = document.createElement("menu");
		menu.classList.add(getSel(ElementClass.OPTION_LIST));
		menu.appendChild(createTermOption(terms, idx, "Case\u00A0Sensitive"));
		menu.appendChild(createTermOption(terms, idx, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, idx, "Whole\u00A0Word"));
		const control = document.createElement("span");
		control.classList.add(getSel(ElementClass.CONTROL));
		control.classList.add(getSel(ElementClass.TERM, term.selector));
		control.appendChild(controlPad);
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
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && !commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
		up: commandsDetail
			.filter(commandDetail =>
				commandDetail.info.type === CommandType.SELECT_TERM && commandDetail.info.reversed)
			.map(commandDetail => commandDetail.shortcut),
	};
};

const addControls = (() => {
	const createButton = (() => {
		const create = (id: BarControl, info: ButtonInfo, hideWhenInactive: boolean) => {
			const button = document.createElement("button"); // TODO: find how vscode knows the type produced by the argument
			button.classList.add(getSel(ElementClass.BAR_CONTROL)); // TODO redundant, use CSS to select class containing this
			button.classList.add(getSel(ElementClass.BAR_CONTROL, id));
			const text = document.createElement("span");
			text.tabIndex = -1;
			text.textContent = info.label;
			button.appendChild(text);
			if (hideWhenInactive) {
				button.classList.add(getSel(ElementClass.DISABLED));
			}
			button.tabIndex = -1;
			button.onclick = info.onclick ?? null;
			if (info.setUp) {
				info.setUp(button);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(button);
		};

		return (terms: MatchTerms, barControl: BarControl, hideWhenInactive: boolean) =>
			create(barControl, ({
				[BarControl.DISABLE_TAB_RESEARCH]: {
					label: "☓",
					containerId: ElementID.BAR_OPTIONS,	
					onclick: () => browser.runtime.sendMessage({
						disableTabResearch: true,
					} as BackgroundMessage),
				},
				[BarControl.PERFORM_SEARCH]: {
					label: "🌐",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => browser.runtime.sendMessage({
						performSearch: true,
					} as BackgroundMessage),
				},
				[BarControl.APPEND_TERM]: {
					label: "🞣",
					containerId: ElementID.BAR_CONTROLS,
					setUp: button => {
						const termInput = createTermInput(terms, button, TermChange.CREATE);
						button.appendChild(termInput);
					},
				},
			} as Record<BarControl, ButtonInfo>)[barControl], hideWhenInactive)
		;
	})();

	return (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
		style: HTMLElement, controlsInfo: ControlsInfo, hues: TermHues) => {
		insertStyle(terms, style, hues);
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
		terms.forEach((term, i) => insertTermControl(highlightTags, terms, i, termCommands.down[i], termCommands.up[i],
			controlsInfo));
		const gutter = document.createElement("div");
		gutter.id = getSel(ElementID.MARKER_GUTTER);
		document.body.insertAdjacentElement("afterend", gutter);
	};
})();

const removeControls = () => {
	const style = document.getElementById(getSel(ElementID.STYLE));
	if (!style || style.textContent === "") {
		return;
	}
	style.textContent = "";
	const bar = document.getElementById(getSel(ElementID.BAR));
	const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER));
	if (bar) {
		bar.remove();
	}
	if (gutter) {
		gutter.remove();
	}
};

const getRectYRelative = (rect: DOMRect) =>
	(rect.y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

const insertScrollMarkers = (() => {
	const getTermSelector = (highlightClassName: string) =>
		highlightClassName.slice(getSel(ElementClass.TERM).length + 1)
	;

	const clearMarkers = (gutter: HTMLElement) => {
		gutter.replaceChildren();
	};

	return (highlightTags: HighlightTags, terms: MatchTerms) => {
		const regexMatchTermSelector = new RegExp(`\\b${getSel(ElementClass.TERM)}-\\w+\\b`);
		const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement,
			termsAdded: Set<string>,
		}> = [];
		clearMarkers(gutter);
		if (terms.length === 0) {
			return;
		}
		document.body.querySelectorAll(terms.map(term => `mms-h.${getSel(ElementClass.TERM, term.selector)}`
		).join(", ")).forEach((highlight: HTMLElement) => {
			const container = getContainerBlock(highlightTags, highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const marker = document.createElement("div");
			marker.classList.add(className);
			const yRelative = getRectYRelative(container.getBoundingClientRect());
			marker.style.top = `${yRelative * 100}%`;
			marker.setAttribute("top", `${yRelative}`);
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermSelector(className))) {
						return;
					} else {
						const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
						marker.style.zIndex = `${termsAddedCount * -1}`;
						marker.style.paddingLeft = `${termsAddedCount * 4}px`;
						containersInfo[containerIdx].termsAdded.add(getTermSelector(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermSelector(className) ]) });
			}
			gutter.appendChild(marker);
		});
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

	const insertHighlights = (rootNode: Node, highlightTags: HighlightTags, terms: MatchTerms) => {
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

	return (requestRefreshMarkers: RequestRefreshMarkers, highlightTags: HighlightTags, terms: MatchTerms,
		rootNode: Node) => {
		insertHighlights(rootNode, highlightTags, terms);
		requestRefreshMarkers.next();
	};
})();

const purgeClass = (className: string, root: Element = document.body) =>
	Array.from(root.getElementsByClassName(className)).forEach(element => element.classList.remove(className))
;

const restoreNodes = (className?: string) => {
	const highlights = document.body.querySelectorAll(className ? `mms-h.${className}` : "mms-h");
	highlights.forEach(element => {
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

	return (requestRefreshMarkers: RequestRefreshMarkers, highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = highlightTags.reject.source.slice(5, -3).split("|").join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightNode(rejectSelector, node as Element)) {
						highlightInNodes(requestRefreshMarkers, highlightTags, terms, node);
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

const insertHighlights = (() => {
	const selectTermOnCommand = (highlightTags: HighlightTags, terms: MatchTerms,
		processCommand: FnProcessCommand) => {
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
			} case CommandType.FOCUS_TERM_INPUT: {
				const termIdx = commandInfo.termIdx as number;
				const button = document.querySelector(termIdx === -1
					? `#${getSel(ElementID.BAR_CONTROLS)} button`
					: `#${getSel(ElementID.BAR)} .${getSel(ElementClass.TERM, terms[termIdx].selector)} button`
				) as HTMLElement;
				const input = button.querySelector("input") as HTMLElement;
				input.classList.add(getSel(ElementClass.OVERRIDE_VISIBILITY));
				button.click();
				input.classList.remove(getSel(ElementClass.OVERRIDE_VISIBILITY));
				break;
			} case CommandType.SELECT_TERM: {
				const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
				barTerms.classList.remove(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				focusedIdx = getFocusedIdx(commandInfo.termIdx as number);
				barTerms.classList.add(getSel(ElementClass.CONTROL_PAD, focusedIdx));
				if (!selectModeFocus)
					jumpToTerm(highlightTags, commandInfo.reversed as boolean, terms[focusedIdx]);
				break;
			}}
		};
	};

	return (highlightTags: HighlightTags, requestRefreshMarkers: RequestRefreshMarkers,
		terms: MatchTerms, disable: boolean, termsFromSelection: boolean,
		selectTermPtr: FnProcessCommand, observer: MutationObserver) => {
		observer.disconnect();
		if (termsFromSelection) {
			const selection = document.getSelection();
			if (selection && selection.anchorNode) {
				const termsAll = selection.toString().split(" ").map(phrase => phrase.replace(/\W/g, ""))
					.filter(phrase => phrase !== "").map(phrase => new MatchTerm(phrase));
				const termSelectors: Set<string> = new Set;
				terms = [];
				termsAll.forEach(term => {
					if (!termSelectors.has(term.selector)) {
						termSelectors.add(term.selector);
						terms.push(term);
					}
				});
				selection.collapseToStart();
			} else {
				terms = [];
			}
			chrome.runtime.sendMessage({
				terms,
				makeUnique: true,
				toggleHighlightsOn: true,
			} as BackgroundMessage);
		}
		restoreNodes();
		if (disable) {
			removeControls();
			return;
		}
		if (termsFromSelection) {
			return;
		}
		selectTermOnCommand(highlightTags, terms, selectTermPtr);
		highlightInNodes(requestRefreshMarkers, highlightTags, terms, document.body);
		terms.forEach(term => updateTermTooltip(term));
		highlightInNodesOnMutation(observer);
	};
})();

(() => {
	// TODO: configuration
	const refreshTermControls = (() => {
		const insertInterface = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
			style: HTMLElement, controlsInfo: ControlsInfo, hues: TermHues) => {
			removeControls();
			addControls(highlightTags, commands, terms, style, controlsInfo, hues);
		};
	
		return (highlightTags: HighlightTags, terms: MatchTerms, commands: BrowserCommands, style: HTMLElement,
			observer: MutationObserver, selectTermPtr: FnProcessCommand,
			requestRefreshMarkers: RequestRefreshMarkers,
			termsFromSelection: boolean, disable: boolean,
			controlsInfo: ControlsInfo, hues: TermHues,
			termsUpdate?: MatchTerms, termUpdate?: MatchTerm, termToUpdateIdx?: number,
		) => {
			const termsToHighlight: MatchTerms = [];
			if (termsUpdate !== undefined && termToUpdateIdx !== undefined
				&& termToUpdateIdx !== TermChange.REMOVE && termUpdate) {
				// 'message.disable' assumed false.
				if (termToUpdateIdx === TermChange.CREATE) {
					terms.push(new MatchTerm(termUpdate.phrase, termUpdate.matchMode));
					const termCommands = getTermCommands(commands);
					const idx = terms.length - 1;
					insertTermControl(highlightTags, terms, idx, termCommands.down[idx], termCommands.up[idx], controlsInfo);
				} else {
					const term = terms[termToUpdateIdx];
					term.matchMode = termUpdate.matchMode;
					term.phrase = termUpdate.phrase;
					term.compile();
					refreshTermControl(highlightTags, terms[termToUpdateIdx], termToUpdateIdx);
				}
			} else if (termsUpdate !== undefined
				&& termToUpdateIdx === TermChange.REMOVE && itemsMatchLoosely(terms.slice(0, -2), termsUpdate)) {
				// TODO works?
				restoreNodes(getSel(ElementClass.TERM, terms.length ? (terms.at(-1) as MatchTerm).selector : ""));
				terms.splice(-1, 1);
				insertInterface(highlightTags, commands, terms, style, controlsInfo, hues);
				return;
			} else if (termsUpdate !== undefined) {
				// TODO: retain colours?
				terms.splice(0);
				termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
				insertInterface(highlightTags, commands, terms, style, controlsInfo, hues);
			} else if (!disable && !termsFromSelection) {
				return;
			}
			if (!disable) {
				insertStyle(terms, style, hues);
			}
			// Timeout seems to reduce freezing impact (by causing threading?)
			setTimeout(() => insertHighlights(
				highlightTags, requestRefreshMarkers, termsToHighlight.length ? termsToHighlight : terms,
				disable, termsFromSelection, selectTermPtr, observer
			));
		};
	})();

	const insertStyleElement = () => {
		let style = document.getElementById(getSel(ElementID.STYLE)) as HTMLElement;
		if (!style) {
			style = document.createElement("style");
			style.id = getSel(ElementID.STYLE);
			document.head.appendChild(style);
		}
		return style;
	};

	return () => {
		const commands: BrowserCommands = [];
		const processCommand: FnProcessCommand = { call: command => { command; } };
		const terms: MatchTerms = [];
		const hues: TermHues = [ 60, 300, 110, 220, 0, 190, 30 ];
		const controlsInfo: ControlsInfo = {
			highlightsShown: false,
			barControlsShown: {
				disableTabResearch: true,
				performSearch: true,
				appendTerm: true,
			},
			barLook: {
				showEditIcon: true,
			},
		};
		const getHighlightTagsRegex = (tags: Array<HTMLElementTagName>) =>
			new RegExp(`\\b(?:${tags.join("|")})\\b`, "i") // TODO replace this and similar with "[ ]"-like syntax in pattern
		;
		const highlightTags: HighlightTags = {
			reject: getHighlightTagsRegex([ "meta", "style", "script", "noscript", "title", "mms-h" as HTMLElementTagName ]),
			skip: getHighlightTagsRegex([ "s", "del"] ), // Implementation would likely be overly complex.
			flow: getHighlightTagsRegex([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as HTMLElementTagName ]),
			// break: any other class of element
		};
		const requestRefreshMarkers: RequestRefreshMarkers = function* () {
			let timeRequestAcceptedLast = 0;
			while (true) {
				const requestWaitDuration = 1000;
				const date = Date.now();
				if (date > timeRequestAcceptedLast + requestWaitDuration) {
					timeRequestAcceptedLast = date;
					setTimeout(() => insertScrollMarkers(highlightTags, terms), requestWaitDuration + 50);
				}
				yield;
			}
		}();
		const observer = getObserverNodeHighlighter(requestRefreshMarkers, highlightTags, terms);
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
			if (message.barLook) {
				controlsInfo.barLook = message.barLook;
			}
			if (message.toggleHighlightsOn !== undefined) {
				controlsInfo.highlightsShown = message.toggleHighlightsOn;
			}
			// TODO: better way of identifying if extension is already active but with no terms
			if (message.disable || message.termsFromSelection || message.termUpdate || (message.terms !== undefined
				&& (!itemsMatchLoosely(terms, message.terms, (a: MatchTerm, b: MatchTerm) => a.phrase === b.phrase)
				|| (!terms.length && !document.getElementById(ElementID.BAR))))) {
				refreshTermControls(
					highlightTags, terms, commands, style, observer, processCommand, requestRefreshMarkers,
					message.termsFromSelection ?? false, message.disable ?? false, controlsInfo, hues,
					message.terms, message.termUpdate, message.termToUpdateIdx,
				);
			}
			// TODO: improve handling of highlight setting
			const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
			bar.classList[controlsInfo.highlightsShown ? "add" : "remove"](getSel(ElementClass.HIGHLIGHTS_SHOWN));
			sendResponse(); // Manifest V3 bug.
		});
	};
})()();
