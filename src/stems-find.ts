const getWordPattern = (() => {
	const wordGroups = [
		["code", "coding", "coder", "coded", "codes"],
		["analysis", "analyse", "analyses", "analysed", "analytical"],
		["do", "doing", "does", "did"],
		["has", "have", "had"],
	];
	let patternString = "";
	const wordPatterns: Array<RegExp> = [];
	wordGroups.forEach(wordGroup => {
		const wordPattern = wordGroup.join("|");
		patternString += `(${wordPattern})|`;
		wordPatterns.push(new RegExp(wordPattern, "gi"));
	});
	const pattern = new RegExp(patternString.slice(0, -1), "g");
	
	return (word: string) => {
		for (const match of word.toLowerCase().matchAll(pattern)) {
			for (let i = 1; i < match.length; i++) {
				if (match[i]) {
					return wordPatterns[i - 1];
				}
			}
		}
	};
})();

console.log(getWordPattern("code"));
console.log(getWordPattern("analysed"));

fetch("https://dictionaryapi.com/api/v3/references/collegiate/json/code?key=af69e760-5d60-49a5-8a12-85638a55c487")
	.then(response => response.json())
	.then(data => console.log(data))
;

// TODO: find good lemmatised/stemmed word frequency list (10,000-100,000?)
