import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

type BaseFlow<WithNode extends boolean> = {
	text: string
	spans: Array<BaseSpan<WithNode>>
}

type BaseSpan<WithNode extends boolean> = {
	term: MatchTerm
	start: number
	end: number
} & (WithNode extends true
	? { node: Text }
	: Record<never, never>
)

const matchInText = (
	terms: ReadonlyArray<MatchTerm>,
	termPatterns: TermPatterns,
	text: string,
): Array<BaseSpan<false>> => {
	const spans: Array<BaseSpan<false>> = [];
	for (const term of terms) {
		for (const match of text.matchAll(termPatterns.get(term))) if (match.index !== undefined) {
			spans.push({
				term,
				start: match.index,
				end: match.index + match[0].length,
			});
		}
	}
	return spans;
};

const matchInTextFlow = (
	terms: ReadonlyArray<MatchTerm>,
	termPatterns: TermPatterns,
	text: string,
	textFlow: ReadonlyArray<Text>,
): Array<BaseSpan<true>> => {
	const spans: Array<BaseSpan<true>> = [];
	for (const term of terms) {
		let i = 0;
		let node = textFlow[0];
		let textStart = 0;
		let textEnd = node.length;
		for (const match of text.matchAll(termPatterns.get(term))) {
			const highlightStart = match.index!;
			const highlightEnd = highlightStart + match[0].length;
			while (textEnd <= highlightStart) {
				node = textFlow[++i];
				textStart = textEnd;
				textEnd += node.length;
			}
			while (true) {
				// Register as much of this highlight that fits into this node.
				spans.push({
					term,
					node,
					start: Math.max(0, highlightStart - textStart),
					end: Math.min(highlightEnd - textStart, node.length),
				});
				if (highlightEnd <= textEnd) {
					break;
				}
				// The highlight extends beyond this node, so keep going; move onto the next node.
				node = textFlow[++i];
				textStart = textEnd;
				textEnd += node.length;
			}
		}
	}
	return spans;
};

export {
	type BaseFlow, type BaseSpan,
	matchInText, matchInTextFlow,
};
