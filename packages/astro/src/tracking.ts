/**
 * The `<Tracking />` resolution layer — tracking config in, what to emit out.
 *
 * Separate from `Tracking.astro` for the same reason `analytics.ts` is separate
 * from `Analytics.astro`: everything decidable is a pure function asserted in
 * `tracking.test.ts`, and the component only renders what this returns.
 *
 * The one decision here is **which consent category the `_ac` cookie waits on**,
 * and it is stated rather than inferred. `_ac` is a 90-day identifier tying a
 * visitor to the ad that brought them, so `marketing` is the default — but a site
 * using click IDs purely for its own campaign reporting may reasonably file it
 * under `analytics`, and that is the consumer's call to make, not ours to guess.
 */

/** Which consent category the attribution cookie waits on. */
export type TrackingCategory = 'marketing' | 'analytics';

export interface GetvitopsTrackingOptions {
  /** Capture ad click IDs and UTMs into `_ac`. */
  enabled?: boolean;
  /** Default `marketing`. */
  category?: TrackingCategory;
  /** Informational; capture recognises every known click-ID parameter regardless. */
  platforms?: string[];
}

/** The cookie the capture script writes. Mirrors `TRACKING_COOKIE` in utils. */
export const TRACKING_COOKIE = '_ac';

/**
 * Where the capture script sends its `tel:` conversion beacon.
 *
 * The route itself is the consumer's to write (`createConversionRoute()` in
 * `@getvitops/astro/routes`), so this is the one place the two halves agree on
 * a path. It was a bare literal inside the inlined script: a consumer who named
 * the file anything else got a silent 404 on every beacon and lost conversions
 * with no error anywhere to explain it. Exported so a consumer can assert
 * against it, mirrored in `scripts/tracking.ts` because that file is inlined
 * into the document and cannot import, and pinned by `tracking.test.ts`.
 */
export const TRACKING_ENDPOINT = '/api/track';

export interface ResolvedTracking {
  enabled: boolean;
  category: TrackingCategory;
  /** Cookie names to clear on revoke — rides on `data-consent-cookies`. */
  cookies: string[];
  /** Configuration problems, as prose. The integration logs these. */
  warnings: string[];
}

export interface ResolveTrackingContext {
  /** Is the consent gate enabled on this site (`vitops({ consent })`)? */
  consent?: boolean;
  /** Categories the banner offers, so we can catch a demand with no row. */
  consentCategories?: readonly string[];
}

/**
 * Resolve the tracking config into what the component emits.
 *
 * Two warnings, both about the same failure — a persistent identifier written
 * with no way for the visitor to decline, or a permission asked for with no way
 * to answer. Returned as data rather than logged here so the check is a test
 * rather than a line someone might scroll past, exactly as `resolveAnalytics`
 * does.
 */
export function resolveTracking(
  opts: GetvitopsTrackingOptions | undefined,
  ctx: ResolveTrackingContext = {},
): ResolvedTracking {
  const warnings: string[] = [];
  const category: TrackingCategory = opts?.category ?? 'marketing';
  const enabled = opts?.enabled === true;

  if (!enabled) return { enabled: false, category, cookies: [], warnings };

  if (!ctx.consent) {
    warnings.push(
      `tracking is on, so this site writes the \`${TRACKING_COOKIE}\` cookie — a 90-day ` +
        'identifier tying a visitor to the ad that brought them — and `consent` is off, so it ' +
        'is written for every visitor with no way to decline. Set `consent: true`.',
    );
  } else if (ctx.consentCategories && !ctx.consentCategories.includes(category)) {
    // The banner would be raised for a category it renders no row for: the
    // visitor is asked a question the form does not show them.
    warnings.push(
      `tracking demands the \`${category}\` consent category, but the banner offers ` +
        `${ctx.consentCategories.join(', ') || 'nothing'}. Add \`${category}\` to ` +
        '`consent.categories`, or the visitor is asked about something the banner never names.',
    );
  }

  return { enabled, category, cookies: [TRACKING_COOKIE], warnings };
}
