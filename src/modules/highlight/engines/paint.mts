import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import { getBoxesOwned } from "/dist/modules/highlight/engines/paint/boxes.mjs";
import type { AbstractTreeCacheEngine } from "/dist/modules/highlight/models/tree-cache.mjs";
import type { AbstractFlowMonitor, Flow, Span } from "/dist/modules/highlight/models/tree-cache/flow-monitor.mjs";
import { FlowMonitor } from "/dist/modules/highlight/models/tree-cache/flow-monitors/flow-monitor.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import { highlightTags } from "/dist/modules/highlight/highlight-tags.mjs";
import * as TermCSS from "/dist/modules/highlight/term-css.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { EleID, createContainer, type PaintEngineMethod, type AllReadonly } from "/dist/modules/common.mjs";

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

interface HighlightingStyleObserver {
	readonly addHighlightingStyleRuleChangedListener: (listener: HighlightingStyleRuleChangedListener) => void

	readonly addHighlightingStyleRuleDeletedListener: (listener: HighlightingStyleRuleChangedListener) => void

	readonly addHighlightingAppliedListener: (listener: HighlightingAppliedListener) => void
}

class PaintEngine implements AbstractTreeCacheEngine, HighlightingStyleObserver {
	readonly class = "PAINT";
	readonly model = "tree-cache";

	readonly #termTokens: TermTokens;

	readonly #method: AbstractMethod;

	readonly #flowMonitor: AbstractFlowMonitor;

	readonly #elementFlowsMap: AllReadonly<Map<HTMLElement, Array<Flow>>>;
	readonly #spanBoxesMap = new Map<Span, Array<Box>>;
	readonly #elementHighlightingIdMap = new Map<HTMLElement, number>();
	readonly #elementStyleRuleMap = new Map<HTMLElement, string>();

	readonly #elementsVisible = new Set<HTMLElement>();

	readonly #highlightingStyleRuleChangedListeners = new Set<HighlightingStyleRuleChangedListener>();
	readonly #highlightingStyleRuleDeletedListeners = new Set<HighlightingStyleRuleChangedListener>();
	readonly #highlightingAppliedListeners = new Set<HighlightingAppliedListener>();

	readonly terms = createContainer<ReadonlyArray<MatchTerm>>([]);
	readonly hues = createContainer<ReadonlyArray<number>>([]);

	constructor (
		methodModule: PaintEngineMethodContainer,
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#flowMonitor = new FlowMonitor(this.terms, termPatterns);
		this.#flowMonitor.setNewSpanOwnerListener(flowOwner => {
			this.observeVisibilityChangesFor(flowOwner);
			if (!this.#elementHighlightingIdMap.has(flowOwner)) {
				const id = highlightingId.next().value;
				this.#elementHighlightingIdMap.set(flowOwner, id);
				// NOTE: Some webpages may remove unknown attributes. It is possible to check and re-apply it from cache.
				// TODO make sure there is cleanup once the highlighting ID becomes invalid (e.g. when the cache is removed).
				flowOwner.setAttribute("markmysearch-h_id", id.toString());
			}
		});
		this.#flowMonitor.setSpansRemovedListener((flowOwner, spansRemoved) => {
			for (const span of spansRemoved) {
				this.#spanBoxesMap.delete(span);
			}
		});
		this.#flowMonitor.setNonSpanOwnerListener(flowOwner => {
			// TODO this is done for consistency with the past behaviour; but is it right/necessary?
			this.#elementHighlightingIdMap.delete(flowOwner);
			this.#elementStyleRuleMap.delete(flowOwner);
			for (const listener of this.#highlightingStyleRuleDeletedListeners) {
				listener(flowOwner);
			}
		});
		this.#elementFlowsMap = this.#flowMonitor.getElementFlowsMap();
		const method = (() => {
			switch (methodModule.methodClass) {
			case "paint": {
				return new methodModule.PaintMethod(termTokens);
			} case "url": {
				return new methodModule.UrlMethod(termTokens);
			} case "element": {
				return new methodModule.ElementMethod(
					termTokens,
					this.#elementFlowsMap,
					this.#spanBoxesMap,
					this.#elementHighlightingIdMap,
					this,
				);
			}}
		})();
		this.#method = method;
		this.getCSS = method.getCSS;
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
		const highlightingId = (function* () {
			let i = 0;
			while (true) {
				yield i++;
			}
		})();
	}

	static async getMethodModule (methodClass: PaintEngineMethod) {
		switch (methodClass) {
		case "paint": {
			const module = await import("/dist/modules/highlight/engines/paint/methods/paint.mjs");
			return { methodClass, PaintMethod: module.PaintMethod };
		} case "url": {
			const module = await import("/dist/modules/highlight/engines/paint/methods/url.mjs");
			return { methodClass, UrlMethod: module.UrlMethod };
		} case "element": {
			const module = await import("/dist/modules/highlight/engines/paint/methods/element.mjs");
			return { methodClass, ElementMethod: module.ElementMethod };
		}}
	}

	readonly getCSS: EngineCSS;

	readonly getTermBackgroundStyle = TermCSS.getHorizontalStyle;

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		termsToHighlight: ReadonlyArray<MatchTerm>,
		termsToPurge: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		// Clean up.
		this.#flowMonitor.unobserveMutations();
		this.#flowMonitor.removeHighlightSpansFor(termsToPurge);
		// MAIN
		this.terms.assign(terms);
		this.hues.assign(hues);
		this.#flowMonitor.generateHighlightSpansFor(terms, document.body);
		this.#flowMonitor.observeMutations();
		// TODO how are the currently-visible elements known and hence highlighted (when the engine has not been watching them)?
		// TODO (should visibility changes be unobserved and re-observed?)
		const highlightables = this.#method.highlightables;
		const highlightableAncestorsVisible = highlightables
			? new Set(Array.from(this.#elementsVisible).map(element => highlightables.findHighlightableAncestor(element)))
			: this.#elementsVisible;
		for (const element of highlightableAncestorsVisible) {
			this.cacheStyleRulesFor(element, false, terms, hues);
		}
		this.applyStyleRules();
	}

	endHighlighting () {
		this.unobserveVisibilityChanges();
		this.#flowMonitor.unobserveMutations();
		this.#flowMonitor.removeHighlightSpansFor();
		// FIXME this should really be applied automatically and judiciously, and the stylesheet should be cleaned up with it
		for (const element of document.body.querySelectorAll("[markmysearch-h_id]")) {
			element.removeAttribute("markmysearch-h_id");
		}
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

	applyStyleRules () {
		for (const listener of this.#highlightingAppliedListeners) {
			listener(this.#elementStyleRuleMap.keys());
		}
		const style = document.getElementById(EleID.STYLE_PAINT) as HTMLStyleElement; // NEXT 2
		style.textContent = Array.from(this.#elementStyleRuleMap.values()).join("\n");
	}

	getElementFlowsMap (): AllReadonly<Map<HTMLElement, Array<Flow>>> {
		return this.#elementFlowsMap;
	}

	getHighlightedElements (): Iterable<HTMLElement> {
		return this.#elementHighlightingIdMap.keys();
	}

	addHighlightingUpdatedListener (listener: Generator) {
		this.#flowMonitor.addHighlightingUpdatedListener(listener);
	}

	addHighlightingStyleRuleChangedListener (listener: HighlightingStyleRuleChangedListener) {
		this.#highlightingStyleRuleChangedListeners.add(listener);
	}

	addHighlightingStyleRuleDeletedListener (listener: HighlightingStyleRuleDeletedListener) {
		this.#highlightingStyleRuleDeletedListeners.add(listener);
	}

	addHighlightingAppliedListener (listener: HighlightingAppliedListener) {
		this.#highlightingAppliedListeners.add(listener);
	}
}

export {
	type Flow, type Span, type Box,
	type HighlightingStyleObserver,
	PaintEngine,
};
