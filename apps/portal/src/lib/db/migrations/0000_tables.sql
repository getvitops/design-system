-- 0000_tables.sql — schema DDL. Kept in sync BY HAND with src/lib/db/schema/*.ts
-- (no drizzle-kit). Applied by drizzle-orm's raw migrator for both postgres.js
-- (deploy) and PGlite (tests). Idempotent (IF NOT EXISTS) so re-runs are safe.

-- ── Better-Auth: owner-only, no RLS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user" (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS organization (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE,
  logo text,
  created_at timestamp NOT NULL DEFAULT now(),
  metadata text
);

CREATE TABLE IF NOT EXISTS session (
  id text PRIMARY KEY,
  expires_at timestamp NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  active_organization_id text
);

CREATE TABLE IF NOT EXISTS account (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamp,
  refresh_token_expires_at timestamp,
  scope text,
  password text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verification (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invitation (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamp NOT NULL,
  inviter_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- ── Tenant tables: organization_id text + RLS (policies in 0001) ──────────────
CREATE TABLE IF NOT EXISTS organizations_ext (
  organization_id text PRIMARY KEY REFERENCES organization(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'starter',
  capabilities jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  provider_refs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  external_org_id text,
  sealed_secret text,
  expires_at timestamp,
  last_synced_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT provider_connections_org_provider UNIQUE (organization_id, provider)
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date date NOT NULL,
  provider text NOT NULL,
  requests bigint NOT NULL DEFAULT 0,
  page_views bigint NOT NULL DEFAULT 0,
  visits bigint NOT NULL DEFAULT 0,
  conversions bigint NOT NULL DEFAULT 0,
  form_submissions bigint NOT NULL DEFAULT 0,
  CONSTRAINT analytics_daily_site_provider_date UNIQUE (site_id, provider, date)
);

CREATE TABLE IF NOT EXISTS traffic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  bucket_ts timestamp NOT NULL,
  human bigint NOT NULL DEFAULT 0,
  ai bigint NOT NULL DEFAULT 0,
  bot bigint NOT NULL DEFAULT 0,
  latency_p50_ms integer,
  latency_p95_ms integer,
  failures bigint NOT NULL DEFAULT 0,
  CONSTRAINT traffic_events_site_bucket UNIQUE (site_id, bucket_ts)
);

CREATE TABLE IF NOT EXISTS rum_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  date date NOT NULL,
  lcp_ms integer,
  inp_ms integer,
  cls_x1000 integer,
  ttfb_ms integer,
  sample_count bigint NOT NULL DEFAULT 0,
  CONSTRAINT rum_metrics_site_date UNIQUE (site_id, date)
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  external_id text NOT NULL,
  subject text,
  status text,
  priority text,
  assignee text,
  remote_created_at timestamp,
  remote_modified_at timestamp,
  synced_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT tickets_org_external UNIQUE (organization_id, external_id)
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  product text NOT NULL,
  seats integer NOT NULL DEFAULT 0,
  used integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  renewal_date date,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provisioning_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  op text NOT NULL,
  subject text NOT NULL,
  system text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  received_at timestamp NOT NULL DEFAULT now()
);

-- Ingestion outbox (customer-submitted requests → forwarded to vendors).
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id text NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  external_ref text,
  submitted_by text NOT NULL,
  approver text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT requests_org_idempotency UNIQUE (organization_id, idempotency_key)
);
