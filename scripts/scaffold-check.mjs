/**
 * Scaffold a template into a temp directory and prove it builds — with THIS
 * checkout's `@getvitops/*` packages, not whatever was last published.
 *
 *   node scripts/scaffold-check.mjs [emdash|static] [--keep]
 *
 * Why this exists: a template's `@getvitops/*` deps are `latest` (see
 * `templates.test.ts` for why), so a scaffold installed today resolves the last
 * *release*. Nothing in the monorepo's own build installs a template the way a
 * client does, so a break in the template, in `@getvitops/emdash`'s plugin
 * surface, or in a bump of EmDash / Vite+ / Astro was invisible until someone ran
 * `vp create` after a release. This is that run, on every PR.
 *
 * How it gets this checkout in front of the install: a throwaway **Verdaccio**
 * registry. `pnpm pack` turns each publishable `@getvitops/*` package into a
 * tarball (rewriting `workspace:`/`catalog:` exactly as publishing does), the
 * tarballs are published to the local registry under the `latest` tag, and the
 * scaffold installs from it. Everything else proxies through to npmjs.
 *
 * That replaced `overrides` pointing at `file:` tarballs, which worked but tested
 * a different install: the scaffold's own `latest` specifiers were never
 * resolved, `blockExoticSubdeps` had to be switched off, and a transitive
 * `@getvitops/*` reference only resolved because an override forced it. Now the
 * scaffold's `package.json` and `pnpm-workspace.yaml` are what a client gets,
 * except for the three things below. `@getvitops/*` is served ONLY from the local
 * registry (no uplink), so it cannot silently fall back to the last release.
 *
 * What it does, and where it deliberately differs from `vp create`:
 *   • Copies `packages/create/templates/<name>` and renames `_gitignore`, rather
 *     than calling `vp create`. `vp create @getvitops:<name>` resolves the
 *     *published* `@getvitops/create` from npm, and `--directory` is refused for
 *     a local path, so the working-tree template could not be scaffolded that
 *     way. The copy is all `vp create` does with a bundled template.
 *   • Points the scaffold's `registry` at the local one. The template's release
 *     cooldown is left ALONE: the packages were published seconds ago, so the
 *     scaffold must exempt `@getvitops/*` from it — which every template already
 *     does for the toolchain, and this throws if one stops. Everything else is held
 *     to the cooldown, so the install resolves what a client would today (Astro
 *     included) rather than whatever shipped an hour ago.
 *   • Drops `packageManager` and `devEngines` — they make pnpm/Node try to
 *     download other versions than the runner has.
 *
 * Fails on: a non-zero step, or EmDash's adapter-version-mismatch warning in the
 * build output (`emdash` and `@emdash-cms/cloudflare` upgraded separately).
 *
 * Requires `build:packages` first, and network access (npmjs, via the proxy).
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { renameSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const name = args.find((a) => !a.startsWith('--')) ?? 'emdash';

/** The publishable toolchain a scaffold depends on (`create` itself is not one). */
const PACKAGES = ['config', 'core', 'generator', 'utils', 'cli', 'vite', 'astro', 'emdash'];

/**
 * Pinned, and chosen to be older than the 3-day release cooldown this repo applies to
 * everything else. Bump deliberately: this runs in CI with the registry's credentials absent but
 * its network open, so an unpinned `latest` would be an unreviewed dependency on every PR.
 */
const VERDACCIO = 'verdaccio@7.0.2';

/** Per-template steps run inside the scaffold, in order. `capture` keeps output. */
const STEPS = {
  emdash: [
    ['pnpm', ['install']],
    ['pnpm', ['run', 'typecheck']],
    ['pnpm', ['run', 'build'], { capture: true }],
    ['pnpm', ['run', 'lint:design']],
    ['pnpm', ['exec', 'emdash', 'seed', '--validate', 'seed/seed.json']],
  ],
  static: [
    ['pnpm', ['install']],
    ['pnpm', ['run', 'build'], { capture: true }],
    ['pnpm', ['run', 'lint:design']],
  ],
};

const MISMATCH = /@emdash-cms\/cloudflare \S+ does not match emdash/;

function fail(message) {
  console.error(`\n[scaffold-check] FAIL: ${message}`);
  process.exitCode = 1;
}

function run(cmd, cmdArgs, { cwd, capture = false } = {}) {
  console.log(`\n[scaffold-check] $ ${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, CI: '1' },
  });
  if (capture) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** An unused TCP port. Verdaccio takes a fixed one, so ask the OS and release it. */
function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

async function until(check, what, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      if (await check()) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Install and start a Verdaccio that serves `@getvitops/*` from local storage only and proxies
 * everything else to npmjs. Returns its URL, an npmrc that can publish to it, and a `stop()`.
 */
async function startRegistry(work) {
  const tools = join(work, 'verdaccio');
  mkdirSync(tools);
  const install = run(
    'npm',
    ['install', '--prefix', tools, VERDACCIO, '--no-audit', '--no-fund', '--ignore-scripts'],
    { cwd: work },
  );
  if (!install.ok) throw new Error(`could not install ${VERDACCIO}`);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const config = join(tools, 'config.yaml');
  writeFileSync(
    config,
    [
      `storage: ${join(tools, 'storage')}`,
      'auth:',
      '  htpasswd:',
      `    file: ${join(tools, 'htpasswd')}`,
      '    max_users: 10', // -1 disables registration, and we need one throwaway user
      'uplinks:',
      '  npmjs:',
      '    url: https://registry.npmjs.org/',
      'packages:',
      "  '@getvitops/*':", // no `proxy`: local only, so it can never fall back to a release
      '    access: $all',
      '    publish: $authenticated',
      "  '**':",
      '    access: $all',
      '    proxy: npmjs',
      'max_body_size: 200mb',
      'log: { type: stdout, format: pretty, level: warn }',
      '',
    ].join('\n'),
  );

  const child = spawn(
    process.execPath,
    [
      join(tools, 'node_modules', 'verdaccio', 'bin', 'verdaccio'),
      '--config',
      config,
      '--listen',
      `127.0.0.1:${port}`,
    ],
    { cwd: tools, stdio: ['ignore', 'inherit', 'inherit'] },
  );
  const stop = () => {
    if (!child.killed) child.kill('SIGTERM');
  };
  try {
    await until(async () => (await fetch(`${url}/-/ping`)).ok, 'Verdaccio to start');

    // `npm publish` refuses without a token even where the registry would allow anonymous
    // publishing, so register a throwaway user and keep the token it returns.
    const res = await fetch(`${url}/-/user/org.couchdb.user:scaffold`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'scaffold',
        password: 'scaffold-check-1',
        email: 'ci@example.com',
      }),
    });
    if (!res.ok) throw new Error(`could not register a publish user (${res.status})`);
    const { token } = await res.json();
    if (!token) throw new Error('Verdaccio returned no auth token');

    const npmrc = join(tools, 'publish.npmrc');
    writeFileSync(npmrc, `registry=${url}/\n//127.0.0.1:${port}/:_authToken=${token}\n`);
    return { url, npmrc, stop };
  } catch (error) {
    stop();
    throw error;
  }
}

if (!STEPS[name]) {
  console.error(
    `[scaffold-check] unknown template '${name}' (expected: ${Object.keys(STEPS).join(', ')})`,
  );
  process.exit(2);
}

const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'vitops-scaffold-'));
const site = join(work, 'site');
const tarballs = join(work, 'tarballs');
mkdirSync(tarballs);
let registry;

try {
  // 1. Pack this checkout's toolchain.
  const packed = {};
  for (const pkg of PACKAGES) {
    const dir = join(ROOT, 'packages', pkg);
    if (!existsSync(join(dir, 'dist'))) {
      throw new Error(`packages/${pkg}/dist is missing — run \`vp run build:packages\` first`);
    }
    const before = new Set(readdirSync(tarballs));
    const { ok } = run('pnpm', ['pack', '--pack-destination', tarballs], { cwd: dir });
    if (!ok) throw new Error(`pnpm pack failed for @getvitops/${pkg}`);
    const file = readdirSync(tarballs).find((f) => !before.has(f));
    packed[`@getvitops/${pkg}`] = join(tarballs, file);
  }

  // 2. Serve them from a local registry, tagged `latest` — what the template's `latest` resolves.
  registry = await startRegistry(work);
  for (const [pkg, file] of Object.entries(packed)) {
    const { ok } = run(
      'npm',
      [
        'publish',
        file,
        '--registry',
        registry.url,
        '--tag',
        'latest',
        '--userconfig',
        registry.npmrc,
      ],
      { cwd: work },
    );
    if (!ok) throw new Error(`publishing ${pkg} to the local registry failed`);
  }

  // 3. Copy the template, the way `vp create` does for a bundled one.
  cpSync(join(ROOT, 'packages/create/templates', name), site, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|\.astro|dist|\.vite-temp)([\\/]|$)/.test(src),
  });
  if (existsSync(join(site, '_gitignore'))) {
    renameSync(join(site, '_gitignore'), join(site, '.gitignore'));
  }

  // 4. Point the scaffold at the registry, and drop the environment-only settings.
  const pkgPath = join(site, 'package.json');
  const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'));
  delete manifest.packageManager;
  delete manifest.devEngines;
  writeFileSync(pkgPath, `${JSON.stringify(manifest, null, 2)}\n`);

  writeFileSync(join(site, '.npmrc'), `registry=${registry.url}/\n`);

  const wsPath = join(site, 'pnpm-workspace.yaml');
  // Every template ships one (`templates.test.ts` asserts it), carrying the cooldown and the
  // build approvals `vp create --approve-builds` would otherwise grant.
  const ws = readFileSync(wsPath, 'utf8');
  // Published seconds ago, so the cooldown would reject the toolchain under test unless the
  // template exempts it — which a real scaffold must do too, since releases land the same way.
  if (!/^\s+- '@getvitops\/\*'$/m.test(ws)) {
    throw new Error(
      "the template's pnpm-workspace.yaml does not exempt '@getvitops/*' from minimumReleaseAge",
    );
  }
  writeFileSync(wsPath, ws);

  run('git', ['init', '--quiet'], { cwd: site });

  // 5. Run the steps.
  for (const [cmd, cmdArgs, opts] of STEPS[name]) {
    const { ok, output } = run(cmd, cmdArgs, { cwd: site, ...opts });
    if (!ok) {
      fail(`\`${cmd} ${cmdArgs.join(' ')}\` failed`);
      break;
    }
    if (opts?.capture && MISMATCH.test(output)) {
      fail('EmDash reports `@emdash-cms/cloudflare` and `emdash` at different versions');
      break;
    }
  }
  if (!process.exitCode) console.log(`\n[scaffold-check] ok: '${name}' scaffolds and builds`);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
} finally {
  registry?.stop();
  if (keep) console.log(`[scaffold-check] kept ${work}`);
  else rmSync(work, { recursive: true, force: true });
}
