/**
 * The CRM module's own option surface.
 *
 * The config shapes are NOT declared here. They are inferred from the schema in
 * `@getvitops/config` — the same one `validateConfig` runs — so the type a CRM executor
 * accepts and the document the validator accepts cannot drift. This module used to keep a
 * field-for-field copy, because the schema lived in a package above this one; moving the
 * provider blocks into a leaf package is what removed the copy, the adapter that converted
 * into it, and the test that held the two together.
 */
import type {
  BiginConfig,
  BiginPipelineConfig,
  CrmConfig,
  HubSpotConfig,
  JobberConfig,
} from '@getvitops/config';
import type { BIGIN_DATA_CENTERS, CrmProviderConfig } from '@getvitops/config/providers';

export type { BiginConfig, BiginPipelineConfig, CrmConfig, HubSpotConfig, JobberConfig };

export type CrmProvider = CrmProviderConfig;

/** Human-readable label per provider, for the notification email's Delivery
 * line (`describeCrmResult`) and anywhere else a provider must be named
 * without a hand-written ternary. Exhaustive by type — a provider missing
 * here is a compile error, not a mislabelled email. */
export const PROVIDER_LABELS: Record<CrmProvider, string> = {
  hubspot: 'HubSpot',
  bigin: 'Bigin',
  jobber: 'Jobber',
};

/** Bigin's data centre — the region a self-client's tokens and API host belong to. */
export type BiginDataCenter = (typeof BIGIN_DATA_CENTERS)[number];

/** Credentials, never config — always injected by the caller from env vars. */
export interface HubSpotCredentials {
  accessToken: string;
}

export interface BiginCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * Jobber's self-client OAuth credential. The refresh token is expected to be
 * static — Refresh Token Rotation must be OFF in the app's Developer Center
 * settings, since a Worker reading a static env var cannot persist a rotated
 * one. See `jobber-token.ts` for the detection when a client's app has it on
 * anyway.
 */
export interface JobberCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export type CrmCredentials =
  | { provider: 'hubspot'; hubspot: HubSpotCredentials }
  | { provider: 'bigin'; bigin: BiginCredentials }
  | { provider: 'jobber'; jobber: JobberCredentials };

/** A channel's decision: on, or off with a stated reason. Mirrors `ChannelPlan`. */
export interface CrmPlan {
  enabled: boolean;
  provider?: CrmProvider | undefined;
  /** Why it's off. Present iff `enabled` is false. */
  skip?: string | undefined;
}

/** A provider-neutral record — what a submission maps to, before either executor
 * renders it into that CRM's own request shape. */
export interface CrmRecord {
  firstName?: string | undefined;
  lastName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  company?: string | undefined;
  message?: string | undefined;
  /** Mapped fields beyond the identity ones above, keyed by the CRM property name. */
  extra: Record<string, string>;
  /** `trackingFields`-mapped attribution, keyed by the CRM property name. Empty
   * when the visitor arrived with no `_ac` cookie — never an error. */
  attribution: Record<string, string>;
}

/**
 * The outcome of one delivery attempt. Never thrown — a CRM write is
 * best-effort and its failure is a fact for the caller to log or notify with,
 * not an exception to propagate into the request that produced the submission.
 */
export interface CrmResult {
  ok: boolean;
  provider: CrmProvider;
  /** The created/updated record's id, when the CRM returned one. */
  recordId?: string | undefined;
  /** Why it didn't write, or what the classification of the failure was. */
  reason?: string | undefined;
  /** The provider's own error/status code, when it gave one. */
  code?: string | undefined;
}

/** What `mapSubmission` needs, gathered by the caller once per site. */
export interface CrmMapContext {
  config: CrmConfig;
}
