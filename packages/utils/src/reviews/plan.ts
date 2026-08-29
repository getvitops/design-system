/**
 * Every decision `vitops reviews` makes, as pure functions.
 *
 * Same split as `../indexing/plan.ts`: no `fetch`, no `fs`, no clock. Which
 * locations to fetch (and why one is blocked), and how a location's reviews are
 * filtered down to what a site actually displays, are decided here — `gbp.ts`
 * and `cache.ts` do what they're told and nothing else. That is what lets Astro's
 * `<ReviewCard>` and a future Bricks renderer both call `selectReviews` instead
 * of each re-implementing "top 5 by rating, minus the ones already featured".
 */
import type {
  LocationReviews,
  Review,
  ReviewCache,
  ReviewLocationConfig,
  ReviewsConfig,
} from './types.ts';

/** One location's fetch plan, or the reason it was skipped. */
export interface LocationPlan {
  key: string;
  accountId?: string;
  locationId?: string;
  /** Present iff this location will not be fetched. */
  skip?: string;
}

export interface ReviewsPlan {
  /** Set when the whole run is refused — nothing is fetched. */
  blocked?: string;
  locations: LocationPlan[];
  notes: string[];
}

export interface PlanInput {
  config: ReviewsConfig | undefined;
  /** Location keys with a Google listing configured (`organization.locations[].listings.google`). */
  knownLocations: Set<string>;
  /** `--location`: fetch exactly this one, skipping the rest. */
  onlyLocation?: string | undefined;
  /** Whether a Google credential was resolved. */
  hasCredential: boolean;
}

/** Decide which locations to fetch, and why any are skipped. */
export function plan(input: PlanInput): ReviewsPlan {
  const { config, knownLocations, onlyLocation, hasCredential } = input;
  const notes: string[] = [];

  if (!config || Object.keys(config.locations).length === 0) {
    return {
      blocked: 'no site.reviews.locations configured — nothing to fetch',
      locations: [],
      notes,
    };
  }

  if (!hasCredential) {
    return {
      blocked:
        'no Google credential — set VITOPS_GOOGLE_CLIENT_ID / _CLIENT_SECRET / _REFRESH_TOKEN, or run `gcloud auth application-default login`',
      locations: [],
      notes,
    };
  }

  const entries = onlyLocation
    ? Object.entries(config.locations).filter(([key]) => key === onlyLocation)
    : Object.entries(config.locations);

  if (onlyLocation && entries.length === 0) {
    return {
      blocked: `--location "${onlyLocation}" is not in site.reviews.locations`,
      locations: [],
      notes,
    };
  }

  const locations: LocationPlan[] = entries.map(([key, loc]) => {
    if (!knownLocations.has(key))
      return {
        key,
        skip: `organization.locations has no entry keyed "${key}" with a listings.google id`,
      };
    const accountId = loc.accountId ?? config.accountId;
    if (!accountId)
      return {
        key,
        skip: `no accountId — set site.reviews.accountId or locations.${key}.accountId`,
      };
    return { key, accountId, locationId: loc.locationId };
  });

  const blocked = locations.filter((l) => l.skip);
  if (blocked.length) for (const l of blocked) notes.push(`${l.key}: skipped — ${l.skip}`);

  return { locations, notes };
}

/** Render a plan as the human-readable block `--dry` prints. */
export function formatPlan(p: ReviewsPlan): string {
  if (p.blocked) return `✗ blocked — ${p.blocked}`;
  const lines: string[] = [];
  const active = p.locations.filter((l) => !l.skip);
  lines.push(`locations  ${active.length} of ${p.locations.length} will be fetched`);
  for (const l of active) lines.push(`  ${l.key}  ${l.accountId}/${l.locationId}`);
  for (const n of p.notes) lines.push(`  ! ${n}`);
  return lines.join('\n');
}

/**
 * Filter and order one location's reviews for display.
 *
 * Featured ids always win and keep the author's order — an explicit choice
 * overrides any automatic ranking. The remainder is filtered by `minRating`
 * (default 4 — a star-rating widget showing a 1-star review it did not have to
 * is a design choice a config field should not have to spell out every time),
 * sorted, then capped by `limit`.
 */
export function selectReviews(reviews: Review[], config: ReviewLocationConfig): Review[] {
  const featuredIds = config.featured ?? [];
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const featured = featuredIds.map((id) => byId.get(id)).filter((r): r is Review => !!r);
  const featuredSet = new Set(featured.map((r) => r.id));

  const minRating = config.minRating ?? 4;
  const rest = reviews
    .filter((r) => !featuredSet.has(r.id) && r.rating >= minRating)
    .sort((a, b) =>
      config.sort === 'rating'
        ? b.rating - a.rating
        : new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

  const combined = [...featured, ...rest];
  return config.limit !== undefined ? combined.slice(0, config.limit) : combined;
}

/**
 * Merge a fresh fetch into the existing cache.
 *
 * Only the locations actually fetched this run are replaced; every other
 * location's prior reviews pass through untouched. This is what makes a partial
 * failure (one location's fetch errors) non-destructive — `cmdReviews` merges
 * only the locations that succeeded and leaves the rest of the cache alone.
 */
export function mergeCache(
  existing: ReviewCache | undefined,
  fetched: Record<string, LocationReviews>,
): ReviewCache {
  return {
    version: 1,
    locations: { ...existing?.locations, ...fetched },
  };
}
