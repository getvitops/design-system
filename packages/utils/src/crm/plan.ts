/**
 * Every decision about *whether* a submission reaches a CRM, as one pure
 * function.
 *
 * Pure in the load-bearing sense: no `fetch`, no clock, no credential lookup
 * beyond what the caller already resolved. Mirrors `notify/plan.ts`'s
 * `ChannelPlan` shape — `enabled`, or `false` with a stated `skip` — so `--dry`
 * is a complete account and a misconfigured site can be told exactly why
 * nothing will be written, rather than discovering it as a silently missing
 * contact.
 *
 * What this file does NOT decide: whether *this* submission's write succeeds.
 * That is `map.ts` (shaping the data) and the executors (`hubspot.ts`/
 * `bigin.ts`/`jobber.ts`, making the call) — this only decides whether the
 * channel is on at all, from config and credentials.
 */
import type { CrmConfig, CrmCredentials, CrmPlan, CrmProvider } from './types.ts';

/**
 * What each provider requires to be considered configured, as one table
 * rather than a per-provider `if`. A provider missing here is a type error —
 * `Record<CrmProvider, …>` — rather than a silently-enabled channel with no
 * config block, which is what the equivalent hand-written checks would do for
 * a provider nobody added a branch for.
 */
const PROVIDER_REQUIREMENTS: Record<
  CrmProvider,
  { block: 'hubspot' | 'bigin' | 'jobber'; credentialHint: string }
> = {
  hubspot: { block: 'hubspot', credentialHint: 'No HubSpot access token configured.' },
  bigin: { block: 'bigin', credentialHint: 'No Zoho OAuth credentials configured.' },
  jobber: { block: 'jobber', credentialHint: 'No Jobber OAuth credentials configured.' },
};

export function planCrm(
  config: CrmConfig | undefined,
  credentials: CrmCredentials | undefined,
): CrmPlan {
  if (!config) {
    return { enabled: false, skip: 'No `crm` configured.' };
  }

  if (config.enabled === false) {
    return { enabled: false, provider: config.provider, skip: '`crm.enabled` is false.' };
  }

  const requirement = PROVIDER_REQUIREMENTS[config.provider];
  if (!config[requirement.block]) {
    return {
      enabled: false,
      provider: config.provider,
      skip: `\`crm.provider\` is "${config.provider}" but \`crm.${requirement.block}\` is missing.`,
    };
  }

  if (!credentials) {
    return {
      enabled: false,
      provider: config.provider,
      skip: requirement.credentialHint,
    };
  }

  if (credentials.provider !== config.provider) {
    return {
      enabled: false,
      provider: config.provider,
      skip: `\`crm.provider\` is "${config.provider}" but the supplied credentials are for "${credentials.provider}".`,
    };
  }

  return { enabled: true, provider: config.provider };
}
