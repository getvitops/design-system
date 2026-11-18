import { describe, expect, it } from 'vitest';
import { currentIndex } from './scrollspy.ts';

describe('currentIndex', () => {
  it('is -1 for no targets and before the first reaches the offset', () => {
    expect(currentIndex([], 80)).toBe(-1);
    expect(currentIndex([300, 900], 80)).toBe(-1);
  });
  it('is the last target at or above the offset', () => {
    expect(currentIndex([-500, 60, 700], 80)).toBe(1);
    expect(currentIndex([-500, -100, -10], 80)).toBe(2);
    expect(currentIndex([80, 400], 80)).toBe(0);
  });
  it('is the last target at the bottom of the page, however short it is', () => {
    expect(currentIndex([-500, -100, 600], 80, true)).toBe(2);
  });
});
