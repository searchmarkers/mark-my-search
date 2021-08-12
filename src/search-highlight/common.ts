namespace searchHighlight.common {
	/**
	 * Adds search term navigation UI to the page.
	 * @param highlightRoot Ancestor node of search term highlighting
	 * @param terms Array containing search terms to be highlighted
	 * @returns Regular expression to select only search term occurrences in the
	 * document HTML
	 */
	export function addControls(highlightRoot, terms) {
		const colors = [
			[255, 255, 0],
			[0, 255, 0],
			[0, 255, 255],
			[255, 0, 255],
			[255, 0, 0],
			[0, 0, 255],
		];
		let pattern = "";
		
		const style = document.createElement("style");
		document.head.appendChild(style);
		highlightRoot.classList.add("highlight-search-all");
		
		const controls = document.createElement("div");
		controls.style.position = "fixed";
		controls.style.zIndex = "10000";
		controls.style.width = "100%";
		document.body.insertAdjacentElement("beforebegin", controls);

		const checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.checked = true;
		checkbox.addEventListener("change", (event) => {
			if (checkbox.checked) highlightRoot.classList.add("highlight-search-all");
			else highlightRoot.classList.remove("highlight-search-all");
		});
		checkbox.style.marginLeft = "10px";
		checkbox.style.marginRight = "10px";
		controls.appendChild(checkbox);

		for (let i = 0; i < terms.length; i++) {
			console.log(terms.length);
			const term = terms[i];
			const color = colors[i % colors.length];
			const ruleStyles = [
				"{color:#000;background:rgba("+color[0]+","+color[1]+","+color[2]+",0.6);}",
				"{border-width:2px;border-block-color:#000}",
			];
			style.textContent += ".highlight-search-all .highlight-search-term-" + term + ruleStyles[0];
			style.textContent += ".highlight-search-control" + ruleStyles[1];
			pattern += "|" + term;
			
			const button = document.createElement("button");
			button.classList.add("highlight-search-control");
			button.textContent = term;
			button.addEventListener("change", (event) => {});
			let hexColor = "#";
			for (const channel of color) hexColor += (channel === 0 ? "7" : "f");
			button.style.backgroundColor = hexColor;
			controls.appendChild(button);
		}
		
		return new RegExp("(" + pattern.substring(1) + ")(?!([^<]+)?>)", "gi");
	}
}
