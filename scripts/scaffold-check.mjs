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
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packAndPublish, prepareSite, run, startRegistry } from './lib/scaffold.mjs';

const args = process.argv.slice(2);
const keep = args.includes('--keep');
const name = args.find((a) => !a.startsWith('--')) ?? 'emdash';

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

if (!STEPS[name]) {
  console.error(
    `[scaffold-check] unknown template '${name}' (expected: ${Object.keys(STEPS).join(', ')})`,
  );
  process.exit(2);
}

const work = mkdtempSync(join(process.env.RUNNER_TEMP ?? tmpdir(), 'vitops-scaffold-'));
const site = join(work, 'site');
let registry;

try {
  // Pack this checkout's toolchain, serve it from a local registry as `latest`, copy the
  // template and point it there — see `scripts/lib/scaffold.mjs`.
  registry = await startRegistry(work);
  packAndPublish(registry, work);
  mkdirSync(site);
  prepareSite(name, site, registry);

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
