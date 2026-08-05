/**
 * `vitops search setup` — onboarding domains into Google Search Console.
 *
 * A separate subpath (`@getvitops/utils/onboarding`) rather than part of the
 * package index, matching `./indexing`: this and `./indexing` are the only
 * network-touching modules here, and a consumer importing the content helpers
 * shouldn't pull either in.
 *
 * The layering is the point. `plan.ts` decides everything and touches nothing;
 * `cloudflare.ts` and `google.ts` execute and decide nothing.
 */
export {
  backoffSchedule,
  formatPlan,
  formatSummary,
  hasDrift,
  ownerUnion,
  plan,
  planDomain,
  siteUrlFor,
} from './plan.ts';
export type { DomainPlan, DomainResult, OnboardingPlan, StepAction, StepPlan } from './plan.ts';

export { createApexTxt, findZoneId, listApexTxt } from './cloudflare.ts';

export {
  addSite,
  getAccessToken,
  getSite,
  getVerificationToken,
  getWebResource,
  updateOwners,
  verifyWebResource,
} from './google.ts';

export type { DomainSetup, DomainState, GoogleOAuth, OnboardingConfig } from './types.ts';
