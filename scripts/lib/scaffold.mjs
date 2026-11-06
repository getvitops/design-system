/**
 * Shared plumbing for the scripts that scaffold a template against THIS checkout's packages
 * (`scaffold-check.mjs`, `e2e-audit.mjs`): pack the publishable `@getvitops/*`, serve them from
 * a throwaway Verdaccio under `latest`, copy a template and point it at that registry. The
 * rationale for each choice lives in `scaffold-check.mjs`'s header; this file is only the
 * mechanism, extracted so the two scripts cannot drift into two ways of installing a scaffold.
 */
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { renameSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..', '..');

/** The publishable toolchain a scaffold depends on (`create` itself is not one). */
export const PACKAGES = ['config', 'core', 'generator', 'utils', 'cli', 'vite', 'astro', 'emdash'];

/**
 * Pinned, and chosen to be older than the 3-day release cooldown this repo applies to
 * everything else. Bump deliberately: this runs in CI with the registry's credentials absent but
 * its network open, so an unpinned `latest` would be an unreviewed dependency on every PR.
 */
const VERDACCIO = 'verdaccio@7.0.2';

/** Run a command, echoing it. `capture` keeps output (and returns it); `tag` prefixes the echo. */
export function run(cmd, cmdArgs, { cwd, capture = false, env = {}, tag = 'scaffold-check' } = {}) {
  console.log(`\n[${tag}] $ ${cmd} ${cmdArgs.join(' ')}`);
  const result = spawnSync(cmd, cmdArgs, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, CI: '1', ...env },
  });
  if (capture) {
    process.stdout.write(result.stdout ?? '');
    process.stderr.write(result.stderr ?? '');
  }
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** An unused TCP port. Verdaccio takes a fixed one, so ask the OS and release it. */
export function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

export async function until(check, what, timeoutMs = 60_000) {
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

/** The root-installed Verdaccio's executable, or null when this checkout has not installed it. */
function findInstalledVerdaccio() {
  // By path, not `require.resolve`: its `exports` map hides `package.json`.
  const bin = join(ROOT, 'node_modules', 'verdaccio', 'bin', 'verdaccio');
  return existsSync(bin) ? bin : null;
}

/**
 * Install and start a Verdaccio that serves `@getvitops/*` from local storage only and proxies
 * everything else to npmjs. Returns its URL, an npmrc that can publish to it, and a `stop()`.
 */
export async function startRegistry(work) {
  const tools = join(work, 'verdaccio');
  mkdirSync(tools);
  // Verdaccio is a root devDependency, so the usual run needs no network install. The pinned
  // `npm install` below is the fallback for a checkout whose dependencies are not installed.
  let bin = findInstalledVerdaccio();
  if (!bin) {
    const install = run(
      'npm',
      ['install', '--prefix', tools, VERDACCIO, '--no-audit', '--no-fund', '--ignore-scripts'],
      { cwd: work },
    );
    if (!install.ok) throw new Error(`could not install ${VERDACCIO}`);
    bin = join(tools, 'node_modules', 'verdaccio', 'bin', 'verdaccio');
  }

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
    [bin, '--config', config, '--listen', `127.0.0.1:${port}`],
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

/** `pnpm pack` every publishable package and publish the tarballs to `registry` as `latest`. */
export function packAndPublish(registry, work) {
  const tarballs = join(work, 'tarballs');
  mkdirSync(tarballs);
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
  // Tagged `latest` — what the template's `latest` specifiers resolve.
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
}

/** Copy a template to `site` (the way `vp create` does) and point it at the local registry. */
export function prepareSite(name, site, registry) {
  cpSync(join(ROOT, 'packages/create/templates', name), site, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|\.astro|dist|\.vite-temp)([\\/]|$)/.test(src),
  });
  if (existsSync(join(site, '_gitignore'))) {
    renameSync(join(site, '_gitignore'), join(site, '.gitignore'));
  }

  // Drop the environment-only settings: they make pnpm/Node try to download other versions
  // than the runner has.
  const pkgPath = join(site, 'package.json');
  const manifest = JSON.parse(readFileSync(pkgPath, 'utf8'));
  delete manifest.packageManager;
  delete manifest.devEngines;
  writeFileSync(pkgPath, `${JSON.stringify(manifest, null, 2)}\n`);

  writeFileSync(join(site, '.npmrc'), `registry=${registry.url}/\n`);

  // Every template ships a `pnpm-workspace.yaml` (`templates.test.ts` asserts it), carrying the
  // cooldown. The packages were published seconds ago, so the cooldown would reject the
  // toolchain under test unless the template exempts it — which a real scaffold must do too.
  const ws = readFileSync(join(site, 'pnpm-workspace.yaml'), 'utf8');
  if (!/^\s+- '@getvitops\/\*'$/m.test(ws)) {
    throw new Error(
      "the template's pnpm-workspace.yaml does not exempt '@getvitops/*' from minimumReleaseAge",
    );
  }
  run('git', ['init', '--quiet'], { cwd: site });
}
