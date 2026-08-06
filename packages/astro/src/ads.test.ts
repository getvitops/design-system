import { AD_PLATFORMS } from '@getvitops/utils/ads';
import { describe, expect, it } from 'vitest';
import { resolveAds } from './ads.ts';
import { consentCategories } from './analytics.ts';

const gated = { consent: true, consentCategories: ['analytics', 'marketing'] as const };

describe('resolveAds', () => {
  it('emits nothing when nothing is configured', () => {
    expect(resolveAds(undefined, gated).tags).toEqual([]);
    expect(resolveAds({}, gated).tags).toEqual([]);
  });

  it('defaults a pixel to the marketing category', () => {
    // Derivation is analytics' job; here it is a stated fact — every platform in
    // the table sets advertising cookies.
    const [tag] = resolveAds({ meta: { pixelId: '123' } }, gated).tags;
    expect(tag?.category).toBe('marketing');
    expect(tag?.key).toBe('meta');
    expect(tag?.setsCookies).toBe(true);
  });

  it('lets a property state analytics instead', () => {
    const [tag] = resolveAds({ meta: { pixelId: '1', category: 'analytics' } }, gated).tags;
    expect(tag?.category).toBe('analytics');
  });

  it('carries the platform cookie list, so a revoke clears them', () => {
    const [tag] = resolveAds({ meta: { pixelId: '1' } }, gated).tags;
    expect(tag?.cookies).toEqual(AD_PLATFORMS.meta.tag.cookies);
  });

  it('reads the id from the field that platform actually needs', () => {
    // LinkedIn's Insight Tag id IS the account id; Google's tag is the AW-
    // conversion id, never the customer id.
    expect(resolveAds({ linkedin: { accountId: '55512' } }, gated).tags).toHaveLength(1);
    const google = resolveAds({ google: { accountId: '123-456-7890' } }, gated);
    expect(google.tags).toHaveLength(0);
    expect(google.warnings[0]).toMatch(/google has no pixelId/);
  });

  it('never emits a live src — the gate is the whole point', () => {
    const { tags } = resolveAds({ meta: { pixelId: '1' }, tiktok: { pixelId: '2' } }, gated);
    for (const tag of tags) expect(tag.gated).toBe(true);
  });

  it('rejects an id that could break out of the inline script', () => {
    const r = resolveAds({ meta: { pixelId: "1');</script><script>alert(1)" } }, gated);
    expect(r.tags).toEqual([]);
    expect(r.warnings[0]).toMatch(/not a valid ID/);
  });

  it('honours the per-property switch', () => {
    expect(resolveAds({ meta: { pixelId: '1', enabled: false } }, gated).tags).toEqual([]);
  });

  it('honours the per-environment switch', () => {
    // A preview deployment firing conversion pixels is the failure this exists for.
    const r = resolveAds({ meta: { pixelId: '1' } }, { ...gated, enabled: false });
    expect(r.tags).toEqual([]);
    expect(r.needsRuntime).toBe(false);
  });

  it('warns when pixels are configured and the gate is off', () => {
    const r = resolveAds({ meta: { pixelId: '1' } }, { consent: false });
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/consent/);
    // Still emitted — ungated, and said so. Silently dropping a configured tag
    // would be a different site than the one the config describes.
    expect(r.tags).toHaveLength(1);
    expect(r.tags[0]?.gated).toBe(false);
  });

  it('warns when the banner offers no row for the category the tags demand', () => {
    const r = resolveAds(
      { meta: { pixelId: '1' } },
      { consent: true, consentCategories: ['analytics'] },
    );
    expect(r.warnings[0]).toMatch(/marketing/);
  });

  it('feeds consentCategories, so the banner grows a marketing row', () => {
    // The build-time half of the pair: a pixel demands `marketing` at runtime, and
    // the banner must already have a row for it.
    const { tags } = resolveAds({ meta: { pixelId: '1' } }, gated);
    expect(consentCategories(tags)).toEqual(['marketing']);
  });
});
