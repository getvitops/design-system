/**
 * The reviews module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['reviews']` imported from
 * `@getvitops/generator` — the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field, the same arrangement as `IndexingConfig` in `../indexing/types.ts`.
 */

/*
 * Optional fields are written `?: T | undefined` throughout, matching
 * `exactOptionalPropertyTypes` and the parsed-JSON-config shape these types
 * describe — see the comment at the top of `../indexing/types.ts`.
 */

/** How one location's reviews should be selected and ordered for display. */
export interface ReviewLocationConfig {
  /** GBP account resource id (`accounts/…`), overriding the top-level default. */
  accountId?: string | undefined;
  /** GBP location resource id (`locations/…`) — required to fetch this location. */
  locationId: string;
  /** Explicit review ids, in order. These are always included, ahead of everything else. */
  featured?: string[] | undefined;
  /** Drop reviews below this star rating (default 4). */
  minRating?: number | undefined;
  /** Keep at most this many reviews after filtering. */
  limit?: number | undefined;
  /** Ordering for the non-featured remainder (default `recent`). */
  sort?: 'recent' | 'rating' | undefined;
}

/** Everything `plan()` needs to decide what to fetch. */
export interface ReviewsConfig {
  /** Default GBP account resource id for locations that don't override it. */
  accountId?: string | undefined;
  /** Keyed by `organization.locations[].key`. */
  locations: Record<string, ReviewLocationConfig>;
}

/** One review, as GBP returns it and the cache stores it. */
export interface Review {
  id: string;
  /** The `organization.locations[]` key this review belongs to. */
  location: string;
  /** 1–5. */
  rating: number;
  author: string;
  authorPhoto?: string | undefined;
  text?: string | undefined;
  publishedAt: string;
  updatedAt: string;
  reply?: { text: string; at: string } | undefined;
  /** Link back to the review on Google — never omit when linking to it. */
  url?: string | undefined;
}

/** What a fetch of one location produced. */
export interface LocationReviews {
  locationId: string;
  accountId: string;
  fetchedAt: string;
  averageRating?: number | undefined;
  totalReviewCount?: number | undefined;
  reviews: Review[];
}

/** The on-disk cache, as written by `writeCache`. */
export interface ReviewCache {
  version: 1;
  locations: Record<string, LocationReviews>;
}
