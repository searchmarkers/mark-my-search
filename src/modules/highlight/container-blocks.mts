import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";

/**
 * A selector string for the container block of an element.
 */
const containerBlockSelector = `:not(${Array.from(highlightTags.flow).join(", ")})`;

/**
 * Gets the containing block of an element.
 * This is its **closest ancestor (inclusive)** which has no tag name counted as 'flow' type.
 * @param element The element of which to find the first container block.
 * @returns The closest container block ancestor.
 */
const getContainerBlock = (element: HTMLElement): HTMLElement =>
	// Always returns an element since "body" is not a flow tag.
	element.closest(containerBlockSelector)!
;

export { containerBlockSelector, getContainerBlock };
