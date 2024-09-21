/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.d.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import { highlightingIdAttr, HighlightingIdGenerator } from "/dist/modules/highlight/engines/paint/common.mjs";
import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.d.mjs";
import type { AbstractFlowTracker, Flow, Span } from "/dist/modules/highlight/models/tree-cache/flow-tracker.d.mjs";
import { FlowTracker } from "/dist/modules/highlight/models/tree-cache/flow-tracker.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import TermCSS from "/dist/modules/highlight/common/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";
import { createContainer, type PaintEngineMethod, type AllReadonly } from "/dist/modules/common.mjs";

type Box = Readonly<{
	token: string
	x: number
	y: number
	width: number
	height: number
}>

type PaintEngineMethodContainer = Awaited<ReturnType<typeof PaintEngine.getMethodModule>>

type HighlightingStyleRuleChangedListener = (element: HTMLElement) => void

type HighlightingStyleRuleDeletedListener = (element: HTMLElement) => void

type HighlightingAppliedListener = (styledElements: IterableIterator<HTMLElement>) => void

/**
 * Observable for a highlighting style manager;
 * something which applies a set of style rules to a document to produce a highlighting effect.
 * 
 * This may be a component of style-based highlighting engines.
 */
interface HighlightingStyleObservable {
	/**
	 * Adds a listener for the addion or modification of style rules in-cache.
	 * At the time of firing, they **will not** be applied to the document.
	 */
	readonly addHighlightingStyleRuleChangedListener: (
		listener: HighlightingStyleRuleChangedListener,
	) => void

	/**
	 * Adds a listener for the deletion of style rules in-cache.
	 * At the time of firing, they **will not** be applied to the document.
	 */
	readonly addHighlightingStyleRuleDeletedListener: (
		listener: HighlightingStyleRuleChangedListener,
	) => void

	/**
	 * Adds a listener for the application of highlighting style rules from cache.
	 */
	readonly addHighlightingAppliedListener: (
		listener: HighlightingAppliedListener,
	) => void
}

class PaintEngine implements AbstractTreeCacheEngine {
	readonly class = "PAINT";
	readonly model = "tree-cache";

	readonly #termTokens: TermTokens;

	readonly #method: AbstractMethod;

	readonly #flowTracker: AbstractFlowTracker;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;
	readonly #spanBoxesMap = new Map<Span, Array<Box>>;
	readonly #elementHighlightingIdMap = new Map<HTMLElement, number>();
	readonly #elementStyleRuleMap = new Map<HTMLElement, string>();

	readonly #elementsVisible = new Set<HTMLElement>();

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));

	/** Whether a 1-frame delayed call to {@link applyStyleRules} is pending. */
	#styleRulesApplicationPending = false;

	readonly terms = createContainer<ReadonlyArray<MatchTerm>>([]);
	readonly hues = createContainer<ReadonlyArray<number>>([]);

	constructor (
		methodModule: PaintEngineMethodContainer,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#flowTracker = new FlowTracker(this.terms, termPatterns);
		this.#flowTracker.setNewSpanOwnerListener(flowOwner => {
			if (this.#method.highlightables) {
				flowOwner = this.#method.highlightables.findHighlightableAncestor(flowOwner);
			}
			this.observeVisibilityChangesFor(flowOwner);
			if (!this.#elementHighlightingIdMap.has(flowOwner)) {
				const id = highlightingIds.getNextId();
				this.#elementHighlightingIdMap.set(flowOwner, id);
				// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
				flowOwner.setAttribute(highlightingIdAttr, id.toString());
			}
		});
		this.#flowTracker.setSpansCreatedListener(flowOwner => {
			if (this.#method.highlightables) {
				flowOwner = this.#method.highlightables.findHighlightableAncestor(flowOwner);
			}
			if (!this.#elementsVisible.has(flowOwner)) {
				return;
			}
			this.cacheStyleRulesFor(flowOwner, false, this.terms.current, this.hues.current);
			this.scheduleStyleRulesApplication();
		});
		this.#flowTracker.setSpansRemovedListener((flowOwner, spansRemoved) => {
			for (const span of spansRemoved) {
				this.#spanBoxesMap.delete(span);
			}
			this.cacheStyleRulesFor(flowOwner, false, this.terms.current, this.hues.current);
			this.scheduleStyleRulesApplication();
		});
		this.#flowTracker.setNonSpanOwnerListener(flowOwner => {
			if (this.#method.highlightables) {
				flowOwner = this.#method.highlightables.findHighlightableAncestor(flowOwner);
			}
			this.#elementHighlightingIdMap.delete(flowOwner);
			flowOwner.removeAttribute(highlightingIdAttr);
			this.#elementStyleRuleMap.delete(flowOwner);
			for (const listener of this.#highlightingStyleRuleDeletedListeners) {
				listener(flowOwner);
			}
		});
		this.#elementFlowsMap = this.#flowTracker.getElementFlowsMap();
		const method = (() => {
			switch (methodModule.methodClass) {
			case "paint": {
				return new methodModule.HoudiniPaintMethod(termTokens);
			} case "url": {
				return new methodModule.SvgUrlMethod(termTokens);
			} case "element": {
				return new methodModule.ElementImageMethod(
					termTokens,
					this.#elementFlowsMap,
					this.#spanBoxesMap,
					this.#elementHighlightingIdMap,
					this.#styleObservable,
				);
			}}
		})();
		this.#method = method;
		{
			const visibilityObserver = new IntersectionObserver(entries => {
				for (const entry of entries) {
					if (!(entry.target instanceof HTMLElement)) {
						continue;
					}
					if (entry.isIntersecting) {
						if (this.#elementHighlightingIdMap.has(entry.target)) {
							this.#elementsVisible.add(entry.target);
							shiftObserver.observe(entry.target);
							this.cacheStyleRulesFor(
								this.#method.highlightables?.findHighlightableAncestor(entry.target) ?? entry.target,
								false,
								this.terms.current,
								this.hues.current,
							);
						}
					} else {
						this.#elementsVisible.delete(entry.target);
						shiftObserver.unobserve(entry.target);
					}
				}
				this.applyStyleRules();
			}, { rootMargin: "400px" });
			const shiftObserver = new ResizeObserver(entries => {
				for (const entry of entries) {
					if (!(entry.target instanceof HTMLElement)) {
						continue;
					}
					this.cacheStyleRulesFor(
						this.#method.highlightables?.findHighlightableAncestor(entry.target) ?? entry.target,
						true,
						this.terms.current,
						this.hues.current,
					);
				}
				this.applyStyleRules();
			});
			this.observeVisibilityChangesFor = (element: HTMLElement) => {
				visibilityObserver.observe(element);
			};
			this.unobserveVisibilityChanges = () => {
				this.#elementsVisible.clear();
				shiftObserver.disconnect();
				visibilityObserver.disconnect();
			};
		}
		const highlightingIds = new HighlightingIdGenerator();
	}

	static async getMethodModule (methodClass: PaintEngineMethod) {
		switch (methodClass) {
		case "paint": {
			const { HoudiniPaintMethod } = await import(
				"/dist/modules/highlight/engines/paint/methods/houdini-paint.mjs"
			);
			return { methodClass, HoudiniPaintMethod };
		} case "url": {
			const { SvgUrlMethod } = await import(
				"/dist/modules/highlight/engines/paint/methods/svg-url.mjs"
			);
			return { methodClass, SvgUrlMethod };
		} case "element": {
			const { ElementImageMethod } = await import(
				"/dist/modules/highlight/engines/paint/methods/element-image.mjs"
			);
			return { methodClass, ElementImageMethod };
		}}
	}

	deactivate () {
		this.endHighlighting();
		this.#method.deactivate();
		this.#styleManager.deactivate();
	}

	readonly getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		this.terms.assign(terms);
		this.hues.assign(hues);
		this.#method.startHighlighting(terms, termsToHighlight, termsToPurge, hues);
		this.#flowTracker.generateHighlightSpansFor(terms);
		this.#flowTracker.observeMutations();
	}

	endHighlighting () {
		this.unobserveVisibilityChanges();
		this.#flowTracker.unobserveMutations();
		this.#flowTracker.removeHighlightSpans();
		this.#method.endHighlighting();
	}

	readonly observeVisibilityChangesFor: (element: HTMLElement) => void;

	readonly unobserveVisibilityChanges: () => void;

	cacheStyleRulesFor (
		highlightableRoot: HTMLElement,
		includeDescendants: boolean,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		// TODO unhighlightable elements should get a style rule which makes their background-color transparent
		const highlightingId = this.#elementHighlightingIdMap.get(highlightableRoot);
		if (highlightingId !== undefined) {
			this.#elementStyleRuleMap.set(highlightableRoot, this.#method.constructHighlightStyleRule(
				highlightingId,
				getBoxesOwned(
					highlightableRoot,
					true,
					this.#elementFlowsMap,
					this.#spanBoxesMap,
					this.#method.highlightables ?? null,
					this.#termTokens,
				),
				terms,
				hues,
			));
			for (const listener of this.#highlightingStyleRuleChangedListeners) {
				listener(highlightableRoot);
			}
		}
		if (includeDescendants) {
			const walker = document.createTreeWalker(highlightableRoot, NodeFilter.SHOW_ELEMENT, element =>
				highlightTags.reject.has(element.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
			);
			let descendant: Node | null;
			// eslint-disable-next-line no-cond-assign
			while (descendant = walker.nextNode()) if (descendant instanceof HTMLElement) {
				const highlightingId = this.#elementHighlightingIdMap.get(descendant);
				if (highlightingId !== undefined) {
					this.#elementStyleRuleMap.set(descendant, this.#method.constructHighlightStyleRule(
						highlightingId,
						getBoxesOwned(
							descendant,
							true,
							this.#elementFlowsMap,
							this.#spanBoxesMap,
							this.#method.highlightables ?? null,
							this.#termTokens,
						),
						terms,
						hues,
					));
					for (const listener of this.#highlightingStyleRuleChangedListeners) {
						listener(highlightableRoot);
					}
				}
			}
		}
	}

	scheduleStyleRulesApplication () {
		if (!this.#styleRulesApplicationPending) {
			this.#styleRulesApplicationPending = true;
			setTimeout(() => {
				if (this.#styleRulesApplicationPending) {
					this.applyStyleRules();
				}
			});
		}
	}

	applyStyleRules () {
		this.#styleRulesApplicationPending = false;
		for (const listener of this.#highlightingAppliedListeners) {
			listener(this.#elementStyleRuleMap.keys());
		}
		this.#styleManager.setStyle(Array.from(this.#elementStyleRuleMap.values()).join("\n"));
	}

	getElementFlowsMap (): AllReadonly<Map<HTMLElement, Array<Flow>>> {
		return this.#elementFlowsMap;
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.#elementHighlightingIdMap.keys();
	}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#flowTracker.addHighlightingUpdatedListener(listener);
	}

	/** See {@link HighlightingStyleObservable.addHighlightingStyleRuleChangedListener}. */
	readonly #highlightingStyleRuleChangedListeners = new Set<HighlightingStyleRuleChangedListener>();

	/** See {@link HighlightingStyleObservable.addHighlightingStyleRuleDeletedListener}. */
	readonly #highlightingStyleRuleDeletedListeners = new Set<HighlightingStyleRuleChangedListener>();

	/** See {@link HighlightingStyleObservable.addHighlightingAppliedListener}. */
	readonly #highlightingAppliedListeners = new Set<HighlightingAppliedListener>();

	readonly #styleObservable: HighlightingStyleObservable = (() => {
		const styleRuleChangedListeners = this.#highlightingStyleRuleChangedListeners;
		const styleRuleDeletedListeners = this.#highlightingStyleRuleDeletedListeners;
		const appliedListeners = this.#highlightingAppliedListeners;
		return {
			addHighlightingStyleRuleChangedListener (listener: HighlightingStyleRuleChangedListener) {
				styleRuleChangedListeners.add(listener);
			},

			addHighlightingStyleRuleDeletedListener (listener: HighlightingStyleRuleDeletedListener) {
				styleRuleDeletedListeners.add(listener);
			},

			addHighlightingAppliedListener (listener: HighlightingAppliedListener) {
				appliedListeners.add(listener);
			},
		};
	})();
}

export {
	type Flow, type Span, type Box,
	type HighlightingStyleObservable,
	PaintEngine,
};
