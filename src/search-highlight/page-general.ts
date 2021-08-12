namespace searchHighlight.pageGeneral {
	const pattern = searchHighlight.common.addControls(document.body, ["javascript", "tab", "url", "changed"]);
	const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
	let textNodes;
	{
		let textNode;
		while (textNode = walk.nextNode()) textNodes.push(textNode);
	}
	for (const textNode of textNodes) {
		if (textNode && textNode.parentNode && textNode.nodeType === 3) {
			textNode.parentNode.innerHTML = textNode.parentNode.innerHTML.replace(pattern, (match) => {
				return "<span class='highlight-search-term-" + match.toLowerCase() + "'>" + match + "</span>";
			});
		}
	}
}
