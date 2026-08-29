/**
 * What the gallery lightbox should do, separated from the DOM plumbing that does
 * it — the same split as `carousel.ts` against `WCCarousel`, `tree-filter.ts`
 * against `WCTree`, and `card-click.ts` against `WCCards`. Everything genuinely
 * decidable is a function over plain data here, tested in the default `node`
 * environment; `WCGallery` only gathers the inputs and acts on the answers.
 *
 * Stepping between images, arrow keys and swipe used to live here too — deleted
 * along with the N-dialogs-per-gallery design they served. `<wc-gallery>` now
 * opens one dialog containing one `<wc-carousel>`, which already owns all three
 * (native `::scroll-button()`/`::scroll-marker` or its own fallback buttons, a
 * focusable scroll container arrow keys scroll natively, and pointer/scroll-snap
 * swipe) — reused rather than re-implemented. See `WCGallery`'s docblock.
 */

// `stepIndex` moved to `keynav.ts` — it's the same wrap/clamp decision every
// roving-tabindex widget needs, not something specific to a gallery. Re-exported
// here so existing imports (this file's own `preloadTargets`) don't need to change.
import { stepIndex } from './keynav.js';
export { stepIndex };

/**
 * Which neighbouring images are worth warming once the visitor is looking at
 * `index` — the two adjacent images, wrapping only when the gallery loops.
 *
 * Not every image: preloading the whole set defeats the lazy-loading the rest of
 * the carousel already gives for free.
 */
export function preloadTargets(index: number, total: number, loop: boolean): number[] {
  if (total <= 1) return [];
  const targets = [
    stepIndex({ index, total, delta: -1, loop }),
    stepIndex({ index, total, delta: 1, loop }),
  ];
  // No wrap at an end with `loop: false`: stepIndex clamps, so both targets can
  // equal `index` itself — drop those rather than "preload the current image".
  return [...new Set(targets)].filter((i) => i !== index);
}
