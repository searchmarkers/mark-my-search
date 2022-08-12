type BrowserCommands = Array<chrome.commands.Command>
type HighlightTags = Record<string, RegExp>
type TermHues = ReadonlyArray<number>
type ButtonInfo = {
	path?: string
	label?: string
	containerId: ElementID
	onclick?: () => void
	setUp?: (container: HTMLElement) => void
}
type RequestRefreshIndicators = Generator<undefined, never, unknown>

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

interface UnbrokenNodeListItem {
	next?: UnbrokenNodeListItem
	value: Node
}

// Singly linked list implementation for efficient highlight matching of node DOM 'flow' groups
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
				itemBefore.next = { next: itemBefore.next, value };
			} else {
				this.first = { next: this.first, value };
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
	const isVisible = (element: HTMLElement) => // TODO improve
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
		const selectionFocus = selection && (!document.activeElement
			|| document.activeElement === document.body || !document.body.contains(document.activeElement)
			|| document.activeElement === focusBase || document.activeElement.contains(focusContainer))
			? selection.focusNode
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
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(highlightTags, selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
				? selectionFocus as HTMLElement
				: selectionFocus.parentElement)
			: undefined;
		const acceptInSelectionFocusContainer = { value: false };
		const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(highlightTags, element) !== selectionFocusContainer || acceptInSelectionFocusContainer.value)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walk.currentNode = selectionFocus ? selectionFocus : document.body;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walk[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			walk.currentNode = reverse && document.body.lastElementChild ? document.body.lastElementChild : document.body;
			elementTerm = walk[nextNodeMethod]() as HTMLElement;
			if (!elementTerm) {
				acceptInSelectionFocusContainer.value = true;
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

const createTermInput = (() => {
	const activateInput = (control: HTMLElement, shiftCaretRight?: boolean) => {
		const input = control.querySelector("input") as HTMLInputElement;
		input.select();
		if (shiftCaretRight !== undefined) {
			const caretPosition = shiftCaretRight ? 0 : -1;
			input.setSelectionRange(caretPosition, caretPosition);
		}
	};

	const commit = (term: MatchTerm | undefined, terms: MatchTerms) => {
		const replaces = !!term;
		const control = getTermControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const inputValue = termInput.value;
		const idx = getTermIdx(term, terms);
		if (replaces && inputValue === "") {
			if (document.activeElement === termInput) {
				activateInput(getTermControl(undefined, idx + 1) as HTMLElement);
				return;
			}
			chrome.runtime.sendMessage({
				terms: terms.slice(0, idx).concat(terms.slice(idx + 1)),
				termChanged: term,
				termChangedIdx: TermChange.REMOVE,
			});
		} else if (replaces && inputValue !== term.phrase) {
			const termChanged = new MatchTerm(inputValue, term.matchMode);
			chrome.runtime.sendMessage({
				terms: terms.map((term, i) => i === idx ? termChanged : term),
				termChanged,
				termChangedIdx: idx,
			});
		} else if (!replaces && inputValue !== "") {
			const termChanged = new MatchTerm(inputValue);
			chrome.runtime.sendMessage({
				terms: terms.concat(termChanged),
				termChanged,
				termChangedIdx: TermChange.CREATE,
			});
		}
	};

	const shiftTermFocus = (term: MatchTerm | undefined, shiftRight: boolean, onBeforeShift: () => void, terms: MatchTerms) => {
		const replaces = !!term;
		const control = getTermControl(term) as HTMLElement;
		const termInput = control.querySelector("input") as HTMLInputElement;
		const idx = getTermIdx(term, terms);
		if (termInput.selectionStart !== termInput.selectionEnd
			|| termInput.selectionStart !== (shiftRight ? termInput.value.length : 0)) {
			return;
		}
		onBeforeShift();
		if (shiftRight && idx === terms.length - 1) {
			activateInput(getControlAppendTerm() as HTMLElement, shiftRight);
			return;
		} else if (shiftRight && !replaces) {
			commit(term, terms);
			termInput.value = "";
			return;
		} else if (!shiftRight && idx === 0) {
			commit(term, terms);
			if (termInput.value === "") {
				const focusingControlAppendTerm = terms.length === 1;
				const controlTarget = focusingControlAppendTerm
					? getControlAppendTerm() as HTMLElement
					: getTermControl(undefined, 1) as HTMLElement;
				activateInput(controlTarget, shiftRight);
			}
			return;
		}
		const controlTarget = getTermControl(undefined, replaces
			? shiftRight ? idx + 1 : idx - 1
			: terms.length - 1) as HTMLElement;
		activateInput(controlTarget, shiftRight);
	};

	return (terms: MatchTerms, controlPad: HTMLElement, idxCode: number) => {
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement ?? controlPad;
		const controlEdit = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_EDIT))[0] as HTMLElement | undefined;
		const term = terms[idxCode] as MatchTerm | undefined;
		const replaces = idxCode !== TermChange.CREATE;
		const termInput = document.createElement("input");
		termInput.type = "text";
		termInput.classList.add(getSel(ElementClass.DISABLED));
		const resetInput = (termText = controlContent.textContent as string) => {
			termInput.value = replaces ? termText : "";
		};
		termInput.onfocus = () => {
			termInput.classList.remove(getSel(ElementClass.DISABLED));
			resetInput();
			purgeClass(getSel(ElementClass.ACTIVE), document.getElementById(getSel(ElementID.BAR)) as HTMLElement);
			termInput.classList.add(getSel(ElementClass.ACTIVE));
		};
		termInput.onblur = () => {
			commit(term, terms);
			termInput.classList.add(getSel(ElementClass.DISABLED));
		};
		const show = (event: MouseEvent) => {
			event.preventDefault();
			termInput.select();
		};
		const hide = () => {
			termInput.blur();
		};
		if (controlEdit) {
			controlEdit.onclick = event => {
				if (!termInput.classList.contains(getSel(ElementClass.ACTIVE)) || getComputedStyle(termInput).width === "0") {
					show(event);
				} else {
					termInput.value = "";
					commit(term, terms);
					hide();
				}
			};
			controlEdit.oncontextmenu = event => {
				event.preventDefault();
				termInput.value = "";
				commit(term, terms);
				hide();
			};
			controlContent.oncontextmenu = show;
		} else if (!replaces) {
			const button = controlPad.querySelector("button") as HTMLButtonElement;
			button.onclick = show;
			button.oncontextmenu = show;
		}
		(new ResizeObserver(entries =>
			entries.forEach(entry => entry.contentRect.width === 0 ? hide() : undefined)
		)).observe(termInput);
		termInput.onkeydown = event => {
			if (event.key === "Enter") {
				if (event.shiftKey) {
					hide();
				} else {
					commit(term, terms);
					resetInput(termInput.value);
				}
			} else if (event.key === "Escape") {
				resetInput();
				hide();
			} else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				shiftTermFocus(term, event.key === "ArrowRight", () => event.preventDefault(), terms);
			}
		};
		return termInput;
	};
})();

const insertStyle = (terms: MatchTerms, style: HTMLElement, hues: ReadonlyArray<number>) => {
	const zIndexMax = 2147483647;
	style.textContent = `
/* TODO reorganise and rename */
/* TERM INPUT & BUTTONS */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input,
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input
	{ width: 5em; padding: 0 2px 0 2px !important; margin-left: 4px; border: none !important; outline: revert;
	box-sizing: unset !important; font-family: revert !important; color: #000 !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled,
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)}),
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.BAR_CONTROL)} input:not(:focus),
#${getSel(ElementID.BAR)} .${getSel(ElementClass.BAR_CONTROL)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
	{ width: 0; padding: 0 !important; margin: 0; }
#${getSel(ElementID.BAR)}
.${getSel(ElementClass.CONTROL_PAD)} .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.PRIMARY)}
	{ display: block; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:disabled
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)}:not(:hover) .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus)
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)},
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} input:not(:focus, .${getSel(ElementClass.ACTIVE)})
+ .${getSel(ElementClass.CONTROL_EDIT)} .${getSel(ElementClass.SECONDARY)}
	{ display: none; }
/**/

/* TERM MATCH MODES STYLE */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_CASE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-top: 0 !important; border-top: 1px dashed black; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.CONTROL)}:not(.${getSel(ElementClass.MATCH_STEM)})
.${getSel(ElementClass.CONTROL_CONTENT)}
	{ text-decoration: underline; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.MATCH_WHOLE)} .${getSel(ElementClass.CONTROL_CONTENT)}
	{ padding-inline: 2px !important; border-inline: 2px solid hsl(0 0% 0% / 0.4); }
/**/

/* BAR */
#${getSel(ElementID.BAR)}
	{ all: revert; position: fixed; z-index: ${zIndexMax}; color-scheme: light; font-size: 14.6px; line-height: initial; user-select: none; }
#${getSel(ElementID.BAR)}.${getSel(ElementClass.BAR_HIDDEN)}
	{ display: none; }
#${getSel(ElementID.BAR)} *
	{ all: revert; font: revert; font-size: inherit; line-height: 120%; padding: 0; outline: none; }
#${getSel(ElementID.BAR)} img
	{ height: 1.1em; width: 1.1em; }
#${getSel(ElementID.BAR)} button
	{ display: flex; align-items: center; padding-inline: 4px; margin-block: 0; border: none; border-radius: inherit;
	background: none; color: #000 !important; cursor: initial; letter-spacing: normal; transition: unset; }
#${getSel(ElementID.BAR)} > *
	{ display: inline; }
#${getSel(ElementID.BAR)} > * > *
	{ display: inline-block; vertical-align: top; margin-left: 0.5em; }
/**/

/* TERM PULLDOWN */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}:active:not(:hover)
+ .${getSel(ElementClass.OPTION_LIST)}
	{ display: flex; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION_LIST)}
	{ position: absolute; flex-direction: column; top: 100%; width: max-content; padding: 0; margin: 0; z-index: 1; display: none; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}
	{ font-size: small; margin-left: 3px; background: hsl(0 0% 75%) !important; filter: grayscale(100%);
	width: 100%; text-align: left; color: #111 !important;
	border-color: hsl(0 0% 50%) !important; border-bottom-width: 1px !important;
	border-style: none none solid solid !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.OPTION)}:hover
	{ background: hsl(0 0% 90%) !important; }
/**/

/* BAR CONTROL PADS */
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)}
	{ display: flex; height: 1.3em;
	background: hsl(0 0% 90% / 0.8) !important; color: #000 !important; border-style: none; border-radius: 4px; box-shadow: 1px 1px 5px; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:hover
	{ background: hsl(0 0% 65%) !important; }
#${getSel(ElementID.BAR)} .${getSel(ElementClass.CONTROL_PAD)} button:active
	{ background: hsl(0 0% 50%) !important; }
#${getSel(ElementID.BAR)} > * > .${getSel(ElementClass.DISABLED)}
	{ display: none; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ display: flex; }
#${getSel(ElementID.BAR)} #${getSel(ElementID.BAR_TERMS)}
.${getSel(ElementClass.CONTROL_PAD)}.${getSel(ElementClass.DISABLED)}
	{ background: hsl(0 0% 80% / 0.6) !important; }
/**/

/* TERM SCROLL MARKERS */
@keyframes ${getSel(Keyframes.MARKER_ON)}
	{ from {} to { padding-right: 16px; }; }
@keyframes ${getSel(Keyframes.MARKER_OFF)}
	{ from { padding-right: 16px; } to { padding-right: 0; }; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ z-index: ${zIndexMax}; display: block; right: 0; top: 0; width: 12px; height: 100%; }
#${getSel(ElementID.MARKER_GUTTER)} div
	{ width: 16px; height: 100%; top: 0; height: 1px; position: absolute; right: 0; border-left: solid black 1px; box-sizing: unset;
	padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
#${getSel(ElementID.MARKER_GUTTER)}
	{ position: fixed; background: linear-gradient(to right, transparent, hsl(0 0% 0% / 0.7) 70%); }
#${getSel(ElementID.MARKER_GUTTER)} div.${getSel(ElementClass.FOCUS)}
	{ padding-right: 16px; transition: unset; }
/**/

/* TERM HIGHLIGHTS */
@keyframes ${getSel(Keyframes.FLASH)}
	{ from { background-color: hsl(0 0% 65% / 0.8); } to {}; }
.${getSel(ElementClass.FOCUS_CONTAINER)}
	{ animation: ${getSel(Keyframes.FLASH)} 1s; }
/**/
	`;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const isAboveStyleLevel = (level: number) => i >= hues.length * level;
		const getBackgroundStyle = (colorA: string, colorB: string) =>
			isAboveStyleLevel(1)
				?  `repeating-linear-gradient(${
					isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
				}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
				: colorA;
		style.textContent += `
/* TERM HIGHLIGHTS */
#${getSel(ElementID.BAR)}.${getSel(ElementClass.HIGHLIGHTS_SHOWN)}
~ body mms-h.${getSel(ElementClass.TERM, term.selector)},
#${getSel(ElementID.BAR)}
~ body .${getSel(ElementClass.FOCUS_CONTAINER)} mms-h.${getSel(ElementClass.TERM, term.selector)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 100% 60% / 0.4)`, `hsl(${hue} 100% 84% / 0.4)`)} !important;
	border-radius: 2px !important; box-shadow: 0 0 0 1px hsl(${hue} 100% 20% / 0.35) !important; }
/**/

/* TERM MARKERS */
#${getSel(ElementID.MARKER_GUTTER)} .${getSel(ElementClass.TERM, term.selector)}
	{ background: hsl(${hue} 100% 50%); }
/**/

/* TERM BUTTONS */
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_PAD)}
	{ background: ${getBackgroundStyle(`hsl(${hue} 70% 70% / 0.8)`, `hsl(${hue} 70% 88% / 0.8)`)} !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:hover,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:hover:not(:disabled)
	{ background: hsl(${hue} 70% 80%) !important; }
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_CONTENT)}:active,
#${getSel(ElementID.BAR_TERMS)} .${getSel(ElementClass.TERM, term.selector)}
.${getSel(ElementClass.CONTROL_EDIT)}:active:not(:disabled)
	{ background: hsl(${hue} 70% 70%) !important; }
#${getSel(ElementID.BAR_TERMS)}.${getSel(ElementClass.CONTROL_PAD, i)}
.${getSel(ElementClass.TERM, term.selector)} .${getSel(ElementClass.CONTROL_PAD)}
	{ background: hsl(${hue} 100% 90%) !important; }
/**/
		`;
	});
};

const getTermIdx = (term: MatchTerm | undefined, terms: MatchTerms) =>
	term ? terms.indexOf(term) : TermChange.CREATE
;

const getTermControl = (term?: MatchTerm, idx?: number) => {
	const barTerms = document.getElementById(getSel(ElementID.BAR_TERMS)) as HTMLElement;
	return (idx === undefined && term
		? barTerms.getElementsByClassName(getSel(ElementClass.TERM, term.selector))[0]
		: idx === undefined || idx >= barTerms.children.length
			? getControlAppendTerm()
			: Array.from(barTerms.children).at(idx ?? -1)
	) as HTMLElement | undefined;
};

const getControlAppendTerm = () =>
	(document.getElementById(getSel(ElementID.BAR_CONTROLS)) as HTMLElement)
		.firstElementChild as HTMLElement | undefined
;

const updateTermOccurringStatus = (term: MatchTerm) => {
	const controlPad = (getTermControl(term) as HTMLElement)
		.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
	const hasOccurrences = document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)).length != 0;
	controlPad.classList[hasOccurrences ? "remove" : "add"](getSel(ElementClass.DISABLED));
};

const updateTermTooltip = (() => {
	const getOccurrenceCount = (term: MatchTerm) => {
		const occurrences = Array.from(document.body.getElementsByClassName(getSel(ElementClass.TERM, term.selector)));
		const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		return matches ? matches.length : 0;
	};

	return (term: MatchTerm) => {
		const controlPad = (getTermControl(term) as HTMLElement)
			.getElementsByClassName(getSel(ElementClass.CONTROL_PAD))[0] as HTMLElement;
		const controlContent = controlPad
			.getElementsByClassName(getSel(ElementClass.CONTROL_CONTENT))[0] as HTMLElement;
		const occurrenceCount = getOccurrenceCount(term);
		controlContent.title = `${occurrenceCount} ${occurrenceCount === 1 ? "match" : "matches"} in page${
			!occurrenceCount || !term.command ? ""
				: occurrenceCount === 1 ? `\nJump to: ${term.command} or ${term.commandReverse}`
					: `\nJump to next: ${term.command}\nJump to previous: ${term.commandReverse}`
		}`;
	};
})();

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
	const control = getTermControl(undefined, idx) as HTMLElement;
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

const removeTermControl = (idx: number) => {
	(getTermControl(undefined, idx) as HTMLElement).remove();
};

const insertTermControl = (() => {
	const createTermOption = (terms: MatchTerms, term: MatchTerm, title: string) => {
		const matchType = getTermOptionMatchType(title);
		const onActivated = () => {
			term.matchMode[matchType] = !term.matchMode[matchType];
			term.compile();
			const message: BackgroundMessage = {
				terms,
				termChanged: term,
				termChangedIdx: getTermIdx(term, terms),
			};
			chrome.runtime.sendMessage(message);
		};
		const option = document.createElement("button");
		option.classList.add(getSel(ElementClass.OPTION));
		option.tabIndex = -1;
		option.textContent = getTermOptionText(term.matchMode[matchType], title);
		option.onmouseup = onActivated;
		return option;
	};

	return (highlightTags: HighlightTags, terms: MatchTerms, idx: number, command: string, commandReverse: string,
		controlsInfo: ControlsInfo) => {
		const term = terms.at(idx) as MatchTerm;
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
		const controlEditRemove = document.createElement("img");
		controlEditChange.src = chrome.runtime.getURL("/icons/edit.svg");
		controlEditRemove.src = chrome.runtime.getURL("/icons/delete.svg");
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
		menu.appendChild(createTermOption(terms, term, "Case\u00A0Sensitive"));
		menu.appendChild(createTermOption(terms, term, "Stem\u00A0Word"));
		menu.appendChild(createTermOption(terms, term, "Whole\u00A0Word"));
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
			const container = document.createElement("span"); // TODO find how vscode knows the type produced by the argument
			container.classList.add(getSel(ElementClass.BAR_CONTROL)); // TODO redundant, use CSS to select class containing this
			container.classList.add(getSel(ElementClass.BAR_CONTROL, id));
			container.tabIndex = -1;
			const pad = document.createElement("span");
			pad.classList.add(getSel(ElementClass.CONTROL_PAD));
			pad.tabIndex = -1;
			const button = document.createElement("button");
			button.tabIndex = -1;
			if (info.path) {
				const image = document.createElement("img");
				image.src = chrome.runtime.getURL(info.path);
				button.appendChild(image);
			}
			if (info.label) {
				const text = document.createElement("span");
				text.tabIndex = -1;
				text.textContent = info.label;
				button.appendChild(text);
			}
			pad.appendChild(button);
			container.appendChild(pad);
			if (hideWhenInactive) {
				container.classList.add(getSel(ElementClass.DISABLED));
			}
			button.onclick = info.onclick ?? null;
			if (info.setUp) {
				info.setUp(container);
			}
			(document.getElementById(getSel(info.containerId)) as HTMLElement).appendChild(container);
		};

		return (terms: MatchTerms, barControl: BarControl, hideWhenInactive: boolean) =>
			create(barControl, ({
				[BarControl.DISABLE_TAB_RESEARCH]: {
					path: "/icons/close.svg",
					containerId: ElementID.BAR_OPTIONS,	
					onclick: () => chrome.runtime.sendMessage({
						disableTabResearch: true,
					} as BackgroundMessage),
				},
				[BarControl.PERFORM_SEARCH]: {
					path: "/icons/search.svg",
					containerId: ElementID.BAR_OPTIONS,
					onclick: () => chrome.runtime.sendMessage({
						performSearch: true,
					} as BackgroundMessage),
				},
				[BarControl.APPEND_TERM]: {
					path: "/icons/create.svg",
					containerId: ElementID.BAR_CONTROLS,
					setUp: container => {
						const pad = container.querySelector(`.${getSel(ElementClass.CONTROL_PAD)}`) as HTMLElement;
						const termInput = createTermInput(terms, pad, TermChange.CREATE);
						pad.appendChild(termInput);
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
		bar.ondragstart = event => event.preventDefault();
		bar.onmouseenter = () => {
			purgeClass(getSel(ElementClass.ACTIVE), bar);
			const controlInput = document.activeElement;
			if (controlInput && controlInput.tagName === "INPUT"
				&& controlInput.closest(`#${getSel(ElementID.BAR)}`)) {
				controlInput.classList.add(getSel(ElementClass.ACTIVE));
			}
		};
		bar.onmouseleave = bar.onmouseenter;
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
		// TODO construct using template literal/s instead of invoking the HTML parser for each?
		const regexMatchTermSelector = new RegExp(`\\b${getSel(ElementClass.TERM)}-\\w+-\\w+\\b`);
		const gutter = document.getElementById(getSel(ElementID.MARKER_GUTTER)) as HTMLElement;
		const containersInfo: Array<{
			container: HTMLElement,
			termsAdded: Set<string>,
		}> = [];
		const gutterParent = gutter.parentElement as HTMLElement;
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
		gutterParent.appendChild(gutter);
	};
})();

const highlightInNodes = (() => {
	const highlightInNode = (term: MatchTerm, textEndNode: Node, start: number, end: number) => {
		// TODO add strategy for mitigating damage (caused by programmatic changes by the website).
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
		// Logic carried over from 'walker'
		const walkerBreakHandler = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node => {
			switch (node.nodeType) {
			case (1): // Node.ELEMENT_NODE
			case (11): { // Node.DOCUMENT_FRAGMENT_NODE
				if (highlightTags.reject.test((node as Element).tagName)) {
					return 2; // NodeFilter.FILTER_REJECT
				}
				if (highlightTags.flow.test((node as Element).tagName)) {
					return 1; // NodeFilter.FILTER_ACCEPT
				}
				if (node.hasChildNodes()) {
					breakLevels.push(level);
				}
				if (nodeItems.first) {
					highlightInBlock(nodeItems, terms);
				}
				return 1; // NodeFilter.FILTER_ACCEPT
			} case (3): { // Node.TEXT_NODE
				if (level > breakLevels[breakLevels.length - 1]) {
					nodeItems.push(node);
				}
				return 1; // NodeFilter.FILTER_ACCEPT
			}}
			return 2; // NodeFilter.FILTER_REJECT
		} });
		// Logic copied in 'walkerBreakHandler' (repetition allowed for critical optimisation)
		const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_ALL, { acceptNode: node =>
			(node.nodeType === 1 || node.nodeType === 11) // Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
				? highlightTags.reject.test((node as Element).tagName)
					? 2 : 1 // NodeFilter.FILTER_REJECT, NodeFilter.FILTER_ACCEPT
				: node.nodeType === 3 // Node.TEXT_NODE
					? 1 : 2 // NodeFilter.FILTER_ACCEPT, NodeFilter.FILTER_REJECT
		});
		let node: Node | null = walkerBreakHandler.currentNode;
		while (node) {
			level++; // Down to child level
			node = walkerBreakHandler.firstChild();
			if (!node) {
				level--; // Up to sibling level
				walker.currentNode = walkerBreakHandler.currentNode;
				node = walker.nextSibling();
				while (!node) {
					level--; // Up to parent level
					walker.parentNode();
					walkerBreakHandler.currentNode = walker.currentNode;
					if (level === breakLevels[breakLevels.length - 1]) {
						breakLevels.pop();
						if (nodeItems.first) {
							highlightInBlock(nodeItems, terms);
						}
					}
					if (level <= 0) {
						return;
					}
					node = walker.nextSibling();
				}
				node = walkerBreakHandler.nextSibling();
			}
		}
	};

	return (requestRefreshIndicators: RequestRefreshIndicators, highlightTags: HighlightTags, terms: MatchTerms,
		rootNode: Node) => {
		insertHighlights(rootNode, highlightTags, terms);
		requestRefreshIndicators.next();
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

	return (requestRefreshIndicators: RequestRefreshIndicators, highlightTags: HighlightTags, terms: MatchTerms) => {
		const rejectSelector = highlightTags.reject.source.slice(5, -3).split("|").join(", ");
		return new MutationObserver(mutations => {
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					// Node.ELEMENT_NODE, Node.DOCUMENT_FRAGMENT_NODE
					if ((node.nodeType === 1 || node.nodeType === 11) && canHighlightNode(rejectSelector, node as Element)) {
						highlightInNodes(requestRefreshIndicators, highlightTags, terms, node);
					}
				}
			}
			terms.forEach(term => updateTermOccurringStatus(term));
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
				const control = document.querySelector(termIdx === -1
					? `#${getSel(ElementID.BAR_CONTROLS)}`
					: `#${getSel(ElementID.BAR)} .${getSel(ElementClass.TERM, terms[termIdx].selector)}`
				) as HTMLElement;
				const input = control.querySelector("input") as HTMLInputElement;
				const button = control.querySelector("button") as HTMLButtonElement;
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

	return (highlightTags: HighlightTags, requestRefreshIndicators: RequestRefreshIndicators,
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
		highlightInNodes(requestRefreshIndicators, highlightTags, terms, document.body);
		terms.forEach(term => updateTermOccurringStatus(term));
		highlightInNodesOnMutation(observer);
	};
})();

(() => {
	const refreshTermControls = (() => {
		const insertToolbar = (highlightTags: HighlightTags, commands: BrowserCommands, terms: MatchTerms,
			style: HTMLElement, controlsInfo: ControlsInfo, hues: TermHues) => {
			removeControls();
			addControls(highlightTags, commands, terms, style, controlsInfo, hues);
		};
	
		return (highlightTags: HighlightTags, terms: MatchTerms, commands: BrowserCommands, style: HTMLElement,
			observer: MutationObserver, selectTermPtr: FnProcessCommand,
			requestRefreshIndicators: RequestRefreshIndicators,
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
			} else if (termsUpdate !== undefined) {
				// TODO retain colours?
				if (termToUpdateIdx === TermChange.REMOVE && termUpdate) {
					const termRemovedPreviousIdx = terms.findIndex(term => JSON.stringify(term) === JSON.stringify(termUpdate));
					if (termRemovedPreviousIdx === -1) {
						console.warn(`Request received to delete term ${JSON.stringify(termUpdate)} which is not stored in this page.`);
					} else {
						removeTermControl(termRemovedPreviousIdx);
						terms.splice(termRemovedPreviousIdx, 1);
						if (termRemovedPreviousIdx === terms.length) {
							// Since it was the last term, simply removing its highlights is accurate (as they are the most recent)
							restoreNodes(getSel(ElementClass.TERM, termUpdate.selector));
							return;
						}
					}
				} else {
					terms.splice(0);
					termsUpdate.forEach(term => terms.push(new MatchTerm(term.phrase, term.matchMode)));
					insertToolbar(highlightTags, commands, terms, style, controlsInfo, hues);
				}
			} else if (!disable && !termsFromSelection) {
				return;
			}
			// TODO incrementally cheaper highlight insertion for adding/modifying/removing terms
			if (!disable) {
				insertStyle(terms, style, hues);
			}
			// Timeout seems to reduce freezing impact (by causing threading?)
			setTimeout(() => insertHighlights(
				highlightTags, requestRefreshIndicators, termsToHighlight.length ? termsToHighlight : terms,
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
			flow: getHighlightTagsRegex([ "b", "i", "u", "strong", "em", "cite", "span", "mark", "wbr", "code", "data", "dfn", "ins",
				"mms-h" as HTMLElementTagName ]),
			// break: any other class of element
		};
		const requestRefreshIndicators: RequestRefreshIndicators = function* () {
			let timeRequestAcceptedLast = 0;
			while (true) {
				const requestWaitDuration = 1000;
				const date = Date.now();
				if (date > timeRequestAcceptedLast + requestWaitDuration) {
					timeRequestAcceptedLast = date;
					setTimeout(() => {
						insertScrollMarkers(highlightTags, terms);
						terms.forEach(term => updateTermTooltip(term));
					}, requestWaitDuration + 50);
				}
				yield;
			}
		}();
		const observer = getObserverNodeHighlighter(requestRefreshIndicators, highlightTags, terms);
		const style = insertStyleElement();
		chrome.runtime.onMessage.addListener((message: HighlightMessage, sender, sendResponse) => {
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
			// TODO better way of identifying if extension is already active but with no terms
			if (message.disable || message.termsFromSelection || message.termUpdate || (message.terms !== undefined
				&& (!itemsMatchLoosely(terms, message.terms, (a: MatchTerm, b: MatchTerm) => a.phrase === b.phrase)
				|| (!terms.length && !document.getElementById(ElementID.BAR))))) {
				refreshTermControls(
					highlightTags, terms, commands, style, observer, processCommand, requestRefreshIndicators,
					message.termsFromSelection ?? false, message.disable ?? false, controlsInfo, hues,
					message.terms, message.termUpdate, message.termToUpdateIdx,
				);
			}
			// TODO improve handling of highlight setting
			const bar = document.getElementById(getSel(ElementID.BAR)) as HTMLElement;
			bar.classList[controlsInfo.highlightsShown ? "add" : "remove"](getSel(ElementClass.HIGHLIGHTS_SHOWN));
			sendResponse(); // Manifest V3 bug
		});
	};
})()();
