// Pre-build step: load production's EmDash content into the LOCAL D1 the build
// prerenders from.
//
// Why this exists: `src/pages/index.astro` and `[...slug].astro` are prerendered
// (`prerender = true` + `getStaticPaths`), so their HTML is written during
// `astro build`. The Cloudflare adapter prerenders inside a local workerd with a
// LOCAL D1 (`.wrangler/state`), never the deployed database — so on a CI runner
// the build would see an empty, auto-seeded database and bake "No home page yet"
// into every page. Production is the truth for content (see .agents/skills/content-and-deploys), so this
// copies production's D1 into the local one first.
//
//   wrangler d1 export <db> --remote   →   .vitops/content.sql
//   wrangler d1 execute <db> --local   ←   .vitops/content.sql   (state cleared first)
//
// Read-only against production (an export). It only ever writes the local
// `.wrangler/state/v3/d1` directory, which is disposable build state.
//
// Fails CLOSED. A deploy that proceeds after a failed pull would publish an empty
// site over a good one, so any failure aborts the deploy — except one case that is
// not a failure: the remote database does not exist yet (the first deploy, where
// wrangler provisions it). Building from the seed is only right once the local database is
// migrated and seeded, which is `scripts/prepare-local-db.mjs`'s job, run straight after this.
//
// Skip with SKIP_PULL_CONTENT=1 (e.g. a deliberate seed-only build).

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';

if (process.env.SKIP_PULL_CONTENT) {
  console.log('pull-content: SKIP_PULL_CONTENT set — prerendering from the local/seed database.');
  process.exit(0);
}

/** wrangler.jsonc allows comments and trailing commas; JSON.parse does not. */
function parseJsonc(text) {
  const out = text
    .replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m, str) => str ?? '')
    .replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(out);
}

const config = parseJsonc(readFileSync('wrangler.jsonc', 'utf8'));
const db = config.d1_databases?.[0]?.database_name;
if (!db) {
  console.error('pull-content: wrangler.jsonc has no d1_databases[0].database_name.');
  process.exit(1);
}

const dump = '.vitops/content.sql';
mkdirSync('.vitops', { recursive: true });

const wrangler = (args) =>
  spawnSync('wrangler', args, { encoding: 'utf8', env: { ...process.env, CI: '1' } });

const exported = wrangler([
  'd1',
  'export',
  db,
  '--remote',
  '--output',
  dump,
  '--skip-confirmation',
]);
if (exported.status !== 0) {
  const text = `${exported.stdout}\n${exported.stderr}`;
  if (/not found|does not exist|no such database|couldn'?t find|could not find|7404/i.test(text)) {
    console.warn(
      `pull-content: remote database "${db}" does not exist yet (first deploy?) — ` +
        'prerendering from the seed.',
    );
    process.exit(0);
  }
  console.error(`pull-content: could not export "${db}" from production:\n${text}`);
  console.error('Refusing to build — prerendering now would publish an empty site.');
  process.exit(1);
}

// Replaying onto a populated local database collides on CREATE TABLE, so start clean.
rmSync('.wrangler/state/v3/d1', { recursive: true, force: true });
execFileSync('wrangler', ['d1', 'execute', db, '--local', '--file', dump, '--yes'], {
  stdio: 'inherit',
});
console.log(`pull-content: loaded production "${db}" into the local build database.`);
