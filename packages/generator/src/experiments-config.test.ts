import { describe, expect, test } from 'vite-plus/test';
import { experimentDimensionWarnings, validateConfig } from './config.ts';
import { defaultConfig } from './index.ts';

/** A minimal valid config, varied by its `site.experiments`/`site.analytics`. */
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

describe('validateConfig on site.experiments', () => {
  test('accepts a well-formed experiment', () => {
    expect(
      errorsFor(
        fixture({
          experiments: {
            'contact-form-v2': {
              enabled: true,
              variants: ['control', 'new-form'],
            },
          },
          plan: { key: 'test', addons: ['ab_testing'] },
        }),
      ),
    ).toEqual([]);
  });

  test('rejects a variants tuple with the wrong arity', () => {
    const errors = errorsFor(
      fixture({
        experiments: {
          'contact-form-v2': { enabled: true, variants: ['only-one'] },
        },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  test('rejects an unrecognized key inside an experiment', () => {
    const errors = errorsFor(
      fixture({
        experiments: {
          'contact-form-v2': {
            enabled: true,
            variants: ['control', 'new-form'],
            totally_made_up: true,
          },
        },
      }),
    );
    expect(errors.join()).toMatch(/totally_made_up/);
  });

  test('two experiments can be configured at once, independently', () => {
    expect(
      errorsFor(
        fixture({
          experiments: {
            'contact-form-v2': {
              enabled: true,
              category: 'analytics',
              variants: ['control', 'new-form'],
            },
            'pricing-layout': {
              enabled: true,
              category: 'marketing',
              splitRatio: 0,
              variants: ['grid', 'table'],
            },
          },
          plan: { key: 'test', addons: ['ab_testing'] },
        }),
      ),
    ).toEqual([]);
  });

  test('no experiments block at all is valid', () => {
    expect(errorsFor(fixture({}))).toEqual([]);
  });
});

describe('experimentDimensionWarnings', () => {
  test('is empty with no experiments configured', () => {
    expect(experimentDimensionWarnings(undefined)).toEqual([]);
    expect(experimentDimensionWarnings({})).toEqual([]);
  });

  test('is empty with experiments but no Matomo', () => {
    expect(
      experimentDimensionWarnings({
        experiments: { 'contact-form-v2': { enabled: true } },
      }),
    ).toEqual([]);
  });

  test('warns when an enabled experiment has no matching Matomo dimension index', () => {
    const warnings = experimentDimensionWarnings({
      experiments: { 'contact-form-v2': { enabled: true } },
      analytics: { matomo: { abVariantDimensions: {} } },
    });
    expect(warnings.join()).toMatch(/contact-form-v2/);
    expect(warnings.join()).toMatch(/abVariantDimensions/);
  });

  test('is silent for a disabled experiment even with no dimension index', () => {
    expect(
      experimentDimensionWarnings({
        experiments: { 'contact-form-v2': { enabled: false } },
        analytics: { matomo: { abVariantDimensions: {} } },
      }),
    ).toEqual([]);
  });

  test('is silent once the dimension index is recorded', () => {
    expect(
      experimentDimensionWarnings({
        experiments: { 'contact-form-v2': { enabled: true } },
        analytics: { matomo: { abVariantDimensions: { 'contact-form-v2': 3 } } },
      }),
    ).toEqual([]);
  });

  test('checks each experiment independently', () => {
    const warnings = experimentDimensionWarnings({
      experiments: {
        'contact-form-v2': { enabled: true },
        'pricing-layout': { enabled: true },
      },
      analytics: { matomo: { abVariantDimensions: { 'contact-form-v2': 3 } } },
    });
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/pricing-layout/);
  });
});
