/**
 * Loads the sendoff page content into the page.
 * This presents the user with an offboarding form with detail, for use when the user has uninstalled the extension.
 */
const loadSendoff = (() => {
	/**
	 * Details of the page's panels and their various components.
	 */
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
								text: "We're sorry to see you go. Please consider submitting this form so we can improve!",
							},
						},
						{
							className: "action",
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
										input: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting doesn't show up",
										},
										input: {},
									},
									{
										className: "option",
										label: {
											text: "Breaks or slows down pages",
										},
										input: {},
									},
									{
										className: "option",
										label: {
											text: "Toolbar gets in the way",
										},
										input: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is sometimes incomplete",
										},
										input: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is ugly or overwhelming",
										},
										input: {},
									},
									{
										className: "option",
										label: {
											text: "I don't want all my searches highlighted",
										},
										note: {
											text: "Turn off \"Detect search engines\" in the popup",
										},
										input: {},
									},
								],
								message: {
									rows: 6,
									placeholder: "Details or support to help us out",
								},
								alerts: {
									[PageAlertType.SUCCESS]: {
										text: "Thank you, your feedback will be carefully considered!",
										timeout: -1,
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
		loadPage(panelsInfo, {
			titleText: "Uninstalled",
			tabsFill: false,
			borderShow: false,
			brandShow: true,
		});
	};
})();

(() => {
	return () => {
		loadSendoff();
	};
})()();
