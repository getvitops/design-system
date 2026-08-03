import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SiteFontSchema } from '@getvitops/generator';
import { fontProviders } from 'astro/config';
import { describe, expect, it } from 'vitest';
import { resolveFonts } from './fonts.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

const decl = (over: Record<string, unknown> = {}) => ({
  name: 'League Spartan',
  provider: 'fontsource' as const,
  cssVariable: '--font-league-spartan',
  ...over,
});

describe('resolveFonts', () => {
  it('constructs the provider and keeps the rest of the declaration', () => {
    const { fonts } = resolveFonts([
      decl({ weights: ['100 900'], subsets: ['latin'], fallbacks: ['sans-serif'] }),
    ]);
    expect(fonts).toHaveLength(1);
    expect(fonts[0]).toMatchObject({
      name: 'League Spartan',
      cssVariable: '--font-league-spartan',
      weights: ['100 900'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    });
    // A constructed provider object, not the string it was declared as.
    expect(typeof fonts[0]!.provider).toBe('object');
  });

  it('keeps `preload` out of the Astro entry and on the head data', () => {
    // preload is a <Font /> prop, not a config key — leaving it in the config entry
    // would put an unknown key through Astro's own schema.
    const { fonts, head } = resolveFonts([decl({ preload: true })]);
    expect(fonts[0]).not.toHaveProperty('preload');
    expect(head).toEqual([{ cssVariable: '--font-league-spartan', preload: true }]);
  });

  it('passes a per-face preload filter through rather than flattening it', () => {
    // Flattening to `true` would preload every face of the family — the opposite of
    // what asking for one face means.
    const filter = [{ weight: 700, style: 'normal' as const }];
    const { head } = resolveFonts([decl({ preload: filter })]);
    expect(head[0]!.preload).toEqual(filter);
  });

  it('defaults preload to false', () => {
    expect(resolveFonts([decl()]).head[0]!.preload).toBe(false);
  });

  it('throws on two families claiming one cssVariable', () => {
    // Astro warns and the last wins, so the first family silently never loads.
    expect(() => resolveFonts([decl(), decl({ name: 'Cardo' })])).toThrow(/two families/);
  });

  it('throws on an unknown provider', () => {
    expect(() => resolveFonts([decl({ provider: 'typekit' })])).toThrow(/unknown provider/);
  });

  it('throws on a cssVariable that is not a custom property', () => {
    expect(() => resolveFonts([decl({ cssVariable: 'font-league' })])).toThrow(/must start with/);
  });

  it('directs Adobe to astro.config instead of half-constructing it', () => {
    // fontProviders.adobe({ id }) needs an environment-supplied key; a JSON
    // declaration has nowhere to hold one, so failing loudly beats a broken family.
    expect(() => resolveFonts([decl({ provider: 'adobe' })])).toThrow(/astro\.config/);
  });
});

describe('provider vocabulary', () => {
  it("matches Astro's fontProviders exactly", () => {
    // The generator's enum and Astro's providers are two hand-maintained lists. Drift
    // is silent in one direction (a provider we accept but Astro doesn't have throws
    // only when someone uses it) and lossy in the other (a provider Astro gained that
    // we reject). Compare them directly.
    const schemaProviders = (SiteFontSchema.def.shape.provider as unknown as { options: string[] })
      .options;
    expect([...schemaProviders].sort()).toEqual(Object.keys(fontProviders).sort());
  });
});

describe('<Head />', () => {
  const head = readFileSync(join(HERE, 'components/Head.astro'), 'utf8');

  it('emits <Font /> for the registered families', () => {
    // The config alone is inert: Astro resolves the files, but <Font /> is what puts
    // the @font-face on the page. Without this the whole feature loads nothing.
    expect(head).toContain("import { Font } from 'astro:assets'");
    expect(head).toMatch(/head\.fonts\.map/);
    expect(head).toMatch(/<Font\s+cssVariable=/);
  });

  it('drives preload from the declaration', () => {
    expect(head).toMatch(/preload=\{f\.preload\}/);
  });
});
