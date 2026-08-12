#!/usr/bin/env node
/**
 * Verify every publishable package resolves the way a real consumer's
 * install would. Three checks, because each catches something the others
 * can't:
 *
 *   - `publint` — the `package.json` shape itself (exports, types, files).
 *   - `attw` — whether TYPE resolution matches at each subpath, across
 *     module systems.
 *   - a real `npm install` of every packed tarball together, then a dynamic
 *     `import()` of every built subpath — whether the JavaScript actually
 *     LOADS at runtime. `attw` proves TypeScript can find a `.d.ts`; it does
 *     not execute anything, so a subpath whose `import` target has a syntax
 *     error or a broken internal import chain unrelated to types would pass
 *     `attw` and fail every real consumer.
 *
 * Nothing before this did any of the three. `@getvitops/core` alone ships 7
 * subpaths, and a broken one was invisible until a consumer's build failed
 * on it.
 *
 * **All 7 tarballs are packed and installed TOGETHER, in one shared
 * `node_modules`, not one at a time.** The fixed-group packages depend on
 * each other (`@getvitops/astro` imports from `@getvitops/generator`, which
 * this session's `renderRobotsTxt` addition is a real example of) via
 * `workspace:*`, which only pnpm understands. Installing one package's
 * tarball in isolation makes `npm install` fall through to whatever version
 * of its `@getvitops/*` dependencies happens to be on the **public npm
 * registry** — the last actually-published release — silently testing a
 * mix of this session's local build and a stale published one instead of
 * what a real release (which publishes the whole fixed group together)
 * would ever produce. Installing every local tarball at once is what makes
 * npm resolve those internal references locally instead.
 *
 * `--profile esm-only` on `attw`, not the default `strict`: every package
 * here is `"type": "module"` with no CJS build, so "resolution failed"
 * under Node10-style resolution and "dynamic import only" from a CJS
 * consumer are both inherent to that choice, not defects — `attw` names
 * exactly this combination `esm-only` and ignores the two rules that would
 * otherwise flag it. `@getvitops/create` is skipped entirely: it ships
 * templates as data with no `exports` map, so none of the three checks has
 * anything to check.
 *
 * `attw` runs on the five pure JS/TS packages only — NOT `astro` or
 * `emdash`. Measured directly: every `.astro`-suffixed export entry in
 * `@getvitops/astro` reports "Resolution failed" under node16-esm AND
 * bundler (attw has no notion of the `.astro` extension, full stop — it
 * isn't JS or TS), and `@getvitops/emdash`'s `./astro` entry surfaces the
 * same wall one level deeper, as an "Internal resolution error" inside its
 * own `.d.ts`. Both are artifacts of attw checking a file kind it was never
 * built to understand, not real defects; a hand-rolled per-entrypoint
 * allowlist to suppress just those would be a maintenance trap that
 * silently stops covering the next `.astro` export someone adds. `publint`
 * still runs against both — its checks don't care what extension a target
 * resolves to, and it passes cleanly on both today. Astro's own type
 * correctness for these two is `vp check`'s job, not this script's.
 *
 * The runtime-import phase only exercises subpaths whose target lives under
 * `dist/` — a genuinely BUILT file. `./components/Popover.astro`,
 * `./components/tree.ts` and `./package.json`-style exports point straight
 * at `src/` or at JSON on purpose (Astro/`.ts` component source is meant
 * for a consumer's OWN bundler to process, never pre-compiled — the same
 * reason `attw`'s `bundler` column is the one that matters for those), and
 * plain Node — no bundler, no Astro compiler — cannot load any of them:
 * `.astro` has no loader at all, `node_modules`-located `.ts` hits Node's
 * own `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (type-stripping is
 * deliberately not applied inside `node_modules`), and a bare `.json`
 * import needs an import attribute this script isn't simulating a
 * consumer's bundler for. None of that is a defect; it is what "ships
 * source for your bundler to process" means.
 *
 * Assumes `vp run build:packages` already ran — this only verifies what
 * `dist/` currently contains, it does not build anything.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PACKAGES = ['core', 'generator', 'utils', 'cli', 'vite', 'astro', 'emdash'];
const ATTW_SKIP = new Set(['astro', 'emdash']);
// `@getvitops/core` ships browser-only bundles (elements.js, consent.js,
// editor.js, deferred.js) — Lit components and DOM-manipulation code that
// reference `HTMLElement`/`document`/`location`/`IntersectionObserver`
// unconditionally at module-evaluation time. Real consumers never `import()`
// these from Node; they get copied into a site's `public/` and loaded via a
// browser `<script>` tag. Measured: every one of them throws a
// `ReferenceError` for a missing browser global under plain Node — the
// right verification for this package's runtime behaviour is
// `packages/core/src/web-components/*.dom.test.ts` (happy-dom), which
// already exists; this script would only be re-discovering "Node is not a
// browser" on every run.
const RUNTIME_IMPORT_SKIP = new Set(['core']);

interface ExportsMap {
  [subpath: string]: unknown;
}

/** `exports` values are either a bare string or a conditions object
 * (`{ types, import, ... }`); either way we want the ESM entry file. */
function resolveEsmTarget(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const conditions = value as Record<string, unknown>;
    const target = conditions.import ?? conditions.default;
    if (typeof target === 'string') return target;
  }
  return undefined;
}

/** Subpaths a real `import()` can exercise: no wildcards, and the target
 * must live under `dist/` — anything else is source meant for a consumer's
 * own bundler (see this file's docblock). */
function importableSubpaths(exports: ExportsMap): string[] {
  return Object.keys(exports).filter((subpath) => {
    if (subpath.includes('*')) return false;
    const target = resolveEsmTarget(exports[subpath]);
    return target !== undefined && target.startsWith('./dist/');
  });
}

function runPublint(dir: string): boolean {
  const result = spawnSync('npx', ['publint', 'run', '.'], { cwd: dir, stdio: 'inherit' });
  return result.status === 0;
}

function runAttw(name: string, dir: string): boolean {
  if (ATTW_SKIP.has(name)) {
    console.log(`(attw skipped for @getvitops/${name} — see this file's docblock)`);
    return true;
  }
  const result = spawnSync('npx', ['attw', '--pack', '.', '--profile', 'esm-only'], {
    cwd: dir,
    stdio: 'inherit',
  });
  return result.status === 0;
}

/** Pack every package into one shared directory, install them all together
 * (so internal `@getvitops/*` references resolve locally — see the
 * docblock), and return the scratch dir plus each package's importable
 * subpaths. Caller owns cleanup. */
function packAndInstallAll(): { scratch: string; subpathsByPackage: Map<string, string[]> } {
  const scratch = mkdtempSync(join(tmpdir(), 'vitops-verify-'));
  const tarballs: string[] = [];
  const subpathsByPackage = new Map<string, string[]>();

  for (const name of PACKAGES) {
    const dir = join('packages', name);
    const pkgJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      name: string;
      exports?: ExportsMap;
    };
    subpathsByPackage.set(
      name,
      RUNTIME_IMPORT_SKIP.has(name)
        ? []
        : pkgJson.exports
          ? importableSubpaths(pkgJson.exports)
          : ['.'],
    );

    const pack = spawnSync('pnpm', ['pack', '--pack-destination', scratch], {
      cwd: dir,
      encoding: 'utf8',
    });
    if (pack.status !== 0)
      throw new Error(`pnpm pack failed for @getvitops/${name}:\n${pack.stderr}`);
    const tarball = pack.stdout.trim().split('\n').pop();
    if (!tarball) throw new Error(`pnpm pack produced no tarball path for @getvitops/${name}`);
    tarballs.push(tarball);
  }

  writeFileSync(join(scratch, 'package.json'), JSON.stringify({ type: 'module' }));
  const install = spawnSync(
    'npm',
    ['install', '--no-audit', '--no-fund', '--no-save', ...tarballs],
    { cwd: scratch, stdio: 'pipe', encoding: 'utf8' },
  );
  if (install.status !== 0) throw new Error(`npm install failed:\n${install.stderr}`);

  return { scratch, subpathsByPackage };
}

function runRuntimeImports(name: string, scratch: string, subpaths: string[]): boolean {
  if (RUNTIME_IMPORT_SKIP.has(name)) {
    console.log(`(runtime import skipped for @getvitops/${name} — see this file's docblock)`);
    return true;
  }
  if (subpaths.length === 0) {
    console.log(`(no dist-built subpaths for @getvitops/${name} — skipping runtime check)`);
    return true;
  }
  let ok = true;
  for (const subpath of subpaths) {
    const spec = subpath === '.' ? `@getvitops/${name}` : `@getvitops/${name}/${subpath.slice(2)}`;
    const result = spawnSync('node', ['--input-type=module', '-e', `await import('${spec}')`], {
      cwd: scratch,
      encoding: 'utf8',
    });
    if (result.status === 0) {
      console.log(`  ✓ import('${spec}')`);
    } else {
      console.error(`  ✗ import('${spec}') failed:\n${result.stderr}`);
      ok = false;
    }
  }
  return ok;
}

let failed = false;

for (const name of PACKAGES) {
  if (!existsSync(join('packages', name, 'package.json'))) {
    console.error(`✗ packages/${name}: no package.json`);
    failed = true;
  }
}

for (const name of PACKAGES) {
  const dir = join('packages', name);
  if (!existsSync(join(dir, 'package.json'))) continue;
  console.log(`\n── @getvitops/${name} — publint + attw ──`);
  if (!runPublint(dir)) failed = true;
  if (!runAttw(name, dir)) failed = true;
}

console.log('\n── runtime import (all packages installed together) ──');
let scratch: string | undefined;
try {
  const packed = packAndInstallAll();
  scratch = packed.scratch;
  for (const name of PACKAGES) {
    console.log(`\n@getvitops/${name}:`);
    const subpaths = packed.subpathsByPackage.get(name) ?? [];
    if (!runRuntimeImports(name, packed.scratch, subpaths)) failed = true;
  }
} catch (e) {
  console.error(`\n✗ ${(e as Error).message}`);
  failed = true;
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
  console.error('\n✗ one or more packages failed publint/attw/runtime import — see output above');
  process.exit(1);
}
console.log('\n✓ every publishable package resolves cleanly (publint + attw + runtime import)');
