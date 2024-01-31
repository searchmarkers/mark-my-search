/**
 * Logs a debug message as part of normal operation.
 * @param operation Description of the process started or completed, or the event encountered.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description (omittable) of the reason for the process or situation.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 */
const log = (operation: string, reason: string, metadata: Record<string, unknown> = {}) => {
	const operationStatement = `LOG: ${operation[0].toUpperCase() + operation.slice(1)}`;
	const reasonStatement = reason.length ? reason[0].toUpperCase() + reason.slice(1) : "";
	console.log(operationStatement
		+ (reasonStatement.length ? `: ${reasonStatement}.` : ".")
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : "")
	);
};

/**
 * Logs a graceful failure message if the condition is not met.
 * @param condition A value which will be evaluated to `true` or `false`. If falsy, there has been a problem which will be logged.
 * @param problem Description of the operation failure.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description of the low-level reason for the failure.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 * @param metadata Objects which may help with debugging the problem.
 * @returns `true` if the condition is truthy, `false` otherwise.
 */
const assert = (condition: unknown, problem: string, reason: string, metadata: Record<string, unknown> = {}): boolean => {
	if (!condition) {
		console.warn(`LOG: ${problem[0].toUpperCase() + problem.slice(1)}: ${reason[0].toUpperCase() + reason.slice(1)}.`
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : ""));
	}
	return !!condition;
};

/**
 * Gets a JSON-stringified form of the given object for use in logging.
 * @param object An object.
 * @returns A stringified form of the object. The JSON may be collapsed or expanded depending on size.
 */
const getObjectStringLog = (object: Record<string, unknown>): string =>
	JSON.stringify(
		object,
		undefined,
		(Object.keys(object).length > 1
		|| (typeof(Object.values(object)[0]) === "object"
			&& Object.keys(Object.values(object)[0] as Record<string, unknown>).length))
			? 2 : undefined,
	)
;

type Browser = "firefox" | "chromium"

const compatibility: {
	browser: Browser
	highlight: {
		paintEngine: {
			paintMethod: boolean
			elementMethod: boolean
		}
		highlightEngine: boolean
	}
} = {
	browser: globalThis.browser ? "firefox" : "chromium",
	highlight: {
		paintEngine: {
			paintMethod: !!globalThis.CSS?.paintWorklet,
			// `element()` might be defined anyway, could have false negatives.
			elementMethod: !!(globalThis.document ? globalThis.document["mozSetImageElement"] : undefined),
		},
		highlightEngine: !!globalThis.CSS?.highlights,
	},
};

type Engine =
	| "element"
	| "paint"
	| "highlight"
;

type PaintEngineMethod =
	| "paint"
	| "element"
	| "url"
;

const [ Z_INDEX_MIN, Z_INDEX_MAX ] = [ -(2**31), 2**31 - 1 ];

const EleID = {
	STYLE: "markmysearch__style",
	STYLE_PAINT: "markmysearch__style_paint",
	STYLE_PAINT_SPECIAL: "markmysearch__style_paint_special",
	BAR: "markmysearch__bar",
	BAR_LEFT: "markmysearch__bar_left",
	BAR_TERMS: "markmysearch__bar_terms",
	BAR_RIGHT: "markmysearch__bar_right",
	MARKER_GUTTER: "markmysearch__markers",
	DRAW_CONTAINER: "markmysearch__draw_container",
	DRAW_ELEMENT: "markmysearch__draw",
	ELEMENT_CONTAINER_SPECIAL: "markmysearch__element_container_special",
	INPUT: "markmysearch__input",
} as const;

const EleClass = {
	HIGHLIGHTS_SHOWN: "mms__highlights_shown",
	BAR_HIDDEN: "mms__bar_hidden",
	CONTROL: "mms__control",
	CONTROL_PAD: "mms__control_pad",
	CONTROL_INPUT: "mms__control_input",
	CONTROL_CONTENT: "mms__control_content",
	CONTROL_BUTTON: "mms__control_button",
	CONTROL_REVEAL: "mms__control_reveal",
	CONTROL_EDIT: "mms__control_edit",
	OPTION_LIST: "mms__options",
	OPTION: "mms__option",
	TERM: "mms__term",
	FOCUS: "mms__focus",
	FOCUS_CONTAINER: "mms__focus_contain",
	FOCUS_REVERT: "mms__focus_revert",
	REMOVE: "mms__remove",
	DISABLED: "mms__disabled",
	WAS_FOCUSED: "mms__was_focused",
	MENU_OPEN: "mms__menu_open",
	MENU_JUST_CLOSED_BY_BUTTON: "mms__menu_just_closed",
	OPENED_MENU: "mms__opened_menu",
	COLLAPSED: "mms__collapsed",
	UNCOLLAPSIBLE: "mms__collapsed_impossible",
	MATCH_REGEX: "mms__match_regex",
	MATCH_CASE: "mms__match_case",
	MATCH_STEM: "mms__match_stem",
	MATCH_WHOLE: "mms__match_whole",
	MATCH_DIACRITICS: "mms__match_diacritics",
	PRIMARY: "mms__primary",
	SECONDARY: "mms__secondary",
	BAR_CONTROLS: "mms__bar_controls",
} as const;

const AtRuleID = {
	FLASH: "markmysearch__flash",
	MARKER_ON: "markmysearch__marker_on",
	MARKER_OFF: "markmysearch__marker_off",
} as const;

/**
 * Transforms an array of lowercase element tags into a set of lowercase and uppercase tags.
 * @param tagsLower An array of tag names in their lowercase form.
 * @returns The transformed set of tag names.
 */
const getElementTagsSet = (tagsLower: Array<keyof HTMLElementTagNameMap>) =>
	new Set(tagsLower.flatMap(tagLower => [ tagLower, tagLower.toUpperCase() ]))
;

/**
 * Gets the node at the end of an element, in layout terms; aka. the last item of a pre-order depth-first search traversal.
 * @param node A container node.
 * @returns The final node of the container.
 */
const getNodeFinal = (node: Node): Node =>
	node.lastChild ? getNodeFinal(node.lastChild) : node
;

/**
 * Determines heuristically whether or not an element is visible. The element need not be currently scrolled into view.
 * @param element An element.
 * @returns `true` if visible, `false` otherwise.
 */
const isVisible = (element: HTMLElement) => // TODO improve correctness
	(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
	&& getComputedStyle(element).visibility !== "hidden"
;

/**
 * Gets the central y-position of the DOM rect of an element, relative to the document scroll container.
 * @param element An element
 * @returns The relative y-position.
 */
const getElementYRelative = (element: HTMLElement) =>
	(element.getBoundingClientRect().y + document.documentElement.scrollTop) / document.documentElement.scrollHeight
;

/**
 * Remove all uses of a class name in elements under a root node in the DOM tree.
 * @param className A class name to purge.
 * @param root A root node under which to purge the class (non-inclusive).
 * @param selectorPrefix A prefix for the selector of elements to purge from. The base selector is the class name supplied.
 * @param predicate A function called for each element, the condition of which must be met in order to purge from that element.
 */
const elementsPurgeClass = (
	className: string,
	root: HTMLElement | DocumentFragment = document.body,
	selectorPrefix = "",
	predicate?: (classList: DOMTokenList) => boolean
) =>
	root.querySelectorAll(`${selectorPrefix}.${className}`).forEach(predicate
		? element => predicate(element.classList) ? element.classList.remove(className) : undefined
		: element => element.classList.remove(className) // Predicate not called when not supplied, for efficiency (bulk purges)
	)
;

type TermHues = Array<number>

const getTermClass = (termToken: string): string => EleClass.TERM + "-" + termToken;

const getTermToken = (termClass: string) => termClass.slice(EleClass.TERM.length + 1);

const getIdSequential = (function* () {
	let id = 0;
	while (true) {
		yield id++;
	}
})();

/**
 * Compares two arrays using an item comparison function.
 * @param as An array of items of a single type.
 * @param bs An array of items of the same type.
 * @param compare A function comparing a corresponding pair of items from the arrays.
 * If unspecified, the items are compared with strict equality.
 * @returns `true` if each item pair matches and arrays are of equal cardinality, `false` otherwise.
 */
const itemsMatch = <T,> (as: ReadonlyArray<T>, bs: ReadonlyArray<T>, compare = (a: T, b: T) => a === b) =>
	as.length === bs.length && as.every((a, i) => compare(a, bs[i]))
;

const { objectSetValue, objectGetValue } = (() => {
	const objectSetGetValue = (object: Record<string, unknown>, key: string, value: unknown, set = true) => {
		if (key.includes(".")) {
			return objectSetValue(
				object[key.slice(0, key.indexOf("."))] as Record<string, unknown>,
				key.slice(key.indexOf(".") + 1),
				value,
			);
		} else {
			if (set) {
				object[key] = value;
			}
			return object[key];
		}
	};

	return {
		objectSetValue: (object: Record<string, unknown>, key: string, value: unknown) =>
			objectSetGetValue(object, key, value),
		objectGetValue: (object: Record<string, unknown>, key: string) =>
			objectSetGetValue(object, key, undefined, false),
	};
})();

export {
	log, assert,
	type Browser, compatibility,
	type Engine, type PaintEngineMethod,
	Z_INDEX_MIN, Z_INDEX_MAX,
	EleID, EleClass, AtRuleID,
	getElementTagsSet,
	getNodeFinal, isVisible, getElementYRelative, elementsPurgeClass,
	type TermHues, getTermClass, getTermToken,
	getIdSequential,
	itemsMatch, objectSetValue, objectGetValue,
}
