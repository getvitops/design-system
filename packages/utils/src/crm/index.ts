/**
 * CRM form-submission delivery — plan, map, dispatch.
 *
 * The seam between "a form was submitted" and "there's a contact in the
 * client's CRM for it." A `ConversionEvent` from `@getvitops/utils/tracking`
 * goes in — the same event `notify` already turns into an email — and where
 * it goes and how it's shaped are config, not code at the call site.
 *
 * Pure-planner / executor split, matching `notify/`, `indexing/`, `ads/`:
 *   - `plan.ts`   decides whether the channel is on at all, purely.
 *   - `map.ts`    decides how one submission becomes a `CrmRecord`, purely.
 *   - `hubspot.ts` / `bigin.ts` / `jobber.ts` execute, and decide nothing
 *     beyond the one thing Bigin must refuse (see `deriveLastName`) and the
 *     four-layer classification `jobber.ts`'s GraphQL transport needs.
 *
 * `deliverToCrm` never throws: a CRM outage must not lose a lead, so the
 * caller (`createConversionRoute`) always gets a `CrmResult` back to log or
 * fold into the notification email, never an exception to catch.
 *
 * TODO — no generic connector framework. Three CRMs with three genuinely
 * different transports (a form-submission POST, a REST upsert, a GraphQL
 * mutation) is evidence against a shared abstraction, not for one — matching
 * `notify`'s own restraint about its unimplemented channels.
 */
import type { ConversionEvent } from '../tracking/types.ts';
import { submitToBigin } from './bigin.ts';
import { submitToHubSpot, type HubSpotSubmitContext } from './hubspot.ts';
import { submitToJobber } from './jobber.ts';
import { mapSubmission } from './map.ts';
import { planCrm } from './plan.ts';
import type { CrmConfig, CrmCredentials, CrmResult } from './types.ts';
import { PROVIDER_LABELS } from './types.ts';

export interface CrmDeps {
  credentials?: CrmCredentials | undefined;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
  /**
   * The visitor's page context, provider-neutral. HubSpot reads `hutk` (its
   * own session cookie) to stitch the submission to its tracking; Jobber
   * reads `pageUri` for the note body. Not every provider uses every field —
   * an unused one is simply ignored, which is why this is one shape rather
   * than a per-provider option the caller has to pick correctly.
   */
  pageContext?: HubSpotSubmitContext | undefined;
}

export async function deliverToCrm(
  event: ConversionEvent,
  config: CrmConfig | undefined,
  deps: CrmDeps = {},
): Promise<CrmResult | null> {
  const plan = planCrm(config, deps.credentials);
  if (!plan.enabled || !config || !deps.credentials) {
    // `null` distinguishes "no CRM configured for this site" from a failed
    // write — a caller building a notification's delivery notes can choose to
    // say nothing at all rather than "Not written to (no provider)".
    return config ? { ok: false, provider: config.provider, reason: plan.skip } : null;
  }

  const record = mapSubmission(event, config);
  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5_000;
  const credentials = deps.credentials;

  switch (config.provider) {
    case 'hubspot':
      if (credentials.provider !== 'hubspot') break;
      return submitToHubSpot(
        record,
        config.hubspot!,
        credentials.hubspot,
        deps.pageContext,
        fetchImpl,
        timeoutMs,
      );
    case 'bigin':
      if (credentials.provider !== 'bigin') break;
      return submitToBigin(record, config.bigin!, credentials.bigin, fetchImpl, timeoutMs);
    case 'jobber':
      if (credentials.provider !== 'jobber') break;
      return submitToJobber(
        record,
        config.jobber ?? {},
        credentials.jobber,
        deps.pageContext?.pageUri,
        fetchImpl,
        timeoutMs,
      );
    default: {
      // Exhaustiveness: a provider added to `CrmProvider` with no case above
      // fails the build here, rather than silently falling through to the
      // generic mismatch result below.
      const _exhaustive: never = config.provider;
      return _exhaustive;
    }
  }

  return {
    ok: false,
    provider: config.provider,
    reason: plan.skip ?? 'Credentials/provider mismatch.',
  };
}

/** A one-line, human-readable delivery note — what `conversion.ts` folds into
 * the notification email's "Delivery" section. */
export function describeCrmResult(result: CrmResult | null): string | null {
  if (!result) return null;
  const name = PROVIDER_LABELS[result.provider];
  if (result.ok) {
    return result.recordId
      ? `Written to ${name} (contact ${result.recordId})`
      : `Written to ${name}`;
  }
  return `⚠ Not written to ${name}: ${result.reason ?? 'unknown reason'}`;
}

export { deriveLastName, mapSubmission } from './map.ts';
export { planCrm } from './plan.ts';
export { submitToBigin, zohoApiHost } from './bigin.ts';
export { submitToHubSpot } from './hubspot.ts';
export { submitToJobber } from './jobber.ts';
export type { HubSpotSubmitContext } from './hubspot.ts';
export { clearZohoTokenCache, zohoAccessToken, zohoAccountsHost } from './zoho-token.ts';
export { clearJobberTokenCache, jobberAccessToken } from './jobber-token.ts';
export type { JobberOAuth } from './jobber-token.ts';
export { PROVIDER_LABELS } from './types.ts';
export type {
  BiginConfig,
  BiginCredentials,
  BiginDataCenter,
  BiginPipelineConfig,
  CrmConfig,
  CrmCredentials,
  CrmPlan,
  CrmProvider,
  CrmRecord,
  CrmResult,
  HubSpotConfig,
  HubSpotCredentials,
  JobberConfig,
  JobberCredentials,
} from './types.ts';
