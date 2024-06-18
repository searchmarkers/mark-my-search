import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";

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

type Engine =
	| "ELEMENT"
	| "PAINT"
	| "HIGHLIGHT"
;

type PaintEngineMethod =
	| "paint"
	| "element"
	| "url"
;

class Compatibility {
	readonly browser: Browser = globalThis.browser ? "firefox" : "chromium";

	#highlighting: HighlightingCompatibility | null = null;
	get highlighting (): HighlightingCompatibility {
		if (!this.#highlighting) {
			this.#highlighting = new HighlightingCompatibility();
		}
		return this.#highlighting;
	}
}

class HighlightingCompatibility {
	readonly engines: Readonly<Record<Engine, boolean>>;
	readonly engineFallback: Engine = "ELEMENT";
	readonly paintEngineMethods: Readonly<Record<PaintEngineMethod, boolean>>;
	readonly paintEngineMethodFallback: PaintEngineMethod = "url";

	constructor () {
		this.engines = {
			ELEMENT: true,
			PAINT: true,
			HIGHLIGHT: !!globalThis.CSS?.highlights,
		};
		this.paintEngineMethods = {
			paint: !!globalThis.CSS?.paintWorklet,
			// `element()` might be defined anyway, could have false negatives.
			element: (!!globalThis.document
				&& !!(globalThis.document as Document & { mozSetImageElement: unknown }).mozSetImageElement
			),
			url: true,
		};
	}
	
	engineToUse (preference: Engine) {
		return this.engines[preference] ? preference : this.engineFallback;
	}

	paintEngineMethodToUse (preference: PaintEngineMethod) {
		return this.paintEngineMethods[preference] ? preference : this.paintEngineMethodFallback;
	}
}

const compatibility = new Compatibility();

const [ Z_INDEX_MIN, Z_INDEX_MAX ] = [ -(2**31), 2**31 - 1 ];

const EleID = (() => {
	const wrap = (name: string) => "markmysearch--" + name;
	return {
		STYLE: wrap("style"),
		STYLE_PAINT: wrap("style-paint"),
		STYLE_PAINT_SPECIAL: wrap("style-paint-special"),
		BAR: wrap("bar"),
		BAR_LEFT: wrap("bar-left"),
		BAR_TERMS: wrap("bar-terms"),
		BAR_RIGHT: wrap("bar-right"),
		MARKER_GUTTER: wrap("markers"),
		DRAW_CONTAINER: wrap("draw-container"),
		DRAW_ELEMENT: wrap("draw"),
		ELEMENT_CONTAINER_SPECIAL: wrap("element-container-special"),
		INPUT: wrap("input"),
	} as const;
})();

const EleClass = (() => {
	const wrap = (name: string) => "mms--" + name;
	return {
		HIGHLIGHTS_SHOWN: wrap("highlights-shown"),
		BAR_HIDDEN: wrap("bar-hidden"),
		BAR_NO_AUTOFOCUS: wrap("bar-no-autofocus"),
		CONTROL: wrap("control"),
		CONTROL_PAD: wrap("control-pad"),
		CONTROL_INPUT: wrap("control-input"),
		CONTROL_CONTENT: wrap("control-content"),
		CONTROL_BUTTON: wrap("control-button"),
		CONTROL_REVEAL: wrap("control-reveal"),
		CONTROL_EDIT: wrap("control-edit"),
		OPTION_LIST: wrap("options"),
		OPTION: wrap("option"),
		OPTION_LIST_PULLDOWN: wrap("options-pulldown"),
		TERM: wrap("term"),
		FOCUS: wrap("focus"),
		FOCUS_CONTAINER: wrap("focus-contain"),
		FOCUS_REVERT: wrap("focus-revert"),
		REMOVE: wrap("remove"),
		DISABLED: wrap("disabled"),
		LAST_FOCUSED: wrap("last-focused"),
		MENU_OPEN: wrap("menu-open"),
		COLLAPSED: wrap("collapsed"),
		UNCOLLAPSIBLE: wrap("collapsed-impossible"),
		MATCH_REGEX: wrap("match-regex"),
		MATCH_CASE: wrap("match-case"),
		MATCH_STEM: wrap("match-stem"),
		MATCH_WHOLE: wrap("match-whole"),
		MATCH_DIACRITICS: wrap("match-diacritics"),
		PRIMARY: wrap("primary"),
		SECONDARY: wrap("secondary"),
		BAR_CONTROLS: wrap("bar-controls"),
	} as const;
})();

const AtRuleID = (() => {
	const wrap = (name: string) => "markmysearch--" + name;
	return {
		FLASH: wrap("flash"),
		MARKER_ON: wrap("marker-on"),
		MARKER_OFF: wrap("marker-off"),
	} as const;
})();

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

const focusClosest = <E extends HTMLElement>(element: E, filter: (element: E) => boolean) => {
	element.focus({ preventScroll: true }); // TODO use focusElement function instead (rename the function too)
	if (document.activeElement !== element) {
		if (filter(element)) {
			focusClosest(element.parentElement as E, filter);
		} else if (document.activeElement) {
			(document.activeElement as HTMLElement).blur();
		}
	}
};

const getTermClass = (term: MatchTerm, termTokens: TermTokens): string => EleClass.TERM + "-" + termTokens.get(term);

const getTermTokenClass = (termToken: string): string => EleClass.TERM + "-" + termToken;

const getTermClassToken = (termClass: string) => termClass.slice(EleClass.TERM.length + 1);

const getIdSequential = (function* () {
	let id = 0;
	while (true) {
		yield id++;
	}
})();

interface RWContainer<T> extends RContainer<T>, WContainer<T> {
	current: T,
}

interface RContainer<T> {
	readonly current: T,
}

interface WContainer<T> {
	readonly assign: (item: T) => void;
}

const createContainer = <T,>(current: T): RWContainer<T> => {
	const container: RWContainer<T> = {
		current,
		assign: (item) => {
			container.current = item;
		}
	};
	return container;
};

// From https://stackoverflow.com/a/76176570. TODO understand how this works

type FromEntries = <const T extends ReadonlyArray<readonly [PropertyKey, unknown]>>(
	entries: T
) => { [K in T[number] as K[0]]: K[1] }

// Experimental
type A<T> = T extends undefined ? never : T
type B<T extends [ unknown, unknown ]> = T extends ([ infer R1, infer R2 | undefined ]) ? [ R1, R2 ] : T

type Entries = <T extends Record<PropertyKey, unknown>>(
	obj: T
) => Array<B<A<{ [K in keyof T]: [K, T[K]] }[keyof T]>>>

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

/**
 * Sanitizes a string for regex use by escaping all potential regex control characters.
 * @param word A string.
 * @param replacement The character pattern with which the sanitizer regex will replace potential control characters.
 * Defaults to a pattern which evaluates to the backslash character plus the control character, hence escaping it.
 * @returns The transformed string to be matched in exact form as a regex pattern.
 */
const sanitizeForRegex = (word: string, replacement = "\\$&") =>
	word.replace(/[/\\^$*+?.()|[\]{}]/g, replacement)
;

export {
	log, assert,
	type Browser, compatibility,
	type Engine, type PaintEngineMethod,
	Z_INDEX_MIN, Z_INDEX_MAX,
	EleID, EleClass, AtRuleID,
	getElementTagsSet,
	getNodeFinal, isVisible, getElementYRelative, elementsPurgeClass, focusClosest,
	getTermClass, getTermTokenClass, getTermClassToken,
	getIdSequential,
	type RWContainer, type RContainer, type WContainer, createContainer,
	type FromEntries, type Entries,
	itemsMatch,
	sanitizeForRegex,
};
