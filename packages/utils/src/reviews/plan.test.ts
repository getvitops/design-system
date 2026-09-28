import { describe, expect, it } from 'vite-plus/test';
import { formatPlan, mergeCache, plan, selectReviews } from './plan.ts';
import type { LocationReviews, Review, ReviewsConfig } from './types.ts';

const review = (over: { [K in keyof Review]?: Review[K] } = {}): Review => ({
  id: 'r1',
  location: 'ottawa',
  rating: 5,
  author: 'Jane D.',
  publishedAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-01T00:00:00Z',
  ...over,
});

describe('plan', () => {
  const config: ReviewsConfig = {
    accountId: 'accounts/1',
    locations: { ottawa: { locationId: 'locations/2' } },
  };

  it('blocks when there are no configured locations', () => {
    const p = plan({ config: undefined, knownLocations: new Set(), hasCredential: true });
    expect(p.blocked).toMatch(/no site\.reviews\.locations/);
  });

  it('blocks when there is no Google credential', () => {
    const p = plan({ config, knownLocations: new Set(['ottawa']), hasCredential: false });
    expect(p.blocked).toMatch(/no Google credential/);
  });

  it('skips a location with no matching organization.locations entry', () => {
    const p = plan({ config, knownLocations: new Set(), hasCredential: true });
    expect(p.locations[0]?.skip).toMatch(/listings\.google/);
  });

  it('skips a location with no accountId anywhere', () => {
    const p = plan({
      config: { locations: { ottawa: { locationId: 'locations/2' } } },
      knownLocations: new Set(['ottawa']),
      hasCredential: true,
    });
    expect(p.locations[0]?.skip).toMatch(/accountId/);
  });

  it('resolves a per-location accountId over the default', () => {
    const p = plan({
      config: {
        accountId: 'accounts/1',
        locations: { ottawa: { locationId: 'locations/2', accountId: 'accounts/9' } },
      },
      knownLocations: new Set(['ottawa']),
      hasCredential: true,
    });
    expect(p.locations[0]?.accountId).toBe('accounts/9');
  });

  it('--location narrows to one key, or blocks when it is unknown', () => {
    const ok = plan({
      config,
      knownLocations: new Set(['ottawa']),
      hasCredential: true,
      onlyLocation: 'ottawa',
    });
    expect(ok.locations).toHaveLength(1);

    const bad = plan({
      config,
      knownLocations: new Set(['ottawa']),
      hasCredential: true,
      onlyLocation: 'toronto',
    });
    expect(bad.blocked).toMatch(/not in site\.reviews\.locations/);
  });

  it('formatPlan renders a blocked plan and an active one', () => {
    expect(formatPlan({ blocked: 'x', locations: [], notes: [] })).toBe('✗ blocked — x');
    const p = plan({ config, knownLocations: new Set(['ottawa']), hasCredential: true });
    expect(formatPlan(p)).toContain('ottawa');
  });
});

describe('selectReviews', () => {
  const reviews = [
    review({ id: 'a', rating: 5, publishedAt: '2026-07-03T00:00:00Z' }),
    review({ id: 'b', rating: 3, publishedAt: '2026-07-04T00:00:00Z' }),
    review({ id: 'c', rating: 4, publishedAt: '2026-07-01T00:00:00Z' }),
    review({ id: 'd', rating: 5, publishedAt: '2026-07-02T00:00:00Z' }),
  ];

  it('drops anything below minRating (default 4)', () => {
    const out = selectReviews(reviews, { locationId: 'locations/2' });
    expect(out.map((r) => r.id)).not.toContain('b');
  });

  it('sorts by recency by default', () => {
    const out = selectReviews(reviews, { locationId: 'locations/2' });
    expect(out.map((r) => r.id)).toEqual(['a', 'd', 'c']);
  });

  it('sorts by rating when asked, most-recent first as tiebreak is not required', () => {
    const out = selectReviews(reviews, { locationId: 'locations/2', sort: 'rating' });
    expect(out[0]?.rating).toBe(5);
  });

  it('featured ids always win, in author order, ahead of everything else', () => {
    const out = selectReviews(reviews, { locationId: 'locations/2', featured: ['b', 'c'] });
    expect(out.slice(0, 2).map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('a featured review is never duplicated in the remainder', () => {
    const out = selectReviews(reviews, {
      locationId: 'locations/2',
      featured: ['a'],
      minRating: 0,
    });
    expect(out.filter((r) => r.id === 'a')).toHaveLength(1);
  });

  it('a featured id with no matching review is silently dropped, not an empty slot', () => {
    const out = selectReviews(reviews, { locationId: 'locations/2', featured: ['ghost'] });
    expect(out.some((r) => r.id === 'ghost')).toBe(false);
  });

  it('limit caps the combined (featured + rest) list', () => {
    const out = selectReviews(reviews, {
      locationId: 'locations/2',
      featured: ['b'],
      minRating: 0,
      limit: 2,
    });
    expect(out).toHaveLength(2);
    expect(out[0]?.id).toBe('b');
  });
});

describe('mergeCache', () => {
  const loc = (id: string): LocationReviews => ({
    locationId: id,
    accountId: 'accounts/1',
    fetchedAt: '2026-08-26T00:00:00Z',
    reviews: [],
  });

  it('replaces only the fetched locations, leaving the rest of an existing cache untouched', () => {
    const existing = { version: 1 as const, locations: { ottawa: loc('a'), toronto: loc('b') } };
    const merged = mergeCache(existing, { ottawa: loc('a2') });
    expect(merged.locations.ottawa?.locationId).toBe('a2');
    expect(merged.locations.toronto?.locationId).toBe('b');
  });

  it('starts fresh with no existing cache', () => {
    const merged = mergeCache(undefined, { ottawa: loc('a') });
    expect(Object.keys(merged.locations)).toEqual(['ottawa']);
  });
});
