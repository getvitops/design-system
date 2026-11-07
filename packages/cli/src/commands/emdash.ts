/**
 * `vitops emdash` — build-time steps for an EmDash site on the Cloudflare adapter.
 *
 * These used to be copied into every scaffold as `scripts/*.mjs`, which froze each fix at
 * scaffold time. As commands they arrive with `@getvitops/cli`, so a site's `package.json`
 * keeps one-line entries and `vp update` delivers the logic (the same move `vitops setup`
 * made for the template's old `init-github`/`init-hosting` scripts).
 *
 *   prepare-db        migrate and seed the LOCAL D1 the build prerenders from
 *   check-prerender   fail if a prerendered page is not a real page
 *
 * Why both exist: `astro build` prerenders every page inside a local workerd against a local D1
 * (`.wrangler/state`), never the deployed database. The template sets
 * `migrations.runtime: 'check'`, so a build against a local database with pending migrations
 * prerenders EmDash's one-line "Database migrations are required" response into every page,
 * and the build still succeeds. A fresh CI runner, a first deploy, a `SKIP_PULL_CONTENT=1`
 * build and an upgrade deploy all hand the build exactly that database.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { missingTypeRoleRules, prerenderProblem, PENDING_MIGRATIONS } from '../prerender-check.ts';
import { fail } from './shared.ts';
import { EMDASH_HELP } from '../help.ts';

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = (server.address() as { port: number }) ?? { port: 0 };
      server.close(() => resolve(port));
    });
  });
}

async function until(test: () => Promise<boolean>, what: string, ms = 120_000) {
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

const log = (msg: string) => console.log(`prepare-db: ${msg}`);

/**
 * `astro dev` daemonizes: the child outlives the command that started it, so capturing its
 * output through pipes would leave this process waiting on the daemon's inherited handles,
 * which looks exactly like a hang. Output is ignored and every call has a timeout.
 */
const astro = (args: string[]) =>
  spawnSync(existsSync('node_modules/.bin/astro') ? 'node_modules/.bin/astro' : 'astro', args, {
    stdio: 'ignore',
    timeout: 300_000,
    env: { ...process.env, CI: '1' },
  });

/**
 * Starts `astro dev` once, calls EmDash's `dev-bypass` setup endpoint (the non-interactive
 * setup wizard: it runs migrations, `dev: 'auto'`, and applies the seed), checks the home page
 * renders, stops. Only ever writes the local `.wrangler/state`, which is disposable; the dev
 * administrator it creates lives in that copy and is never deployed. Content already there
 * (from `pull-content`) is kept: the seed applies with `onConflict: skip`.
 */
async function cmdPrepareDb() {
  if (process.env.SKIP_PREPARE_LOCAL_DB) {
    log('SKIP_PREPARE_LOCAL_DB set — leaving the local database as it is.');
    return;
  }
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;

  log(`starting astro dev on ${base} ...`);
  const started = astro(['dev', '--port', String(port), '--host', '127.0.0.1']);
  if ((started.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT')
    fail('`astro` is not on PATH. Run it through the package scripts (`vpr prepare-local-db`).');
  if (started.status !== 0)
    fail(
      `could not start astro dev (${started.signal ?? `exit ${started.status}`}). ` +
        'It is killed after 5 minutes (exit 143 = SIGTERM). Run `astro dev` by hand to see why.',
    );

  let failure: Error | null = null;
  try {
    await until(async () => (await fetch(`${base}/_emdash/api/setup/status`)).ok, 'astro dev');
    log('dev server is up; migrating and seeding (first run can take a minute) ...');
    // A database that is already set up may decline; the home page check decides if it matters.
    const setup = await fetch(`${base}/_emdash/api/setup/dev-bypass?redirect=/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    });
    if (setup.status >= 400)
      console.warn(
        `prepare-db: dev-bypass answered ${setup.status}; checking the home page anyway.`,
      );

    const home = await fetch(`${base}/`);
    const html = await home.text();
    if (!home.ok)
      throw new Error(`astro dev answered ${home.status} on / — the dev runtime is broken`);
    if (PENDING_MIGRATIONS.test(html))
      throw new Error('the local database still has pending migrations');
    log('the local database is migrated and the home page renders.');
  } catch (e) {
    failure = e as Error;
  } finally {
    astro(['dev', 'stop']);
  }
  if (failure)
    fail(
      `${failure.message}\nRefusing to continue: prerendering now would publish error pages as the site.`,
    );
}

function* filesWith(dir: string, ext: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* filesWith(path, ext);
    else if (entry.name.endsWith(ext)) yield path;
  }
}
const htmlFiles = (dir: string) => filesWith(dir, '.html');
const cssFiles = (dir: string) => [...filesWith(dir, '.css')];

function cmdCheckPrerender(argv: string[]) {
  const root = argv.find((a) => !a.startsWith('-')) ?? 'dist/client';
  const strict = argv.includes('--strict');
  if (!existsSync(root)) fail(`${root} does not exist (run \`astro build\` first).`);
  const bad: string[] = [];
  const unstyled: string[] = [];
  const css = cssFiles(root)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  let count = 0;
  for (const file of htmlFiles(root)) {
    count += 1;
    const html = readFileSync(file, 'utf8');
    const why = prerenderProblem(html);
    if (why) bad.push(`  ${file} ${why}`);
    else if (css) {
      const missing = missingTypeRoleRules(html, css);
      if (missing.length) unstyled.push(`  ${file}: ${missing.join(', ')}`);
    }
  }
  if (count === 0) fail(`no .html files under ${root}.`);
  if (bad.length)
    fail(
      `the build prerendered pages that are not real pages:\n${bad.join('\n')}\n\n` +
        'The local database the build reads is probably unmigrated. Run `vpr prepare-local-db` ' +
        '(it migrates and seeds the local D1 through `astro dev`), then build again.',
    );
  if (unstyled.length) {
    const note =
      `type-role classes with no rule in the built CSS (they render at body size):\n${unstyled.join('\n')}\n\n` +
      'Tailwind does not scan node_modules. Use @getvitops/astro >= the release that adds the ' +
      "`@source` lines, or add `@source` for the package that renders them to the site's stylesheet.";
    if (strict) fail(note);
    console.warn(`check-prerender: warning: ${note}`);
  }
  console.log(`check-prerender: ${count} prerendered page(s) look like real pages.`);
}

export async function cmdEmdash(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'prepare-db':
      return cmdPrepareDb();
    case 'check-prerender':
      return cmdCheckPrerender(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(EMDASH_HELP);
      return;
    default:
      fail(
        `unknown "emdash" subcommand "${sub}" (expected: prepare-db | check-prerender). Try: vitops --help`,
      );
  }
}
