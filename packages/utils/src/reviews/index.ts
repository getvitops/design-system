/**
 * `vitops reviews` — caching a client's Google Business Profile reviews.
 *
 * A separate subpath (`@getvitops/utils/reviews`), matching `./indexing`: this is
 * one of the network-touching modules, and a consumer importing the content
 * helpers shouldn't pull it in.
 *
 * Same layering as `./indexing`: `plan.ts` decides everything and touches
 * nothing; `gbp.ts` and `cache.ts` execute a plan and decide nothing.
 */
export { formatPlan, mergeCache, plan, selectReviews } from './plan.ts';
export type { LocationPlan, PlanInput, ReviewsPlan } from './plan.ts';

export { REVIEWS_CACHE_PATH, readCache, toCache, writeCache } from './cache.ts';

export { fetchReviews } from './gbp.ts';
export type { FetchReviewsResult } from './gbp.ts';

export type {
  LocationReviews,
  Review,
  ReviewCache,
  ReviewLocationConfig,
  ReviewsConfig,
} from './types.ts';

/**
 * The shared token exchange, surfaced here for the same reason `./indexing`
 * surfaces it: a consumer who already minted a `search setup` OAuth credential
 * should not be made to create a second, unrelated one for reviews.
 */
export { googleAccessToken, googleHeaders, SCOPES } from '../google/token.ts';
export type { GoogleAuth, GoogleAuthLike } from '../google/token.ts';
export { adcCredentialsPath, adcQuotaProject, parseAdcUser } from '../google/adc.ts';
export type { GoogleCredential, GoogleOAuth } from '../google/token.ts';
