namespace searchHighlight.pageSpecial {
	const stoplist = [
		"a",
		"about",
		"above",
		"after",
		"again",
		"against",
		"all",
		"am",
		"an",
		"and",
		"any",
		"are",
		"aren't",
		"as",
		"at",
		"be",
		"because",
		"been",
		"before",
		"being",
		"below",
		"between",
		"both",
		"but",
		"by",
		"can't",
		"cannot",
		"could",
		"couldn't",
		"did",
		"didn't",
		"do",
		"does",
		"doesn't",
		"doing",
		"don't",
		"down",
		"during",
		"each",
		"few",
		"for",
		"from",
		"further",
		"had",
		"hadn't",
		"has",
		"hasn't",
		"have",
		"haven't",
		"having",
		"he",
		"he'd",
		"he'll",
		"he's",
		"her",
		"here",
		"here's",
		"hers",
		"herself",
		"him",
		"himself",
		"his",
		"how",
		"how's",
		"i",
		"i'd",
		"i'll",
		"i'm",
		"i've",
		"if",
		"in",
		"into",
		"is",
		"isn't",
		"it",
		"it's",
		"its",
		"itself",
		"let's",
		"me",
		"more",
		"most",
		"mustn't",
		"my",
		"myself",
		"no",
		"nor",
		"not",
		"of",
		"off",
		"on",
		"once",
		"only",
		"or",
		"other",
		"ought",
		"our",
		"ours",
		"ourselves",
		"out",
		"over",
		"own",
		"same",
		"shan't",
		"she",
		"she'd",
		"she'll",
		"she's",
		"should",
		"shouldn't",
		"so",
		"some",
		"such",
		"than",
		"that",
		"that's",
		"the",
		"their",
		"theirs",
		"them",
		"themselves",
		"then",
		"there",
		"there's",
		"these",
		"they",
		"they'd",
		"they'll",
		"they're",
		"they've",
		"this",
		"those",
		"through",
		"to",
		"too",
		"under",
		"until",
		"up",
		"very",
		"was",
		"wasn't",
		"we",
		"we'd",
		"we'll",
		"we're",
		"we've",
		"were",
		"weren't",
		"what",
		"what's",
		"when",
		"when's",
		"where",
		"where's",
		"which",
		"while",
		"who",
		"who's",
		"whom",
		"why",
		"why's",
		"with",
		"won't",
		"would",
		"wouldn't",
		"you",
		"you'd",
		"you'll",
		"you're",
		"you've",
		"your",
		"yours",
		"yourself",
		"yourselves",
	];
	const engines = {
		bing: {linksId: "b_results", highlightInLink: (node) => {
			if (!node.classList.contains("b_algo")) return;
			let elementsInfo = [
				["Tag", "p", 0],
				["Tag", "h2", 0],
				["Class", "b_text"],
			];
			highlightInElement(node, elementsInfo);
		}},
		duckduckgo: {linksId: "links", highlightInLink: (node) => {
			if (!node.classList.contains("results_links_deep")) return;
			let elementsInfo = [
				["Class", "js-result-title-link", 0],
				["Class", "js-result-snippet", 0],
			];
			highlightInElement(node, elementsInfo);
		}},
		ecosia: {linksClass: "mainline", linkContainersClass: "card-web", highlightInLink: (node) => {
			if (!node.classList || !node.classList.contains("result")) return;
			let elementsInfo = [
				["Class", "result-title", 0],
				["Class", "result-snippet", 0],
			];
			highlightInElement(node, elementsInfo);
		}},
		google: {linksId: "rso", highlightInLink: (node) => {
			if (!node.classList.contains("g") && node.childElementCount > 0) node = node.childNodes[0];
			if (!node.classList.contains("g")) return;
			let elementsInfo = [
				["Tag", "h3", 0],
				["Class", "VwiC3b yXK7lf MUxGbd yDYNvb lyLwlc lEBKkf", 0],
			];
			highlightInElement(node, elementsInfo);
		}},
	};
	let engine;
	let terms = [];
	let links;
	
	{
		let url = new URL(document.URL);
		let engineName = "";
		let termList = [];
		if (url.hostname === "") {
			let path = url.pathname;
			engineName = path.substring(path.lastIndexOf("/") + 1, path.indexOf(".html"));
			termList = ["javascript", "format", "string"];
		} else {
			let host = url.hostname;
			host = host.substring(0, host.lastIndexOf("."))
			engineName = host.substring(host.lastIndexOf(".") + 1);
			for (const term of url.searchParams.get("q").split(" ")) {
				if (terms.indexOf(term) === -1) termList.push(term);
			}
		}
		engine = engines[engineName];
		for (const term of termList) {
			if (stoplist.indexOf(term) === -1) {
				terms.push(JSON.stringify(term.toLowerCase()).replace(/\W/g , ""));
			}
		}
	}
	
	if (engine.linksId) links = document.getElementById(engine.linksId);
	else links = document.getElementsByClassName(engine.linksClass)[0];
	
	const pattern = searchHighlight.common.addControls(links, terms);

	function highlightInElement(parent, elementsInfo) {
		for (let info of elementsInfo) {
			let elements = parent["getElementsBy" + info[0] + "Name"](info[1]);
			if (info.length === 1) info.push(elements.length - 1);
			for (let i = 0; i < info[2] + 1; i++) {
				let element = elements[i];
				element.innerHTML = element.innerHTML.replace(pattern, (match) => {
					return "<span class='highlight-search-term-" + match.toLowerCase() + "'>" + match + "</span>";
				});
			}
		}
	}
	
	const observer = new MutationObserver((mutations) => {
		mutations.forEach((mutation) => {
			mutation.addedNodes.forEach((node) => {
				engine.highlightInLink(node);
			});
		});
	});

	function highlightInContainer(linkContainer) {
		observer.observe(linkContainer, {childList: true});
		for (let node of linkContainer.childNodes) engine.highlightInLink(node);
	}

	if ("linkContainersClass" in engine) {
		for (let linkContainer of links.getElementsByClassName(engine.linkContainersClass)) {
			highlightInContainer(linkContainer);
		}
	} else highlightInContainer(links);
}
