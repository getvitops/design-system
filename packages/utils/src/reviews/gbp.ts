/**
 * Google Business Profile — fetching one location's reviews.
 *
 * Reviews live only on the legacy v4 Business Information API
 * (`mybusiness.googleapis.com/v4`); the newer split APIs (Account Management,
 * Business Information v1) never grew a reviews resource. **The calling GCP
 * project must be allowlisted by Google before any call here succeeds** — a
 * one-time access-request form, turnaround measured in days to weeks — so a 403
 * is treated as that known state rather than surfaced as a raw failure. Scope:
 * `SCOPES.businessProfile` (`../google/token.ts`).
 *
 * TODO — re-check when Google migrates the Reviews endpoint off v4 onto a
 * successor API. Endpoint, auth, pagination and the review object's fields may
 * all change; this module is the one place that assumption lives.
 *
 * Auth is the shared exchange in `../google/token.ts`, same as `../indexing/gsc.ts`
 * — no `googleapis` dependency, one REST endpoint.
 */
import { googleHeaders, type GoogleAuthLike } from '../google/token.ts';
import type { Review } from './types.ts';

const STAR_RATING: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

interface RawReview {
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
}

function toReview(raw: RawReview, location: string): Review {
  return {
    id: raw.reviewId,
    location,
    rating: STAR_RATING[raw.starRating ?? ''] ?? 0,
    author: raw.reviewer?.isAnonymous
      ? 'A Google user'
      : (raw.reviewer?.displayName ?? 'A Google user'),
    ...(raw.reviewer?.profilePhotoUrl ? { authorPhoto: raw.reviewer.profilePhotoUrl } : {}),
    ...(raw.comment ? { text: raw.comment } : {}),
    publishedAt: raw.createTime,
    updatedAt: raw.updateTime,
    ...(raw.reviewReply
      ? { reply: { text: raw.reviewReply.comment, at: raw.reviewReply.updateTime } }
      : {}),
    // v4 carries no public review URL on the resource itself. The stable link is
    // `organization.locations[].listings.google` / `sameAs` — the whole profile,
    // not the single review — which is what a "read more on Google" affordance
    // should point at instead.
  };
}

/** One page (or, having paginated, the whole set) of a location's reviews. */
export interface FetchReviewsResult {
  ok: boolean;
  reviews: Review[];
  averageRating?: number;
  totalReviewCount?: number;
  status?: number;
  message?: string;
}

/**
 * Fetch every review for one location, paginating to completion.
 *
 * Never throws — a per-location failure is a structured result so a run across
 * several locations can fetch what it can and report the rest, the same contract
 * `../indexing/gsc.ts`'s `inspectUrl` keeps.
 */
export async function fetchReviews(
  auth: GoogleAuthLike,
  accountId: string,
  locationId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchReviewsResult> {
  const location = locationId.startsWith('locations/') ? locationId : `locations/${locationId}`;
  const account = accountId.startsWith('accounts/') ? accountId : `accounts/${accountId}`;
  const reviews: Review[] = [];
  let averageRating: number | undefined;
  let totalReviewCount: number | undefined;
  let pageToken: string | undefined;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${account}/${location}/reviews`);
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetchImpl(url, { headers: googleHeaders(auth) });
    if (!res.ok) {
      const message =
        res.status === 403
          ? `403 — this GCP project is most likely not allowlisted for the Business Profile API yet ` +
            `(a one-time Google approval, requested separately from every other API here), or the ` +
            `credential is not an owner/manager of ${account}/${location}`
          : `${res.status}: ${await res.text()}`;
      return { ok: false, reviews, status: res.status, message };
    }

    const body = (await res.json()) as {
      reviews?: RawReview[];
      averageRating?: number;
      totalReviewCount?: number;
      nextPageToken?: string;
    };
    for (const r of body.reviews ?? []) reviews.push(toReview(r, locationId));
    averageRating = body.averageRating ?? averageRating;
    totalReviewCount = body.totalReviewCount ?? totalReviewCount;
    pageToken = body.nextPageToken;
  } while (pageToken);

  return {
    ok: true,
    reviews,
    ...(averageRating !== undefined ? { averageRating } : {}),
    ...(totalReviewCount !== undefined ? { totalReviewCount } : {}),
  };
}
