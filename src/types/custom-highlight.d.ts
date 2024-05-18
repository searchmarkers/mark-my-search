type HighlightType = (
	| "highlight"
	| "spelling-error"
	| "grammar-error"
)

declare class Highlight extends Set<AbstractRange> {
	constructor(...initialRanges: AbstractRange[]);
	priority: number;
	type: HighlightType;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace CSS {
	const highlights: HighlightRegistry | undefined;
}

declare class HighlightRegistry extends Map<string, Highlight> {}
