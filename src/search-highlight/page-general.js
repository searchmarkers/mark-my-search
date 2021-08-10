terms = ["javascript", "tab", "url", "changed"]

addControls(document.body);

let walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
let textNodes = [];
{
	let textNode;
	while (textNode = walk.nextNode()) textNodes.push(textNode)
}
for (let textNode of textNodes) {
	if (textNode && textNode.parentNode && textNode.nodeType === 3) {
		textNode.parentNode.innerHTML = textNode.parentNode.innerHTML.replace(pattern, (match) => {
			return "<span class='highlight-search-term-" + match.toLowerCase() + "'>" + match + "</span>";
		});
	}
}
