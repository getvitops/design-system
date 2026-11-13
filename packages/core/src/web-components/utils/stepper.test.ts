import { describe, expect, it } from 'vite-plus/test';
import { itemState, moveBy, resolveTarget, stepFromHash } from './stepper.ts';

describe('stepFromHash', () => {
  const ids = ['identity', 'contact', 'brand'];
  it('finds the step the fragment names', () => {
    expect(stepFromHash(ids, '#contact')).toBe(1);
    expect(stepFromHash(ids, 'brand')).toBe(2);
  });
  it('is -1 for nothing, an unknown id, or a bad escape', () => {
    expect(stepFromHash(ids, '')).toBe(-1);
    expect(stepFromHash(ids, '#')).toBe(-1);
    expect(stepFromHash(ids, '#nope')).toBe(-1);
    expect(stepFromHash(ids, '#%E0%A4%A')).toBe(-1);
  });
});

describe('moveBy', () => {
  it('stays inside the steps', () => {
    expect(moveBy(0, -1, 3)).toBe(0);
    expect(moveBy(2, 1, 3)).toBe(2);
    expect(moveBy(1, 1, 3)).toBe(2);
    expect(moveBy(0, 1, 0)).toBe(0);
  });
});

describe('resolveTarget', () => {
  it('always lets a visitor go back or stay', () => {
    expect(resolveTarget(2, 0, [false, false, false])).toBe(0);
    expect(resolveTarget(1, 1, [true, false])).toBe(1);
  });
  it('goes forward when everything in between is valid', () => {
    expect(resolveTarget(0, 3, [true, true, true, false])).toBe(3);
  });
  it('stops at the first invalid step on the way', () => {
    expect(resolveTarget(0, 3, [true, false, false, true])).toBe(1);
  });
  it('checks the step it is leaving, not the one it arrives at', () => {
    expect(resolveTarget(0, 1, [false, true])).toBe(0);
    expect(resolveTarget(0, 1, [true, false])).toBe(1);
  });
});

describe('itemState', () => {
  it('names current, upcoming, complete and invalid', () => {
    const visited = new Set([0, 1]);
    expect(itemState(2, 2, visited, [true, false, true])).toBe('current');
    expect(itemState(3, 2, visited, [true, true, true, true])).toBe('upcoming');
    expect(itemState(0, 2, visited, [true, false, true])).toBe('complete');
    expect(itemState(1, 2, visited, [true, false, true])).toBe('invalid');
  });
});
