import * as z from '@zod/mini';
import { desc } from './desc.ts';

/**
 * How one location's Google reviews are selected and ordered for display.
 *
 * Keyed by `organization.locations` key, mirroring `site.ads`/`site.searchConsole`
 * — `vitops reviews` needs to know which physical location a fetched review set
 * belongs to, and that record already exists.
 */
export const ReviewLocationSchema = z.strictObject({
  accountId: desc(
    z.optional(z.string()),
    'GBP account resource id (`accounts/…`), overriding `site.reviews.accountId` for this location.',
  ),
  locationId: desc(z.string(), 'GBP location resource id (`locations/…`) to fetch reviews for.'),
  featured: desc(
    z.optional(z.array(z.string())),
    'Review ids to always include, in this order, ahead of everything else automatically selected.',
  ),
  minRating: desc(
    z.optional(z.number()),
    'Drop reviews below this star rating (default 4) from the automatic (non-featured) selection.',
  ),
  limit: desc(z.optional(z.number()), 'Keep at most this many reviews after filtering.'),
  sort: desc(
    z.optional(z.enum(['recent', 'rating'])),
    'Ordering for the non-featured remainder (default `recent`).',
  ),
});

export const ReviewsSchema = z.strictObject({
  accountId: desc(
    z.optional(z.string()),
    'Default GBP account resource id (`accounts/…`) for locations that do not override it.',
  ),
  locations: desc(
    z.record(z.string(), ReviewLocationSchema),
    'Which `organization.locations` to fetch Google reviews for, and how each one’s reviews are filtered/ordered. `vitops reviews` writes the result to `.vitops/reviews.json`.',
  ),
  schema: desc(
    z.optional(z.boolean()),
    'Emit `Review` JSON-LD for these reviews (default false). Off by default: Google’s structured-data policy treats a business marking up reviews of itself as ineligible for review rich results, and risks a manual action.',
  ),
  avatars: desc(
    z.optional(z.boolean()),
    'Render the reviewer’s Google-hosted avatar photo (default false). Off by default: every visitor would otherwise issue a third-party request to googleusercontent.com, and the URLs are not guaranteed to stay live.',
  ),
});

export type ReviewsConfig = z.infer<typeof ReviewsSchema>;
export type ReviewLocationConfig = z.infer<typeof ReviewLocationSchema>;
