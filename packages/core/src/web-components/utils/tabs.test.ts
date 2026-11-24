import { describe, expect, it } from 'vite-plus/test';
import { initialIndex, orientationOf, panelIds, slugify } from './tabs.ts';

describe('slugify', () => {
  it('lowercases, strips accents and collapses punctuation', () => {
    expect(slugify('Our Pricing & Plans')).toBe('our-pricing-plans');
    expect(slugify('Café  — Menu')).toBe('cafe-menu');
  });
  it('is empty when nothing usable is left', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('panelIds', () => {
  it('keeps an author id and derives the rest from the label', () => {
    expect(
      panelIds([{ id: 'pricing', label: 'Pricing' }, { label: 'Our Team' }], new Set(), 't'),
    ).toEqual(['pricing', 't-our-team']);
  });
  it('de-duplicates against ids already on the page and against each other', () => {
    expect(
      panelIds([{ label: 'Overview' }, { label: 'Overview' }], new Set(['t-overview']), 't'),
    ).toEqual(['t-overview-2', 't-overview-3']);
  });
  it('never reuses an author id that appears later in the list', () => {
    expect(panelIds([{ label: 'A' }, { id: 't-a', label: 'B' }], new Set(), 't')).toEqual([
      't-a-2',
      't-a',
    ]);
  });
  it('falls back to a position when the label has no usable characters', () => {
    expect(panelIds([{ label: '★' }], new Set(), 't')).toEqual(['t-panel-1']);
  });
});

describe('initialIndex', () => {
  const ids = ['a', 'b', 'c'];
  it('prefers the URL, then `selected`, then the first', () => {
    expect(initialIndex({ ids, fromHash: 2, selected: 1 })).toBe(2);
    expect(initialIndex({ ids, fromHash: null, selected: 1 })).toBe(1);
    expect(initialIndex({ ids, fromHash: null, selected: null })).toBe(0);
  });
  it('clamps an out-of-range selected and ignores a non-integer one', () => {
    expect(initialIndex({ ids, fromHash: null, selected: 99 })).toBe(2);
    expect(initialIndex({ ids, fromHash: null, selected: -4 })).toBe(0);
    expect(initialIndex({ ids, fromHash: null, selected: 1.5 })).toBe(0);
  });
  it('ignores an out-of-range hash match and handles no panels', () => {
    expect(initialIndex({ ids, fromHash: 7, selected: 1 })).toBe(1);
    expect(initialIndex({ ids: [], fromHash: null, selected: 3 })).toBe(0);
  });
});

describe('orientationOf', () => {
  it('is horizontal unless asked for vertical', () => {
    expect(orientationOf('vertical')).toBe('vertical');
    expect(orientationOf('diagonal')).toBe('horizontal');
    expect(orientationOf(null)).toBe('horizontal');
  });
});
