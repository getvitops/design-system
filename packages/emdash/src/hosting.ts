/**
 * Hosting seam — one call in astro.config.mjs resolves the adapter + EmDash
 * database/storage for the chosen hosting target, so a site can start on
 * Cloudflare and move to a Node host (VPS / docker-compose / k8s) — or back —
 * by flipping a single value instead of rewiring its config:
 *
 * ```js
 * import { vitopsEmdash, vitopsHosting } from '@getvitops/emdash';
 * const { adapter, database, storage } = await vitopsHosting();
 * export default defineConfig({
 *   output: 'server',
 *   adapter,
 *   integrations: [react(), emdash({ database, storage, plugins: [vitopsEmdash()] })],
 * });
 * ```
 *
 * Targets:
 * - `'cloudflare'` (default) — `@astrojs/cloudflare` + D1/R2 bindings.
 *   Needs `@astrojs/cloudflare` and `@emdash-cms/cloudflare` installed.
 * - `'node'` — `@astrojs/node` (standalone) + SQLite file + local uploads.
 *   Needs `@astrojs/node` and `better-sqlite3` installed. Scheduled publishing
 *   runs in-process on Node (no worker/cron trigger needed). For production,
 *   move storage to S3-compatible (`s3()` from `emdash/astro`) and/or the
 *   database to Postgres (`postgres()` from `emdash/db`) via `options.node`.
 *
 * The adapter packages are optional peer dependencies, resolved lazily — a
 * site only installs the stack for the target it uses. Content lives in the
 * database and media in the storage backend, so switching hosts is a data
 * migration (D1 export / EmDash seed round-trip + media copy), not a rewrite.
 */
import type { AstroIntegration } from 'astro';

export type HostingTarget = 'cloudflare' | 'node';

const TARGETS: HostingTarget[] = ['cloudflare', 'node'];

export interface VitopsHostingOptions {
  /** Hosting target. Overridden by the `HOSTING` env var. Default 'cloudflare'. */
  target?: HostingTarget;
  cloudflare?: {
    /** D1 binding name in wrangler config (default 'DB'). */
    dbBinding?: string;
    /** R2 binding name in wrangler config (default 'MEDIA'). */
    mediaBinding?: string;
    /** D1 Sessions API read-replication mode (default 'auto'). */
    session?: string;
  };
  node?: {
    /** SQLite URL (default `DATABASE_PATH` env or 'file:./data/emdash.db'). */
    databaseUrl?: string;
    /** Full database descriptor override (e.g. postgres() from 'emdash/db'). */
    database?: unknown;
    /** Local uploads directory (default './data/uploads'). */
    uploadsDir?: string;
    /** Full storage descriptor override (e.g. s3() from 'emdash/astro'). */
    storage?: unknown;
  };
}

export interface VitopsHosting {
  target: HostingTarget;
  adapter: AstroIntegration;
  /** EmDash database descriptor — pass to emdash({ database }). */
  database: unknown;
  /** EmDash storage descriptor — pass to emdash({ storage }). */
  storage: unknown;
}

/**
 * Import an optional hosting dependency. The specifier is passed as a
 * variable so bundlers/type-checkers leave it as a plain runtime import —
 * these packages are optional peers a consumer installs per target.
 */
async function importFor(target: HostingTarget, specifier: string, install: string) {
  try {
    return await import(/* @vite-ignore */ specifier);
  } catch (cause) {
    throw new Error(
      `[vitops] hosting target '${target}' needs ${specifier}, which isn't installed.\n` +
        `Install the ${target} stack first:  ${install}`,
      { cause },
    );
  }
}

export async function vitopsHosting(options: VitopsHostingOptions = {}): Promise<VitopsHosting> {
  const target = (process.env.HOSTING as HostingTarget) || options.target || 'cloudflare';

  if (target === 'cloudflare') {
    const install = 'pnpm add @astrojs/cloudflare @emdash-cms/cloudflare';
    const cf = options.cloudflare ?? {};
    const { default: cloudflare } = await importFor(target, '@astrojs/cloudflare', install);
    const { d1, r2 } = await importFor(target, '@emdash-cms/cloudflare', install);
    return {
      target,
      adapter: cloudflare(),
      database: d1({ binding: cf.dbBinding ?? 'DB', session: cf.session ?? 'auto' }),
      storage: r2({ binding: cf.mediaBinding ?? 'MEDIA' }),
    };
  }

  if (target === 'node') {
    const install = 'pnpm add @astrojs/node better-sqlite3';
    const opts = options.node ?? {};
    const { default: node } = await importFor(target, '@astrojs/node', install);
    // Required peer of this package, so always present — but still routed
    // through importFor: a literal import('emdash/db') would be statically
    // analyzable, and bundling the plugin runtime would drag EmDash's whole
    // integration graph into the site's server/client bundles.
    const { sqlite } = await importFor(target, 'emdash/db', install);
    const { local } = await importFor(target, 'emdash/astro', install);
    const { mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');

    const databaseUrl = opts.databaseUrl ?? process.env.DATABASE_PATH ?? 'file:./data/emdash.db';
    const uploadsDir = opts.uploadsDir ?? './data/uploads';
    // better-sqlite3 refuses to create parent directories, so make sure the
    // defaults exist (runs at astro config load — dev and build). A deployed
    // host still needs the data directory mounted/persisted as a volume.
    if (!opts.database && databaseUrl.startsWith('file:')) {
      mkdirSync(dirname(databaseUrl.slice('file:'.length)), { recursive: true });
    }
    if (!opts.storage) mkdirSync(uploadsDir, { recursive: true });

    return {
      target,
      adapter: node({ mode: 'standalone' }),
      database: opts.database ?? sqlite({ url: databaseUrl }),
      storage: opts.storage ?? local({ directory: uploadsDir, baseUrl: '/_emdash/api/media/file' }),
    };
  }

  throw new Error(
    `[vitops] unknown hosting target '${target}' (from ${process.env.HOSTING ? 'HOSTING env var' : 'options.target'}). ` +
      `Valid targets: ${TARGETS.join(', ')}.`,
  );
}
