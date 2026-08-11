/**
 * What the gallery lightbox should do, separated from the DOM plumbing that does
 * it — the same split as `carousel.ts` against `WCCarousel`, `tree-filter.ts`
 * against `WCTree`, and `card-click.ts` against `WCCards`. Everything genuinely
 * decidable is a function over plain data here, tested in the default `node`
 * environment; `WCGallery` only gathers the inputs and acts on the answers.
 */

// `stepIndex` moved to `keynav.ts` — it's the same wrap/clamp decision every
// roving-tabindex widget needs, not something specific to a gallery. Re-exported
// here so existing imports (this file's own `preloadTargets`, `WCGallery.ts`)
// don't need to change.
import { stepIndex } from './keynav.js';
export { stepIndex };

/** The step a keypress requests, or `null` when the key means nothing here. */
export type GalleryKeyAction = { delta: number } | 'first' | 'last' | null;

/**
 * What `key` asks for, RTL-aware.
 *
 * Escape and Tab are deliberately not handled here: `<dialog>` already closes on
 * Escape with no help, and a focus trap is the platform's job, not this
 * function's. This only answers "which image", which is the one decision that
 * depends on writing direction — arrow-key sides flip under `direction: rtl`, the
 * same convention `WCCarousel` follows for its dot nav.
 */
export function keyToAction(key: string, rtl: boolean): GalleryKeyAction {
  switch (key) {
    case 'ArrowLeft':
      return { delta: rtl ? 1 : -1 };
    case 'ArrowRight':
      return { delta: rtl ? -1 : 1 };
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    default:
      return null;
  }
}

/**
 * Which neighbouring images are worth warming once the visitor is looking at
 * `index` — the two adjacent images, wrapping only when the gallery loops.
 *
 * Not every image: preloading the whole set defeats the lazy-loading the closed
 * dialogs already give for free (see `WCGallery`'s docblock on why the dialogs
 * are kept rather than collapsed to one).
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

/** What a pointer gesture asks for: step the gallery, dismiss it, or neither. */
export type SwipeAction = { type: 'step'; delta: number } | { type: 'dismiss' } | null;

/**
 * Classify a completed drag by its dominant axis.
 *
 * Horizontal past `threshold` steps to the neighbour in that direction; vertical
 * past `threshold` dismisses (a downward flick closing a full-screen viewer is
 * the convention every native photo app uses). Whichever axis moved further
 * decides, so a diagonal flick doesn't fire both.
 */
export function swipeAction(dx: number, dy: number, threshold: number): SwipeAction {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absX < threshold && absY < threshold) return null;
  if (absX >= absY) return { type: 'step', delta: dx < 0 ? 1 : -1 };
  return { type: 'dismiss' };
}
