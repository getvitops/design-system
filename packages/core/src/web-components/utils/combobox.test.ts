import { describe, expect, it } from 'vite-plus/test';
import { exactMatch, filterOptions, moveActive, normalize, statusText } from './combobox.ts';

const cities = [
  { value: 'ottawa', label: 'Ottawa' },
  { value: 'toronto', label: 'Toronto' },
  { value: 'gatineau', label: 'Gatineau' },
  { value: 'montreal', label: 'Montréal' },
];

describe('normalize', () => {
  it('ignores case, accents and surrounding space', () => {
    expect(normalize('  Montréal ')).toBe('montreal');
  });
});

describe('filterOptions', () => {
  it('returns every option for an empty or blank query', () => {
    expect(filterOptions(cities, '')).toHaveLength(4);
    expect(filterOptions(cities, '   ')).toHaveLength(4);
  });
  it('finds across accents and case', () => {
    expect(filterOptions(cities, 'MONTREAL').map((o) => o.value)).toEqual(['montreal']);
    expect(filterOptions(cities, 'montré').map((o) => o.value)).toEqual(['montreal']);
  });
  it('ranks prefix matches before substring matches, keeping author order within each', () => {
    const words = ['Photo', 'Otto', 'Notting'].map((w) => ({ value: w, label: w }));
    expect(filterOptions(words, 'ot').map((o) => o.value)).toEqual(['Otto', 'Photo', 'Notting']);
  });
  it('matches the value when the label differs', () => {
    expect(filterOptions([{ value: 'ON', label: 'Ontario' }], 'on').map((o) => o.value)).toEqual([
      'ON',
    ]);
    expect(filterOptions([{ value: 'ON', label: 'Ontario' }], 'ont')).toHaveLength(1);
  });
  it('returns nothing when nothing matches, and never mutates its input', () => {
    const copy = structuredClone(cities);
    expect(filterOptions(cities, 'zzz')).toEqual([]);
    expect(cities).toEqual(copy);
  });
});

describe('moveActive', () => {
  it('enters from none: Down to the first, Up to the last', () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
  });
  it('wraps at both ends', () => {
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
  });
  it('is none when there are no options', () => {
    expect(moveActive(0, 1, 0)).toBe(-1);
  });
});

describe('statusText', () => {
  it('pluralises, and says when nothing matches', () => {
    expect(statusText(1, '', 'No matches')).toBe('1 result');
    expect(statusText(3, 'o', 'No matches')).toBe('3 results available');
    expect(statusText(0, 'zz', 'No matches')).toBe('No matches');
  });
});

describe('exactMatch', () => {
  it('matches a value or a label exactly, ignoring case and accents', () => {
    expect(exactMatch(cities, 'MONTRÉAL')?.value).toBe('montreal');
    expect(exactMatch(cities, 'ottawa')?.label).toBe('Ottawa');
  });
  it('does not match a fragment or nothing', () => {
    expect(exactMatch(cities, 'otta')).toBeUndefined();
    expect(exactMatch(cities, '')).toBeUndefined();
  });
});
