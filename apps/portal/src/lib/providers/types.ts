// Provider-adapter contract. Adapters are PURE I/O → normalized rows; the sync
// worker owns all DB upserts (keeps adapters DB-agnostic and unit-testable).
// Interfaces are capability-aligned so the gating layer maps cleanly onto them.
import type { Capability } from '../capabilities.ts';
import type { Env } from '../env.ts';

export interface DateRange {
  /** inclusive ISO date (YYYY-MM-DD) */ from: string;
  /** inclusive ISO date (YYYY-MM-DD) */ to: string;
}

export interface SiteRef {
  id: string;
  organizationId: string;
  domain: string;
  providerRefs: Record<string, string>;
}

/** Everything an adapter needs for one call: env + decrypted per-org creds. */
export interface SyncCtx {
  env: Env;
  /** Decrypted provider credentials (tokens/keys), if a connection exists. */
  secret?: Record<string, string>;
  /** Provider-side org id (e.g. Zoho orgId, Cloudflare account id). */
  externalOrgId?: string | null;
}

// ── Normalized row shapes (mirror the cache tables) ──────────────────────────
export interface AnalyticsRow {
  date: string;
  provider: string;
  requests: number;
  pageViews: number;
  visits: number;
  conversions: number;
  formSubmissions: number;
}
export interface TrafficRow {
  bucketTs: string;
  human: number;
  ai: number;
  bot: number;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
  failures: number;
}
export interface RumRow {
  date: string;
  lcpMs?: number;
  inpMs?: number;
  clsX1000?: number;
  ttfbMs?: number;
  sampleCount: number;
}
export interface AnalyticsBundle {
  analytics: AnalyticsRow[];
  traffic: TrafficRow[];
  rum: RumRow[];
}
export interface TicketRow {
  externalId: string;
  subject?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  remoteCreatedAt?: string;
  remoteModifiedAt?: string;
}
export interface LicenseRow {
  product: string;
  seats: number;
  used: number;
  status: string;
  renewalDate?: string;
}
export interface ProvisioningRow {
  op: 'join' | 'move' | 'leave';
  subject: string;
  system?: string;
  status: string;
  receivedAt?: string;
  payload?: unknown;
}

// ── Capability-aligned adapters ──────────────────────────────────────────────
interface Base {
  id: string;
  capability: Capability;
  /** True for real integrations; false for deterministic mocks. */
  live: boolean;
}
export interface AnalyticsProvider extends Base {
  capability: 'analytics';
  fetchAnalytics(ctx: SyncCtx, site: SiteRef, range: DateRange): Promise<AnalyticsBundle>;
}
export interface HelpdeskProvider extends Base {
  capability: 'helpdesk';
  fetchTickets(ctx: SyncCtx): Promise<TicketRow[]>;
}
export interface LicensingProvider extends Base {
  capability: 'licensing';
  fetchLicenses(ctx: SyncCtx): Promise<LicenseRow[]>;
}
export interface ProvisioningProvider extends Base {
  capability: 'scim';
  fetchProvisioning(ctx: SyncCtx): Promise<ProvisioningRow[]>;
}
export type Provider =
  | AnalyticsProvider
  | HelpdeskProvider
  | LicensingProvider
  | ProvisioningProvider;

// ── Write / ingestion adapters (the outbox forwards through these) ───────────
export interface SubmittedRequest {
  id: string;
  organizationId: string;
  type: string; // ticket | jml | pto | hris
  payload: Record<string, unknown>;
  submittedBy: string;
}

/** Forwards a customer-submitted request to the underlying vendor. */
export interface RequestProvider {
  id: string;
  /** Request types this provider handles. */
  handles: readonly string[];
  live: boolean;
  submit(ctx: SyncCtx, req: SubmittedRequest): Promise<{ externalRef: string }>;
}

/** Small deterministic hash → seeded pseudo-random, for stable mock data. */
export function seedFrom(...parts: string[]): number {
  let h = 2166136261;
  for (const s of parts.join('|')) h = Math.imul(h ^ s.charCodeAt(0), 16777619);
  return (h >>> 0) / 0xffffffff;
}
