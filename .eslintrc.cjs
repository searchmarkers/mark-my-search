// eslint-disable-next-line no-undef
module.exports = {
	env: { browser: true },
	extends: [ "eslint:recommended", "plugin:@typescript-eslint/recommended" ],
	parser: "@typescript-eslint/parser",
	plugins: [ "@typescript-eslint" ],
	rules: {
		"indent": [ "error", "tab" ],
		"linebreak-style": [ "error", "unix" ],
		"semi": [ "error", "always" ],
		"no-unused-vars": "off",
		"@typescript-eslint/no-unused-vars": 1,
	},
};
