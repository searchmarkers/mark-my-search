// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getDiacriticsMatchingPatternString: (chars: string) => string = (() => {
	const getCharacterGroups = (): Array<string> => [
		"[AÀ-ÆĀĂĄ]", "[aà-æāăą]",
		"B", "b",
		"[CÇĆĈĊČ]", "[cçćĉċč]",
		"[DĎĐ]", "[dďđ]",
		"[EÆÈ-ËĒĔĖĘĚ]", "[eæè-ëēĕėęě]",
		"F", "f",
		"[GĜĞĠĢ]", "[gĝğġģ]",
		"[HĤĦ]", "[hĥħ]",
		"[IÌ-ÏĨĪĬĮİĲ]", "[iì-ïĩīĭįıĳ]",
		"[JĲĴ]", "[jĳĵ]",
		"[KĶ]", "[kķĸ]",
		"[LĹĻĽĿŁ]", "[lĺļľŀł]",
		"M", "m",
		"[NÑŃŅŇ]", "[nñńņň]",
		"[OÒ-ÖØŌŎŐŒ]", "[oò-öøōŏőœ]",
		"P", "p",
		"Q", "q",
		"[RŔŖŘ]", "[rŕŗř]",
		"[SŚŜŞŠ]", "[sśŝşš]",
		"[TŢŤŦ]", "[tţťŧ]",
		"[UÙ-ÜŨŪŮŰŲ]", "[uù-üũūŭůűų]",
		"V", "v",
		"[WŴ]", "[wŵ]",
		"X", "x",
		"[YÝŸŶ]", "[yýÿŷ]",
		"[ZŹŻŽ]", "[zźżž]",
		"Þ", "þ",
		"ẞ", "ß",
		"Ð", "ð",
		"Ŋ", "ŋ",
		"", "ſ",
	];

	const getCharacterGroupsPattern = (characterGroups: Array<string>): RegExp =>
		new RegExp(
			characterGroups.map((patternString) => `(${patternString})`).join("|"),
			"g",
		)
	;

	return (chars: string) => {
		console.log("HERE");
		let patternString = "";
		const characterGroups = getCharacterGroups();
		Array.from(chars.matchAll(getCharacterGroupsPattern(characterGroups))).slice(0, -1).forEach((matchArray, i) => {
			patternString += characterGroups[matchArray.slice(1).findIndex(match => match)] ?? chars[i];
		});
		return patternString;
	};
})();
