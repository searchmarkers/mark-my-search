import type { MatchTerm, TermPatterns } from "/dist/modules/match-term.mjs";

type BaseFlow<WithNode extends boolean, BoxInfoExt extends BoxInfoExtension = Record<never, never>> = {
	text: string
	boxesInfo: Array<BaseBoxInfo<WithNode, BoxInfoExt>>
}

type BaseBoxInfo<WithNode extends boolean, BoxInfoExt extends BoxInfoExtension = Record<never, never>> = {
	term: MatchTerm
	start: number
	end: number
} & (WithNode extends true ? { node: Text } : Record<never, never>) & Partial<BoxInfoExt>

type BoxInfoExtension = Record<string | never, unknown>

const matchInText = (
	terms: ReadonlyArray<MatchTerm>,
	termPatterns: TermPatterns,
	text: string,
): Array<BaseBoxInfo<false>> => {
	const boxesInfo: Array<BaseBoxInfo<false>> = [];
	for (const term of terms) {
		for (const match of text.matchAll(termPatterns.get(term))) if (match.index !== undefined) {
			boxesInfo.push({
				term,
				start: match.index,
				end: match.index + match[0].length,
			});
		}
	}
	return boxesInfo;
};

const matchInTextFlow = <BoxInfo extends BaseBoxInfo<true>>(
	terms: ReadonlyArray<MatchTerm>,
	termPatterns: TermPatterns,
	text: string,
	textFlow: ReadonlyArray<Text>,
): Array<BoxInfo> => {
	const boxesInfo: Array<BaseBoxInfo<true>> = [];
	for (const term of terms) {
		let i = 0;
		let node = textFlow[0];
		let textStart = 0;
		let textEnd = node.length;
		for (const match of text.matchAll(termPatterns.get(term))) {
			const highlightStart = match.index as number;
			const highlightEnd = highlightStart + match[0].length;
			while (textEnd <= highlightStart) {
				node = textFlow[++i];
				textStart = textEnd;
				textEnd += node.length;
			}
			// eslint-disable-next-line no-constant-condition
			while (true) {
				// Register as much of this highlight that fits into this node.
				boxesInfo.push({
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
	return boxesInfo as Array<BoxInfo>; // Extensions to box info contain only optional properties, so this assumption is safe.
};

export {
	type BaseFlow, type BaseBoxInfo,
	matchInText, matchInTextFlow,
};
