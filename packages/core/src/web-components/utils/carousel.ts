/**
 * What the carousel should do, separated from the DOM plumbing that does it — the
 * same split as `tree-filter.ts` against `WCTree` and `card-click.ts` against
 * `WCCards`. Everything genuinely decidable is a function over plain data here,
 * tested in the default `node` environment; `WCCarousel` only gathers the inputs
 * and acts on the answers.
 *
 * The decision that matters most is *which controls to build*, and it is subtler
 * than "does this engine support `::scroll-button()`". See `readFeatures`.
 */

/** Which of the stylesheet's branches are live for this element. */
export interface CarouselFeatures {
  /**
   * The native `::scroll-button()` / `::scroll-marker` branch applied, so the
   * browser is already rendering navigation and JS must build none.
   */
  nativeNav: boolean;
  /**
   * Scroll-progress timelines are available, so the hint and scrollbar fade are
   * pure CSS and JS need not watch the scroll position at all.
   */
  scrollTimeline: boolean;
}

/** What the author asked for, plus what the environment says. */
export interface CarouselConfig {
  /** The `loop` attribute is present. */
  loop: boolean;
  /** `autoplay` in milliseconds; 0 is off. */
  autoplay: number;
  /** `carousel--auto-pages` — CSS multicol paging. */
  paged: boolean;
  /** `carousel--scroll-buttons`. */
  wantsButtons: boolean;
  /** `carousel--scroll-markers`. */
  wantsMarkers: boolean;
  /** Number of authored slides, before any cloning. */
  slides: number;
  /** `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
}

/** The resolved plan. Every field is a question `WCCarousel` would otherwise ask inline. */
export interface CarouselPlan {
  clone: boolean;
  play: boolean;
  buildButtons: boolean;
  buildMarkers: boolean;
  trackScrolled: boolean;
}

/**
 * Read the stylesheet's feature probe off an element's computed style.
 *
 * `WCCarousel` deliberately does NOT call `CSS.supports` for these. Two reasons,
 * and the second is the important one.
 *
 * Drift: the conditions would then be written twice — once as `@supports` in
 * `carousel.css`, once as a string here — and the failure mode of them disagreeing
 * is silent duplicate controls sitting on top of working native ones.
 *
 * Correctness: the real question is not "does this engine support
 * `::scroll-button()`" but "did *my* stylesheet's native branch apply". A page
 * that loads `elements.js` without the framework CSS has no pseudo-elements to
 * collide with — the probe reads empty and the fallback is built, which is right.
 * `CSS.supports` would have answered yes and built nothing, leaving a carousel
 * with no navigation at all.
 *
 * An absent or unparseable value reads as "not supported", which is the safe
 * direction: it builds controls that may be redundant rather than none at all.
 */
export function readFeatures(probe: (name: string) => string): CarouselFeatures {
  const on = (name: string): boolean => probe(name).trim() === '1';
  return {
    nativeNav: on('--carousel-native-nav'),
    scrollTimeline: on('--carousel-scroll-timeline'),
  };
}

/**
 * Resolve what to build and what to run.
 *
 * `clone` is opt-in because it triples the DOM and duplicates every image element.
 * It is also excluded from paged mode outright: in a multicol flow, cloning items
 * adds *items* to the flow, not pages, so the seam never lines up with a column
 * boundary and the jump is visible.
 */
export function planCarousel(config: CarouselConfig, features: CarouselFeatures): CarouselPlan {
  const enough = config.slides >= 2;
  return {
    // Autoplay implies loop: an autoplaying strip that stops dead at the last
    // slide is worse than one that doesn't autoplay.
    clone: enough && !config.paged && (config.loop || config.autoplay > 0),
    play: config.autoplay > 0 && !config.reducedMotion,
    buildButtons: enough && config.wantsButtons && !features.nativeNav,
    buildMarkers: enough && config.wantsMarkers && !features.nativeNav,
    trackScrolled: !features.scrollTimeline,
  };
}

/**
 * Distance past which the visitor has demonstrably scrolled, in CSS pixels.
 *
 * Not zero: a snap adjustment or a restored scroll position can leave a sub-pixel
 * offset, and treating that as "they scrolled" would dismiss the hint before it
 * was read.
 */
export const SCROLLED_EPSILON = 4;

/**
 * Has the visitor scrolled the track?
 *
 * Takes the magnitude, because `scrollLeft` is *negative* in an RTL scroller in
 * every current engine — a bare `> SCROLLED_EPSILON` never fires there, so the
 * hint never dismissed and, where scroll timelines are unavailable, the scrollbar
 * never dimmed.
 */
export function hasScrolled(scrollLeft: number): boolean {
  return Math.abs(scrollLeft) > SCROLLED_EPSILON;
}

/**
 * Which authored slide a child index refers to, in the `[clones][real][clones]`
 * layout cloning produces. Returns -1 for an index outside the run.
 */
export function realIndex(childIndex: number, realCount: number, cloned: boolean): number {
  if (realCount <= 0) return -1;
  if (!cloned) return childIndex >= 0 && childIndex < realCount ? childIndex : -1;
  const total = realCount * 3;
  if (childIndex < 0 || childIndex >= total) return -1;
  return childIndex % realCount;
}

/**
 * Child index of the real twin of the clone at `childIndex` — the slide the
 * scroller silently jumps to when a clone snaps. The real run always starts at
 * `realCount`.
 */
export function twinIndex(childIndex: number, realCount: number): number {
  const real = realIndex(childIndex, realCount, true);
  return real < 0 ? -1 : realCount + real;
}

/** Accessible name for a marker. `slideLabel(2, 7)` → `'Slide 3 of 7'`. */
export function slideLabel(index: number, total: number): string {
  return `Slide ${index + 1} of ${total}`;
}

/**
 * Attributes every image inside a clone is forced to.
 *
 * A clone of the first slide is a clone of the LCP candidate, which
 * `Carousel.astro` marks `eager`/`high`. Duplicating that would issue further
 * high-priority fetches of the same URL — deduplicated by the HTTP cache, but not
 * by the priority queue, so it competes with the real LCP image. Demoting every
 * cloned image is what keeps `loop` cheap: an off-screen lazy clone never loads
 * at all, so cloning costs about two extra image loads rather than 2N.
 *
 * Set with `setAttribute`, not property assignment: the IDL name is
 * `fetchPriority`, so an `Object.assign` with these keys silently does nothing for
 * that one.
 */
export const CLONE_MEDIA: Readonly<Record<string, string>> = Object.freeze({
  loading: 'lazy',
  fetchpriority: 'low',
  decoding: 'async',
});
