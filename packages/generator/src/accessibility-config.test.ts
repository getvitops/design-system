import { describe, expect, test } from 'vite-plus/test';
import { validateConfig } from './config.ts';
import { wcagRatioMode } from './generate.ts';
import { defaultConfig, defaultSiteConfig } from './index.ts';

function fixture(accessibility: unknown): unknown {
  return {
    designSystem: { themes: { default: defaultConfig() } },
    organization: { name: 'Acme', email: 'a@acme.example' },
    site: {
      defaultLocale: 'en',
      locales: { en: { name: 'English' } },
      environments: { production: { url: 'https://acme.example' } },
      domains: { canonical: 'https://acme.example' },
      accessibility,
    },
  };
}

const errorsFor = (raw: unknown): string[] => {
  const r = validateConfig(raw);
  return r.ok ? [] : r.errors.map((e) => `${e.path.join('.')}: ${e.message}`);
};

describe('site.accessibility', () => {
  test('accepts a target and a recorded accepted risk', () => {
    expect(
      errorsFor(
        fixture({ standard: 'wcag20', level: 'none', acceptedRisk: 'Client, 2026-11-11, rebrand' }),
      ),
    ).toEqual([]);
  });
  test('every field is optional; the block may be absent', () => {
    expect(errorsFor(fixture({}))).toEqual([]);
    expect(errorsFor(fixture(undefined))).toEqual([]);
  });
  test('rejects an unknown level, standard or key', () => {
    expect(errorsFor(fixture({ level: 'AA+' })).length).toBeGreaterThan(0);
    expect(errorsFor(fixture({ standard: 'wcag3' })).length).toBeGreaterThan(0);
    expect(errorsFor(fixture({ compliant: true })).length).toBeGreaterThan(0);
  });
  test('a new site starts at AA', () => {
    expect(defaultSiteConfig().site.accessibility).toEqual({ standard: 'wcag21', level: 'AA' });
  });
});

describe('wcagRatioMode', () => {
  test('only AA and AAA fail the build; everything else, including no target, warns', () => {
    expect(wcagRatioMode('AA')).toBe('fail');
    expect(wcagRatioMode('AAA')).toBe('fail');
    expect(wcagRatioMode('A')).toBe('warn');
    expect(wcagRatioMode('none')).toBe('warn');
    expect(wcagRatioMode(undefined)).toBe('warn');
  });
});
