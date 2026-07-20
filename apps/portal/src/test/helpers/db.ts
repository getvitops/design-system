// Fresh in-memory PGlite for a test: migrate, then seed two orgs (A, B) as the
// OWNER (PGlite's default superuser bypasses RLS), so tests can then prove the
// `authenticated`-role isolation via withOrgScope().
import { createDb, type DbBundle } from '../../lib/db/client.ts';
import { applyMigrations } from '../../lib/db/migrate.ts';
import { licenses, organization, organizationsExt, sites } from '../../lib/db/schema/index.ts';

export interface SeededDb {
  bundle: DbBundle;
  db: DbBundle['db'];
}

export async function freshSeededDb(): Promise<SeededDb> {
  const bundle = createDb({ pglite: ':memory:' });
  await applyMigrations(bundle);
  const { db } = bundle;

  for (const org of ['org_a', 'org_b'] as const) {
    await db.insert(organization).values({ id: org, name: org.toUpperCase() });
    await db
      .insert(organizationsExt)
      .values({ organizationId: org, plan: org === 'org_a' ? 'enterprise' : 'starter' });
    await db.insert(sites).values({ organizationId: org, name: `${org} site`, domain: `${org}.test` });
    await db
      .insert(licenses)
      .values({ organizationId: org, product: `${org}-product`, seats: 10, used: 3 });
  }

  return { bundle, db };
}
