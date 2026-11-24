import { describe, expect, it } from 'vite-plus/test';
import { astroLocaleCodes, localeConsistencyWarnings } from './i18n.ts';

describe('astroLocaleCodes', () => {
  it('flattens bare-string and { path, codes } entries alike', () => {
    expect(
      astroLocaleCodes({
        defaultLocale: 'en',
        locales: ['en', { path: 'french', codes: ['fr', 'fr-CA'] }],
      }),
    ).toEqual(new Set(['en', 'fr', 'fr-CA']));
  });
});

describe('localeConsistencyWarnings', () => {
  const site = { locales: { en: {}, fr: {} }, defaultLocale: 'en' };
  const i18n = { defaultLocale: 'en', locales: ['en', 'fr'] };

  it('is silent when either side is absent', () => {
    expect(localeConsistencyWarnings(null, i18n)).toEqual([]);
    expect(localeConsistencyWarnings(site, undefined)).toEqual([]);
  });

  it('is silent when both agree', () => {
    expect(localeConsistencyWarnings(site, i18n)).toEqual([]);
  });

  it('flags a locale in site.locales but not astro i18n', () => {
    const [warning] = localeConsistencyWarnings(site, { defaultLocale: 'en', locales: ['en'] });
    expect(warning).toMatch(/site\.locales has "fr" that astro's i18n doesn't/);
  });

  it('flags a locale in astro i18n but not site.locales', () => {
    const [warning] = localeConsistencyWarnings(
      { locales: { en: {} }, defaultLocale: 'en' },
      { defaultLocale: 'en', locales: ['en', 'fr'] },
    );
    expect(warning).toMatch(/astro's i18n has "fr" that site\.locales doesn't/);
  });

  it('flags a defaultLocale mismatch independently of the locale-set check', () => {
    const warnings = localeConsistencyWarnings(site, {
      defaultLocale: 'fr',
      locales: ['en', 'fr'],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(
      /defaultLocale \("fr"\) does not match site\.defaultLocale \("en"\)/,
    );
  });

  it('reports both kinds of mismatch together', () => {
    const warnings = localeConsistencyWarnings(site, {
      defaultLocale: 'de',
      locales: ['en', 'de'],
    });
    expect(warnings).toHaveLength(2);
  });
});
