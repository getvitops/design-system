/**
 * `vitops domains setup` — making a site's declared canonical domain true.
 *
 * Its own subpath (`@getvitops/utils/domains`), matching `./indexing`, `./onboarding` and
 * `./ads`: these are the network-touching modules here, and a consumer importing the
 * content helpers shouldn't pull one in.
 *
 * The layering is the same as its siblings': `plan.ts` decides everything and touches
 * nothing; `cloudflare.ts` executes and decides nothing. The split is what makes `--dry`
 * a complete account of a run rather than an approximation.
 *
 * The DNS verbs are re-exported from `onboarding/cloudflare.ts` rather than reimplemented,
 * for the reason `ads/index.ts` gives: two copies would be two places for "never delete a
 * record" to stop being true. The zone-settings and Page Rule verbs could *not* live
 * there — they update, and that file promises it never does — so they sit in this
 * module's own executor under a contract of its own.
 */
export {
  HSTS_DEFAULT_MAX_AGE,
  HSTS_PRELOAD_MIN_MAX_AGE,
  REDIRECT_PLACEHOLDER,
  canonicalHost,
  counterpartHost,
  desiredRule,
  findOurRule,
  formatPlan,
  formatSummary,
  hasDrift,
  missingRequirements,
  plan,
  planAlias,
  planHsts,
  planHttps,
  planReachable,
  resolveAliases,
  resolveHsts,
  ruleForward,
  ruleTarget,
  zoneOf,
} from './plan.ts';
export type {
  AliasPlan,
  AliasResult,
  DomainsPlan,
  DomainsResult,
  StepAction,
  StepPlan,
} from './plan.ts';

export {
  createPageRule,
  forwardingRuleBody,
  getZoneSetting,
  hstsValue,
  listPageRules,
  lookupZone,
  readAlwaysUseHttps,
  readHsts,
  readNosniff,
  readPageRule,
  setZoneSetting,
  updatePageRule,
} from './cloudflare.ts';
export type { ZoneLookup } from './cloudflare.ts';

// The DNS verbs, re-exported rather than reimplemented — see the note above.
export { createRecord, findZoneId, listRecords } from '../onboarding/cloudflare.ts';

export type {
  AliasSetup,
  DomainsSetup,
  HstsSetup,
  PageRuleState,
  RedirectStatus,
  ResolvedHsts,
  ZoneState,
} from './types.ts';
