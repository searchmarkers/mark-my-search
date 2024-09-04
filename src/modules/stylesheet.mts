/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

interface AbstractStylesheet {
	readonly setStyle: (style: string) => void

	readonly deactivate: () => void
}

export type { AbstractStylesheet };
