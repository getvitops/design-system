/**
 * The attribution module's guarantees.
 *
 * Everything here is a function of a cookie string, which is what lets the browser
 * capture and the server-side conversion handler share one implementation — and
 * what makes this testable with no DOM and no Worker.
 */
import { describe, expect, it } from 'vitest';
import {
  cookieAttributes,
  mergeTracking,
  parseTrackingCookie,
  readCookie,
  serializeTrackingCookie,
} from './cookie.ts';
import { getPrimaryClickId, identifyPlatform } from './platform.ts';
import type { TrackingData } from './types.ts';

const jar = (data: unknown) => `_ac=${encodeURIComponent(JSON.stringify(data))}`;

describe('parseTrackingCookie', () => {
  it('round-trips what serialize wrote', () => {
    const data: TrackingData = { gclid: 'abc', utm_campaign: 'spring', ts: 1_700_000_000_000 };
    expect(parseTrackingCookie(`_ac=${serializeTrackingCookie(data)}`)).toEqual(data);
  });

  it('finds the cookie among others without prefix-matching a longer name', () => {
    const header = `other=1; ${jar({ gclid: 'abc' })}; _account=zzz`;
    expect(parseTrackingCookie(header)).toEqual({ gclid: 'abc' });
  });

  /**
   * A half-read cookie would attribute the conversion to whichever fields
   * survived. "We don't know" is actionable; a wrong campaign is not.
   */
  it.each([
    ['no header at all', null],
    ['an empty header', ''],
    ['a cookie that is not there', 'other=1; _ab=b'],
    ['a value that is not JSON', '_ac=nonsense'],
    ['JSON that is not an object', `_ac=${encodeURIComponent('"gclid"')}`],
    ['a JSON array', `_ac=${encodeURIComponent('[1,2]')}`],
    ['literal null', `_ac=${encodeURIComponent('null')}`],
  ])('reads %s as no attribution rather than partial attribution', (_label, header) => {
    expect(parseTrackingCookie(header)).toBeNull();
  });

  it('drops undefined values rather than serializing them', () => {
    const value = serializeTrackingCookie({ gclid: 'abc', referrer: undefined });
    expect(JSON.parse(decodeURIComponent(value))).toEqual({ gclid: 'abc' });
  });
});

describe('readCookie', () => {
  it('returns null when absent', () => {
    expect(readCookie('a=1; b=2', '_ac')).toBeNull();
  });

  it('keeps a value containing "="', () => {
    expect(readCookie('_ac=a=b=c', '_ac')).toBe('a=b=c');
  });
});

describe('identifyPlatform', () => {
  it('names the platform from a click ID', () => {
    expect(identifyPlatform({ fbclid: 'x' })).toBe('Meta');
    expect(identifyPlatform({ msclkid: 'x' })).toBe('Microsoft Ads');
  });

  it('prefers the click ID over utm_source', () => {
    // A Google Ads link retargeted through Meta arrives with both. The
    // platform-issued ID is the one that survived the redirect intact.
    expect(identifyPlatform({ gclid: 'x', utm_source: 'newsletter' })).toBe('Google Ads');
  });

  it('resolves ties by table order', () => {
    expect(identifyPlatform({ fbclid: 'x', gclid: 'y' })).toBe('Google Ads');
  });

  it('falls back to utm_source — a tagged link is still attribution', () => {
    expect(identifyPlatform({ utm_source: 'partner-site' })).toBe('partner-site');
  });

  it('is null when there is nothing to go on', () => {
    expect(identifyPlatform({ landingPage: '/' })).toBeNull();
    expect(identifyPlatform({ utm_source: '' })).toBeNull();
  });
});

describe('getPrimaryClickId', () => {
  it('reports the parameter alongside the value, for the notification', () => {
    expect(getPrimaryClickId({ wbraid: 'W1' })).toEqual({ param: 'wbraid', value: 'W1' });
  });

  it('is null with only UTMs', () => {
    expect(getPrimaryClickId({ utm_source: 'x' })).toBeNull();
  });
});

describe('mergeTracking', () => {
  it('keeps the FIRST capture timestamp', () => {
    // The 90-day window is measured from the original click. Taking the latest
    // would restart it on every visit and let the cookie outlive its click.
    const merged = mergeTracking({ gclid: 'old', ts: 1000 }, { gclid: 'new' }, 9999);
    expect(merged.ts).toBe(1000);
    expect(merged.gclid).toBe('new');
  });

  it('stamps `now` on a first capture', () => {
    expect(mergeTracking(null, { gclid: 'a' }, 5000).ts).toBe(5000);
  });

  it('preserves prior parameters the new capture does not mention', () => {
    const merged = mergeTracking({ utm_campaign: 'spring' }, { gclid: 'a' }, 1);
    expect(merged.utm_campaign).toBe('spring');
  });
});

describe('cookieAttributes', () => {
  it('is SameSite=Lax, not Strict', () => {
    // The visitor arrives by following the ad's link. Strict withholds the cookie
    // on exactly that cross-site navigation, so a returning click reads as new.
    expect(cookieAttributes(0, false)).toContain('SameSite=Lax');
    expect(cookieAttributes(0, false)).not.toContain('Strict');
  });

  it('expires 90 days out', () => {
    const attrs = cookieAttributes(Date.parse('2026-01-01T00:00:00Z'), false);
    expect(attrs).toContain(new Date(Date.parse('2026-04-01T00:00:00Z')).toUTCString());
  });

  it('adds Secure only on https', () => {
    expect(cookieAttributes(0, true)).toContain(';Secure');
    expect(cookieAttributes(0, false)).not.toContain('Secure');
  });
});
