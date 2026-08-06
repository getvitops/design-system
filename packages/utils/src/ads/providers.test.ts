import { describe, expect, test } from 'vitest';
import { PLATFORM_PARAMS } from '../tracking/params.ts';
import { AD_PLATFORMS, AD_PROVIDER_KEYS, categoryOf, renderTag } from './providers.ts';

describe('the platform table and the click-ID vocabulary agree', () => {
  // Two lists that must match, guarded rather than hoped for. A configured ad
  // property whose click ID is not captured produces conversions that arrive
  // unattributed — and an unattributed conversion is indistinguishable from an
  // organic one, so nothing about the failure is visible at runtime.
  test('every platform click ID is captured, and maps back to that platform', () => {
    for (const provider of AD_PROVIDER_KEYS) {
      const platform = AD_PLATFORMS[provider];
      for (const param of platform.clickIdParams) {
        expect(PLATFORM_PARAMS[param], `${provider}: ${param} not captured`).toBeDefined();
        expect(PLATFORM_PARAMS[param], `${provider}: ${param} attributed elsewhere`).toBe(
          platform.name,
        );
      }
    }
  });

  test('every captured click ID belongs to a platform in the table', () => {
    const known = new Set(AD_PROVIDER_KEYS.flatMap((p) => AD_PLATFORMS[p].clickIdParams));
    for (const param of Object.keys(PLATFORM_PARAMS))
      expect(known.has(param), `${param} is captured but no platform claims it`).toBe(true);
  });
});

describe('the table stays internally consistent', () => {
  test('a platform with no verification says why; one with DNS_TXT has a prefix', () => {
    for (const provider of AD_PROVIDER_KEYS) {
      const v = AD_PLATFORMS[provider].verification;
      if (v.method === 'none') expect(v.reason, provider).toBeTruthy();
      else {
        expect(v.txtPrefix, provider).toBeTruthy();
        expect(v.where, provider).toBeTruthy();
      }
    }
  });

  test('every platform declares the cookies its tag sets', () => {
    // The same list reaches `data-consent-cookies` (what a revoke clears) and the
    // generated cookie notice. An empty list here would silently mean "this pixel
    // stores nothing", which is true of no ad platform in the table.
    for (const provider of AD_PROVIDER_KEYS)
      expect(AD_PLATFORMS[provider].tag.cookies.length, provider).toBeGreaterThan(0);
  });
});

describe('renderTag', () => {
  const meta = { provider: 'meta' as const, pixelId: '123' };

  test('emits an inert gated script — never a live src', () => {
    const html = renderTag(meta)!;
    expect(html).toContain('type="text/plain"');
    expect(html).toContain('data-src="https://connect.facebook.net/en_US/fbevents.js"');
    expect(html).toContain('data-consent="marketing"');
    expect(html).toContain('data-consent-cookies="_fbp,_fbc"');
    // The whole gate rests on this: no `src=` attribute the browser will act on.
    expect(html).not.toMatch(/\ssrc="/);
  });

  test('no platform in the table renders a live src', () => {
    for (const provider of AD_PROVIDER_KEYS) {
      const html = renderTag({ provider, pixelId: 'x', accountId: 'x' })!;
      expect(html, provider).not.toMatch(/\ssrc="/);
      expect(html, provider).toContain('type="text/plain"');
    }
  });

  test('is null when the entry has no tag id, rather than initialising undefined', () => {
    expect(renderTag({ provider: 'meta' })).toBeNull();
  });

  test('honours an explicit consent category', () => {
    expect(categoryOf({ provider: 'meta', category: 'analytics' })).toBe('analytics');
    expect(renderTag({ ...meta, category: 'analytics' })).toContain('data-consent="analytics"');
  });
});
