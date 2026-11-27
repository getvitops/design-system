import { describe, expect, it } from 'vite-plus/test';
import { resolveSiteOrigin, usableOrigin } from './site-origin.ts';

describe('usableOrigin', () => {
  it('normalizes to an origin', () => {
    expect(usableOrigin('https://gofitness.ca/some/path')).toBe('https://gofitness.ca');
    expect(usableOrigin('gofitness.ca')).toBe('https://gofitness.ca');
  });
  it('rejects empty, malformed and placeholder hosts', () => {
    expect(usableOrigin(undefined)).toBeUndefined();
    expect(usableOrigin('  ')).toBeUndefined();
    expect(usableOrigin('https://dev.my-emdash-site.example.com')).toBeUndefined();
    expect(usableOrigin('https://example.com')).toBeUndefined();
    expect(usableOrigin('http://localhost:4321')).toBeUndefined();
  });
});

describe('resolveSiteOrigin', () => {
  it('prefers the env var', () => {
    expect(
      resolveSiteOrigin({
        env: 'https://a.ca',
        environmentUrl: 'https://b.ca',
        canonical: 'https://c.ca',
        siteEnv: 'production',
      }),
    ).toEqual({ origin: 'https://a.ca', source: 'env' });
  });
  it('falls back to the environment url, then canonical for production only', () => {
    expect(resolveSiteOrigin({ environmentUrl: 'https://b.ca', siteEnv: 'dev' })).toEqual({
      origin: 'https://b.ca',
      source: 'environment',
    });
    expect(resolveSiteOrigin({ canonical: 'https://c.ca', siteEnv: 'production' })).toEqual({
      origin: 'https://c.ca',
      source: 'canonical',
    });
    expect(resolveSiteOrigin({ canonical: 'https://c.ca', siteEnv: 'dev' })).toBeUndefined();
  });
  it('skips a placeholder env var and uses the next source', () => {
    expect(
      resolveSiteOrigin({
        env: 'https://x.example.com',
        environmentUrl: 'https://b.ca',
        siteEnv: 'dev',
      }),
    ).toEqual({ origin: 'https://b.ca', source: 'environment' });
  });
});
