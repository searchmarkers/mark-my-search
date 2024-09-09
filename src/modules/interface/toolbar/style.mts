/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleID, EleClass, getControlClass, getControlPadClass } from "/dist/modules/interface/toolbar/common.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import type { HighlighterCSSInterface } from "/dist/modules/highlight/engine.d.mjs";
import type { ControlsInfo } from "/dist/content.mjs";
import { Z_INDEX_MAX, getTermClass } from "/dist/modules/common.mjs";

class ToolbarStyle {
	readonly #termTokens: TermTokens;
	readonly #highlighter: HighlighterCSSInterface;

	readonly #styleManager: StyleManager<{
		"--font-size": string,
		"--opacity-control": number,
		"--opacity-term": number,
		"--border-radius": string,
	}>;
	readonly #termTokenStyleManagerMap = new Map<string, StyleManager<{
		"--hue": number,
		"--background": string,
		"--background-disabled": string,
	}>>();

	readonly #stylesheetParent: Node;

	constructor (
		stylesheetParent: Node,
		termTokens: TermTokens,
		highlighter: HighlighterCSSInterface,
	) {
		this.#stylesheetParent = stylesheetParent;
		this.#termTokens = termTokens;
		this.#highlighter = highlighter;
		this.#styleManager = new StyleManager(new HTMLStylesheet(stylesheetParent), {
			selector: `#${EleID.BAR}`,
			defaults: {
				"--font-size": "inherit",
				"--opacity-control": 0,
				"--opacity-term": 0,
				"--border-radius": "inherit",
			},
			stylesheet: new HTMLStylesheet(stylesheetParent),
		});
	}

	applyStyle () {
		this.#styleManager.setStyle(this.getConstantStyle());
	}

	updateStyle (barLook: ControlsInfo["barLook"]) {
		this.#styleManager.setVariables({
			"--font-size": barLook.fontSize,
			"--opacity-control": barLook.opacityControl,
			"--opacity-term": barLook.opacityTerm,
			"--border-radius": barLook.borderRadius,
		});
	}

	getConstantStyle (): string {
		return (`
/* || Term Buttons and Input */

#${EleID.BAR} {
	& ::selection {
		background: Highlight;
		color: HighlightText;
	}
	& .${EleClass.CONTROL_PAD} .${EleClass.CONTROL_EDIT} {
		.${EleClass.PRIMARY} {
			display: block;
		}
		.${EleClass.SECONDARY} {
			display: none;
		}
	}
	& .${EleClass.CONTROL_PAD} button:disabled,
	& .${EleClass.CONTROL_PAD} button:disabled *,
	& .${EleClass.CONTROL_INPUT} {
		width: 0;
		padding: 0;
		margin: 0;
	}
	& .${EleClass.CONTROL_INPUT} {
		border: none;
		outline: revert;
		box-sizing: unset;
		font-family: revert;
		white-space: pre;
		color: hsl(0 0% 0%);
	}
	& .${EleClass.CONTROL_INPUT}:is(:focus, .${EleClass.LAST_FOCUSED}) {
		width: 5em;
		padding: 0 2px 0 2px;
		margin-inline: 3px;
		& + .${EleClass.CONTROL_EDIT} {
			& .${EleClass.PRIMARY} {
				display: none;
			}
			& .${EleClass.SECONDARY} {
				display: block;
			}
		}
	}
	&.${EleClass.COLLAPSED} .${getControlClass("toggleBarCollapsed")} .${EleClass.PRIMARY},
	&:not(.${EleClass.COLLAPSED}) .${getControlClass("toggleBarCollapsed")} .${EleClass.SECONDARY} {
		display: none;
	}
	& .${EleClass.CONTROL_REVEAL} img {
		width: 0.5em;
	}
}

/* || Term Matching Option Hints */

#${EleID.BAR_TERMS} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_REGEX} .${EleClass.CONTROL_CONTENT} {
			font-weight: bold;
		}
		&:not(.${EleClass.MATCH_DIACRITICS}) .${EleClass.CONTROL_CONTENT} {
			font-style: italic;
		}
	}
}

#${EleID.BAR_TERMS},
#${EleID.BAR_RIGHT} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_CASE} .${EleClass.CONTROL_CONTENT} {
			padding-top: 0;
			border-top: 2px dashed black;
		}
		&.${EleClass.MATCH_WHOLE} .${EleClass.CONTROL_CONTENT} {
			padding-inline: 2px;
			border-inline: 2px solid hsl(0 0% 0% / 0.4);
		}
	}
}

#${EleID.BAR_RIGHT} {
	& .${EleClass.CONTROL} {
		&.${EleClass.MATCH_REGEX} .${EleClass.CONTROL_CONTENT}::before {
			content: "(.*)";
			margin-right: 2px;
			font-weight: bold;
		}
		&:not(.${EleClass.MATCH_STEM}) .${EleClass.CONTROL_CONTENT} {
			border-bottom: 3px solid hsl(0 0% 38%);
		}
		&:not(.${EleClass.MATCH_DIACRITICS}) .${EleClass.CONTROL_CONTENT} {
			border-left: 3px dashed black;
		}
	}
}

#${EleID.BAR_TERMS} .${EleClass.CONTROL}:not(.${EleClass.MATCH_STEM},
.${EleClass.MATCH_REGEX}) .${EleClass.CONTROL_CONTENT} {
	text-decoration: underline;
	text-decoration-skip-ink: none;
}

/* || Bar */

#${EleID.BAR} {
	& {
		all: revert;
		position: fixed;
		top: 0;
		left: 0;
		z-index: ${Z_INDEX_MAX};
		color-scheme: light;
		font-size: var(--font-size);
		line-height: initial;
		user-select: none;
		pointer-events: none;
	}
	&.${EleClass.BAR_HIDDEN} {
		display: none;
	}
	& * {
		all: revert;
		font: revert;
		font-family: sans-serif;
		font-size: inherit;
		line-height: 120%;
		padding: 0;
	}
	& :not(input) {
		outline: none;
	}
	& img {
		height: 1.1em;
		width: 1.1em;
		object-fit: cover;
	}
	& button {
		display: flex;
		align-items: center;
		padding-inline: 4px;
		margin-block: 0;
		border: none;
		border-radius: inherit;
		background: none;
		color: hsl(0 0% 0%);
		cursor: pointer;
		letter-spacing: normal;
		transition: unset;
	}
	& > * {
		display: inline;
	}
	& .${EleClass.CONTROL} {
		display: inline-block;
		vertical-align: top;
		margin-left: 0.5em;
		pointer-events: auto;
	}
	&.${EleClass.COLLAPSED} > * > *:not(.${EleClass.UNCOLLAPSIBLE}) {
		display: none;
	}
}

/* || Term Pulldown */

#${EleID.BAR} {
	& .${EleClass.CONTROL}:has(.${EleClass.OPTION_LIST_PULLDOWN}:active:not(:hover)) .${EleClass.OPTION_LIST},
	& .${EleClass.MENU_OPEN} .${EleClass.OPTION_LIST} {
		display: flex;
	}
	& .${EleClass.OPTION_LIST}:focus-within .${EleClass.OPTION}::first-letter {
		text-decoration: underline;
	}
	& .${EleClass.OPTION_LIST} {
		display: none;
		position: absolute;
		flex-direction: column;
		padding: 0;
		width: max-content;
		margin: 0 0 0 4px;
		z-index: 1;
		font-size: max(14px, 0.84em) /* Make the font size a proportion of the overall font size, down to 14px */;
	}
	& .${EleClass.OPTION} {
		& {
			display: flex;
			padding-block: 3px;
			background: hsl(0 0% 94% / 0.76);
			color: hsl(0 0% 6%);
			width: 100%;
			text-align: left;
			border-width: 2px;
			border-color: hsl(0 0% 40% / 0.7);
			border-left-style: solid;
		}
		& input[type='checkbox'] {
			margin-block: 0;
			margin-inline: 4px;
			width: 1em;
		}
		&:hover {
			background: hsl(0 0% 100%);
		}
	}
}

/* || Bar Controls */

#${EleID.BAR_TERMS} .${EleClass.CONTROL} {
	white-space: pre;
}

#${EleID.BAR} {
	& .${EleClass.CONTROL} {
		& .${EleClass.CONTROL_PAD} {
			display: flex;
			height: 1.3em;
			background: hsl(0 0% 90% / var(--opacity-control));
			color: hsl(0 0% 0%);
			border-style: none;
			border-radius: var(--border-radius);
			box-shadow: 1px 1px 5px;
		}
		&.${EleClass.MENU_OPEN} .${EleClass.CONTROL_REVEAL} {
			background: hsl(0 0% 100% / 0.6);
		}
		& .${EleClass.CONTROL_BUTTON}:not(:disabled) {
			&:hover {
				background: hsl(0 0% 65%);
			}
			&:active {
				background: hsl(0 0% 50%);
			}
		}
	}
	&.${EleClass.DISABLED} .${EleClass.CONTROL} .${EleClass.CONTROL_PAD} {
		background: hsl(0 0% 90% / min(var(--opacity-control), 0.4));
	}
	&:not(.${EleClass.DISABLED}) #${EleID.BAR_TERMS} .${EleClass.CONTROL} .${EleClass.CONTROL_PAD}.${EleClass.DISABLED} {
		display: flex;
		background: hsl(0 0% 80% / min(var(--opacity-term), 0.6));
	}
	& > :not(#${EleID.BAR_TERMS}) > .${EleClass.DISABLED}:not(:focus-within) {
		display: none;
	}
}
`)
		;
	}

	applyTermStyle (
		term: MatchTerm,
		termIndex: number,
		hues: ReadonlyArray<number>,
	) {
		const termToken = this.#termTokens.get(term);
		const styleManager = (this.#termTokenStyleManagerMap.get(termToken)
			?? new StyleManager(new HTMLStylesheet(this.#stylesheetParent), {
				selector: `#${EleID.BAR_TERMS} .${getTermClass(term, this.#termTokens)}`,
				defaults: {
					"--hue": 0,
					"--background": "transparent",
					"--background-disabled": "transparent",
				},
				stylesheet: new HTMLStylesheet(this.#stylesheetParent),
			})
		);
		this.#termTokenStyleManagerMap.set(termToken, styleManager);
		styleManager.setStyle(this.getTermConstantStyle(term));
		this.updateTermStyle(termToken, termIndex, hues);
	}

	updateTermStyle (
		termToken: string,
		termIndex: number,
		hues: ReadonlyArray<number>,
	) {
		const styleManager = this.#termTokenStyleManagerMap.get(termToken);
		const cycle = Math.floor(termIndex / hues.length);
		styleManager?.setVariables({
			"--hue": hues[termIndex % hues.length],
			"--background": this.#highlighter.getTermBackgroundStyle(
				`hsl(var(--hue) 70% 70% / var(--opacity-term))`,
				`hsl(var(--hue) 70% 88% / var(--opacity-term))`,
				cycle,
			),
			"--background-disabled": this.#highlighter.getTermBackgroundStyle(
				`hsl(var(--hue) 70% 70% / min(var(--opacity-term), 0.4))`,
				`hsl(var(--hue) 70% 88% / min(var(--opacity-term), 0.4))`,
				cycle,
			),
		});
	}

	getTermConstantStyle (term: MatchTerm): string {
		const termIndex = 0; // TODO do this differently
		return (`
#${EleID.BAR_TERMS} .${getTermClass(term, this.#termTokens)} .${EleClass.CONTROL_PAD} {
	background: var(--background);
}

#${EleID.BAR}.${EleClass.DISABLED} #${EleID.BAR_TERMS} .${getTermClass(term, this.#termTokens)} .${EleClass.CONTROL_PAD} {
	background: var(--background-disabled);
}

#${EleID.BAR_TERMS} {
	& .${getTermClass(term, this.#termTokens)} .${EleClass.CONTROL_BUTTON}:not(:disabled) {
		&:hover {
			background: hsl(var(--hue) 70% 80%);
		}
		&:active {
			background: hsl(var(--hue) 70% 70%);
		}
	}
	&.${getControlPadClass(termIndex)} .${getTermClass(term, this.#termTokens)} .${EleClass.CONTROL_PAD} {
		background: hsl(var(--hue) 100% 90%);
	}
}
`
		);
	}

	removeTermStyle (termToken: string) {
		this.#termTokenStyleManagerMap.get(termToken)?.deactivate();
		this.#termTokenStyleManagerMap.delete(termToken);
	}
}

export { ToolbarStyle };
