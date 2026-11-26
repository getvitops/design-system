/**
 * Email-list signups — plan, dispatch.
 *
 * Pure-planner / executor split like `crm/`: `plan.ts` decides whether and which lists,
 * the executors (`zoho-campaigns.ts`, `sendfox.ts`) make the call and decide nothing.
 * `deliverToCampaigns` never throws: a campaign-tool outage must not lose a signup or fail the
 * request, so the caller always gets a `CampaignsResult` to fold into the notification email.
 *
 * Subscription *state* (confirmed, unsubscribed, bounced) lives in the campaign tool. This module
 * only asks; it never mirrors that state anywhere.
 *
 * Worker-safe: no Node builtins (`worker-safe.test.ts`).
 */
import type { ConversionEvent } from '../tracking/types.ts';
import { identifySubmitter } from '../tracking/identity.ts';
import { planCampaigns } from './plan.ts';
import { subscribeToSendFox } from './sendfox.ts';
import { subscribeToZohoCampaigns } from './zoho-campaigns.ts';
import type {
  CampaignCredentials,
  CampaignListOutcome,
  CampaignsConfig,
  CampaignsResult,
} from './types.ts';
import { CAMPAIGN_PROVIDER_LABELS } from './types.ts';

export interface CampaignsDeps {
  credentials?: CampaignCredentials | undefined;
  fetch?: typeof fetch | undefined;
  timeoutMs?: number | undefined;
  /** The page the visitor signed up on, recorded as part of the opt-in evidence. */
  pageUri?: string | undefined;
}

export async function deliverToCampaigns(
  event: ConversionEvent,
  config: CampaignsConfig | undefined,
  deps: CampaignsDeps = {},
): Promise<CampaignsResult | null> {
  const plan = planCampaigns(event, config, deps.credentials);
  // `null` = nothing was asked for, so the notification says nothing. A non-opted-in contact
  // form is the normal case and must not produce a "⚠ not subscribed" line on every enquiry.
  if (!config || !plan.provider) return null;
  if (!plan.enabled || !deps.credentials) {
    return { ok: false, provider: plan.provider, lists: [], reason: plan.skip };
  }

  const identity = identifySubmitter(event.formData ?? {});
  const email = identity.email ?? event.email;
  if (!email) {
    return {
      ok: false,
      provider: plan.provider,
      lists: [],
      reason: 'No email address to subscribe.',
    };
  }
  const subscriber = { email, firstName: identity.firstName, lastName: identity.lastName };

  const fetchImpl = deps.fetch ?? fetch;
  const timeoutMs = deps.timeoutMs ?? 5_000;
  const credentials = deps.credentials;
  let lists: CampaignListOutcome[] = [];

  switch (config.provider) {
    case 'zoho-campaigns': {
      if (credentials.provider !== 'zoho-campaigns') break;
      // Zoho takes one list per call; run them together, each isolated from the others' failures.
      lists = await Promise.all(
        plan.lists.map((l) =>
          subscribeToZohoCampaigns(
            subscriber,
            l.config.zohoCampaigns!.listKey,
            config.zohoCampaigns!,
            credentials.zohoCampaigns,
            fetchImpl,
            timeoutMs,
            l.key,
          ),
        ),
      );
      break;
    }
    case 'sendfox': {
      if (credentials.provider !== 'sendfox') break;
      lists = await subscribeToSendFox(
        subscriber,
        plan.lists.map((l) => l.config.sendfox!.listId),
        plan.lists.map((l) => l.key),
        credentials.sendfox,
        fetchImpl,
        timeoutMs,
      );
      break;
    }
    default: {
      // A provider added to `CampaignProvider` with no case above fails the build here.
      const _exhaustive: never = config.provider;
      return _exhaustive;
    }
  }

  if (lists.length === 0)
    return {
      ok: false,
      provider: config.provider,
      lists,
      reason: 'Credentials/provider mismatch.',
    };

  return {
    ok: lists.every((l) => l.ok),
    provider: config.provider,
    lists,
    consent: { at: event.at, ip: event.ip, pageUri: deps.pageUri },
  };
}

/** One human-readable line for the notification email's Delivery section. It carries the opt-in
 * evidence (when, from where) so the email doubles as the CASL consent record. */
export function describeCampaignsResult(result: CampaignsResult | null): string | null {
  if (!result) return null;
  const name = CAMPAIGN_PROVIDER_LABELS[result.provider];
  if (result.lists.length === 0)
    return `⚠ Not subscribed on ${name}: ${result.reason ?? 'unknown reason'}`;

  const ok = result.lists.filter((l) => l.ok).map((l) => l.key);
  const failed = result.lists.filter((l) => !l.ok);
  const proof = result.consent
    ? ` (opt-in ${new Date(result.consent.at).toISOString()}${result.consent.pageUri ? ` from ${result.consent.pageUri}` : ''}${result.consent.ip ? `, ip ${result.consent.ip}` : ''})`
    : '';
  const parts: string[] = [];
  if (ok.length) parts.push(`Subscribed to ${ok.join(', ')} on ${name}${proof}`);
  for (const f of failed)
    parts.push(`⚠ Not subscribed to ${f.key} on ${name}: ${f.reason ?? 'unknown reason'}`);
  return parts.join('; ');
}

export { isOptedIn, planCampaigns, PROVIDER_REQUIREMENTS } from './plan.ts';
export { fetchSendFoxLists, fetchZohoCampaignsLists, missingLists } from './lists.ts';
export type { LiveList, ListProblem } from './lists.ts';
export { subscribeToSendFox } from './sendfox.ts';
export { subscribeToZohoCampaigns, zohoCampaignsHost } from './zoho-campaigns.ts';
export { CAMPAIGN_PROVIDER_LABELS } from './types.ts';
export type {
  CampaignCredentials,
  CampaignListConfig,
  CampaignListOutcome,
  CampaignPlan,
  CampaignProvider,
  CampaignSubscriber,
  CampaignTarget,
  CampaignsConfig,
  CampaignsResult,
  ConsentRecord,
  SendFoxCredentials,
  ZohoCampaignsConfig,
  ZohoCampaignsCredentials,
} from './types.ts';
