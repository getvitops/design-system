import { describe, expect, it } from 'vite-plus/test';
import { analyticsFromSite, mergeAnalytics, mergeConsentOptions } from './integration.ts';

/**
 * The site config supplies the defaults for `vitops({ analytics, consent })`. Both used to be
 * hand-copied from `site.json` into `astro.config`, with only a one-way check between them.
 */
describe('analyticsFromSite', () => {
  it('maps each declared provider to its <Analytics /> option', () => {
    expect(
      analyticsFromSite({
        googleAnalyticsId: 'G-1',
        clarityId: 'abc',
        plausibleDomain: 'acme.ca',
        matomo: { url: 'https://m.example', siteId: '3', cookies: true },
      }),
    ).toEqual({
      googleAnalytics: 'G-1',
      clarity: 'abc',
      plausible: 'acme.ca',
      matomo: { url: 'https://m.example', siteId: '3', cookies: true },
    });
  });
  it('leaves Matomo cookieless unless the config says otherwise', () => {
    const m = analyticsFromSite({ matomo: { url: 'https://m.example', siteId: '3' } }).matomo;
    expect(m).toEqual({ url: 'https://m.example', siteId: '3' });
    expect(m).not.toHaveProperty('cookies');
  });
  it('is empty for no block, and ignores a provider with no <Analytics /> tag', () => {
    expect(analyticsFromSite(undefined)).toEqual({});
    expect(analyticsFromSite({ clarityId: '' })).toEqual({});
    expect(analyticsFromSite({ googleTagManagerId: 'GTM-1' } as never)).toEqual({});
  });
});

describe('mergeAnalytics', () => {
  it('lets the option add a provider and override one, and set the strategy', () => {
    expect(
      mergeAnalytics(
        { clarity: 'from-config', plausible: 'acme.ca' },
        { clarity: 'from-option', strategy: 'async' },
      ),
    ).toEqual({ clarity: 'from-option', plausible: 'acme.ca', strategy: 'async' });
  });
  it('is the config alone when there is no option, and undefined when there is neither', () => {
    expect(mergeAnalytics({ clarity: 'abc' }, undefined)).toEqual({ clarity: 'abc' });
    expect(mergeAnalytics({}, undefined)).toBeUndefined();
  });
});

describe('mergeConsentOptions', () => {
  it('uses the categories the cookie notice states when the option has none', () => {
    expect(mergeConsentOptions(true, ['analytics', 'marketing'])).toEqual({
      categories: ['analytics', 'marketing'],
    });
    expect(mergeConsentOptions(undefined, ['analytics'])).toEqual({ categories: ['analytics'] });
  });
  it('keeps the config categories when an object option sets only something else', () => {
    // The trap vitops-website documented: `{ policyUrl }` used to replace the list outright, and
    // the banner fell back to a default that always offers `preferences`.
    expect(mergeConsentOptions({ policyUrl: '/privacy' }, ['analytics', 'marketing'])).toEqual({
      categories: ['analytics', 'marketing'],
      policyUrl: '/privacy',
    });
  });
  it('lets an explicit categories list in the option win', () => {
    expect(
      mergeConsentOptions({ categories: ['preferences'] }, ['analytics', 'marketing']).categories,
    ).toEqual(['preferences']);
  });
  it('is empty with no config categories and no option, so the provider-derived default applies', () => {
    expect(mergeConsentOptions(undefined, undefined)).toEqual({});
    expect(mergeConsentOptions(false, undefined)).toEqual({});
  });
});
