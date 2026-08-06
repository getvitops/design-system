/**
 * `vitops ads` — linking a site to its ad properties.
 *
 * Its own subpath (`@getvitops/utils/ads`), matching `./indexing` and
 * `./onboarding`: these are the network-touching modules here, and a consumer
 * importing the content helpers shouldn't pull one in.
 *
 * The layering is the point, and it is the same as onboarding's: `plan.ts` decides
 * everything and touches nothing; the DNS executor executes and decides nothing.
 * There is deliberately **no ads-specific DNS executor** — the verification record
 * is an apex TXT, which `onboarding/cloudflare.ts` already creates under the same
 * `CLOUDFLARE_API_TOKEN` and the same create-only contract (no update verb, no
 * delete verb). Two copies would be two places for "never delete a record" to stop
 * being true.
 */
export { formatPlan, formatSummary, hasDrift, missingFields, plan, planProperty } from './plan.ts';
export type {
  AdPropertyPlan,
  AdPropertyResult,
  AdsPlan,
  MissingField,
  StepAction,
  StepPlan,
} from './plan.ts';

export {
  AD_PLATFORMS,
  AD_PROVIDER_KEYS,
  categoryOf,
  isAdProvider,
  renderTag,
  tagId,
  txtRecord,
} from './providers.ts';
export type { AdPlatform, AdTagSpec, AdVerificationSpec } from './providers.ts';

// The DNS verbs, re-exported rather than reimplemented — see the note above.
export { createApexTxt, findZoneId, listApexTxt } from '../onboarding/cloudflare.ts';

export type {
  AdConsentCategory,
  AdDomainState,
  AdProvider,
  AdPropertySetup,
  AdsConfig,
} from './types.ts';
