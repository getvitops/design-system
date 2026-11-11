import { describe, expect, it } from 'vite-plus/test';
import { AD_PLATFORMS } from '../ads/providers.ts';
import type { AdProvider } from '../ads/types.ts';
import {
  DEFAULT_PAID,
  PROVIDER_BY_PARAM,
  phoneDigits,
  samePhone,
  selectPhoneNumber,
  telUri,
} from './phone.ts';

const config = {
  number: '613-555-0100',
  sources: {
    meta: '613-555-0101',
    microsoft: '613-555-0102',
    [DEFAULT_PAID]: '613-555-0199',
  },
};

describe('phone number comparison', () => {
  it('treats every spelling of one North American number as equal', () => {
    for (const spelling of [
      '613-555-0100',
      '(613) 555-0100',
      '+1 613 555 0100',
      'tel:+16135550100',
    ])
      expect(samePhone(spelling, '613-555-0100')).toBe(true);
  });

  it('never matches an empty value', () => {
    expect(samePhone('', '')).toBe(false);
    expect(phoneDigits('call us')).toBe('');
  });

  it('builds a tel: URI with the country code', () => {
    expect(telUri('613-555-0101')).toBe('tel:+16135550101');
    expect(telUri('+44 20 7946 0958')).toBe('tel:+442079460958');
  });
});

describe('selectPhoneNumber', () => {
  it('returns null for an organic visit', () => {
    expect(selectPhoneNumber(null, null, config)).toBeNull();
    expect(selectPhoneNumber({}, {}, config)).toBeNull();
  });

  it('picks the platform number from a click ID in the URL', () => {
    expect(selectPhoneNumber({ fbclid: 'x' }, null, config)).toEqual({
      number: '613-555-0101',
      source: 'meta',
    });
  });

  it('prefers what the URL carries over a stale stored click ID', () => {
    const picked = selectPhoneNumber({ msclkid: 'a' }, { fbclid: 'old' }, config);
    expect(picked?.source).toBe('microsoft');
  });

  it('falls back to the stored click ID on a later page', () => {
    expect(selectPhoneNumber({}, { fbclid: 'x' }, config)?.source).toBe('meta');
  });

  it('matches a utm_source alias when there is no click ID', () => {
    expect(selectPhoneNumber({ utm_source: 'Facebook' }, null, config)?.source).toBe('meta');
    expect(selectPhoneNumber({ utm_source: 'bing' }, null, config)?.source).toBe('microsoft');
  });

  it('uses default-paid for a paid platform with no number of its own', () => {
    expect(selectPhoneNumber({ ttclid: 'x' }, null, config)).toEqual({
      number: '613-555-0199',
      source: DEFAULT_PAID,
    });
    expect(selectPhoneNumber({ utm_medium: 'cpc' }, null, config)?.source).toBe(DEFAULT_PAID);
  });

  it('leaves a non-paid UTM visit alone', () => {
    expect(
      selectPhoneNumber({ utm_source: 'newsletter', utm_medium: 'email' }, null, config),
    ).toBeNull();
  });

  it('never swaps in the real number as if it were a tracking number', () => {
    const same = { number: '613-555-0100', sources: { meta: '(613) 555-0100' } };
    expect(selectPhoneNumber({ fbclid: 'x' }, null, same)).toBeNull();
  });

  it('stands aside for Google when its own tag is swapping', () => {
    const withGoogle = { ...config, sources: { ...config.sources, google: '613-555-0103' } };
    expect(selectPhoneNumber({ gclid: 'x' }, null, withGoogle, { googleNative: true })).toBeNull();
    expect(selectPhoneNumber({ gclid: 'x' }, null, withGoogle)?.source).toBe('google');
  });

  it('returns null with no config', () => {
    expect(selectPhoneNumber({ fbclid: 'x' }, null, undefined)).toBeNull();
  });
});

describe('PROVIDER_BY_PARAM', () => {
  it('covers every click-ID parameter the platform table declares', () => {
    for (const provider of Object.keys(AD_PLATFORMS) as AdProvider[])
      for (const param of AD_PLATFORMS[provider].clickIdParams)
        expect(PROVIDER_BY_PARAM[param]).toBe(provider);
  });
});
