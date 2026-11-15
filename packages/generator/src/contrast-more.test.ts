import { contrastRatio } from '@getvitops/utils/color';
import { describe, expect, it, vi } from 'vite-plus/test';
import {
  checkHighContrast,
  contrastMoreCss,
  highContrastRole,
  withHighContrast,
} from './contrast-more.ts';
import { build } from './generate.ts';
import { defaultConfig } from './index.ts';
import { checkContrast, expandPalette, functionalRole } from './tokens.ts';

const ASSETS = new URL('../assets', import.meta.url).pathname;
const palette = expandPalette({
  ink: { seed: '#3f4a5c' },
  brand: { seed: '#2e9b73' },
});
const surface = functionalRole('surface', 'ink', palette.ink!, 'surface');
const brand = functionalRole('ui-primary', 'brand', palette.brand!, 'chromatic', { solid: '700' });
const numericOf = (h: string) => palette[h]!.numeric!;
const hexOf = (v: string) => {
  const m = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/.exec(v);
  return m ? (numericOf(m[1]!)[m[2] as never] as string) : v;
};
const planes = (which: 'light' | 'dark') =>
  ['bg', 'bg-muted', 'bg-x-muted'].map((k) => hexOf(surface[which][k]!));
const surfaceBg = { light: planes('light'), dark: planes('dark') };

describe('highContrastRole', () => {
  const more = highContrastRole(brand, palette.brand!, surfaceBg);
  const merged = withHighContrast(brand, more);

  it('moves chromatic text to 7:1 against every plane it sits on, in both appearances', () => {
    for (const appearance of ['light', 'dark'] as const)
      for (const bg of [...surfaceBg[appearance]])
        expect(contrastRatio(hexOf(merged[appearance]['text']!), bg)).toBeGreaterThanOrEqual(7);
  });

  it('makes a decorative border as solid as the icon', () => {
    expect(merged.light['border']).toBe(merged.light['icon']);
    expect(merged.dark['border']).toBe(merged.dark['icon']);
  });

  it('walks the solid until text-on clears 7:1, keeping text-on itself', () => {
    expect(merged.light['text-on']).toBe(brand.light['text-on']);
    expect(
      contrastRatio(merged.light['text-on']!, hexOf(merged.light['bg-solid']!)),
    ).toBeGreaterThanOrEqual(7);
  });

  it('is a delta: it restates nothing identical to the baseline for light', () => {
    for (const [k, v] of Object.entries(more.light)) expect(brand.light[k]).not.toBe(v);
  });

  it('restates in dark every token light-more sets, so light-more cannot leak into a dark page', () => {
    for (const k of Object.keys(more.light)) expect(more.dark).toHaveProperty(k);
  });

  it('passes the baseline bars, so it is a conforming alternative (G174)', () => {
    const r = checkHighContrast(brand, more, numericOf, surfaceBg, undefined);
    expect(r.failures).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('a layer below the baseline is reported as a failure, not silently shipped', () => {
    const weak = { role: brand.role, light: { text: 'var(--color-brand-50)' }, dark: {} };
    expect(
      checkHighContrast(brand, weak, numericOf, surfaceBg, ['light']).failures.length,
    ).toBeGreaterThan(0);
  });
});

describe('contrastMoreCss', () => {
  const more = [highContrastRole(brand, palette.brand!, surfaceBg)];
  const css = contrastMoreCss(more, {
    systemColorScheme: false,
    darkOnly: false,
    surfaceHue: 'ink',
  });

  it('answers all three triggers', () => {
    expect(css).toContain(':root[data-contrast="more"]');
    expect(css).toContain(':root:has(:where(.contrast-toggle input:checked))');
    expect(css).toContain('@media (prefers-contrast: more)');
  });

  it('lets a visitor opt out of the media query with data-contrast="standard"', () => {
    expect(css).toContain(':root:not([data-contrast="standard"])');
  });

  it('pairs the trigger with the dark selector so dark-more outranks light-more', () => {
    expect(css).toContain('[data-contrast="more"][data-theme="dark"]');
  });

  it('removes transparency from the glass surface', () => {
    expect(css).toContain('--surface-glass: var(--color-bg-surface)');
  });

  it('adds the OS-preference twins only when the site opts into system colour scheme', () => {
    expect(css).not.toContain('prefers-color-scheme');
    const sys = contrastMoreCss(more, {
      systemColorScheme: true,
      darkOnly: false,
      surfaceHue: 'ink',
    });
    expect(sys).toContain('@media (prefers-contrast: more) and (prefers-color-scheme: dark)');
  });

  it('emits no dark blocks for a dark-only site', () => {
    const dark = contrastMoreCss(more, { systemColorScheme: true, darkOnly: true });
    expect(dark).not.toContain('data-theme="dark"');
  });
});

describe('format reach', () => {
  const ds = defaultConfig();
  it('is in the css and tailwind output, and absent from bricks', () => {
    expect(build(ds, 'css', ASSETS).generated['color.css']).toContain('prefers-contrast: more');
    expect(build(ds, 'bricks', ASSETS).generated['color.css']).not.toContain('prefers-contrast');
    expect(build(ds, 'tailwind', ASSETS).tailwind ?? '').toContain('prefers-contrast: more');
  });
});

describe('site.accessibility.contrastToggle (G174)', () => {
  // Brand colour under 4.5:1 for text-on at its step 600, which fails the baseline.
  const failing = () => {
    const ds = defaultConfig();
    ds.colors.roles['danger'] = { hue: 'rose', kind: 'chromatic', solid: '600' };
    return ds;
  };

  it('without the toggle a baseline miss fails the build', () => {
    expect(() => build(failing(), 'css', ASSETS)).toThrow(/text-on on bg-solid/);
  });

  it('with the toggle it only warns, because the generated layer conforms', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(() => build(failing(), 'css', ASSETS, { contrastToggle: true })).not.toThrow();
      expect(warn.mock.calls.flat().join('\n')).toMatch(/only via the contrast toggle/);
    } finally {
      warn.mockRestore();
    }
  });

  it('checkContrast against the layer is the same contract (sanity)', () => {
    const more = highContrastRole(brand, palette.brand!, surfaceBg);
    expect(checkContrast(withHighContrast(brand, more), numericOf, surfaceBg)).toEqual([]);
  });
});
