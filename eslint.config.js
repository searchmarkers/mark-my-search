import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
	...tseslint.config({
		files: [ "**/*.ts", "**/*.mts" ],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommended,
			{
				languageOptions: {
					parserOptions: {
						projectService: true,
						tsconfigRootDir: import.meta.dirname,
					},
				},
			},
		],
	}),
	{
		files: [ "**/*.ts", "**/*.mts" ],
		plugins: {
			tseslint: tseslint.plugin,
		},
		rules: {
			"indent": [ "error", "tab" ],
			"semi": [ "error", "always" ],
			"linebreak-style": [ "error", "unix" ],
			"@typescript-eslint/no-unused-expressions": "off",
			"@typescript-eslint/no-empty-function": "warn",
		},
	},
	{
		ignores: [ "dist/**/*" ],
	},
];
