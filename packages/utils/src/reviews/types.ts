/**
 * The reviews module's own option surface.
 *
 * The `site.reviews` block is the schema's own type, from `@getvitops/config`.
 */

/*
 * Optional fields are written `?: T | undefined` throughout, matching
 * `exactOptionalPropertyTypes` and the parsed-JSON-config shape these types
 * describe — see the comment at the top of `../indexing/types.ts`.
 */

import type { ReviewLocationConfig, ReviewsConfig } from '@getvitops/config';

// Inferred from the `site.reviews` schema in `@getvitops/config`, not re-declared here.
export type { ReviewLocationConfig, ReviewsConfig };

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
