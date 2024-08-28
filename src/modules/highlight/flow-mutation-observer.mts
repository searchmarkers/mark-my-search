interface MutationObserverWrapper {
	/**
	 * Begins observation of the document body for mutations, in order to respond to them.
	 * Mutations of the child list and character data are observed over the whole subtree.
	 */
	observeMutations: () => void

	/**
	 * Stops ongoing observation of the document body for mutations.
	 */
	unobserveMutations: () => void
}

export type { MutationObserverWrapper };
