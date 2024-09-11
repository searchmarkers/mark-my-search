/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

abstract class TermCSS {
	static getFlatStyle (this: void, color: string) {
		return color;
	}

	static getDiagonalStyle (this: void, colorA: string, colorB: string, cycle: number) {
		const isAboveStyleLevel = (level: number) => cycle >= level;
		return isAboveStyleLevel(1)
			? `repeating-linear-gradient(${
				isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
			}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
			: colorA;
	}

	static getHorizontalStyle (this: void, colorA: string, colorB: string, cycle: number) {
		const isAboveStyleLevel = (level: number) => cycle >= level;
		return isAboveStyleLevel(1)
			? `linear-gradient(${Array(Math.floor(cycle/2 + 1.5) * 2)
				.fill("")
				.map((v, i) => (
					(Math.floor(i / 2) % 2 == cycle % 2 ? colorB : colorA)
					+ (Math.floor((i + 1) / 2)/(Math.floor((cycle + 1) / 2) + 1) * 100) + "%"
				))
				.join(", ")
			})`
			: colorA;
	}
}

export default TermCSS;
