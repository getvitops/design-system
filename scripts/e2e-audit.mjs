/**
 * End-to-end: scaffold an EmDash site, give it pages that use EVERY block, build it, serve the
 * prerendered output and run `vitops audit` against it.
 *
 *   node scripts/e2e-audit.mjs [--warn] [--pause] [--no-keep] [--audit-only | --serve-only]
 *                              [--pages /a,/b] [--out <dir>] [--port <n>] [--keep]
 *
 * (`vp run verify:e2e`; extra flags go after `--` where the runner needs them, or use the
 * `VITOPS_E2E_PAUSE=1` environment variable.)
 *
 * What it adds over `scaffold-check.mjs` (whose packing, registry and template copy it shares
 * through `scripts/lib/scaffold.mjs`): the TEST-ONLY overlay from `packages/create/e2e/` is laid
 * over the scaffold's copy — never the template — so the site has a `/blocks` page with every
 * plugin Portable Text block and a `/landings/showcase` page composed of `vitops_section` block
 * types. The overlay seed is validated with `emdash seed --validate` before the build.
 *
 * Serving: the build's `dist/client` is served by `scripts/lib/static-server.mjs`, which also
 * applies `public/_headers`, so the report-only CSP and the security headers the audit runs
 * under are the real ones. Not `astro preview` (unverified against the Cloudflare adapter) and
 * not `wrangler dev` (needs workerd; everything audited is prerendered, so files are faithful).
 *
 * Exit code: the audit's (non-zero when a budget fails), or 1 when a setup step fails. `--warn`
 * is passed through, so findings are reported without failing — what CI uses today.
 *
 * PAUSE (`--pause` or `VITOPS_E2E_PAUSE=1`): after the audit has run and printed its results,
 * keep the server up and wait for Ctrl+C, so a human can browse the site and the report. The
 * temp directory is kept while paused (`--no-keep` to delete it on exit). Never pauses by
 * default, and refuses outright when `CI` is set — a paused job would hang until its timeout.
 *   --audit-only   build, serve, audit, exit (the default; named for symmetry)
 *   --serve-only   build and serve, skip the audit (pauses regardless of `--pause`)
 *
 * Requires `build:packages` first (the vp task does), network access (npmjs via the proxy) and
 * a Chromium for Playwright (`npx playwright install chromium`).
 */
import { mkdirSync, mkdtempSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import {
  ROOT,
  freePort,
  until,
  packAndPublish,
  prepareSite,
  run,
  startRegistry,
} from './lib/scaffold.mjs';
import { serveStatic } from './lib/static-server.mjs';

const TAG = 'e2e-audit';
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const serveOnly = flag('serve-only');
const pause = flag('pause') || process.env.VITOPS_E2E_PAUSE === '1' || serveOnly;
const keep = flag('keep') || (pause && !flag('no-keep'));
const outDir = resolve(opt('out') ?? join(ROOT, '.vitops', 'e2e-audit'));

if (pause && process.env.CI) {
  console.error(
    `[${TAG}] refusing to pause: CI is set, and a paused job would hang until it times out. ` +
      'Unset CI (or drop --pause / VITOPS_E2E_PAUSE) to run to completion.',
  );
  process.exit(2);
}
if (flag('audit-only') && serveOnly) {
  console.error(`[${TAG}] --audit-only and --serve-only are mutually exclusive`);
  process.exit(2);
}

const log = (m) => console.log(`\n[${TAG}] ${m}`);
function fail(message) {
  console.error(`\n[${TAG}] FAIL: ${message}`);
  process.exitCode = 1;
}

const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'vitops-e2e-'));
const site = join(work, 'site');
let registry;
let server;
let kept = keep;

/**
 * Migrate and seed the LOCAL D1 the build prerenders from. The template's `runtime: 'check'`
 * means a build against an unmigrated database prerenders EmDash's pending-migrations page
 * (no title, no `lang`, no content) and succeeds anyway — and a seed's sample content is only
 * applied by the setup wizard, never by a build. EmDash's dev-bypass endpoint is the
 * non-interactive form of that wizard ("runs migrations, creates a development administrator,
 * and adds the seed's sample content"), so: start `astro dev`, hit it once, stop it. The state
 * lands in `.wrangler/state`, where the build's prerender reads it.
 */
async function seedLocalDatabase(site, step) {
  const port = await freePort();
  step('pnpm', ['exec', 'astro', 'dev', '--port', String(port), '--host', '127.0.0.1']);
  try {
    const base = `http://127.0.0.1:${port}`;
    await until(
      async () => (await fetch(`${base}/`, { redirect: 'manual' })).status < 600,
      'astro dev',
    );
    const res = await fetch(`${base}/_emdash/api/setup/dev-bypass?redirect=/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status >= 400) throw new Error(`dev-bypass setup answered ${res.status}`);
    // A dev server that 500s on every route still contains no "No home page yet" text, so the
    // status is checked first: a broken dev runtime must fail here, not pass as "seeded".
    const homeRes = await fetch(`${base}/`);
    if (!homeRes.ok) throw new Error(`astro dev answered ${homeRes.status} on / (dev is broken)`);
    const home = await homeRes.text();
    if (/No home page yet/.test(home)) throw new Error('the seed content was not applied');
    log('seeded the local database via the dev-bypass setup');
  } finally {
    run('pnpm', ['exec', 'astro', 'dev', 'stop'], { cwd: site, tag: TAG });
  }
}

async function cleanup() {
  server?.stop();
  registry?.stop();
  if (kept) console.log(`[${TAG}] kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

try {
  // 1. This checkout's toolchain in front of the install, then the template.
  registry = await startRegistry(work);
  packAndPublish(registry, work);
  mkdirSync(site);
  prepareSite('emdash', site, registry);

  // 2. The test-only overlay, onto the scaffold's copy.
  const overlay = await import(pathToFileURL(join(ROOT, 'packages/create/e2e/overlay.ts')).href);
  const { missing } = overlay.coverage();
  if (missing.length > 0) {
    console.warn(
      `[${TAG}] WARNING: no fixture for ${missing.join(', ')} — not on the page ` +
        '(packages/create/e2e/fixtures.test.ts is what fails on this)',
    );
  }
  const seedPath = join(site, 'seed', 'seed.json');
  const built = overlay.buildOverlay(JSON.parse(readFileSync(seedPath, 'utf8')));
  writeFileSync(seedPath, `${JSON.stringify(built.seed, null, 2)}\n`);
  for (const [rel, text] of Object.entries(built.files)) {
    mkdirSync(dirname(join(site, rel)), { recursive: true });
    writeFileSync(join(site, rel), text);
  }
  for (const [from, rel] of built.copies) {
    mkdirSync(dirname(join(site, rel)), { recursive: true });
    copyFileSync(from, join(site, rel));
  }

  // 3. Install, validate the overlaid seed, build. `pull-content` is skipped: the build
  // prerenders from the seeded local D1, which is the content under test.
  const step = (cmd, args, opts) => {
    const r = run(cmd, args, { cwd: site, tag: TAG, ...opts });
    if (!r.ok) throw new Error(`\`${cmd} ${args.join(' ')}\` failed`);
    return r;
  };
  step('pnpm', ['install']);
  step('pnpm', ['exec', 'emdash', 'seed', '--validate', 'seed/seed.json']);
  await seedLocalDatabase(site, step);
  step('pnpm', ['run', 'build']);

  // 4. Serve the prerendered output.
  const client = join(site, 'dist', 'client');
  if (!existsSync(join(client, 'index.html')))
    throw new Error(`no prerendered ${client}/index.html`);
  const port = Number(opt('port')) || (await freePort());
  server = await serveStatic(client, port);
  log(`serving ${client} at ${server.url} (${server.headerRules} _headers rule(s) applied)`);

  // 5. The audit, with this checkout's built CLI.
  if (!serveOnly) {
    const pages = ['/', '/privacy', '/terms', '/cookies', '/contact', ...overlay.E2E_PATHS];
    const extra = (opt('pages') ?? '').split(',').filter(Boolean);
    const args = [
      join(ROOT, 'packages/cli/dist/cli.mjs'),
      'audit',
      '--url',
      server.url,
      '--dir',
      site,
      '--no-defaults',
      '--pages',
      [...new Set([...pages, ...extra])].join(','),
      '--out',
      outDir,
      ...(flag('warn') ? ['--warn'] : []),
    ];
    mkdirSync(outDir, { recursive: true });
    const code = await new Promise((res) => {
      console.log(`\n[${TAG}] $ node ${args.join(' ')}`);
      spawn(process.execPath, args, { stdio: 'inherit' }).on('exit', (c) => res(c ?? 1));
    });
    process.exitCode = code;
    log(`audit exited ${code}; report: ${join(outDir, 'report.md')}`);
  }

  // 6. Pause for a human, after the results are printed.
  if (pause) {
    kept = !flag('no-keep');
    console.log(
      [
        '',
        `[${TAG}] PAUSED — Ctrl+C to stop and clean up`,
        `  site:    ${server.url}   (/blocks, /landings/showcase)`,
        `  report:  ${outDir}`,
        `  scaffold: ${site}${kept ? ' (kept)' : ' (deleted on exit: --no-keep)'}`,
        '',
      ].join('\n'),
    );
    await new Promise((res) => {
      process.once('SIGINT', res);
      process.once('SIGTERM', res);
    });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  await cleanup();
}
