const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const textNodes = [];
let textNode;
do {
	textNode = walk.nextNode();
	textNodes.push(textNode);
} while (textNode);
highlightInNodes(textNodes);
