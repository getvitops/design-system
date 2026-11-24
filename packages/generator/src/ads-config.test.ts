import { describe, expect, test } from 'vite-plus/test';
import { AD_PLATFORMS } from '@getvitops/utils/ads';
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

// The schema's provider list and the capability table used to be two lists held together by a test
// here. `AD_PROVIDERS` now lives in `@getvitops/config` and the table is a
// `Record<AdProvider, …>` over it, so a provider missing from either is a compile error.
describe('site.ads providers', () => {
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

  test('accepts a bare-string conversionLabel — back-compat shape', () => {
    expect(errorsFor(fixture({ google: { pixelId: 'AW-1', conversionLabel: 'lbl' } }))).toEqual([]);
  });

  test('accepts a per-action conversionLabel map', () => {
    expect(
      errorsFor(
        fixture({
          google: { pixelId: 'AW-1', conversionLabel: { call: 'c', email: 'e', form: 'f' } },
        }),
      ),
    ).toEqual([]);
  });

  test('rejects an unrecognized key inside a conversionLabel map', () => {
    expect(
      errorsFor(fixture({ google: { pixelId: 'AW-1', conversionLabel: { sms: 'x' } } })).join(),
    ).toMatch(/conversionLabel/);
  });

  test('accepts a bare-string conversionActionId — back-compat shape', () => {
    expect(errorsFor(fixture({ google: { pixelId: 'AW-1', conversionActionId: '999' } }))).toEqual(
      [],
    );
  });

  test('accepts a per-action conversionActionId map alongside reporting', () => {
    expect(
      errorsFor(
        fixture({
          google: {
            pixelId: 'AW-1',
            conversionActionId: { call: '111', form: '999' },
            reporting: 'server',
          },
        }),
      ),
    ).toEqual([]);
  });

  test('rejects an unrecognized reporting value', () => {
    expect(errorsFor(fixture({ google: { pixelId: 'AW-1', reporting: 'both' } })).join()).toMatch(
      /reporting/,
    );
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

describe('call tracking numbers', () => {
  // `tracking.enabled` is a plan-gated capability, so the fixture states the add-on.
  const plan = { key: 'growth', addons: ['server_side_tracking'] };
  const tracking = { enabled: true };
  const call = { label: 'abc_DEF-1', number: '613-555-0100' };

  test('accepts Google website call conversions with tracking on', () => {
    expect(
      errorsFor(fixture({ google: { pixelId: 'AW-1', callTracking: call } }, { tracking, plan })),
    ).toEqual([]);
  });

  test('rejects callTracking on a platform that cannot do it, and says where to go instead', () => {
    const errors = errorsFor(
      fixture({ microsoft: { pixelId: '1', callTracking: call } }, { tracking, plan }),
    );
    expect(errors.join()).toMatch(/site\.ads\.microsoft\.callTracking/);
    expect(errors.join()).toMatch(/site\.tracking\.phoneNumbers/);
  });

  test('rejects callTracking when the capture script is off', () => {
    // Google replaces text only; the script is what rewrites the tel: href.
    expect(errorsFor(fixture({ google: { pixelId: 'AW-1', callTracking: call } })).join()).toMatch(
      /site\.tracking\.enabled/,
    );
  });

  test('rejects callTracking with no AW- conversion id to address it by', () => {
    expect(
      errorsFor(
        fixture({ google: { accountId: '123-456-7890', callTracking: call } }, { tracking, plan }),
      ).join(),
    ).toMatch(/pixelId/);
  });

  test('accepts per-platform numbers', () => {
    expect(
      errorsFor(
        fixture(
          {},
          {
            plan,
            tracking: {
              enabled: true,
              phoneNumbers: {
                number: '613-555-0100',
                sources: { meta: '613-555-0101', 'default-paid': '613-555-0199' },
              },
            },
          },
        ),
      ),
    ).toEqual([]);
  });

  test('rejects an unknown source key', () => {
    expect(
      errorsFor(
        fixture(
          {},
          {
            plan,
            tracking: {
              enabled: true,
              phoneNumbers: { number: '613-555-0100', sources: { myspace: '613-555-0101' } },
            },
          },
        ),
      ).join(),
    ).toMatch(/myspace|sources/);
  });

  test('rejects phoneNumbers when the capture script is off', () => {
    expect(
      errorsFor(
        fixture(
          {},
          {
            plan,
            tracking: {
              phoneNumbers: { number: '613-555-0100', sources: { meta: '613-555-0101' } },
            },
          },
        ),
      ).join(),
    ).toMatch(/site\.tracking\.enabled/);
  });

  test('rejects a google source while Google supplies its own number', () => {
    const errors = errorsFor(
      fixture(
        { google: { pixelId: 'AW-1', callTracking: call } },
        {
          plan,
          tracking: {
            enabled: true,
            phoneNumbers: { number: '613-555-0100', sources: { google: '613-555-0102' } },
          },
        },
      ),
    );
    expect(errors.join()).toMatch(/Google supplies its own/);
  });

  test('rejects an empty sources map', () => {
    expect(
      errorsFor(
        fixture(
          {},
          {
            plan,
            tracking: { enabled: true, phoneNumbers: { number: '613-555-0100', sources: {} } },
          },
        ),
      ).join(),
    ).toMatch(/sources is empty/);
  });
});
