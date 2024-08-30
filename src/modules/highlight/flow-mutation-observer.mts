interface FlowMutationObserver {
	/**
	 * Begins observation of the document body for mutations, in order to respond to them.
	 * Mutations of the child list and character data are observed over the whole subtree.
	 */
	readonly observeMutations: () => void

	/**
	 * Stops ongoing observation of the document body for mutations.
	 */
	readonly unobserveMutations: () => void
}

export type { FlowMutationObserver };
