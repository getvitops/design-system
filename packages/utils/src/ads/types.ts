/**
 * The ads module's own option surface.
 *
 * `AdPropertySetup` is the `site.ads.<platform>` block from `@getvitops/config` plus the platform it
 * is keyed by — inferred from the schema `validateConfig` runs, not re-declared here.
 */

import type { AdPropertyConfig } from '@getvitops/config';
import type { AdProvider as AdProviderConfig } from '@getvitops/config/providers';

/**
 * The ad platforms this toolchain knows how to link a site to.
 *
 * A closed set, and `AD_PROVIDERS` in `@getvitops/config` is its single source: the capability
 * table in `providers.ts` is a `Record<AdProvider, …>`, so a provider added there without an entry
 * here is a compile error. (This was a hand-copied union held to the schema's enum by a test in the
 * generator; the schema now lives below this package, so the copy and the test are gone.) An open
 * string would mean a typo'd provider silently getting no verification step and no tag.
 */
export type AdProvider = AdProviderConfig;

/** Which consent category gates a provider's tag. */
export type AdConsentCategory = 'marketing' | 'analytics';

/**
 * The three interactions Google Ads can report a distinct conversion action
 * for. `form` is fired client-side via `vitopsFormConversion()`
 * (`@getvitops/astro`'s tracking script), the other two from the tel:/mailto:
 * click handler.
 */
export type ConversionAction = 'call' | 'email' | 'form';

/**
 * One label per action this site wants Google Ads to tell apart.
 *
 * Written out field by field, `?: string | undefined` — not
 * `Partial<Record<ConversionAction, string>>` — matching this file's own
 * convention above: `exactOptionalPropertyTypes` treats `{ email?: string }`
 * (present-or-absent) and `{ email?: string | undefined }` (present,
 * absent, or explicitly `undefined`) as different types, and a parsed JSON
 * config's optional field is the latter. `Partial<Record<...>>` produces the
 * former, which rejected the zod-inferred shape config.ts actually produces.
 */
export interface ConversionLabelMap {
  call?: string | undefined;
  email?: string | undefined;
  form?: string | undefined;
}

/**
 * A bare string is back-compat shorthand for `{ call: label }` — the only
 * action that existed before this was a map. Absent input normalises to `{}`.
 */
export function normalizeConversionLabels(
  label: string | ConversionLabelMap | undefined,
): ConversionLabelMap {
  if (label == null) return {};
  return typeof label === 'string' ? { call: label } : label;
}

/**
 * One Google Ads conversion action **resource id** per action this site
 * uploads server-side — a numeric id (`"123456789"`) or a full resource name
 * (`"customers/123/conversionActions/456"`), never the `conversionLabel`
 * string. Written out field by field for the same `exactOptionalPropertyTypes`
 * reason as `ConversionLabelMap` above.
 *
 * **This is a genuinely different identifier from `conversionLabel`, not an
 * alternate spelling of it.** `conversionLabel` is the opaque label the web
 * tag embeds in `send_to: "AW-…/label"` — it identifies the conversion action
 * to `gtag.js`, not to the Ads API. The API's click-conversion upload
 * (`ConversionUploadService.UploadClickConversions`) addresses the action by
 * `conversion_action` **resource name**, a value the label cannot be turned
 * into locally — Google returns both when a conversion action is created, but
 * only the label ships to the browser today. Until something in this
 * toolchain calls `ConversionActionService` to create/list actions and print
 * both back, this field has to be copied in by hand from the Ads UI/API.
 */
export interface ConversionActionIdMap {
  call?: string | undefined;
  email?: string | undefined;
  form?: string | undefined;
}

/** Same back-compat shorthand as `normalizeConversionLabels`, for ids. */
export function normalizeConversionActionIds(
  id: string | ConversionActionIdMap | undefined,
): ConversionActionIdMap {
  if (id == null) return {};
  return typeof id === 'string' ? { call: id } : id;
}

/** One ad property to link: the config block, plus the platform it is keyed by. */
export type AdPropertySetup = AdPropertyConfig & {
  provider: AdProvider;
};

/** Everything `plan()` needs, once the CLI has read the config. */
export interface AdsConfig {
  /** The properties to link. Already filtered to `--provider` if that was passed. */
  properties: AdPropertySetup[];
}

/**
 * One property's observed live state, gathered by the executor before planning.
 *
 * Same shape of arrangement as `DomainState`: the decision is pure, the
 * observation is not. `txtContents` is every apex TXT record on the domain, so
 * the planner can decide both "our record is present" and "a *different* record
 * from this provider is present" — the second is a token rotation, which needs
 * saying rather than silently adding a second record.
 */
export interface AdDomainState {
  zoneId?: string | undefined;
  /** Every apex TXT record content, unquoted. */
  txtContents: string[];
}
