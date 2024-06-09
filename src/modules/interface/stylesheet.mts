import { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { type TermHues, EleID, EleClass, AtRuleID, getTermClass } from "/dist/modules/common.mjs";
import { getControlClass, getControlPadClass } from "/dist/modules/interface/toolbar/common.mjs";
import type { Highlighter } from "/dist/modules/highlight/engine.mjs";
import type { ControlsInfo } from "/dist/content.mjs";
import { Z_INDEX_MAX } from "/dist/modules/common.mjs";

/**
 * Fills a CSS stylesheet element to style all UI elements we insert.
 * @param terms Terms to account for and style.
 * @param hues Color hues for term styles to cycle through.
 */
const fillContent = (
	terms: ReadonlyArray<MatchTerm>,
	termTokens: TermTokens,
	hues: TermHues,
	barLook: ControlsInfo["barLook"],
	highlighter: Highlighter,
) => {
	const style = document.getElementById(EleID.STYLE) as HTMLStyleElement;
	const makeImportant = (styleText: string): string =>
		styleText.replace(/;/g, " !important;"); // Prevent websites from overriding rules with !important;
	style.textContent = makeImportant(`
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
	&:active .${EleClass.CONTROL_INPUT}.${EleClass.WAS_FOCUSED},
	& .${EleClass.CONTROL_INPUT}:is(:focus, .${EleClass.MENU_OPENER}) {
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

/**/

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

/**/

/* || Bar */

#${EleID.BAR} {
	& {
		all: revert;
		position: fixed;
		top: 0;
		left: 0;
		z-index: ${Z_INDEX_MAX};
		color-scheme: light;
		font-size: ${barLook.fontSize};
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

/**/

/* || Term Pulldown */

#${EleID.BAR} {
	& .${EleClass.CONTROL}:active .${EleClass.CONTROL_PAD}:not(:hover) ~ .${EleClass.OPTION_LIST},
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

/**/

/* || Bar Controls */

#${EleID.BAR_TERMS} .${EleClass.CONTROL} {
	white-space: pre;
}

#${EleID.BAR} {
	& .${EleClass.CONTROL} {
		& .${EleClass.CONTROL_PAD} {
			display: flex;
			height: 1.3em;
			background: hsl(0 0% 90% / ${barLook.opacityControl});
			color: hsl(0 0% 0%);
			border-style: none;
			border-radius: ${barLook.borderRadius};
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
		background: hsl(0 0% 90% / min(${barLook.opacityControl}, 0.4));
	}
	&:not(.${EleClass.DISABLED}) #${EleID.BAR_TERMS} .${EleClass.CONTROL} .${EleClass.CONTROL_PAD}.${EleClass.DISABLED} {
		display: flex;
		background: hsl(0 0% 80% / min(${barLook.opacityTerm}, 0.6));
	}
	& > :not(#${EleID.BAR_TERMS}) > .${EleClass.DISABLED}:not(:focus-within) {
		display: none;
	}
}

/**/

/* || Scroll Markers */

#${EleID.MARKER_GUTTER} {
	& {
		display: block;
		position: fixed;
		right: 0;
		top: 0;
		width: 0;
		height: 100%;
		z-index: ${Z_INDEX_MAX};
	}
	& * {
		width: 16px;
		height: 1px;
		position: absolute;
		right: 0; border-left: solid hsl(0 0% 0% / 0.6) 1px; box-sizing: unset;
		padding-right: 0; transition: padding-right 600ms; pointer-events: none; }
	& .${EleClass.FOCUS} {
		padding-right: 16px;
		transition: unset;
	}
}

/**/

/* || Term Highlights */

.${EleClass.FOCUS_CONTAINER} {
	animation: ${AtRuleID.FLASH} 1s;
}
${highlighter.current?.getCSS.termHighlights() ?? ""}

/**/

`) + `

${highlighter.current?.getCSS.misc() ?? ""}

/* || Transitions */

@keyframes ${AtRuleID.MARKER_ON} {
	from {} to { padding-right: 16px; };
}
@keyframes ${AtRuleID.MARKER_OFF} {
	from { padding-right: 16px; } to { padding-right: 0; };
}
@keyframes ${AtRuleID.FLASH} {
	from { background-color: hsl(0 0% 65% / 0.8); } to {};
}

/**/`
	;
	terms.forEach((term, i) => {
		const hue = hues[i % hues.length];
		const cycle = Math.floor(i / hues.length);
		style.textContent += makeImportant(`
/* || Term Highlight */

${highlighter.current?.getCSS.termHighlight(terms, hues, i) ?? ""}

/**/

/* || Term Scroll Markers */

#${EleID.MARKER_GUTTER} .${getTermClass(term, termTokens)} {
	background: hsl(${hue} 100% 44%);
}

/**/

/* || Term Control Buttons */

#${EleID.BAR_TERMS} .${getTermClass(term, termTokens)} .${EleClass.CONTROL_PAD} {
	background: ${highlighter.current?.getTermBackgroundStyle(
		`hsl(${hue} 70% 70% / ${barLook.opacityTerm})`,
		`hsl(${hue} 70% 88% / ${barLook.opacityTerm})`,
		cycle,
	)};
}

#${EleID.BAR}.${EleClass.DISABLED} #${EleID.BAR_TERMS} .${getTermClass(term, termTokens)} .${EleClass.CONTROL_PAD} {
	background: ${highlighter.current?.getTermBackgroundStyle(
		`hsl(${hue} 70% 70% / min(${barLook.opacityTerm}, 0.4))`,
		`hsl(${hue} 70% 88% / min(${barLook.opacityTerm}, 0.4))`,
		cycle,
	)};
}

#${EleID.BAR_TERMS} {
	& .${getTermClass(term, termTokens)} .${EleClass.CONTROL_BUTTON}:not(:disabled) {
		&:hover {
			background: hsl(${hue} 70% 80%);
		}
		&:active {
			background: hsl(${hue} 70% 70%);
		}
	}
	&.${getControlPadClass(i)} .${getTermClass(term, termTokens)} .${EleClass.CONTROL_PAD} {
		background: hsl(${hue} 100% 90%);
	}
}

/**/
		`);
	});
};

export { fillContent as fillContent };
