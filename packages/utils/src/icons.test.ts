import { describe, expect, it } from 'vitest';
import { generateIconInclude, iconMap, prefixToMapKey, resolveIcon } from './icons.ts';

/**
 * `generateIconInclude` is the build-time contract: declare the semantic names a
 * site needs plus which sets to draw them from, get back the `include` map that
 * astro-icon (and astro-iconset — same shape) uses to ship only those glyphs.
 *
 * The point of the exercise is that swapping the set is safe, which only holds if
 * an unresolvable name is loud. It used to skip silently, so a swap "succeeded"
 * and the gaps appeared as missing glyphs in production.
 */
describe('generateIconInclude', () => {
  it('resolves semantic names through the configured ui set', () => {
    const include = generateIconInclude({ ui: 'fa7-solid', semantic: ['menu', 'close'] });
    expect(include['fa7-solid']).toContain(iconMap.fa7.menu);
    expect(include['fa7-solid']).toContain(iconMap.fa7.close);
  });

  it('emits only what was asked for — no fallback to the whole set', () => {
    const include = generateIconInclude({ ui: 'fa7-solid', semantic: ['menu'] });
    expect(include['fa7-solid']).toHaveLength(1);
  });

  it('passes through explicit per-set lists alongside semantic names', () => {
    const include = generateIconInclude({
      ui: 'fa7-solid',
      semantic: ['menu'],
      'fa7-solid': ['custom-glyph'],
    } as Parameters<typeof generateIconInclude>[0]);
    expect(include['fa7-solid']).toEqual(
      expect.arrayContaining([iconMap.fa7.menu, 'custom-glyph']),
    );
  });

  it('deduplicates when a semantic name and an explicit list overlap', () => {
    const include = generateIconInclude({
      ui: 'fa7-solid',
      semantic: ['menu'],
      'fa7-solid': [iconMap.fa7.menu],
    } as Parameters<typeof generateIconInclude>[0]);
    expect(include['fa7-solid']).toHaveLength(1);
  });

  it('throws — naming every offender — when a semantic name is missing', () => {
    expect(() =>
      generateIconInclude({ ui: 'fa7-solid', semantic: ['menu', 'not-an-icon', 'also-fake'] }),
    ).toThrow(/not-an-icon, also-fake/);
  });

  it('throws on an unknown icon set rather than silently emitting nothing', () => {
    expect(() => generateIconInclude({ ui: 'not-a-set', semantic: ['menu'] })).toThrow(
      /Unknown icon set/,
    );
  });

  it('lets a name resolve from the brand set when the ui set lacks it', () => {
    const brandOnly = Object.keys(iconMap['simple-icons']).find((k) => !(k in iconMap.fa7));
    expect(brandOnly, 'expected a brand-only name to exist').toBeTruthy();
    const include = generateIconInclude({
      ui: 'fa7-solid',
      brand: 'simple-icons',
      semantic: [brandOnly!],
    });
    const brandMap = iconMap['simple-icons'] as Record<string, string>;
    expect(include['simple-icons']).toContain(brandMap[brandOnly!]);
  });
});

describe('icon set swapping', () => {
  it('produces set-appropriate names for the same semantic list', () => {
    // The whole reason the indirection exists: one declaration, different output
    // per set. If these ever matched, the map would be doing nothing.
    const names = ['menu', 'close'];
    const fa = generateIconInclude({ ui: 'fa7-solid', semantic: names })['fa7-solid'];
    const lucide = generateIconInclude({ ui: 'lucide', semantic: names })['lucide'];
    expect(fa).toBeDefined();
    expect(lucide).toBeDefined();
    expect(fa).not.toEqual(lucide);
  });

  it('maps every fa7 variant onto the same underlying names', () => {
    // fa7-solid/regular/light/thin share glyph names, so a weight change must not
    // be treated as a different set.
    for (const p of ['fa7-solid', 'fa7-regular', 'fa7-light', 'fa7-thin'])
      expect(prefixToMapKey[p]).toBe('fa7');
    expect(resolveIcon('menu', 'fa7-regular')).toBe(`fa7-regular:${iconMap.fa7.menu}`);
  });
});

describe('phosphor', () => {
  it('covers the same semantic vocabulary as the other sets', () => {
    // Parity with fa7 is the contract that makes `ui: 'ph'` a safe swap. A gap
    // here is exactly the "swap succeeded, glyph missing in prod" failure.
    const fa7Keys = Object.keys(iconMap.fa7).sort();
    expect(Object.keys(iconMap.ph).sort()).toEqual(fa7Keys);
  });

  it('is one collection, not a family of prefixed ones', () => {
    // Unlike fa7-solid/regular/light/thin, Phosphor keeps every weight in `ph`
    // and varies the NAME. So `ph` maps to itself with nothing to collapse.
    expect(prefixToMapKey.ph).toBe('ph');
    expect(resolveIcon('menu', 'ph')).toBe('ph:list');
    expect(resolveIcon('close', 'ph')).toBe('ph:x');
    expect(resolveIcon('home', 'ph')).toBe('ph:house');
  });
});

describe('weights', () => {
  it('suffixes the name, and treats the default weight as bare', () => {
    expect(resolveIcon('menu', 'ph', { weight: 'bold' })).toBe('ph:list-bold');
    expect(resolveIcon('menu', 'ph', { weight: 'fill' })).toBe('ph:list-fill');
    // 'regular' is the unsuffixed default — asking for it must add nothing,
    // because `ph:list-regular` does not exist.
    expect(resolveIcon('menu', 'ph', { weight: 'regular' })).toBe('ph:list');
    expect(resolveIcon('menu', 'ph')).toBe('ph:list');
  });

  it('throws on an unknown weight rather than falling back', () => {
    // Silently returning the regular glyph would be indistinguishable from a typo.
    expect(() => resolveIcon('menu', 'ph', { weight: 'heavy' })).toThrow(/Unknown weight/);
  });

  it('ignores weight for sets that are not suffix-weighted', () => {
    // fa7 encodes weight in the PREFIX, so the name must be left alone.
    expect(resolveIcon('menu', 'fa7-solid', { weight: 'bold' })).toBe(
      `fa7-solid:${iconMap.fa7.menu}`,
    );
  });

  it('carries the weight into the bundled include list', () => {
    // The weight is part of the name, so `include` must carry it — bundling
    // `ph:list` while the page renders `ph:list-bold` ships the wrong glyph.
    const include = generateIconInclude({ ui: 'ph', weight: 'bold', semantic: ['menu'] });
    expect(include.ph).toContain('list-bold');
    expect(include.ph).not.toContain('list');
  });

  it('does not treat `weight` as a per-set icon list', () => {
    // `weight` sits beside the per-set keys in the same object, so the
    // pass-through loop has to skip it the way it skips ui/brand/semantic.
    const include = generateIconInclude({ ui: 'ph', weight: 'bold', semantic: ['menu'] });
    expect(include.weight).toBeUndefined();
  });
});
