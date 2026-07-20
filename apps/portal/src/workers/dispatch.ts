// Outbox forwarder: claims `pending` requests and pushes each to its vendor via
// a write adapter, flipping status to sent/failed. Uses the OWNER client (sees
// all orgs). The claim is atomic (`FOR UPDATE SKIP LOCKED`) so multiple worker
// instances never double-send. Retries up to MAX_ATTEMPTS, then `failed`.
import { and, eq, sql } from 'drizzle-orm';
import { unseal } from '../lib/crypto.ts';
import { providerConnections, requests } from '../lib/db/schema/index.ts';
import type { Env } from '../lib/env.ts';
import { connectionProviderFor, getWriteProvider } from '../lib/providers/write.ts';
import type { SubmittedRequest, SyncCtx } from '../lib/providers/types.ts';
import { getServer } from '../lib/runtime.ts';

const MAX_ATTEMPTS = 5;

interface ClaimedRow {
  id: string;
  organization_id: string;
  type: string;
  payload: Record<string, unknown>;
  submitted_by: string;
  attempts: number;
}

export async function dispatchPending(
  env: Env,
  limit = 20,
): Promise<{ processed: number; sent: number; failed: number }> {
  const { db } = getServer(env).bundle;

  // Atomically claim a batch: pending → sending (attempts++).
  const claimed = await db.execute(sql`
    UPDATE requests SET status = 'sending', attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM requests WHERE status = 'pending'
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT ${limit}
    )
    RETURNING id, organization_id, type, payload, submitted_by, attempts
  `);
  const rows = normalizeRows(claimed) as ClaimedRow[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const provider = getWriteProvider(row.type);
    try {
      if (!provider) throw new Error(`no write adapter for type '${row.type}'`);
      const ctx = await ctxFor(env, db, row.organization_id, row.type);
      const req: SubmittedRequest = {
        id: row.id,
        organizationId: row.organization_id,
        type: row.type,
        payload: row.payload ?? {},
        submittedBy: row.submitted_by,
      };
      const { externalRef } = await provider.submit(ctx, req);
      await db
        .update(requests)
        .set({ status: 'sent', externalRef, lastError: null, updatedAt: new Date() })
        .where(eq(requests.id, row.id));
      sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const giveUp = row.attempts >= MAX_ATTEMPTS;
      await db
        .update(requests)
        .set({ status: giveUp ? 'failed' : 'pending', lastError: msg, updatedAt: new Date() })
        .where(eq(requests.id, row.id));
      if (giveUp) failed++;
      console.error(`[dispatch] ${row.type}/${row.id} attempt ${row.attempts} failed: ${msg}`);
    }
  }
  return { processed: rows.length, sent, failed };
}

async function ctxFor(
  env: Env,
  db: ReturnType<typeof getServer>['bundle']['db'],
  organizationId: string,
  type: string,
): Promise<SyncCtx> {
  const provider = connectionProviderFor(type);
  if (!provider) return { env };
  const rows = await db
    .select()
    .from(providerConnections)
    .where(
      and(
        eq(providerConnections.organizationId, organizationId),
        eq(providerConnections.provider, provider),
      ),
    )
    .limit(1);
  const conn = rows[0];
  const secret = conn?.sealedSecret ? await unseal(env, conn.sealedSecret) : undefined;
  return { env, secret, externalOrgId: conn?.externalOrgId };
}

// drizzle-orm/postgres-js returns a RowList (array); drizzle-orm/pglite returns { rows }.
function normalizeRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  const r = result as { rows?: unknown[] };
  return r.rows ?? [];
}
