const loadSendoff = (() => {
	const panelsInfo: Array<PagePanelInfo> = [
		{
			className: "panel-general",
			name: {
				text: "Sendoff",
			},
			sections: [
				{
					title: {
						text: "Farewell",
					},
					interactions: [
						{
							className: "action",
							label: {
								text: "We're sorry to see you go. Please consider filling out this form so we can improve for the future!",
							},
							note: {
								text:
`If you do not wish to submit feedback, simply close this tab and carry on.
However, Mark My Search will only improve if we know what needs fixing.`,
							},
						},
						{
							className: "action",
							label: {
								text: "Information is sent privately with no personal details, and is viewable only by the developer of Mark My Search.",
							},
							submitters: [ {
								text: "Submit",
								onClick: (messageText, formFields, onSuccess, onError) => {
									sendProblemReport(messageText, formFields)
										.then(() => onSuccess())
										.catch(() => onError());
								},
								formFields: [
									{
										className: "option",
										label: {
											text: "Not what I was looking for",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting doesn't show up",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Slows down my browser",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Too confusing",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Toolbar gets in the way",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting breaks pages",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is sometimes incomplete",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is ugly or hard to read",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is overwhelming",
										},
										note: {
											text: "Turn off 'Highlights begin visible' in the options",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "I don't want all my searches highlighted",
										},
										note: {
											text: "Turn off 'Highlight web searches' in the popup",
										},
										checkbox: {},
									},
								],
								message: {
									rows: 6,
									placeholder: "Optional details or support to help us out",
								},
								alerts: {
									[PageAlertType.SUCCESS]: {
										text: "Success",
									},
									[PageAlertType.FAILURE]: {
										text: "Status {status}: {text}",
									},
									[PageAlertType.PENDING]: {
										text: "Pending, do not exit page",
									},
								},
							} ],
						},
						{
							className: "link",
							anchor: {
								url: "https://github.com/searchmarkers/mark-my-search/issues/new",
								text: "Have a problem or idea? Open an issue",
							},
						},
						{
							className: "link",
							anchor: {
								url: "https://github.com/searchmarkers/mark-my-search",
								text: "Mark My Search is developed here",
							},
						},
					],
				},
			],
		},
	];

	return () => {
		const title = document.createElement("title");
		title.text = `${getName()} - Uninstalled`;
		document.head.appendChild(title);
		loadPage(panelsInfo, `
body
	{ border: unset; }
.container-tab > .tab
	{ flex: unset; padding-inline: 10px; }
		`);
	};
})();

(() => {
	return () => {
		loadSendoff();
	};
})()();
