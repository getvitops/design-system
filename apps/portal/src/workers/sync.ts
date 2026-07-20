// Background sync engine. `runSync` enumerates (org × enabled provider),
// capability-filters, and either enqueues per-unit messages (Workers Queue) or
// runs inline (dev / no queue). `processConnection` fetches from one provider and
// upserts into the org-stamped cache tables via the OWNER client (RLS-bypass).
//
// Wiring on Cloudflare: export `scheduled` (calls runSync) and `queue` (calls
// handleQueueBatch) from the Worker entry (adapter workerEntryPoint). In dev the
// /api/dev/sync route calls runSync({ inline: true }) so data populates without
// the CF cron/queue plumbing.
import { eq, sql } from 'drizzle-orm';
import { capabilitiesFor } from '../lib/capabilities.ts';
import { unseal } from '../lib/crypto.ts';
import type { Env } from '../lib/env.ts';
import { getServer, type Server } from '../lib/runtime.ts';
import {
  analyticsDaily,
  licenses,
  organizationsExt,
  providerConnections,
  provisioningOperations,
  rumMetrics,
  sites as sitesTable,
  tickets,
  trafficEvents,
} from '../lib/db/schema/index.ts';
import { getProvider } from '../lib/providers/registry.ts';
import type { DateRange, SiteRef, SyncCtx } from '../lib/providers/types.ts';

const CLARITY_MIN_INTERVAL_MS = 8 * 60 * 60 * 1000; // ≤3 pulls/day → respects the 10/day cap

interface Unit {
  organizationId: string;
  provider: string;
}

function lastNDays(n: number): DateRange {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (n - 1));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/** Build the work-list and dispatch (queue or inline). */
export async function runSync(env: Env, opts: { inline?: boolean } = {}): Promise<Unit[]> {
  const server = getServer(env);
  const { db } = server.bundle;
  const orgs = await db
    .select({ organizationId: organizationsExt.organizationId, plan: organizationsExt.plan })
    .from(organizationsExt);

  const units: Unit[] = [];
  for (const org of orgs) {
    const caps = capabilitiesFor(org.plan);
    const conns = await db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.organizationId, org.organizationId));
    for (const conn of conns) {
      const provider = getProvider(conn.provider);
      if (!provider || !caps.has(provider.capability)) continue;
      if (conn.provider === 'clarity' && recentlySynced(conn.lastSyncedAt, CLARITY_MIN_INTERVAL_MS))
        continue;
      units.push({ organizationId: org.organizationId, provider: conn.provider });
    }
  }

  if (env.SYNC_QUEUE && !opts.inline) {
    // Chunk to stay within sendBatch limits.
    for (let i = 0; i < units.length; i += 100) {
      await env.SYNC_QUEUE.sendBatch(units.slice(i, i + 100).map((body) => ({ body })));
    }
  } else {
    for (const unit of units) await processConnection(env, unit.organizationId, unit.provider);
  }
  return units;
}

function recentlySynced(last: Date | null, withinMs: number): boolean {
  return !!last && Date.now() - new Date(last).getTime() < withinMs;
}

/** Fetch one provider for one org and upsert into the cache tables. */
export async function processConnection(
  env: Env,
  organizationId: string,
  providerId: string,
): Promise<void> {
  const server = getServer(env);
  const { db } = server.bundle;
  const provider = getProvider(providerId);
  if (!provider) return;

  const [conn] = await db
    .select()
    .from(providerConnections)
    .where(eq(providerConnections.organizationId, organizationId))
    .limit(100)
    .then((rows) => rows.filter((r) => r.provider === providerId));
  if (!conn) return;

  const secret = conn.sealedSecret ? await unseal(env, conn.sealedSecret) : undefined;
  const ctx: SyncCtx = { env, secret, externalOrgId: conn.externalOrgId };

  try {
    if (provider.capability === 'analytics') {
      const orgSites = await db
        .select()
        .from(sitesTable)
        .where(eq(sitesTable.organizationId, organizationId));
      const range = lastNDays(14);
      for (const s of orgSites) {
        const site: SiteRef = {
          id: s.id,
          organizationId,
          domain: s.domain,
          providerRefs: s.providerRefs ?? {},
        };
        const bundle = await provider.fetchAnalytics(ctx, site, range);
        await upsertAnalytics(server, organizationId, s.id, providerId, bundle);
      }
    } else if (provider.capability === 'helpdesk') {
      const rows = await provider.fetchTickets(ctx);
      await upsertTickets(server, organizationId, rows);
    } else if (provider.capability === 'licensing') {
      const rows = await provider.fetchLicenses(ctx);
      await replaceLicenses(server, organizationId, rows);
    } else if (provider.capability === 'scim') {
      const rows = await provider.fetchProvisioning(ctx);
      await replaceProvisioning(server, organizationId, rows);
    }
    await db
      .update(providerConnections)
      .set({ lastSyncedAt: new Date(), status: 'connected' })
      .where(eq(providerConnections.id, conn.id));
  } catch (err) {
    console.error(`[sync] ${providerId}/${organizationId} failed:`, err);
    await db
      .update(providerConnections)
      .set({ status: 'error' })
      .where(eq(providerConnections.id, conn.id));
  }
}

export async function handleQueueBatch(
  batch: { messages: { body: Unit; ack: () => void; retry: () => void }[] },
  env: Env,
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      await processConnection(env, msg.body.organizationId, msg.body.provider);
      msg.ack();
    } catch {
      msg.retry();
    }
  }
}

// ── Upserts (owner client; stamps organization_id explicitly) ────────────────
async function upsertAnalytics(
  server: Server,
  organizationId: string,
  siteId: string,
  provider: string,
  bundle: { analytics: unknown[]; traffic: unknown[]; rum: unknown[] },
): Promise<void> {
  const { db } = server.bundle;
  const a = bundle.analytics as import('../lib/providers/types.ts').AnalyticsRow[];
  const t = bundle.traffic as import('../lib/providers/types.ts').TrafficRow[];
  const r = bundle.rum as import('../lib/providers/types.ts').RumRow[];

  if (a.length) {
    await db
      .insert(analyticsDaily)
      .values(a.map((row) => ({ organizationId, siteId, ...row })))
      .onConflictDoUpdate({
        target: [analyticsDaily.siteId, analyticsDaily.provider, analyticsDaily.date],
        set: {
          requests: sql`excluded.requests`,
          pageViews: sql`excluded.page_views`,
          visits: sql`excluded.visits`,
          conversions: sql`excluded.conversions`,
          formSubmissions: sql`excluded.form_submissions`,
        },
      });
  }
  if (t.length) {
    await db
      .insert(trafficEvents)
      .values(t.map((row) => ({ organizationId, siteId, ...row, bucketTs: new Date(row.bucketTs) })))
      .onConflictDoUpdate({
        target: [trafficEvents.siteId, trafficEvents.bucketTs],
        set: {
          human: sql`excluded.human`,
          ai: sql`excluded.ai`,
          bot: sql`excluded.bot`,
          latencyP50Ms: sql`excluded.latency_p50_ms`,
          latencyP95Ms: sql`excluded.latency_p95_ms`,
          failures: sql`excluded.failures`,
        },
      });
  }
  if (r.length) {
    await db
      .insert(rumMetrics)
      .values(r.map((row) => ({ organizationId, siteId, ...row })))
      .onConflictDoUpdate({
        target: [rumMetrics.siteId, rumMetrics.date],
        set: {
          lcpMs: sql`excluded.lcp_ms`,
          inpMs: sql`excluded.inp_ms`,
          clsX1000: sql`excluded.cls_x1000`,
          ttfbMs: sql`excluded.ttfb_ms`,
          sampleCount: sql`excluded.sample_count`,
        },
      });
  }
}

async function upsertTickets(
  server: Server,
  organizationId: string,
  rows: import('../lib/providers/types.ts').TicketRow[],
): Promise<void> {
  if (!rows.length) return;
  await server.bundle.db
    .insert(tickets)
    .values(
      rows.map((t) => ({
        organizationId,
        externalId: t.externalId,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        remoteCreatedAt: t.remoteCreatedAt ? new Date(t.remoteCreatedAt) : null,
        remoteModifiedAt: t.remoteModifiedAt ? new Date(t.remoteModifiedAt) : null,
        syncedAt: new Date(),
      })),
    )
    .onConflictDoUpdate({
      target: [tickets.organizationId, tickets.externalId],
      set: {
        subject: sql`excluded.subject`,
        status: sql`excluded.status`,
        priority: sql`excluded.priority`,
        assignee: sql`excluded.assignee`,
        remoteModifiedAt: sql`excluded.remote_modified_at`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

async function replaceLicenses(
  server: Server,
  organizationId: string,
  rows: import('../lib/providers/types.ts').LicenseRow[],
): Promise<void> {
  const { db } = server.bundle;
  await db.delete(licenses).where(eq(licenses.organizationId, organizationId));
  if (rows.length)
    await db.insert(licenses).values(
      rows.map((l) => ({
        organizationId,
        product: l.product,
        seats: l.seats,
        used: l.used,
        status: l.status,
        renewalDate: l.renewalDate ?? null,
      })),
    );
}

async function replaceProvisioning(
  server: Server,
  organizationId: string,
  rows: import('../lib/providers/types.ts').ProvisioningRow[],
): Promise<void> {
  const { db } = server.bundle;
  await db.delete(provisioningOperations).where(eq(provisioningOperations.organizationId, organizationId));
  if (rows.length)
    await db.insert(provisioningOperations).values(
      rows.map((p) => ({
        organizationId,
        op: p.op,
        subject: p.subject,
        system: p.system,
        status: p.status,
        payload: p.payload ?? null,
        receivedAt: p.receivedAt ? new Date(p.receivedAt) : new Date(),
      })),
    );
}
