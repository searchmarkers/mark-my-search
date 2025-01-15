/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { getName } from "/dist/modules/utility.mjs";
import type { PagePanelInfo } from "/dist/modules/page-build.mjs";
import { loadPage, sendProblemReport, PageAlertType } from "/dist/modules/page-build.mjs";

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
											text: "Breaks or slows down pages",
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
											text: "Highlighting is sometimes incomplete",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "Highlighting is ugly or overwhelming",
										},
										checkbox: {},
									},
									{
										className: "option",
										label: {
											text: "I don't want all my searches highlighted",
										},
										note: {
											text: "Turn off \"Detect search engines\" in the popup",
										},
										checkbox: {},
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
