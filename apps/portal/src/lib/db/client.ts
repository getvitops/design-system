// THE single runtime-specific module — the portability seam.
//
//   • Deployed / real dev: postgres.js over a direct DATABASE_URL (any
//     Canadian-sovereign Postgres — self-host or managed). A normal long-lived
//     pool, since this is a persistent Node process.
//   • Tests / zero-infra dev: PGlite (WASM Postgres) — real Postgres semantics
//     (roles, RLS, policies), so RLS tests are meaningful.
//
// The returned `db` is typed as the common `PgDatabase<…, schema>` so callers
// (queries, withOrgScope) don't care which driver backs it. `exec` runs raw
// multi-statement SQL (migrations) the right way per driver.
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Schema = typeof schema;
export type PortalDb = PgDatabase<any, Schema, any>;

export interface DbBundle {
  db: PortalDb;
  /** Run raw, possibly multi-statement SQL (used by the migrator). */
  exec: (sql: string) => Promise<unknown>;
  close: () => Promise<void>;
  kind: 'postgres' | 'pglite';
}

export interface CreateDbOptions {
  /** Direct Postgres URL (Node server / any Canadian-sovereign host). */
  url?: string;
  /** PGlite data dir; ':memory:'/undefined → in-memory (tests). */
  pglite?: string;
}

function createPostgres(connectionString: string): DbBundle {
  // A normal long-lived pool: one Node process reuses it for the whole lifetime.
  const sql = postgres(connectionString, { max: 10, idle_timeout: 30 });
  return {
    db: drizzlePostgres(sql, { schema }) as unknown as PortalDb,
    exec: (raw) => sql.unsafe(raw).simple(),
    close: () => sql.end({ timeout: 5 }),
    kind: 'postgres',
  };
}

function createPglite(dataDir?: string): DbBundle {
  const pg = new PGlite(dataDir && dataDir !== ':memory:' ? dataDir : undefined);
  return {
    db: drizzlePglite(pg, { schema }) as unknown as PortalDb,
    exec: (raw) => pg.exec(raw),
    close: () => pg.close(),
    kind: 'pglite',
  };
}

/** Resolve a DB bundle: real Postgres when a URL is given, else PGlite. */
export function createDb(opts: CreateDbOptions = {}): DbBundle {
  if (opts.url) return createPostgres(opts.url);
  return createPglite(opts.pglite);
}
