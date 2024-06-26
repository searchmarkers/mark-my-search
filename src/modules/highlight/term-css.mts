const getFlatStyle = (color: string) => color;

const getDiagonalStyle = (colorA: string, colorB: string, cycle: number) => {
	const isAboveStyleLevel = (level: number) => cycle >= level;
	return isAboveStyleLevel(1)
		? `repeating-linear-gradient(${
			isAboveStyleLevel(3) ? isAboveStyleLevel(4) ? 0 : 90 : isAboveStyleLevel(2) ? 45 : -45
		}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`
		: colorA;
};

const getHorizontalStyle = (colorA: string, colorB: string, cycle: number) => {
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
};

export { getFlatStyle, getDiagonalStyle, getHorizontalStyle };
