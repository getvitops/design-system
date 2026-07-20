// Tenant / business tables. EVERY table carries `organizationId` (text, FK to
// organization.id) and is protected by RLS (see migrations/0001_rls_roles.sql):
// the `authenticated` role can only see/modify rows where
//   organization_id = current_setting('app.organization_id')
// The owner role (auth + sync worker) bypasses RLS by table ownership.
//
// Two kinds of tables:
//   • first-class  — source of truth (sites, provider_connections, licenses,
//     provisioning_operations, organizations_ext)
//   • sync cache   — rebuilt idempotently by the sync worker via upsert
//     (analytics_daily, traffic_events, rum_metrics, tickets)
import {
  bigint,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './auth.ts';

const orgId = () =>
  text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' });

/** 1:1 extension of the Better-Auth organization: plan + derived capabilities. */
export const organizationsExt = pgTable('organizations_ext', {
  organizationId: text('organization_id')
    .primaryKey()
    .references(() => organization.id, { onDelete: 'cascade' }),
  plan: text('plan').notNull().default('starter'), // starter | growth | enterprise
  capabilities: jsonb('capabilities').$type<string[]>(), // optional denormalized cache
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** A client-monitored property, mapping to per-provider account ids. */
export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgId(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  // { cloudflareZoneId, cloudflareAccountId, ga4PropertyId, matomoSiteId, clarityProjectId }
  providerRefs: jsonb('provider_refs').$type<Record<string, string>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** Per-org provider credentials. Rotating OAuth tokens are AES-GCM sealed. */
export const providerConnections = pgTable(
  'provider_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    provider: text('provider').notNull(), // cloudflare|zoho|ga4|clarity|matomo|licensing|scim
    status: text('status').notNull().default('disconnected'),
    externalOrgId: text('external_org_id'), // e.g. Zoho orgId
    sealedSecret: text('sealed_secret'), // base64 AES-GCM blob (tokens/keys)
    expiresAt: timestamp('expires_at'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('provider_connections_org_provider').on(t.organizationId, t.provider)],
);

/** Sync cache: per-site daily rollup across analytics providers. */
export const analyticsDaily = pgTable(
  'analytics_daily',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    provider: text('provider').notNull(),
    requests: bigint('requests', { mode: 'number' }).notNull().default(0),
    pageViews: bigint('page_views', { mode: 'number' }).notNull().default(0),
    visits: bigint('visits', { mode: 'number' }).notNull().default(0),
    conversions: bigint('conversions', { mode: 'number' }).notNull().default(0),
    formSubmissions: bigint('form_submissions', { mode: 'number' }).notNull().default(0),
  },
  (t) => [unique('analytics_daily_site_provider_date').on(t.siteId, t.provider, t.date)],
);

/** Sync cache: bucketed traffic with human/AI/bot split + latency + failures. */
export const trafficEvents = pgTable(
  'traffic_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    bucketTs: timestamp('bucket_ts').notNull(),
    human: bigint('human', { mode: 'number' }).notNull().default(0),
    ai: bigint('ai', { mode: 'number' }).notNull().default(0),
    bot: bigint('bot', { mode: 'number' }).notNull().default(0),
    latencyP50Ms: integer('latency_p50_ms'),
    latencyP95Ms: integer('latency_p95_ms'),
    failures: bigint('failures', { mode: 'number' }).notNull().default(0),
  },
  (t) => [unique('traffic_events_site_bucket').on(t.siteId, t.bucketTs)],
);

/** Sync cache: per-site daily Core Web Vitals (RUM). */
export const rumMetrics = pgTable(
  'rum_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    lcpMs: integer('lcp_ms'),
    inpMs: integer('inp_ms'),
    clsX1000: integer('cls_x1000'), // CLS * 1000 (integer-friendly)
    ttfbMs: integer('ttfb_ms'),
    sampleCount: bigint('sample_count', { mode: 'number' }).notNull().default(0),
  },
  (t) => [unique('rum_metrics_site_date').on(t.siteId, t.date)],
);

/** Sync cache: Zoho Desk ticket mirror (helpdesk capability). */
export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    externalId: text('external_id').notNull(),
    subject: text('subject'),
    status: text('status'),
    priority: text('priority'),
    assignee: text('assignee'),
    remoteCreatedAt: timestamp('remote_created_at'),
    remoteModifiedAt: timestamp('remote_modified_at'),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
  },
  (t) => [unique('tickets_org_external').on(t.organizationId, t.externalId)],
);

/** First-class: software licenses (licensing capability; mock-fed for now). */
export const licenses = pgTable('licenses', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgId(),
  product: text('product').notNull(),
  seats: integer('seats').notNull().default(0),
  used: integer('used').notNull().default(0),
  status: text('status').notNull().default('active'),
  renewalDate: date('renewal_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** First-class: JML / SCIM provisioning operations (scim capability; stub). */
export const provisioningOperations = pgTable('provisioning_operations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: orgId(),
  op: text('op').notNull(), // join | move | leave
  subject: text('subject').notNull(), // user email / name
  system: text('system'), // target software
  payload: jsonb('payload'),
  status: text('status').notNull().default('pending'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
});

/**
 * Ingestion OUTBOX (the write path). Customer-submitted requests — help tickets,
 * JML signals, HRIS/PTO actions — land here as `pending`, then the dispatch
 * worker forwards each to the underlying vendor and flips it to sent/failed.
 * `idempotency_key` (unique per org) prevents double-filing on resubmit/retry.
 */
export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: orgId(),
    type: text('type').notNull(), // ticket | jml | pto | hris
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: text('status').notNull().default('pending'), // pending|approved|sent|failed
    idempotencyKey: text('idempotency_key').notNull(),
    externalRef: text('external_ref'), // vendor id once created
    submittedBy: text('submitted_by').notNull(), // user id/email
    approver: text('approver'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique('requests_org_idempotency').on(t.organizationId, t.idempotencyKey)],
);
