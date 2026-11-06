// Pre-build step: make the LOCAL D1 the build prerenders from migrated, and seeded if empty.
//
// Why this exists: `astro build` prerenders every page inside a local workerd against a local
// D1 (`.wrangler/state`), never the deployed database. The template sets
// `migrations.runtime: 'check'` (right for production: migrate in a deploy step, never behind
// a visitor's request), so a build against a local database with pending migrations
// prerenders EmDash's one-line "Database migrations are required" response into every page,
// and the build still succeeds. That is what a fresh CI runner, a first deploy, a
// `SKIP_PULL_CONTENT=1` build and an upgrade deploy (the content pull restores production's
// older schema, and `emdash migrate` only runs AFTER the build) all hand the build.
//
// `astro dev` is configured `migrations.dev: 'auto'`, and EmDash's `dev-bypass` setup endpoint
// is the non-interactive form of the setup wizard (it runs migrations and applies the seed's
// sample content). So: start `astro dev` once, hit that endpoint, check the home page really
// renders, stop it. The state lands in `.wrangler/state`, where the build reads it.
//
// This only ever writes the local `.wrangler/state` directory, which is disposable build
// state. The dev administrator it creates lives in that copy and is never deployed.
//
// Content already in the local database (from `pull-content`) is kept: the seed applies with
// `onConflict: skip`, and a setup endpoint that declines an already-set-up database is
// tolerated as long as the home page renders afterwards.
//
// Skip with SKIP_PREPARE_LOCAL_DB=1.

import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

if (process.env.SKIP_PREPARE_LOCAL_DB) {
  console.log('prepare-local-db: SKIP_PREPARE_LOCAL_DB set — leaving the local database as it is.');
  process.exit(0);
}

const PENDING = 'Database migrations are required';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function until(test, what, ms = 120_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if (await test()) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out waiting for ${what}`);
}

const astro = (args) =>
  spawnSync('astro', args, { encoding: 'utf8', env: { ...process.env, CI: '1' } });

const port = await freePort();
const base = `http://127.0.0.1:${port}`;

const started = astro(['dev', '--port', String(port), '--host', '127.0.0.1']);
if (started.error?.code === 'ENOENT') {
  console.error(
    'prepare-local-db: `astro` is not on PATH. Run it through the package scripts (`vpr prepare-local-db`).',
  );
  process.exit(1);
}
if (started.status !== 0) {
  console.error(
    `prepare-local-db: could not start astro dev:\n${started.stdout}\n${started.stderr}`,
  );
  process.exit(1);
}

let failure = null;
try {
  await until(async () => (await fetch(`${base}/_emdash/api/setup/status`)).ok, 'astro dev');

  // Migrates (dev: 'auto') and applies the seed's sample content. A database that is already
  // set up may decline; the home page check below is what decides whether that matters.
  const setup = await fetch(`${base}/_emdash/api/setup/dev-bypass?redirect=/`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(120_000),
  });
  if (setup.status >= 400) {
    console.warn(
      `prepare-local-db: dev-bypass answered ${setup.status}; checking the home page anyway.`,
    );
  }

  const home = await fetch(`${base}/`);
  const html = await home.text();
  if (!home.ok)
    throw new Error(`astro dev answered ${home.status} on / — the dev runtime is broken`);
  if (html.includes(PENDING)) throw new Error('the local database still has pending migrations');
  console.log('prepare-local-db: the local database is migrated and the home page renders.');
} catch (e) {
  failure = e;
} finally {
  astro(['dev', 'stop']);
}

if (failure) {
  console.error(`prepare-local-db: ${failure.message}`);
  console.error('Refusing to continue: prerendering now would publish error pages as the site.');
  process.exit(1);
}
