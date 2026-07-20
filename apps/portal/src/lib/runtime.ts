// Process-level server context: ONE long-lived Postgres pool + Auth instance,
// cached and reused across requests. This is a normal Node server, so the pool
// persists for the process lifetime (the Workers "I/O can't cross requests"
// constraint is gone). Falls back to a file-backed PGlite dev DB when no
// DATABASE_URL is present (zero-infra local dev).
import { createAuth, type Auth } from './auth.ts';
import { createDb, type DbBundle } from './db/client.ts';
import type { Env } from './env.ts';

export interface Server {
  bundle: DbBundle;
  auth: Auth;
}

let cached: { key: string; server: Server } | null = null;

export function getServer(env: Env): Server {
  const key = env.DATABASE_URL ?? 'pglite:./.pglite';
  if (cached && cached.key === key) return cached.server;

  const bundle = createDb(env.DATABASE_URL ? { url: env.DATABASE_URL } : { pglite: './.pglite' });
  const server: Server = { bundle, auth: createAuth(bundle.db, env) };
  cached = { key, server };
  return server;
}
