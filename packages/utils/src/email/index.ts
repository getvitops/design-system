/**
 * `vitops email` — connecting `site.notifications.email.from` to whether its
 * domain is actually onboarded onto an outbound email provider.
 *
 * Its own subpath (`@getvitops/utils/email`), matching `./ads` and
 * `./onboarding`: this is a network-touching + fs-scanning module, and a
 * consumer importing the notify content helpers shouldn't pull it in.
 *
 * Layering matches every other onboarding-shaped module here: `plan.ts` decides
 * everything and touches nothing; `cloudflare.ts` executes Cloudflare's REST API
 * and decides nothing; `dns.ts` is a read-only DoH propagation probe; `scan.ts`
 * is the best-effort static source scan, a supplement to config — never the
 * primary source.
 */
export {
  blockedDomains,
  dnsStatus,
  formatPlan,
  formatSummary,
  hasDrift,
  planDomain,
  planSendingDomains,
} from './plan.ts';
export type { DomainResult, EmailPlan, SendingDomainPlan, StepAction, StepPlan } from './plan.ts';

export { enableSending, findZoneForHost, listSendingSubdomains, sendingDns } from './cloudflare.ts';
export { resolveTxt } from './dns.ts';
export { collectFromAddresses, extractFromRefs } from './scan.ts';
export type { DynamicFromRef, FromRef, FromScanResult } from './scan.ts';

export type {
  EmailConfig,
  EmailProvider,
  ExpectedRecord,
  FromCandidate,
  SendingDomainState,
  ZoneSendingState,
} from './types.ts';

// The onboarding backoff schedule, re-exported rather than reimplemented — the
// DNS_TXT propagation problem it was written for is the exact one this module
// polls for too.
export { backoffSchedule } from '../onboarding/plan.ts';
