import * as Manifest from "/dist/modules/manifest.mjs";
import { type Page, loadPage } from "/dist/modules/page/build.mjs";
import { Config } from "../modules/storage.mjs";

/**
 * Loads the startpage content into the page.
 * This presents the user with expandable onboarding information and functions, for use when the user has installed the extension.
 */
const loadStartpage = (() => {
	/**
	 * Details of the page's panels and their various components.
	 */
	const panelsInfo: Array<Page.PanelInfo> = [
		{
			className: "panel-general",
			name: {
				text: "Start",
			},
			sections: [
				{
					title: {
						text: "How To Use",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "Press Alt+M, then type a keyword and press Enter to see it highlighted.",
								getText: async () => {
									const shortcut = (await chrome.commands.getAll())
										.find(command => command.name === "toggle-research-tab")
										?.shortcut;
									return shortcut
										? `Press ${shortcut}, then type a keyword and press Enter to see it highlighted.`
										: `Set a keyboard shortcut by visiting ${chrome.runtime.getURL("/").startsWith("chrome-extension://")
											? "chrome://extensions/shortcuts"
											: "about:addons, pressing the cog and selecting \"Manage Extension Shortcuts\""
										}, \
going to "Find in current tab", and assigning something like Alt+M. \
You can always activate ${Manifest.getName()} by opening its popup (from the 'extensions' icon) and clicking "Active".`;
								},
							},
						},
						{
							className: "action",
							label: {
								text: "Try it here!",
							},
						},
					]
				},
				{
					title: {
						text: "Automatic Highlighting",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "Use a search provider like DuckDuckGo or Google.",
							},
						},
						{
							className: "action",
							label: {
								text: "Search keywords are highlighted - click a link to see it in action.",
							},
						},
						{
							className: "option",
							label: {
								text: "Should online searches be highlighted automatically?",
							},
							input: {
								getType: () => "checkbox",
								onLoad: async setChecked => {
									const config = await Config.get({ autoFindOptions: { enabled: true } });
									setChecked(config.autoFindOptions.enabled);
								},
								onChange: async checked => {
									const config = await Config.get({ autoFindOptions: { enabled: true } });
									config.autoFindOptions.enabled = checked;
									await Config.set(config);
								},
							},
						},
						{
							className: "action",
							submitters: [ {
								text: "Type search words, then click here to open search results",
								// Allow the user to try out the extension by searching for the query string, if any, they entered into the input.
								// Prefer highlighting within the startpage, fallback to searching with their default search provider.
								onClick: (messageText, formFields, onSuccess) => {
									chrome.search["query"]({
										disposition: "NEW_TAB",
										text: messageText,
									}, onSuccess);
								},
								message: {
									required: true,
									singleline: true,
									rows: 1,
									placeholder: "Search keywords",
								},
							} ],
						},
					],
				},
				{
					title: {
						text: "Operation",
						expands: true,
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "Keywords - create or edit",
							},
							note: {
								text: "Click (+) or the pen button, type your new keyword, then press [Enter] or click out.",
							},
						},
						{
							className: "action",
							label: {
								text: "Keywords - remove",
							},
							note: {
								text: "While editing a keyword, delete the text or click the bin button.",
							},
						},
						{
							className: "action",
							label: {
								text: "Keywords - change matching",
							},
							note: {
								text: "Use [Shift+Space] while editing or the 3-dots button, and click an option.",
							},
						},
					],
				},
			],
		},
		{
			className: "panel-features",
			name: {
				text: "Features",
			},
			sections: [
				{
					title: {
						text: "Keyword Matching",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: `Matching options affect how strictly ${Manifest.getName()} looks for a keyword.`,
							},
						},
						{
							className: "action",
							label: {
								text: "Case sensitivity",
							},
							note: {
								text: "\"Mark\" matches \"Mark\" but not \"mark\", \"MARK\", \"mArk\", etc.",
							},
						},
						{
							className: "action",
							label: {
								text: "Whole words",
							},
							note: {
								text: "\"a\" is matched in \"b a b\" but not in \"bab\", \"ba b\", or \"b ab\".",
							},
						},
						{
							className: "action",
							label: {
								text: "Stemming",
							},
							note: {
								text: "\"marking\" matches \"mark\", \"marks\", \"marker\", \"marked\", \"marking\", etc.",
							},
						},
						{
							className: "action",
							label: {
								text: "Diacritics insensitivity",
							},
							note: {
								text: "\"şéârçh\" matches \"search\".",
							},
						},
						{
							className: "action",
							label: {
								text: "Regex mode",
							},
							note: {
								text: "Enter a custom expression for advanced matching.",
							},
						},
					],
				},
				{
					title: {
						text: "Advanced Operation",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "Toolbar - click keyword buttons to scroll to the next match.",
							},
							note: {
								text:
`Press [Alt+Space] to jump to the next generic match, and [Alt+Shift+Space] for the previous,
or assign a shortcut like [Alt+Shift+1] for individual terms.`,
							},
						},
						{
							className: "action",
							label: {
								text: "Toolbar - view and edit keywords with the pen/bin and 3-dots buttons, create them with the + button.",
							},
						},
						{
							className: "action",
							label: {
								text: "Toolbar - see the number of matches for a keyword by hovering over it with your cursor.",
							},
							note: {
								text: "If the keyword background is grey, no matches were found.",
							},
						},
						{
							className: "action",
							label: {
								text: "Settings - open the popup at any time to quickly change highlighting options.",
							},
							note: {
								text: `Click the extensions icon and pin ${Manifest.getName()} to the toolbar.`,
							},
						},
						{
							className: "action",
							label: {
								text: "Settings - open the options page for advanced configuration.",
							},
							note: {
								text: "Open the popup and click 'More options' or use your browser's standard method.",
							},
						},
						{
							className: "action",
							label: {
								text: "Filtering - exclude misbehaving websites from highlighting.",
							},
							note: {
								text: "Open the popup, go to Highlight, enter e.g. \"example.com\" into the Never Highlight list.",
							},
						},
						{
							className: "action",
							label: {
								text: "Filtering - exclude websites from being detected as search engines.",
							},
							note: {
								text: "Open the popup, go to Highlight, enter e.g. \"example.com\" into the Not Search Engines list.",
							},
						},
					],
				},
			],
		},
	];

	return () => {
		loadPage(panelsInfo, {
			titleText: "Start",
			tabsFill: false,
			borderShow: false,
			brandShow: true,
		});
	};
})();

(() => {
	return () => {
		loadStartpage();
	};
})()();
