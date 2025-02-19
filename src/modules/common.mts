/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import type { HighlightTagName } from "/dist/modules/highlight/models/tree-edit/tags.mjs";

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
			element: (!!globalThis.document && !!globalThis.document["mozSetImageElement"]),
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

enum EleID {
	BAR = "markmysearch--bar",
	MARKER_GUTTER = "markmysearch--markers",
	DRAW_CONTAINER = "markmysearch--draw-container",
	DRAW_ELEMENT = "markmysearch--draw-",
	INPUT = "markmysearch--input-",
}

enum EleClass {
	STYLESHEET = "markmysearch--stylesheet",
	HIGHLIGHTS_SHOWN = "mms--highlights-shown",
	TERM = "mms--term",
	FOCUS = "mms--focus",
	FOCUS_CONTAINER = "mms--focus-contain",
	FOCUS_REVERT = "mms--focus-revert",
	REMOVE = "mms--remove",
}

enum AtRuleID {
	FLASH = "markmysearch--flash",
	MARKER_ON = "markmysearch--marker-on",
	MARKER_OFF = "markmysearch--marker-off",
}

/**
 * Transforms an array of lowercase element tags into a set of lowercase and uppercase tags.
 * @param htmlTags An array of tag names in their lowercase form.
 * @returns The transformed set of tag names.
 */
const getElementTagsSet = (
	htmlTags: Array<keyof HTMLElementTagNameMap | HighlightTagName>,
) => new Set(htmlTags.map(tagLower => tagLower.toUpperCase()));

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
const isVisible = (element: HTMLElement): boolean => // TODO improve correctness
	(element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
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

const focusClosest = (element: HTMLElement, filter: (element: HTMLElement) => boolean) => {
	element.focus({ preventScroll: true }); // TODO use focusElement function instead (rename the function too)
	if (document.activeElement !== element) {
		if (filter(element) && element.parentElement instanceof HTMLElement) {
			focusClosest(element.parentElement, filter);
		} else if (document.activeElement instanceof HTMLElement) {
			document.activeElement.blur();
		}
	}
};

const getTermClass = (term: MatchTerm, termTokens: TermTokens): string => EleClass.TERM + "-" + termTokens.get(term);

const getTermTokenClass = (termToken: string): string => EleClass.TERM + "-" + termToken;

const getTermClassToken = (termClass: string) => termClass.slice(EleClass.TERM.length + 1);

// TODO: Instantiate this in specific places and pass it around, rather than using global index.
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

declare const stopReadonly: unique symbol;

type AllReadonly<T> = (
	T extends infer U & { [stopReadonly]: true } ? U
	: T extends Array<infer V> ? ReadonlyArray<AllReadonly<V>>
	: T extends Set<infer V> ? ReadonlySet<AllReadonly<V>>
	: T extends Map<infer K, infer V> ? ReadonlyMap<AllReadonly<K>, AllReadonly<V>>
	: T extends ReadonlyArray<infer V> ? ReadonlyArray<AllReadonly<V>>
	: T extends ReadonlySet<infer V> ? ReadonlySet<AllReadonly<V>>
	: T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<AllReadonly<K>, AllReadonly<V>>
	: T extends Record<string | number | symbol, unknown> ? { readonly [P in keyof T]: AllReadonly<T[P]> }
	: T
)

type StopReadonly<T> = T & { [stopReadonly]: true }

// From https://stackoverflow.com/a/76176570. TODO understand how this works
type FromEntries = <const T extends ReadonlyArray<readonly [ PropertyKey, unknown ]>>(
	entries: T
) => { [K in T[number] as K[0]]: K[1] }

// Experimental
type A<T> = T extends undefined ? never : T
type B<T extends [ unknown, unknown ]> = T extends ([ infer R1, infer R2 | undefined ]) ? [ R1, R2 ] : T

type Entries = <T extends Record<PropertyKey, unknown>>(
	obj: T
) => Array<B<A<{ [K in keyof T]: [K, T[K]] }[keyof T]>>>

type Partial2<T> = {
	[P in keyof T]: {
		[P1 in keyof T[P]]?: T[P][P1];
	};
};

interface ArrayAccessor<T> {
	readonly getItems: () => ReadonlyArray<T>
	readonly itemEquals: (a: T, b: T) => boolean
	readonly itemsEqual: (items: ReadonlyArray<T>) => boolean
}

interface ArrayMutator<T> {
	readonly setItems: (items: ReadonlyArray<T>) => void
	readonly replaceItem: (item: T | null, index: number) => void
	readonly insertItem: (item: T, index?: number) => void
}

type ArrayListener<T> = (items: ReadonlyArray<T>, oldItems: ReadonlyArray<T>, mutation: ArrayMutation<T> | null) => void

type ArrayMutation<T> = Readonly<{
	type: "remove"
	index: number
	old: T
} | {
	type: "replace"
	index: number
	new: T
	old: T
} | {
	type: "insert"
	index: number
	new: T
}>

interface ArrayObservable<T> {
	readonly addListener: (listener: ArrayListener<T>) => void
}

class ArrayBox<T> implements ArrayAccessor<T>, ArrayMutator<T>, ArrayObservable<T> {
	itemEquals: (a: T, b: T) => boolean;

	#items: ReadonlyArray<T> = [];
	#listeners = new Set<ArrayListener<T>>();

	constructor (itemEquals: (a: T, b: T) => boolean = (a, b) => a === b) {
		this.itemEquals = itemEquals;
	}

	getItems () {
		return this.#items;
	}

	setItems (items: ReadonlyArray<T>) {
		if (this.itemsEqual(items)) {
			return;
		}
		const oldItems = this.#items;
		this.#items = [ ...items ]; // The array passed may mutate unexpectedly; create our own copy.
		for (const listener of this.#listeners) {
			listener(this.#items, oldItems, null);
		}
	}

	itemsEqual (items: ReadonlyArray<T>): boolean {
		return this.#items.length === items.length && this.#items.every((item, i) => this.itemEquals(item, items[i]));
	}

	replaceItem (item: T | null, index: number) {
		if (item && this.itemEquals(item, this.#items[index])) {
			return;
		}
		const mutation: ArrayMutation<T> = item === null ? {
			type: "remove",
			index,
			old: this.#items[index],
		} : {
			type: "replace",
			index,
			new: item,
			old: this.#items[index],
		};
		const oldItems = this.#items;
		if (item) {
			this.#items = this.#items.slice(0, index).concat(item).concat(this.#items.slice(index + 1));
		} else {
			this.#items = this.#items.slice(0, index).concat(this.#items.slice(index + 1));
		}
		for (const listener of this.#listeners) {
			listener(this.#items, oldItems, mutation);
		}
	}

	insertItem (item: T, index?: number) {
		index ??= this.#items.length;
		const mutation: ArrayMutation<T> = {
			type: "insert",
			index,
			new: item,
		};
		const oldItems = this.#items;
		if (index === this.#items.length) {
			this.#items = this.#items.concat(item);
		} else {
			this.#items = this.#items.slice(0, index).concat(item ?? []).concat(this.#items.slice(index));
		}
		for (const listener of this.#listeners) {
			listener(this.#items, oldItems, mutation);
		}
	}

	addListener (listener: ArrayListener<T>) {
		this.#listeners.add(listener);
	}
}

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
	type AllReadonly, type StopReadonly,
	type FromEntries, type Entries,
	type Partial2,
	type ArrayMutation,
	type ArrayAccessor, type ArrayMutator, type ArrayObservable,
	ArrayBox,
	itemsMatch,
	sanitizeForRegex,
};
