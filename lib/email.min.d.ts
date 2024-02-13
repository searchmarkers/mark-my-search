/**
 * An EmailJS library function which sends an email using the EmailJS service.
 * @param service The name of a service category for the email.
 * @param template The name of a template under the service for the email.
 * @param details Custom template field entries.
 * @param key The API key to use.
 */
declare const sendEmail: (
	service: string,
	template: string,
	details: {
		addon_version?: string
		url?: string
		phrases?: string
		user_message?: string
		user_email?: string
		item_0_question?: string
		item_1_question?: string
		item_2_question?: string
		item_3_question?: string
		item_4_question?: string
		item_5_question?: string
		item_6_question?: string
		item_7_question?: string
		item_8_question?: string
		item_9_question?: string
		item_0_response?: string
		item_1_response?: string
		item_2_response?: string
		item_3_response?: string
		item_4_response?: string
		item_5_response?: string
		item_6_response?: string
		item_7_response?: string
		item_8_response?: string
		item_9_response?: string
	},
	key: string,
) => Promise<unknown>; // TODO check the actual return value in the EmailJS docs

export { sendEmail };
