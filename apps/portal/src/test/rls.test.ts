// RLS isolation — the load-bearing security proof for the multi-tenant portal.
// Runs real Postgres (PGlite) with the same migrations that ship: after
// `SET LOCAL ROLE authenticated`, policies enforce exactly as on Neon.
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { licenses, requests } from '../lib/db/schema/index.ts';
import { withOrgScope } from '../lib/db/scope.ts';
import { freshSeededDb, type SeededDb } from './helpers/db.ts';

let seeded: SeededDb;

beforeEach(async () => {
  seeded = await freshSeededDb();
});
afterEach(async () => {
  await seeded.bundle.close();
});

describe('RLS tenant isolation', () => {
  it('scoped read returns only the active org rows', async () => {
    const { db } = seeded;
    const a = await withOrgScope(db, 'org_a', (tx) => tx.select().from(licenses));
    const b = await withOrgScope(db, 'org_b', (tx) => tx.select().from(licenses));

    expect(a).toHaveLength(1);
    expect(a[0]?.organizationId).toBe('org_a');
    expect(b).toHaveLength(1);
    expect(b[0]?.organizationId).toBe('org_b');
  });

  it('cannot read another org rows even when querying for them', async () => {
    const { db } = seeded;
    const rows = await withOrgScope(db, 'org_b', (tx) =>
      tx.select().from(licenses).where(sql`organization_id = 'org_a'`),
    );
    expect(rows).toHaveLength(0);
  });

  it('INSERT with a mismatched organization_id is rejected by WITH CHECK', async () => {
    const { db } = seeded;
    await expect(
      withOrgScope(db, 'org_a', (tx) =>
        tx.insert(licenses).values({ organizationId: 'org_b', product: 'smuggled', seats: 1 }),
      ),
    ).rejects.toThrow();

    // And nothing leaked in: org_b still has exactly its seeded row.
    const b = await withOrgScope(db, 'org_b', (tx) => tx.select().from(licenses));
    expect(b).toHaveLength(1);
    expect(b[0]?.product).toBe('org_b-product');
  });

  it('fail-closed: an authenticated query without a scope leaks nothing', async () => {
    const { db } = seeded;
    // Manually enter the restricted role WITHOUT set_config — the policy's
    // current_setting() has no missing-ok flag, so this must error, not leak.
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE authenticated`);
        return tx.select().from(licenses);
      }),
    ).rejects.toThrow();
  });

  it('ingestion outbox (requests) is org-isolated', async () => {
    const { db } = seeded;
    await withOrgScope(db, 'org_a', (tx) =>
      tx.insert(requests).values({
        organizationId: 'org_a',
        type: 'ticket',
        payload: { subject: 'Login issue' },
        idempotencyKey: 'k1',
        submittedBy: 'alex@org-a',
      }),
    );
    const aRows = await withOrgScope(db, 'org_a', (tx) => tx.select().from(requests));
    const bRows = await withOrgScope(db, 'org_b', (tx) => tx.select().from(requests));
    expect(aRows).toHaveLength(1);
    expect(aRows[0]?.status).toBe('pending');
    expect(bRows).toHaveLength(0);
  });

  it('owner (no scope) sees all orgs — the sync worker / auth path', async () => {
    // Default role is the table owner → bypasses RLS by ownership (no FORCE).
    const all = await seeded.db.select().from(licenses);
    expect(all.length).toBe(2);
    expect(new Set(all.map((r) => r.organizationId))).toEqual(new Set(['org_a', 'org_b']));
  });
});
