/**
 * The Worker-safe slice of `@getvitops/utils/reviews`: the display decision and the types it
 * takes, with none of the cache reader (`node:fs`) or the Google fetcher the root entry carries.
 *
 * A server-rendered `.astro` component (the EmDash `vitops_reviews` block) runs in a Worker and
 * must choose which reviews to show with the SAME function `<ReviewCard>` callers and a future
 * Bricks renderer use — so it imports this entry rather than the root, whose graph reaches
 * `node:fs`. `worker-safe.test.ts` walks this entry's imports.
 */
export { selectReviews } from './plan.ts';
export type {
  LocationReviews,
  Review,
  ReviewCache,
  ReviewLocationConfig,
  ReviewsConfig,
} from './types.ts';
