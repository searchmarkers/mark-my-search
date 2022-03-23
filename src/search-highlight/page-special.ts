new MutationObserver(mutations => {
	mutations.forEach(mutation => {
		mutation.addedNodes.forEach(textNode0 => {
			const walk = document.createTreeWalker(textNode0, NodeFilter.SHOW_TEXT);
			const textNodes = [];
			{
				let textNode;
				do {
					textNode = walk.nextNode();
					textNodes.push(textNode);
				}
				while (textNode);
			}
			highlightInNodes(textNodes);
		});
	});
}).observe(document.getElementsByClassName("results")[0], {childList: true});
