// The heart of tenant isolation. Every tenant-table read/write MUST go through
// here. Inside one transaction it:
//   1. downgrades to the non-owner `authenticated` role (RLS applies to it)
//   2. sets app.organization_id (transaction-scoped → pool/Hyperdrive safe)
// Both reset on COMMIT/ROLLBACK, so nothing leaks to the next pooled borrower.
//
// The RLS policy reads current_setting('app.organization_id') WITHOUT the
// missing-ok flag, so a query that reaches a tenant table without a scope here
// ERRORS rather than silently returning everything — fail-closed.
import { sql } from 'drizzle-orm';
import type { PortalDb } from './client.ts';

// The tx handed to `fn` is a drizzle transaction; typed loosely to stay
// driver-agnostic across postgres.js and PGlite.
export type ScopedTx = Parameters<Parameters<PortalDb['transaction']>[0]>[0];

export async function withOrgScope<T>(
  db: PortalDb,
  organizationId: string,
  fn: (tx: ScopedTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Role name is an identifier — cannot be bound; it's a fixed literal.
    await tx.execute(sql`SET LOCAL ROLE authenticated`);
    // Value is bound safely; `true` = is_local (transaction-scoped).
    await tx.execute(sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
    return fn(tx);
  });
}
