// Refreshes the DEV D1 database (and, optionally, the dev media bucket) from
// PRODUCTION. One direction only: prod is the source of truth for content, dev
// is a disposable copy used to rehearse code and schema changes against real
// data (EmDash's own "rehearse changes on a preview environment" pattern).
//
//   node scripts/refresh-dev.mjs          # wipe dev D1, import prod's export
//   node scripts/refresh-dev.mjs --dry    # run every check, change nothing
//
// Names come from wrangler.jsonc, the same way scripts/build-dev-wrangler.mjs
// derives them, so the two can't disagree about which resources are "dev":
//
//   D1      <database_name>      → <database_name>-dev   (id from $DEV_D1_ID)
//   R2      <bucket_name>        → <bucket_name>-dev
//
// SAFETY, in the order it is enforced:
//   1. $DEV_D1_ID must be set, and `wrangler d1 info <name>-dev` must report
//      that same id. A name that resolves to a different database than the id
//      we were told about means one of the two is stale.
//   2. The dev id must differ from prod's. This script DROPS every table in
//      the target, so pointing it at prod would erase production — the exact
//      thing the dev/prod split exists to prevent.
//   Both checks run before the first write, and `--dry` stops after them.
//
// Not copied: anything outside D1/R2. Sessions live in the Astro session store
// (KV), not D1, so nothing is carried over there. The preview-link secret IS in
// D1 — set EMDASH_PREVIEW_SECRET on the dev worker so prod preview links don't
// verify on dev (see SETUP.html).
//
// Media is copied only when R2 S3 credentials are present, because wrangler has
// no bucket-to-bucket sync and rclone needs the S3 API:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID
// Without them the database is refreshed and media is left alone, with a note —
// dev then shows broken images for anything uploaded since the last copy.
//
// KNOWN LIMIT: `wrangler d1 export` does not support virtual tables, so an FTS5
// search table breaks the export. EmDash rebuilds its search index on the first
// search call, so if an export ever fails on one, drop it from prod's schema
// dump rather than working around it here.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Pull the D1 database and R2 bucket names out of a wrangler.jsonc source.
 * Regex rather than a JSONC parser: the template carries no parser, the file
 * is ours, and these two keys are the only thing read. `//` comment lines are
 * stripped first so a commented-out example block can't be picked up.
 */
export function parseBindingNames(jsonc) {
  const code = jsonc
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
  const database = /"database_name"\s*:\s*"([^"]+)"/.exec(code)?.[1];
  const bucket = /"bucket_name"\s*:\s*"([^"]+)"/.exec(code)?.[1];
  return { database, bucket };
}

/**
 * Throws unless it is safe to wipe `devId`'s database. Pure, so the one check
 * that stands between this script and production is asserted in a test.
 */
export function assertSafeTarget({ devName, devId, devReportedId, prodId }) {
  if (!devId) throw new Error('DEV_D1_ID is not set.');
  if (!devName.endsWith('-dev')) throw new Error(`Refusing: "${devName}" is not a -dev database.`);
  if (devReportedId !== devId) {
    throw new Error(
      `DEV_D1_ID (${devId}) does not match "${devName}" (${devReportedId}). One of them is stale.`,
    );
  }
  if (devId === prodId) throw new Error('Refusing: the dev database id is the production id.');
}

/**
 * SQL that empties a database: views, then virtual tables, then ordinary
 * tables. `rows` is `{ name, type, sql }` from sqlite_master. A virtual table
 * owns shadow tables named `<virtual>_*`, which SQLite refuses to drop on their
 * own and removes with the parent, so those are skipped.
 */
export function dropStatements(rows) {
  const virtual = rows.filter((r) => /^CREATE VIRTUAL TABLE/i.test(r.sql ?? ''));
  const isShadow = (name) => virtual.some((v) => name.startsWith(`${v.name}_`));
  const tables = rows.filter(
    (r) => r.type === 'table' && !virtual.includes(r) && !isShadow(r.name),
  );
  const q = (name) => `"${name.replaceAll('"', '""')}"`;
  return [
    'PRAGMA defer_foreign_keys = true;',
    ...rows.filter((r) => r.type === 'view').map((r) => `DROP VIEW IF EXISTS ${q(r.name)};`),
    ...virtual.map((r) => `DROP TABLE IF EXISTS ${q(r.name)};`),
    ...tables.map((r) => `DROP TABLE IF EXISTS ${q(r.name)};`),
  ];
}

const wrangler = (args, opts = {}) =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], { encoding: 'utf8', ...opts });

const d1Id = (name) => JSON.parse(wrangler(['d1', 'info', name, '--json'])).uuid;

function main() {
  const dry = process.argv.includes('--dry');
  const wranglerConfig = 'wrangler.jsonc';
  if (!existsSync(wranglerConfig))
    throw new Error(`Run from the project root (no ${wranglerConfig}).`);

  const { database, bucket } = parseBindingNames(readFileSync(wranglerConfig, 'utf8'));
  if (!database) throw new Error(`No D1 database_name found in ${wranglerConfig}.`);
  const devDatabase = `${database}-dev`;

  assertSafeTarget({
    devName: devDatabase,
    devId: process.env.DEV_D1_ID,
    devReportedId: d1Id(devDatabase),
    prodId: d1Id(database),
  });
  console.log(`OK to refresh ${devDatabase} from ${database}.`);

  const dir = mkdtempSync(join(tmpdir(), 'refresh-dev-'));
  const dump = join(dir, 'prod.sql');
  const wipe = join(dir, 'wipe.sql');

  const master = JSON.parse(
    wrangler([
      'd1',
      'execute',
      devDatabase,
      '--remote',
      '--json',
      '--command',
      "SELECT name, type, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\' AND type IN ('table','view')",
    ]),
  )[0].results;
  writeFileSync(wipe, `${dropStatements(master).join('\n')}\n`);

  if (dry) {
    console.log(`--dry: would drop ${master.length} objects from ${devDatabase} and import prod.`);
    console.log(
      bucket ? `--dry: would copy ${bucket} → ${bucket}-dev.` : '--dry: no R2 bucket found.',
    );
    return;
  }

  wrangler(['d1', 'export', database, '--remote', '--output', dump], { stdio: 'inherit' });
  wrangler(['d1', 'execute', devDatabase, '--remote', '--file', wipe], { stdio: 'inherit' });
  wrangler(['d1', 'execute', devDatabase, '--remote', '--file', dump], { stdio: 'inherit' });
  console.log(`Imported ${database} into ${devDatabase}.`);

  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID } = process.env;
  if (!bucket) return;
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CLOUDFLARE_ACCOUNT_ID) {
    console.log(
      `Skipped media: R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY not set, ${bucket}-dev left as is.`,
    );
    return;
  }
  // Credentials ride rclone's env-var config, not the command line, so the
  // secret never appears in a process listing.
  const env = {
    ...process.env,
    RCLONE_CONFIG_R2_TYPE: 's3',
    RCLONE_CONFIG_R2_PROVIDER: 'Cloudflare',
    RCLONE_CONFIG_R2_ENDPOINT: `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    RCLONE_CONFIG_R2_ACCESS_KEY_ID: R2_ACCESS_KEY_ID,
    RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY,
  };
  // `sync`, not `copy`: media deleted from prod should disappear from dev too.
  execFileSync('rclone', ['sync', `R2:${bucket}`, `R2:${bucket}-dev`], { env, stdio: 'inherit' });
  console.log(`Synced ${bucket} → ${bucket}-dev.`);
}

// Importable for tests without running; executed when invoked as a script.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    process.exit(1);
  }
}
