import { describe, expect, it } from 'vitest';
import {
  keyToAction,
  preloadTargets,
  stepIndex,
  swipeAction,
  type SwipeAction,
} from './gallery.ts';

describe('stepIndex', () => {
  it('steps forward and back within bounds', () => {
    expect(stepIndex({ index: 1, total: 5, delta: 1, loop: false })).toBe(2);
    expect(stepIndex({ index: 1, total: 5, delta: -1, loop: false })).toBe(0);
  });

  it('clamps at the ends when not looping', () => {
    expect(stepIndex({ index: 0, total: 5, delta: -1, loop: false })).toBe(0);
    expect(stepIndex({ index: 4, total: 5, delta: 1, loop: false })).toBe(4);
  });

  it('wraps at the ends when looping', () => {
    expect(stepIndex({ index: 0, total: 5, delta: -1, loop: true })).toBe(4);
    expect(stepIndex({ index: 4, total: 5, delta: 1, loop: true })).toBe(0);
  });

  it('wraps a multi-step delta, not just ±1', () => {
    expect(stepIndex({ index: 0, total: 5, delta: -7, loop: true })).toBe(3);
  });

  it('is a no-op with nothing to step through', () => {
    expect(stepIndex({ index: 0, total: 0, delta: 1, loop: true })).toBe(0);
  });
});

describe('keyToAction', () => {
  it('maps arrow keys to a step, LTR', () => {
    expect(keyToAction('ArrowLeft', false)).toEqual({ delta: -1 });
    expect(keyToAction('ArrowRight', false)).toEqual({ delta: 1 });
  });

  it('flips arrow sides under RTL', () => {
    expect(keyToAction('ArrowLeft', true)).toEqual({ delta: 1 });
    expect(keyToAction('ArrowRight', true)).toEqual({ delta: -1 });
  });

  it('maps Home/End to first/last, unaffected by direction', () => {
    expect(keyToAction('Home', false)).toBe('first');
    expect(keyToAction('End', true)).toBe('last');
  });

  it('leaves everything else — including Escape — to the platform', () => {
    expect(keyToAction('Escape', false)).toBeNull();
    expect(keyToAction('Tab', false)).toBeNull();
    expect(keyToAction('a', false)).toBeNull();
  });
});

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

describe('swipeAction', () => {
  const THRESHOLD = 40;

  it('does nothing below the threshold on both axes', () => {
    expect(swipeAction(10, 10, THRESHOLD)).toBeNull();
  });

  it('steps forward on a leftward swipe past the threshold', () => {
    const action: SwipeAction = swipeAction(-60, 5, THRESHOLD);
    expect(action).toEqual({ type: 'step', delta: 1 });
  });

  it('steps back on a rightward swipe past the threshold', () => {
    expect(swipeAction(60, 5, THRESHOLD)).toEqual({ type: 'step', delta: -1 });
  });

  it('dismisses on a vertical swipe past the threshold', () => {
    expect(swipeAction(5, 60, THRESHOLD)).toEqual({ type: 'dismiss' });
    expect(swipeAction(5, -60, THRESHOLD)).toEqual({ type: 'dismiss' });
  });

  it('picks the dominant axis on a diagonal flick, never both', () => {
    expect(swipeAction(-80, 41, THRESHOLD)).toEqual({ type: 'step', delta: 1 });
    expect(swipeAction(41, -80, THRESHOLD)).toEqual({ type: 'dismiss' });
  });
});
