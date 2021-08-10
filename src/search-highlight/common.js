const colors = [
	[255, 255, 000],
	[000, 255, 000],
	[000, 255, 255],
	[255, 000, 255],
	[255, 000, 000],
	[000, 000, 255],
]
const colorsTemp = [
	"#ff7",
	"#7f7",
	"#7ff",
	"#f7f",
	"#f77",
	"#77f",
]
let terms = [];
let pattern = "";

function addControls(highlightRoot) {
	const style = document.createElement("style");
	document.head.appendChild(style);
	highlightRoot.classList.add("highlight-search-all");
	
	const controls = document.createElement("div");
	controls.style.position = "fixed";
	controls.style.zIndex = 10000;
	controls.style.width = "100%";
	document.body.insertAdjacentElement("beforebegin", controls);

	const checkbox = document.createElement("input");
	checkbox.type = "checkbox";
	checkbox.checked = "checked";
	checkbox.addEventListener("change", (event) => {
		if (checkbox.checked) links.classList.add("highlight-search-all");
		else links.classList.remove("highlight-search-all");
	});
	checkbox.style.marginLeft = "10px";
	checkbox.style.marginRight = "10px";
	controls.appendChild(checkbox);

	for (let i in terms) {
		let term = terms[i];
		let c = colors[i % colors.length];
		let ruleStyles = [
			"{background:rgba("+c[0]+","+c[1]+","+c[2]+",0.4);}",
			"{border-width:2px;border-block-color:#000}",
		];
		style.textContent += " .highlight-search-all .highlight-search-term-" + term + ruleStyles[0];
		style.textContent += " .highlight-search-control" + ruleStyles[1];
		pattern += "|" + term;
		
		let button = document.createElement("button");
		button.classList.add("highlight-search-control");
		button.textContent = term;
		button.addEventListener("change", (event) => {
			
		});
		button.style.backgroundColor = colorsTemp[i % colorsTemp.length];
		controls.appendChild(button);
	}
	
	pattern = new RegExp("(" + pattern.substring(1) + ")(?!([^<]+)?>)", "gi");
}
