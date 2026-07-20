// Better-Auth instance (email+password + organization multi-tenancy), bound to
// the OWNER Drizzle client — auth manages its own tables outside RLS. Created via
// a factory (not a module singleton) because the DB connection depends on the
// per-deployment env; runtime.ts caches one instance per isolate.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins';
import type { PortalDb } from './db/client.ts';
import * as schema from './db/schema/index.ts';
import type { Env } from './env.ts';

export type Auth = ReturnType<typeof betterAuth>;

export function createAuth(db: PortalDb, env: Env): Auth {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: false }),
    secret: env.BETTER_AUTH_SECRET ?? 'dev-insecure-secret-change-me',
    baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:4321',
    // Dev convenience: accept localhost on the common Astro dev ports. In prod,
    // set BETTER_AUTH_URL and rely on it as the single trusted origin.
    trustedOrigins: ['http://localhost:4321', 'http://localhost:4322', 'http://localhost:4323'],
    emailAndPassword: { enabled: true },
    plugins: [
      organization({
        // On login, make the user's first membership the active tenant so the
        // dashboard has an org to scope to without an extra click.
        // (UI still offers an explicit org switcher.)
      }),
    ],
  });
}
