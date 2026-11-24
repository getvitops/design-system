import { describe, expect, it } from 'vite-plus/test';
import { defaultConfig, defaultSiteConfig } from './index.ts';
import { build } from './generate.ts';
import { previewCss } from './preview.ts';

const ds = () => structuredClone(defaultConfig()) as ReturnType<typeof defaultConfig>;

describe('previewCss', () => {
  it('returns the generated layers, each in the bundle’s cascade layer', () => {
    const r = previewCss(ds());
    expect(r.errors).toEqual([]);
    expect(r.css.startsWith('@layer vitops.base, vitops.components, vitops.utilities;')).toBe(true);
    expect(r.css).toMatch(/@layer vitops\.utilities \{[\s\S]*--color-/);
    expect(r.css).toMatch(/@layer vitops\.components \{[\s\S]*\.btn/);
  });

  it('matches what build() emits for the css format', () => {
    const built = build(ds(), 'css', '').generated;
    const r = previewCss(ds());
    expect(r.css).toContain(built['color.css']!.trim());
    expect(r.css).toContain(built['patterns.css']!.trim());
  });

  it('reflects an edited seed, which is what a live preview is for', () => {
    const edited = ds();
    const hue = Object.keys(edited.colors.palette)[0]!;
    const before = previewCss(edited).css;
    (edited.colors.palette as Record<string, { seed: string }>)[hue] = { seed: '#ff00aa' };
    const after = previewCss(edited).css;
    expect(after).not.toBe(before);
  });

  it('reports a bad document as errors with no css, so a caller keeps the last good one', () => {
    const bad = ds();
    (bad.colors.roles as Record<string, string>).danger = 'no-such-hue';
    const r = previewCss(bad);
    expect(r.css).toBe('');
    expect(r.errors.join(' ')).toMatch(/no-such-hue|unknown|palette/i);
  });

  it('takes a full Config and its default theme', () => {
    const r = previewCss(defaultSiteConfig({ name: 'Acme', url: 'https://acme.example' }));
    expect(r.errors).toEqual([]);
    expect(r.css).toContain('--color-');
  });
});
