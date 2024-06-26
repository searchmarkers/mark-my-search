type HighlightType = (
	| "highlight"
	| "spelling-error"
	| "grammar-error"
)

declare class Highlight extends Set<AbstractRange> {
	constructor (...initialRanges: Array<AbstractRange>)
	priority: number;
	type: HighlightType;
}

declare namespace CSS {
	const highlights: HighlightRegistry | undefined;
}

declare class HighlightRegistry extends Map<string, Highlight> {}
