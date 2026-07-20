// Seed the Vitops demo tenant into the local dev DB (./.pglite by default, or
// DATABASE_URL). Idempotent-ish: safe to re-run. Then runs an initial sync so
// the dashboard is populated. Usage: `node ./scripts/seed.ts`.
import { eq } from 'drizzle-orm';
import { applyMigrations } from '../src/lib/db/migrate.ts';
import { member, organization, user as userTable } from '../src/lib/db/schema/index.ts';
import { getEnv } from '../src/lib/env.ts';
import { provisionOrg } from '../src/lib/provision.ts';
import { getServer } from '../src/lib/runtime.ts';
import { runSync } from '../src/workers/sync.ts';

process.env.BETTER_AUTH_SECRET ??= 'dev-insecure-secret-change-me-please-32b';

const EMAIL = 'alex@vitops.dev';
const PASSWORD = 'password123';
const ORG_ID = 'vitops';

const env = getEnv({});
const server = getServer(env);
const { db } = server.bundle;

console.log(`[seed] migrating ${server.bundle.kind} …`);
await applyMigrations(server.bundle);

// 1. User (Better-Auth handles password hashing + account row).
let userId: string | undefined;
try {
  const res = await server.auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: 'Alex Gagnon' },
  });
  userId = (res as { user?: { id: string } }).user?.id;
  console.log('[seed] created user', EMAIL);
} catch {
  console.log('[seed] user already exists, reusing');
}
if (!userId) {
  const rows = await db.select({ id: userTable.id }).from(userTable).where(eq(userTable.email, EMAIL)).limit(1);
  userId = rows[0]?.id;
}
if (!userId) throw new Error('could not resolve seeded user id');

// 2. Organization + membership (owner client; our tables back the org plugin).
await db
  .insert(organization)
  .values({ id: ORG_ID, name: 'Vitops', slug: 'vitops' })
  .onConflictDoNothing();
const existingMember = await db
  .select({ id: member.id })
  .from(member)
  .where(eq(member.organizationId, ORG_ID));
if (!existingMember.some(() => true)) {
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: ORG_ID,
    userId,
    role: 'owner',
  });
}

// 3. Plan (enterprise → all modules) + a couple of sites + provider connections.
await provisionOrg(env, ORG_ID, { plan: 'enterprise', siteName: 'Vitops', siteDomain: 'getvitops.com' });

// 4. Populate the caches.
console.log('[seed] running initial sync …');
const units = await runSync(env, { inline: true });
console.log(`[seed] synced ${units.length} provider units`);

await server.bundle.close();
console.log(`\n[seed] done. Log in at /login with:\n  email:    ${EMAIL}\n  password: ${PASSWORD}\n`);
