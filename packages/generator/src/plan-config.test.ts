import { describe, expect, test } from 'vite-plus/test';
import { PLAN_CAPABILITIES, validateConfig } from './config.ts';
import { defaultConfig } from './index.ts';

/** A minimal valid config, varied by its `site.plan`/`site.abTesting`/`site.tracking`. */
function fixture(site: Record<string, unknown> = {}): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'privacy@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      ...site,
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const result = validateConfig(raw);
  return result.ok ? [] : result.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('PLAN_CAPABILITIES', () => {
  test('has no entry for pure-Portal features with no Config counterpart', () => {
    expect(PLAN_CAPABILITIES['bookkeeping']).toBeUndefined();
    expect(PLAN_CAPABILITIES['support']).toBeUndefined();
    expect(PLAN_CAPABILITIES['software_licenses']).toBeUndefined();
  });

  describe('ab_testing.gates', () => {
    test('is false with no abTesting block and no environment variant', () => {
      expect(PLAN_CAPABILITIES['ab_testing']!.gates(fixture() as never)).toBe(false);
    });

    test('is true when site.abTesting.enabled is true', () => {
      const cfg = fixture({ abTesting: { enabled: true } }) as never;
      expect(PLAN_CAPABILITIES['ab_testing']!.gates(cfg)).toBe(true);
    });

    test('is true when any environment names a variant, even with abTesting.enabled false', () => {
      const cfg = fixture({
        abTesting: { enabled: false, variants: { b: { environment: 'production' } } },
        environments: { production: { url: 'https://acme.example', variant: 'b' } },
      }) as never;
      expect(PLAN_CAPABILITIES['ab_testing']!.gates(cfg)).toBe(true);
    });
  });

  describe('server_side_tracking.gates', () => {
    test('is false with no tracking block', () => {
      expect(PLAN_CAPABILITIES['server_side_tracking']!.gates(fixture() as never)).toBe(false);
    });

    test('is true when site.tracking.enabled is true', () => {
      const cfg = fixture({ tracking: { enabled: true } }) as never;
      expect(PLAN_CAPABILITIES['server_side_tracking']!.gates(cfg)).toBe(true);
    });
  });
});

describe('validateConfig on site.plan', () => {
  test('rejects abTesting.enabled with no site.plan at all', () => {
    const errors = errorsFor(fixture({ abTesting: { enabled: true } }));
    expect(errors.join()).toMatch(/site\.plan\.addons.*ab_testing/);
  });

  test('rejects abTesting.enabled when site.plan.addons omits ab_testing', () => {
    const errors = errorsFor(
      fixture({ abTesting: { enabled: true }, plan: { key: 'essentials', addons: [] } }),
    );
    expect(errors.join()).toMatch(/ab_testing/);
  });

  test('accepts abTesting.enabled when site.plan.addons lists ab_testing', () => {
    const errors = errorsFor(
      fixture({
        abTesting: { enabled: true },
        plan: { key: 'growth', addons: ['ab_testing'] },
      }),
    );
    expect(errors).toEqual([]);
  });

  test('rejects tracking.enabled with no matching add-on', () => {
    const errors = errorsFor(fixture({ tracking: { enabled: true } }));
    expect(errors.join()).toMatch(/server_side_tracking/);
  });

  test('accepts tracking.enabled when site.plan.addons lists server_side_tracking', () => {
    const errors = errorsFor(
      fixture({
        tracking: { enabled: true },
        plan: { key: 'growth', addons: ['server_side_tracking'] },
      }),
    );
    expect(errors).toEqual([]);
  });

  test('a site.plan with no gated feature turned on needs no addons', () => {
    expect(errorsFor(fixture({ plan: { key: 'essentials' } }))).toEqual([]);
  });

  test('no site.plan and no gated feature is valid', () => {
    expect(errorsFor(fixture())).toEqual([]);
  });
});
