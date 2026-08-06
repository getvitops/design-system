import { describe, expect, test } from 'vitest';
import { AD_PLATFORMS, AD_PROVIDER_KEYS } from '@getvitops/utils/ads';
import { AD_PROVIDERS, validateConfig, type Config } from './config.ts';
import { defaultConfig } from './index.ts';
import { resolveProcessors } from './legal/providers.ts';

/** A minimal valid config, varied by its `site.ads` block. */
function fixture(ads: Record<string, unknown>, site: Record<string, unknown> = {}): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'privacy@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      ads,
      ...site,
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const result = validateConfig(raw);
  return result.ok ? [] : result.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('AD_PROVIDERS mirrors the capability table', () => {
  // The schema owns what a config may *say*; `@getvitops/utils/ads` owns what each
  // platform *can do*. A provider added to one and not the other would either be
  // unconfigurable or configurable with no verification step and no tag — both
  // silent. The generator may import utils (the reverse would be a cycle), so this
  // guard lives here.
  test('the two lists are the same set', () => {
    expect([...AD_PROVIDERS].sort()).toEqual([...AD_PROVIDER_KEYS].sort());
  });

  test('an unknown provider key is rejected', () => {
    expect(errorsFor(fixture({ myspace: { pixelId: '1' } })).join()).toMatch(/myspace/i);
  });
});

describe('validateConfig on site.ads', () => {
  test('accepts a well-formed entry', () => {
    expect(errorsFor(fixture({ meta: { pixelId: '123', domainVerification: 'tok' } }))).toEqual([]);
  });

  test('rejects a token on a platform that has no domain verification', () => {
    // Not a harmless extra field: it is a belief that the next `ads setup` will do
    // something, and nothing will.
    const errors = errorsFor(fixture({ google: { pixelId: 'AW-1', domainVerification: 'tok' } }));
    expect(errors.join()).toMatch(/site.ads.google.domainVerification/);
    expect(errors.join()).toMatch(/no domain verification/i);
  });

  test('rejects a token with no domain to put it on', () => {
    const errors = errorsFor(
      fixture({ meta: { pixelId: '1', domainVerification: 'tok' } }, { domains: undefined }),
    );
    expect(errors.join()).toMatch(/needs a domain/);
  });

  test('rejects an entry that identifies nothing', () => {
    expect(errorsFor(fixture({ reddit: {} })).join()).toMatch(/identifies nothing/);
  });
});

describe('ad pixels reach the generated documents', () => {
  test('a configured pixel becomes a disclosed processor with its cookies', () => {
    const cfg = fixture({ meta: { pixelId: '123' } }) as Config;
    const meta = resolveProcessors(cfg).find((p) => p.name === 'Meta');
    expect(meta).toBeDefined();
    // The same list the gated tag writes into `data-consent-cookies`: a notice that
    // omits a cookie the pixel sets is the defect the provider table exists for.
    expect(meta?.cookies).toEqual(AD_PLATFORMS.meta.tag.cookies);
    expect(meta?.operatorCountry).toBe(AD_PLATFORMS.meta.operatorCountry);
  });

  test('a property on record but disabled discloses nothing', () => {
    const cfg = fixture({ meta: { pixelId: '123', enabled: false } }) as Config;
    expect(resolveProcessors(cfg).some((p) => p.name === 'Meta')).toBe(false);
  });

  test('a property with no tag id discloses nothing — no tag, no cookies', () => {
    const cfg = fixture({ meta: { domainVerification: 'tok' } }) as Config;
    expect(resolveProcessors(cfg).some((p) => p.name === 'Meta')).toBe(false);
  });
});
