import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
	...tseslint.config({
		files: [ "**/*.ts", "**/*.mts" ],
		extends: [
			eslint.configs.recommended,
			...tseslint.configs.recommendedTypeChecked,
			...tseslint.configs.stylisticTypeChecked,
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
			//"no-cond-assign": "off",
			"@typescript-eslint/array-type": [ "error", { default: "generic" } ],
			"@typescript-eslint/no-empty-object-type": [ "error", { allowInterfaces: "always" } ],
			"@typescript-eslint/no-empty-function": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "warn",
			"no-unused-private-class-members": "warn",
			"@typescript-eslint/prefer-optional-chain": "off",
			"@typescript-eslint/dot-notation": "off",
			"@typescript-eslint/no-floating-promises": "off",
			"@typescript-eslint/no-misused-promises": "off",
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/no-unnecessary-type-assertion": "off",
			"@typescript-eslint/consistent-type-definitions": "off",
		},
	},
	{
		ignores: [ "dist/**/*" ],
	},
];
