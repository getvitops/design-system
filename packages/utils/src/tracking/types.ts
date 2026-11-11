/**
 * The tracking module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['tracking']` imported from
 * `@getvitops/generator`: the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field — the same arrangement, and for the same reason, as `IndexingConfig`.
 */

/*
 * Optional fields are written `?: T | undefined` throughout, matching
 * `indexing/types.ts`: `exactOptionalPropertyTypes` is on and these describe a
 * *parsed JSON config*, where an absent key and an explicit `undefined` are the
 * same thing.
 */

import type { TrackingConfig } from '@getvitops/config';

// The `site.tracking` block, inferred from `@getvitops/config` rather than re-declared.
export type { TrackingConfig };

/** Which consent category the `_ac` cookie waits on. */
export type TrackingCategory = NonNullable<TrackingConfig['category']>;

/**
 * What the `_ac` cookie holds: where a visitor came from, captured once on the
 * landing page and carried until it expires.
 *
 * Click-ID and UTM keys are indexed rather than enumerated because the platform
 * table is the source of truth for which are recognised — enumerating them here
 * would be a second list to keep in step.
 */
export interface TrackingData {
  [param: string]: string | number | undefined;
  /** Path of the page the visitor first landed on. */
  landingPage?: string | undefined;
  /** `document.referrer` at capture, when there was one. */
  referrer?: string | undefined;
  /** Epoch ms of first capture. Preserved across later captures. */
  ts?: number | undefined;
  /** A/B variant assigned by the router, when the site runs one. */
  ab_variant?: string | undefined;
}

/**
 * A conversion, as a fact — the thing every notification channel renders.
 *
 * This is the module's load-bearing abstraction. The event says *what happened*;
 * how it reads is the channel's business, so an SMS channel can render 160
 * characters from the same event an email renders in full without a second source
 * of truth. It is the rule the legal templates already follow: the config records
 * facts, the template owns prose.
 *
 * `at` is passed in rather than read from a clock, so `plan`/`render` stay pure
 * and their tests need no fake timers.
 */
export interface ConversionEvent {
  type: 'form' | 'call' | 'email';
  /** Submitted fields, for `type: 'form'`. Honeypots are stripped before this. */
  formData?: Record<string, string> | undefined;
  phone?: string | undefined;
  /**
   * For `type: 'call'` on a swapped number: which `site.tracking.phoneNumbers` source (or
   * `google`) the visitor was shown. Lets the notification say "called the Meta number".
   */
  phoneSource?: string | undefined;
  /** The `mailto:` address, for `type: 'email'`. */
  email?: string | undefined;
  /** Attribution from the `_ac` cookie, or null when the visitor arrived cold. */
  tracking: TrackingData | null;
  userAgent?: string | undefined;
  ip?: string | undefined;
  /** Epoch ms. */
  at: number;
}
