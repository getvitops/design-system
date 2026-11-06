import { describe, expect, test } from 'vite-plus/test';
import { CRM_PROVIDERS, validateConfig } from './config.ts';
import { defaultConfig } from './index.ts';

/** A minimal valid config, varied by its `site.crm` block. */
function fixture(
  crm: Record<string, unknown> | undefined,
  site: Record<string, unknown> = {},
): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'privacy@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      ...(crm !== undefined ? { crm } : {}),
      ...site,
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const result = validateConfig(raw);
  return result.ok ? [] : result.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('CRM_PROVIDERS', () => {
  test('has exactly hubspot, bigin and jobber', () => {
    expect([...CRM_PROVIDERS].sort()).toEqual(['bigin', 'hubspot', 'jobber']);
  });
});

describe('validateConfig on site.crm', () => {
  test('accepts a well-formed hubspot block', () => {
    expect(
      errorsFor(fixture({ provider: 'hubspot', hubspot: { portalId: '1', formGuid: 'g' } })),
    ).toEqual([]);
  });

  test('accepts a well-formed bigin block', () => {
    expect(errorsFor(fixture({ provider: 'bigin', bigin: { dataCenter: 'ca' } }))).toEqual([]);
  });

  test('rejects provider hubspot with no hubspot block', () => {
    const errors = errorsFor(fixture({ provider: 'hubspot' }));
    expect(errors.join()).toMatch(/site\.crm\.hubspot/);
  });

  test('rejects provider bigin with no bigin block', () => {
    const errors = errorsFor(fixture({ provider: 'bigin' }));
    expect(errors.join()).toMatch(/site\.crm\.bigin/);
  });

  test('accepts a well-formed jobber block', () => {
    expect(errorsFor(fixture({ provider: 'jobber', jobber: {} }))).toEqual([]);
  });

  test('rejects provider jobber with no jobber block', () => {
    const errors = errorsFor(fixture({ provider: 'jobber' }));
    expect(errors.join()).toMatch(/site\.crm\.jobber/);
  });

  test('rejects an unknown trackingFields key', () => {
    const errors = errorsFor(
      fixture({
        provider: 'hubspot',
        hubspot: { portalId: '1', formGuid: 'g' },
        trackingFields: { totally_made_up: 'field' },
      }),
    );
    expect(errors.join()).toMatch(/totally_made_up/);
  });

  test('accepts a known click-ID and a known non-click-ID tracking key', () => {
    expect(
      errorsFor(
        fixture({
          provider: 'hubspot',
          hubspot: { portalId: '1', formGuid: 'g' },
          trackingFields: { gclid: 'google_click_id', landingPage: 'landing_page' },
        }),
      ),
    ).toEqual([]);
  });

  test('no crm block at all is valid', () => {
    expect(errorsFor(fixture(undefined))).toEqual([]);
  });
});
