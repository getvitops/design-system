import { describe, expect, it } from 'vitest';
import { SeoSchema } from '@getvitops/config';
import { defaultSiteConfig, resolveConfig, type Config } from '@getvitops/generator';
import { mergeSeoDefaults, resolveSeoDefaults } from './seo-defaults.ts';

function config(site: Record<string, unknown> = {}, organization: Record<string, unknown> = {}) {
  const base = defaultSiteConfig() as unknown as Config;
  return {
    ...base,
    organization: { ...base.organization, ...organization },
    site: { ...base.site, defaultLocale: 'en', ...site },
  } as Config;
}

describe('resolveSeoDefaults', () => {
  it('states nothing it was not told', () => {
    const seo = resolveSeoDefaults(config({}, { name: undefined, legalName: undefined }));
    expect(seo).toEqual({});
  });

  it('falls back to organization.name for the site name', () => {
    expect(resolveSeoDefaults(config({}, { name: 'Acme' })).siteName).toBe('Acme');
  });

  it('prefers site.seo.siteName over the organization', () => {
    const seo = resolveSeoDefaults(config({ seo: { siteName: 'Acme Co' } }, { name: 'Acme' }));
    expect(seo.siteName).toBe('Acme Co');
  });

  it('resolves Localizable values for the build locale, then the default locale', () => {
    const cfg = config({
      defaultLocale: 'en',
      seo: {
        titleTemplate: { en: '%s · Acme', fr: '%s · Acme FR' },
        defaultDescription: { en: 'Hi' },
      },
    });
    expect(resolveSeoDefaults(cfg, { locale: 'fr' }).titleTemplate).toBe('%s · Acme FR');
    // fr has no description: the default locale answers rather than emitting nothing.
    expect(resolveSeoDefaults(cfg, { locale: 'fr' }).defaultDescription).toBe('Hi');
  });

  it('lets the environment robots win over site.seo.robots', () => {
    const cfg = config({
      seo: { robots: 'index,follow' },
      environments: { staging: { url: 'https://staging.example.com', robots: 'noindex,nofollow' } },
    });
    expect(resolveSeoDefaults(cfg).robots).toBe('index,follow');
    expect(resolveSeoDefaults(cfg, { env: 'staging' }).robots).toBe('noindex,nofollow');
  });

  it('maps a bare image URL and an image object to the same shape', () => {
    expect(
      resolveSeoDefaults(config({ seo: { openGraph: { image: '/og.png' } } })).openGraph?.image,
    ).toEqual({ url: '/og.png' });
    expect(
      resolveSeoDefaults(
        config({ seo: { openGraph: { image: { src: '/og.png', alt: 'Logo', width: 1200 } } } }),
      ).openGraph?.image,
    ).toEqual({ url: '/og.png', alt: 'Logo', width: 1200 });
  });

  /**
   * The guard that was missing. `site.seo` once declared `titleTemplate`, verification tokens,
   * `openGraph` and `twitter` that nothing read, so a client who filled them in got no effect and
   * no error. Every field the schema accepts must change the resolver's output: add a field to
   * `SeoSchema` and this fails until `resolveSeoDefaults` reads it and the fixture below names it.
   */
  it('reads every display field of site.seo', () => {
    const FIXTURE: Record<string, unknown> = {
      siteName: 'N',
      titleTemplate: '%s · N',
      defaultTitle: 'T',
      defaultDescription: 'D',
      robots: 'noindex',
      googleSiteVerification: 'g',
      bingSiteVerification: 'b',
      openGraph: { type: 'article', locale: 'en_CA', localeAlternates: ['fr_CA'], image: '/i.png' },
      twitter: { card: 'summary', site: '@s', creator: '@c' },
    };
    // `indexing` is read by `search notify`/`robots`, not by <Seo />.
    const NOT_DISPLAY = new Set(['indexing']);
    const fields = Object.keys(SeoSchema.shape).filter((k) => !NOT_DISPLAY.has(k));
    expect(Object.keys(FIXTURE).sort()).toEqual(fields.sort());

    const empty = resolveSeoDefaults(config({}, { name: undefined, legalName: undefined }));
    for (const field of fields) {
      const out = resolveSeoDefaults(
        config({ seo: { [field]: FIXTURE[field] } }, { name: undefined, legalName: undefined }),
      );
      expect(out, `site.seo.${field} is declared but resolveSeoDefaults ignores it`).not.toEqual(
        empty,
      );
    }
  });

  it('accepts what the config schema says it accepts', () => {
    const cfg = resolveConfig(
      {
        ...(defaultSiteConfig() as object),
        site: { ...defaultSiteConfig().site, seo: { siteName: 'X' } },
      },
      'production',
    );
    expect(resolveSeoDefaults(cfg).siteName).toBe('X');
  });
});

describe('mergeSeoDefaults', () => {
  it('returns the config defaults untouched when there is no override', () => {
    const base = { siteName: 'A' };
    expect(mergeSeoDefaults(base, undefined)).toBe(base);
  });

  it('lets the override win per field, and merges nested objects key by key', () => {
    const merged = mergeSeoDefaults(
      { siteName: 'A', openGraph: { locale: 'en_CA', image: { url: '/og.png' } } },
      { siteName: 'B', openGraph: { locale: 'fr_CA' } },
    );
    expect(merged).toEqual({
      siteName: 'B',
      openGraph: { locale: 'fr_CA', image: { url: '/og.png' } },
    });
  });
});
