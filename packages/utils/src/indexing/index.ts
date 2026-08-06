/**
 * `vitops search notify` — telling search engines a deploy happened.
 *
 * A separate subpath (`@getvitops/utils/indexing`) rather than part of the package
 * index, matching `./favicon`: this is the only module here that touches the
 * network, and a consumer importing the content helpers shouldn't pull it in.
 *
 * The layering is the point. `plan.ts` decides everything and touches nothing;
 * `indexnow.ts` and `gsc.ts` execute a plan and decide nothing. That is what makes
 * `--dry` a complete account of a run rather than an approximation of one.
 */
export {
  INDEXNOW_BATCH,
  INDEXNOW_ENDPOINT,
  formatPlan,
  plan,
  resolveKeyLocation,
  resolveSitemapUrl,
} from './plan.ts';
export type {
  ChannelPlan,
  IndexNowPlan,
  IndexingPlan,
  PlanInput,
  SearchConsolePlan,
  UrlReason,
} from './plan.ts';

export { collectEntries, parseSitemap } from './sitemap.ts';
export type { ParsedSitemap, SitemapReader } from './sitemap.ts';

export { SNAPSHOT_PATH, readSnapshot, toSnapshot, writeSnapshot } from './snapshot.ts';

export { keyFileContents, newKey, submitBatch, verifyKeyFile } from './indexnow.ts';
export type { SubmitResult } from './indexnow.ts';

export { inspectUrl, parseServiceAccount, serviceAccountToken, submitSitemap } from './gsc.ts';
export type { InspectionResult, ServiceAccount } from './gsc.ts';

/**
 * The shared token exchange, surfaced here because `search notify` is what needs
 * to choose between the two identities: Search Console accepts either, so a
 * consumer who already minted an OAuth credential for `search setup` is not made
 * to create a second, unrelated Google setup for the other half of the command.
 */
export { googleAccessToken, googleHeaders, SCOPES } from '../google/token.ts';
export type { GoogleAuth, GoogleAuthLike } from '../google/token.ts';
// Recognising a gcloud ADC credential — pure, so the CLI keeps only the file read.
export { adcCredentialsPath, adcQuotaProject, parseAdcUser } from '../google/adc.ts';
export type { GoogleCredential, GoogleOAuth } from '../google/token.ts';

export type {
  IndexingConfig,
  IndexNowConfig,
  SearchConsoleConfig,
  SitemapEntry,
  Snapshot,
} from './types.ts';
