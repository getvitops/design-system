/**
 * The campaigns module's option surface. Config shapes are inferred from `@getvitops/config`
 * (the schema `validateConfig` runs), never re-declared here — the same rule `crm/types.ts` follows.
 */
import type { CampaignListConfig, CampaignsConfig, ZohoCampaignsConfig } from '@getvitops/config';
import type { CampaignProviderConfig } from '@getvitops/config/providers';

export type { CampaignListConfig, CampaignsConfig, ZohoCampaignsConfig };

export type CampaignProvider = CampaignProviderConfig;

/** Provider name for the notification email's Delivery line. Exhaustive by type. */
export const CAMPAIGN_PROVIDER_LABELS: Record<CampaignProvider, string> = {
  'zoho-campaigns': 'Zoho Campaigns',
  sendfox: 'SendFox',
};

/** Credentials, never config — injected by the caller from env vars. */
export interface ZohoCampaignsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface SendFoxCredentials {
  accessToken: string;
}

export type CampaignCredentials =
  | { provider: 'zoho-campaigns'; zohoCampaigns: ZohoCampaignsCredentials }
  | { provider: 'sendfox'; sendfox: SendFoxCredentials };

/** One list a submission opted into, resolved against config. */
export interface CampaignTarget {
  key: string;
  label: string;
  config: CampaignListConfig;
}

/** A channel's decision: on with the lists to join, or off with a stated reason. */
export interface CampaignPlan {
  enabled: boolean;
  provider?: CampaignProvider | undefined;
  lists: CampaignTarget[];
  /** List keys the form named that config does not define. Reported, never guessed at. */
  unknown: string[];
  /** Why it's off. Present iff `enabled` is false. */
  skip?: string | undefined;
}

/** The subscriber, provider-neutral. */
export interface CampaignSubscriber {
  email: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
}

/** The opt-in evidence CASL asks a sender to be able to produce. */
export interface ConsentRecord {
  /** Epoch ms of the submission. */
  at: number;
  ip?: string | undefined;
  pageUri?: string | undefined;
}

export interface CampaignListOutcome {
  key: string;
  ok: boolean;
  reason?: string | undefined;
}

/** Never thrown — a failed subscribe is a fact for the caller, not an exception. */
export interface CampaignsResult {
  ok: boolean;
  provider: CampaignProvider;
  lists: CampaignListOutcome[];
  /** Why nothing was attempted, when `lists` is empty. */
  reason?: string | undefined;
  consent?: ConsentRecord | undefined;
}
