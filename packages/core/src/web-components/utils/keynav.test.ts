import { describe, expect, it } from 'vitest';
import {
  linearKeyToMove,
  matchTypeahead,
  stepIndex,
  typeahead,
  type TypeaheadState,
} from './keynav.ts';

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

  it('is a no-op with nothing to step through', () => {
    expect(stepIndex({ index: 0, total: 0, delta: 1, loop: true })).toBe(0);
  });
});

describe('linearKeyToMove', () => {
  it('maps horizontal arrows to a step, LTR', () => {
    expect(linearKeyToMove('ArrowLeft', { orientation: 'horizontal' })).toEqual({
      type: 'step',
      delta: -1,
    });
    expect(linearKeyToMove('ArrowRight', { orientation: 'horizontal' })).toEqual({
      type: 'step',
      delta: 1,
    });
  });

  it('flips horizontal arrows under rtl', () => {
    expect(linearKeyToMove('ArrowLeft', { orientation: 'horizontal', rtl: true })).toEqual({
      type: 'step',
      delta: 1,
    });
    expect(linearKeyToMove('ArrowRight', { orientation: 'horizontal', rtl: true })).toEqual({
      type: 'step',
      delta: -1,
    });
  });

  it('never flips vertical arrows under rtl', () => {
    expect(linearKeyToMove('ArrowUp', { orientation: 'both', rtl: true })).toEqual({
      type: 'step',
      delta: -1,
    });
    expect(linearKeyToMove('ArrowDown', { orientation: 'both', rtl: true })).toEqual({
      type: 'step',
      delta: 1,
    });
  });

  it('orientation "horizontal" ignores vertical arrows', () => {
    expect(linearKeyToMove('ArrowUp', { orientation: 'horizontal' })).toBeNull();
    expect(linearKeyToMove('ArrowDown', { orientation: 'horizontal' })).toBeNull();
  });

  it('orientation "vertical" ignores horizontal arrows', () => {
    expect(linearKeyToMove('ArrowLeft', { orientation: 'vertical' })).toBeNull();
    expect(linearKeyToMove('ArrowRight', { orientation: 'vertical' })).toBeNull();
  });

  it('orientation "both" accepts every arrow', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
      expect(linearKeyToMove(key, { orientation: 'both' })).not.toBeNull();
    }
  });

  it('maps Home/End to first/last regardless of orientation or direction', () => {
    expect(linearKeyToMove('Home', { orientation: 'horizontal' })).toEqual({ type: 'first' });
    expect(linearKeyToMove('End', { orientation: 'horizontal', rtl: true })).toEqual({
      type: 'last',
    });
  });

  it('returns null for anything else', () => {
    expect(linearKeyToMove('Escape', { orientation: 'both' })).toBeNull();
    expect(linearKeyToMove('a', { orientation: 'both' })).toBeNull();
  });
});

describe('typeahead', () => {
  it('starts a fresh buffer with no prior state', () => {
    const state = typeahead(null, 'a', 1000);
    expect(state).toEqual({ buffer: 'a', query: 'a', lastTime: 1000 });
  });

  it('accumulates distinct characters within the timeout into a multi-char query', () => {
    let state: TypeaheadState | null = null;
    state = typeahead(state, 'c', 0);
    state = typeahead(state, 'l', 100);
    state = typeahead(state, 'a', 200);
    expect(state.buffer).toBe('cla');
    expect(state.query).toBe('cla');
  });

  it('starts fresh after the timeout elapses', () => {
    const first = typeahead(null, 'c', 0);
    const second = typeahead(first, 'x', 0 + 1001);
    expect(second.buffer).toBe('x');
    expect(second.query).toBe('x');
  });

  it('collapses a same-character repeat to a single-character query', () => {
    let state: TypeaheadState | null = null;
    state = typeahead(state, 'a', 0);
    state = typeahead(state, 'a', 100);
    state = typeahead(state, 'a', 200);
    expect(state.buffer).toBe('aaa');
    expect(state.query).toBe('a');
  });

  it('a repeat followed by a different character is NOT collapsed', () => {
    let state: TypeaheadState | null = null;
    state = typeahead(state, 'a', 0);
    state = typeahead(state, 'a', 100);
    state = typeahead(state, 'b', 200);
    expect(state.buffer).toBe('aab');
    expect(state.query).toBe('aab');
  });
});

describe('matchTypeahead', () => {
  const candidates = [
    { key: 'apple', text: 'Apple' },
    { key: 'apricot', text: 'Apricot' },
    { key: 'banana', text: 'Banana' },
    { key: 'cherry', text: 'Cherry' },
  ];

  it('matches case-insensitively from the start', () => {
    expect(matchTypeahead(candidates, 'ban', 'apple')).toBe('banana');
  });

  it('starts searching just after the active item, wrapping around', () => {
    // Active on apple; searching "a" should skip apple itself first and land on
    // apricot, the next "a…" item — not stay on apple.
    expect(matchTypeahead(candidates, 'a', 'apple')).toBe('apricot');
  });

  it('wraps to the beginning and can land back on the active item if it is the only match', () => {
    expect(matchTypeahead(candidates, 'cherry', 'cherry')).toBe('cherry');
  });

  it('cycles through repeated matches on successive single-character queries', () => {
    // Simulates pressing "a" three times: first lands on apricot (skipping the
    // active apple), a second search from apricot wraps around to apple.
    expect(matchTypeahead(candidates, 'a', 'apple')).toBe('apricot');
    expect(matchTypeahead(candidates, 'a', 'apricot')).toBe('apple');
  });

  it('skips hidden candidates', () => {
    // Only apricot matches "apri"; hiding it leaves nothing to find.
    expect(matchTypeahead(candidates, 'apri', 'apple', (key) => key === 'apricot')).toBe(null);
  });

  it('returns null for no candidates or an empty query', () => {
    expect(matchTypeahead([], 'a', null)).toBeNull();
    expect(matchTypeahead(candidates, '', 'apple')).toBeNull();
  });

  it('treats an unknown active key as searching from the start', () => {
    expect(matchTypeahead(candidates, 'cherry', 'not-a-real-key')).toBe('cherry');
  });
});
