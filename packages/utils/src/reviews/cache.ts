/**
 * The cache — what makes a re-render free and offline.
 *
 * Committed, like `../media/manifest.ts` and for the same reason: reviews change
 * slowly, and a build should not need a live Google credential to render them. The
 * one field that keeps it from being byte-identical across runs is `fetchedAt` per
 * location — acceptable because `vitops reviews` is invoked deliberately
 * (scheduled or manual), not rewritten on every build the way `media-manifest.json`
 * is.
 */
import type { LocationReviews, ReviewCache } from './types.ts';
import { readVersioned, writeVersioned } from '../json-store.ts';

/** Default location, relative to the consumer's project root. */
export const REVIEWS_CACHE_PATH = '.vitops/reviews.json';

/**
 * Read the cache, or `undefined` when there isn't a usable one.
 *
 * A corrupt or wrong-version file reads as absent, exactly `readManifest`'s rule:
 * the alternative — reading it as an empty cache — would be indistinguishable
 * from "this business genuinely has no reviews" and silently ship an empty
 * carousel.
 */
export function readCache(path: string): ReviewCache | undefined {
  return readVersioned<ReviewCache, 'locations'>(path, 'locations');
}

/** Build a cache with its keys and each location's reviews in a stable order. */
export function toCache(locations: Record<string, LocationReviews>): ReviewCache {
  const sorted: Record<string, LocationReviews> = {};
  for (const key of Object.keys(locations).sort()) {
    const entry = locations[key] as LocationReviews;
    sorted[key] = {
      ...entry,
      reviews: [...entry.reviews].sort((a, b) => a.id.localeCompare(b.id)),
    };
  }
  return { version: 1, locations: sorted };
}

/** Write the cache, creating its directory. */
export function writeCache(path: string, cache: ReviewCache): void {
  writeVersioned(path, cache);
}
