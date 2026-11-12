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
 *   form-template     copy a vitops_form block into site.templates
 *   build             `astro build`, then the same checks, plus a failure for any block with no renderer
 *   schema, db        move content between environments without losing the target's work (see emdash-env.ts)
 *
 * Why both exist: `astro build` prerenders every page inside a local workerd against a local D1
 * (`.wrangler/state`), never the deployed database. The template sets
 * `migrations.runtime: 'check'`, so a build against a local database with pending migrations
 * prerenders EmDash's one-line "Database migrations are required" response into every page,
 * and the build still succeeds. A fresh CI runner, a first deploy, a `SKIP_PULL_CONTENT=1`
 * build and an upgrade deploy all hand the build exactly that database.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { validateConfig } from '@getvitops/generator';
import { createServer } from 'node:net';
import { join, relative } from 'node:path';
import {
  brokenInternalLinks,
  deliveryProblem,
  formFieldNames,
  uninventoriedFields,
  hasConversionForm,
  h1Count,
  missingBlockComponents,
  missingTypeRoleRules,
  prerenderProblem,
  PENDING_MIGRATIONS,
  routeOf,
  sitemapOrphans,
} from '../prerender-check.ts';
import { findFormBlocks, withTemplate } from '../form-template.ts';
import { cmdEmdashDb, cmdEmdashSchema } from './emdash-env.ts';
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

/**
 * Poll until `test` passes. `died` is asked after each miss and may return why waiting is pointless
 * (the dev server printed an error and is gone), so a broken config fails in seconds, not after the
 * full timeout.
 */
async function until(
  test: () => Promise<boolean>,
  what: string,
  ms = 120_000,
  died?: () => string | undefined,
) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try {
      if (await test()) return;
    } catch {
      // not up yet
    }
    const why = died?.();
    if (why) throw new Error(`${what} did not start: ${why}`);
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
const DEV_LOG = '.vitops/prepare-db.log';
const astro = (args: string[]) => {
  // Output goes to a file, not a pipe: the daemon keeps the handle open, and a pipe would make
  // this process wait on it (which looks exactly like a hang). The file is read back on failure.
  mkdirSync('.vitops', { recursive: true });
  const fd = openSync(DEV_LOG, 'a');
  try {
    return spawnSync(
      existsSync('node_modules/.bin/astro') ? 'node_modules/.bin/astro' : 'astro',
      args,
      { stdio: ['ignore', fd, fd], timeout: 300_000, env: { ...process.env, CI: '1' } },
    );
  } finally {
    closeSync(fd);
  }
};
const logTail = (lines = 30) => {
  try {
    return readFileSync(DEV_LOG, 'utf8').trimEnd().split('\n').slice(-lines).join('\n');
  } catch {
    return '';
  }
};
// An error line from the dev server, once it has printed one, means it is not coming up.
const devError = () => {
  const tail = logTail(60);
  const line = tail.split('\n').find((l) => /\[(?:ERROR|error)\]|^\s*(?:\w+)?Error:|ERR_/.test(l));
  return line?.trim();
};

/** `site.json` must parse and validate before a dev server is asked to read it. */
function checkSiteConfig(siteFile = 'site.json') {
  if (!existsSync(siteFile)) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(siteFile, 'utf8'));
  } catch (e) {
    fail(`${siteFile} is not valid JSON: ${(e as Error).message}`);
  }
  const result = validateConfig(parsed);
  if (!result.ok)
    fail(
      `${siteFile} is not a valid site config:\n` +
        result.errors
          .map((i) => `  ${(i.path ?? []).join('.') || '(root)'}: ${i.message}`)
          .join('\n') +
        '\n\nThe dev server would exit on this without saying why. Fix it, or run `vitops validate`.',
    );
}

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
  checkSiteConfig();
  writeFileSync(DEV_LOG, '');
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
    await until(
      async () => (await fetch(`${base}/_emdash/api/setup/status`)).ok,
      'astro dev',
      120_000,
      devError,
    );
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
  if (failure) {
    const tail = logTail();
    if (tail) console.error(`prepare-db: last of ${DEV_LOG}:\n${tail}\n`);
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
  const outline: string[] = [];
  const dead: string[] = [];
  let formPage: string | undefined;
  const formFields = new Set<string>();
  const routes = new Set([...htmlFiles(root)].map((f) => routeOf(relative(root, f))));
  const css = cssFiles(root)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  let count = 0;
  for (const file of htmlFiles(root)) {
    // The toolkit's own assets (the theme editor page, …) are not site pages: no h1, no outline.
    if (relative(root, file).startsWith('vitops/')) continue;
    count += 1;
    const html = readFileSync(file, 'utf8');
    const why = prerenderProblem(html);
    if (why) bad.push(`  ${file} ${why}`);
    else {
      const h1s = h1Count(html);
      if (h1s !== 1 && !file.endsWith('/404.html')) outline.push(`  ${file}: ${h1s} <h1>`);
    }
    if (!why && hasConversionForm(html)) {
      formPage ??= file;
      for (const n of formFieldNames(html)) formFields.add(n);
    }
    if (!why) {
      const links = brokenInternalLinks(html, routes);
      if (links.length) dead.push(`  ${file}: ${links.join(', ')}`);
    }
    if (!why && css) {
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
  if (formPage) {
    const siteFile = argv.find((a) => a.startsWith('--site='))?.slice(7) ?? 'site.json';
    let siteConfig: unknown;
    try {
      if (existsSync(siteFile)) siteConfig = JSON.parse(readFileSync(siteFile, 'utf8'));
    } catch {
      siteConfig = undefined; // an unreadable config is `vitops validate`'s to report
    }
    if (siteConfig) {
      const problem = deliveryProblem(siteConfig);
      if (problem) {
        const note =
          `${formPage} has a form, but ${problem}. The route refuses submissions until one is set, ` +
          'so the first visitor to send a message would be told it failed. Run `vitops email setup` ' +
          'for the sender domain once it is.';
        if (strict) fail(note);
        console.warn(`check-prerender: warning: ${note}`);
      }
      const missing = uninventoriedFields(siteConfig, [...formFields].sort());
      if (missing.length) {
        const note =
          `the form collects ${missing.join(', ')}, which no site.templates form entry in ${siteFile} ` +
          'lists. `vitops legal` builds the privacy policy\'s "what we collect" from those entries, ' +
          'so the generated policy would under-report. Mirror the fields in a `type: "form"` template.';
        if (strict) fail(note);
        console.warn(`check-prerender: warning: ${note}`);
      }
    }
  }
  const orphaned = [...filesWith(root, '.xml')]
    .filter((f) => /sitemap[^/\\]*\.xml$/.test(f))
    .flatMap((f) => sitemapOrphans(readFileSync(f, 'utf8'), routes));
  if (orphaned.length) {
    const note =
      `the sitemap lists URLs the build did not produce (a search engine would be sent to 404s):\n` +
      `${orphaned
        .slice(0, 10)
        .map((u) => `  ${u}`)
        .join('\n')}${orphaned.length > 10 ? `\n  … and ${orphaned.length - 10} more` : ''}\n\n` +
      'A collection with no `urlPattern` is listed as /<collection>/<slug>. Set the pattern on the ' +
      "collection (the seed's `urlPattern`, or Content types in the admin) to the path the site serves.";
    if (strict) fail(note);
    console.warn(`check-prerender: warning: ${note}`);
  }
  if (dead.length) {
    const note =
      `links to pages the build did not produce (they would 404):\n${dead.join('\n')}\n\n` +
      'Publish the page, or mark the menu item as a planned link by adding `draft` to its CSS ' +
      'classes so it is not rendered until the page exists.';
    if (strict) fail(note);
    console.warn(`check-prerender: warning: ${note}`);
  }
  if (outline.length) {
    const note =
      `pages whose outline has not exactly one <h1>:\n${outline.join('\n')}\n\n` +
      'Give each page one: set a `vitops_hero` (or section) heading level to h1, or let the ' +
      'layout render the title, and make other display headings h2 or p.';
    if (strict) fail(note);
    console.warn(`check-prerender: warning: ${note}`);
  }
  console.log(`check-prerender: ${count} prerendered page(s) look like real pages.`);
}

/**
 * `vitops emdash form-template --from <seed.json|export.json> [--name <key>] [--site <site.json>]`:
 * copy a `vitops_form` block's fields into `site.templates`, so the generated privacy policy and
 * `check-prerender` know what the form collects. Hand-written entries are easy to get wrong (a
 * field type the policy's schema does not have fails with only a path); this uses the renderer's
 * own resolver, so the names are the ones the form submits.
 */
async function cmdFormTemplate(argv: string[]) {
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    if (i >= 0) return argv[i + 1];
    return argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  };
  const from = flag('from') ?? (existsSync('seed/seed.json') ? 'seed/seed.json' : undefined);
  const siteFile = flag('site') ?? 'site.json';
  const dry = argv.includes('--dry');
  if (!from) fail('give --from <seed.json or content export containing a vitops_form block>.');
  if (!existsSync(from!)) fail(`${from} does not exist.`);
  if (!existsSync(siteFile)) fail(`${siteFile} does not exist (use --site <path>).`);

  const blocks = findFormBlocks(JSON.parse(readFileSync(from!, 'utf8')));
  if (blocks.length === 0) fail(`no vitops_form block found in ${from}.`);
  const requested = flag('name');
  if (blocks.length > 1 && !requested)
    fail(
      `${blocks.length} vitops_form blocks in ${from}; this writes one entry. Name it with --name <key> ` +
        'and narrow --from to the one you mean (a content export of a single entry).',
    );
  const name = requested ?? 'contact';

  let emdash: { formTemplateFromBlock: (b: unknown) => unknown };
  try {
    const resolved = createRequire(join(process.cwd(), 'noop.js')).resolve('@getvitops/emdash');
    emdash = await import(pathToFileURL(resolved).href);
  } catch {
    fail('@getvitops/emdash is not installed in this project (run from the site root).');
  }
  const template = emdash!.formTemplateFromBlock(blocks[0]);
  const { config, changed } = withTemplate(
    JSON.parse(readFileSync(siteFile, 'utf8')),
    name,
    template,
  );
  const check = validateConfig(config);
  if (!check.ok)
    fail(
      `the template would make ${siteFile} invalid:\n` +
        check.errors.map((i) => `  ${(i.path ?? []).join('.')}: ${i.message}`).join('\n'),
    );
  if (!changed) return console.log(`form-template: site.templates.${name} is already up to date.`);
  if (dry) return console.log(JSON.stringify({ [name]: template }, null, 2));
  writeFileSync(siteFile, `${JSON.stringify(config, null, 2)}\n`);
  console.log(
    `form-template: wrote site.templates.${name} to ${siteFile}. Run your formatter on it.`,
  );
}

/**
 * `astro build` and then `check-prerender`, failing on any block type EmDash reported as having
 * no component. That report is a build-log warning, not an exit code, so the build's output is
 * streamed through unchanged and scanned afterwards.
 */
async function cmdBuild(argv: string[]) {
  const bin = existsSync('node_modules/.bin/astro') ? 'node_modules/.bin/astro' : 'astro';
  let log = '';
  const code = await new Promise<number>((resolve) => {
    const child = spawn(bin, ['build'], { stdio: ['inherit', 'pipe', 'pipe'] });
    child.stdout.on('data', (d) => {
      log += d;
      process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      log += d;
      process.stderr.write(d);
    });
    child.on('error', () => resolve(1));
    child.on('close', (c) => resolve(c ?? 1));
  });
  if (code !== 0) process.exit(code);
  const missing = missingBlockComponents(log);
  if (missing.length)
    fail(
      `the build rendered nothing for these block types (no component registered):\n` +
        missing.map((t) => `  ${t}`).join('\n') +
        '\n\nEvery page using them was published without that content. If they are `vitops_*` ' +
        'blocks, the plugin block map was empty for this build: check that no module imported by ' +
        '`@getvitops/emdash/astro` imports `emdash/ui` statically (an import cycle), and that the ' +
        'plugin is registered in astro.config.mjs.',
    );
  cmdCheckPrerender(argv);
}

export async function cmdEmdash(argv: string[]) {
  const [sub, ...rest] = argv;
  switch (sub) {
    case 'prepare-db':
      return cmdPrepareDb();
    case 'check-prerender':
      return cmdCheckPrerender(rest);
    case 'build':
      return cmdBuild(rest);
    case 'form-template':
      return cmdFormTemplate(rest);
    case 'schema':
      return cmdEmdashSchema(rest);
    case 'db':
      return cmdEmdashDb(rest);
    case undefined:
    case '-h':
    case '--help':
      console.log(EMDASH_HELP);
      return;
    default:
      fail(
        `unknown "emdash" subcommand "${sub}" (expected: prepare-db | check-prerender | build | form-template | schema | db). Try: vitops --help`,
      );
  }
}
