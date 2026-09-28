/**
 * The CRM module's own option surface.
 *
 * Deliberately structural rather than `Config['site']['crm']` imported from
 * `@getvitops/generator`: the generator already depends on this package, so
 * importing back would be a cycle. The vocabulary mirrors that block field for
 * field — the same arrangement, and for the same reason, as `IndexingConfig`
 * and `NotifyContext` beside it.
 *
 * Optional fields are written `?: T | undefined` throughout: `exactOptionalPropertyTypes`
 * is on, and these describe a *parsed JSON config* where an absent key and an
 * explicit `undefined` are the same thing.
 */

export type CrmProvider = 'hubspot' | 'bigin' | 'jobber';

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
export type BiginDataCenter = 'com' | 'ca' | 'eu' | 'in' | 'com.au' | 'jp';

export interface HubSpotConfig {
  portalId: string;
  formGuid: string;
  /** Default `na`. Only affects the submissions API host. */
  dataCenter?: 'na' | 'eu' | undefined;
}

export interface BiginPipelineConfig {
  enabled: boolean;
  subPipeline?: string | undefined;
  stage?: string | undefined;
}

export interface BiginConfig {
  dataCenter: BiginDataCenter;
  /** Default `Email` — Bigin's own unique field, used for `upsert`'s dedupe. */
  duplicateCheckField?: string | undefined;
  pipeline?: BiginPipelineConfig | undefined;
}

export interface JobberConfig {
  /**
   * The pinned `X-JOBBER-GRAPHQL-VERSION` date this integration was built and
   * tested against. Overriding it is an escape hatch for a client's app
   * pinned to a different version — not something to reach for casually,
   * since Jobber's schema can change field names between versions.
   */
  apiVersion?: string | undefined;
  /**
   * Look up an existing client by email before creating one (default
   * **false**). Jobber's `clientCreate` has no upsert, so a resubmitting
   * visitor creates a second client unless this runs — but the lookup query's
   * filter shape is not yet verified against a live Jobber schema (see
   * `jobber.ts`'s docblock), so it defaults off rather than risk a wrong
   * query silently blocking a real submission. Set `true` once verified for
   * your account.
   */
  dedupe?: boolean | undefined;
  note?:
    | {
        /** Attach a best-effort note carrying the message + unmapped
         * attribution (default true). A failure here never downgrades the
         * client write's own success — see `jobber.ts`. */
        enabled?: boolean | undefined;
      }
    | undefined;
}

export interface CrmConfig {
  provider: CrmProvider;
  enabled?: boolean | undefined;
  hubspot?: HubSpotConfig | undefined;
  bigin?: BiginConfig | undefined;
  jobber?: JobberConfig | undefined;
  /** Submitted field name → CRM property name. Unmapped fields are dropped, not guessed. */
  fieldMap?: Record<string, string> | undefined;
  /** `_ac` tracking key → CRM property name. Same drop-if-unmapped rule. */
  trackingFields?: Record<string, string> | undefined;
}

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
