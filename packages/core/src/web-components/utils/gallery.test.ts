import { describe, expect, it } from 'vitest';
import { preloadTargets } from './gallery.ts';

// `stepIndex` (re-exported here) is tested at its home, `keynav.test.ts` —
// `keyToAction` and `swipeAction` are gone along with the N-dialogs-per-gallery
// design they served; see this file's own docblock and WCGallery's.

describe('preloadTargets', () => {
  it('warms both neighbours mid-set', () => {
    expect(preloadTargets(2, 5, false)).toEqual(expect.arrayContaining([1, 3]));
    expect(preloadTargets(2, 5, false)).toHaveLength(2);
  });

  it('does not wrap at an end when the gallery does not loop', () => {
    // stepIndex clamps both ends to 0, which would otherwise "preload" index 0
    // itself — the current image, not a neighbour.
    expect(preloadTargets(0, 5, false)).toEqual([1]);
  });

  it('wraps at an end when the gallery loops', () => {
    expect(preloadTargets(0, 5, true)).toEqual(expect.arrayContaining([4, 1]));
    expect(preloadTargets(0, 5, true)).toHaveLength(2);
  });

  it('has nothing to preload with zero or one image', () => {
    expect(preloadTargets(0, 1, true)).toEqual([]);
    expect(preloadTargets(0, 0, true)).toEqual([]);
  });
});
