#!/usr/bin/env node
/**
 * Symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into
 * `packages/create/templates/emdash/node_modules/` so its `tsconfig.json`
 * (`extends: "astro/tsconfigs/strict"`) and its `.ts` sources actually
 * resolve inside this monorepo.
 *
 * The template is inert scaffold data (`@getvitops/create` ships it as-is —
 * see AGENTS.md's "@getvitops/create templates" section), not an installed
 * project: it has no `node_modules` of its own, and neither does this
 * repo's own root (nothing at the root directly depends on `astro`). Without
 * this, oxlint's type-aware tsconfig-discovery walk — which runs project-
 * wide regardless of `lint.ignorePatterns`, since that option only filters
 * which files get LINTED, not which tsconfig.json files get read while
 * building the type-checking project graph — hard-errors on every
 * `vp check` / pre-commit run with "File 'astro/tsconfigs/strict' not
 * found", which blocks every commit in this repo, not just ones that touch
 * the template. Once that resolves, the template's own `.ts` files
 * (`worker.ts`, `live.config.ts`) get type-checked for the first time too —
 * genuinely, not just permitted to — which is why `emdash`/
 * `@emdash-cms/cloudflare` need the same treatment: they were never
 * reachable to type-check before either, just silently unreachable rather
 * than erroring. `astro:content` (imported by `live.config.ts`) is a
 * virtual module astro's own tooling normally resolves by generating
 * `.astro/types.d.ts` via `astro sync` — too heavy to run here (it needs
 * the config's full integration list, including `@getvitops/*` packages
 * this template resolves via `latest` from the registry, to actually load),
 * so it gets a minimal local ambient shim instead, written at exactly
 * `.astro/types.d.ts` — the same path `astro sync` would generate for
 * real, already first in the tsconfig's own `include` array. (A
 * `node_modules/@types/` package was tried first, since that's TypeScript's
 * own documented auto-included ambient-types convention; oxlint's
 * type-aware engine didn't pick it up the same way `tsc` does, so this
 * uses the path the tsconfig already names explicitly instead.) Harmless
 * for a real scaffold too, not just gitignored-and-invisible: this file only
 * ever exists inside THIS monorepo's copy of the template, since `vp
 * create` copies tracked `src/`/config files, never `node_modules/` — a
 * real scaffolded project has no shim to even potentially conflict with
 * astro's own generated `.astro/types.d.ts`.
 *
 * A symlink is the right shape here rather than a real dependency: making
 * the template a pnpm workspace member was considered and rejected (it
 * would change how its `@getvitops/*: "latest"` deps resolve locally, which
 * is exactly what `templates.test.ts` exists to protect), and inlining
 * astro's strict preset into the template's tsconfig was rejected too (it
 * would drift out of sync with astro's own evolving default, defeating the
 * point of `extends`). This only has to be resolvable for THIS monorepo's
 * own tooling — `node_modules/` is gitignored everywhere, so the symlink
 * never ships and a real scaffold (via `vp create`) never sees it; the
 * template installs its own real `astro` there instead.
 *
 * Idempotent and safe to re-run: `pnpm install`'s `postinstall` hook calls
 * this every time, and it resolves astro's CURRENT location fresh rather
 * than hardcoding a `.pnpm/astro@<hash>` path, since that hash changes
 * whenever astro's version or its own peer resolution set does.
 */
import {
  existsSync,
  lstatSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

/**
 * Only the emdash template needs this — its tsconfig `extends` astro's
 * preset and its `.ts` sources import `astro`/`emdash`/`@emdash-cms/cloudflare`
 * directly; the static template's tsconfig has no `extends` and its sources
 * import nothing this monorepo can't already resolve.
 *
 * Each entry names where to resolve the package FROM (a real workspace
 * member that already depends on it for real, so this tracks whatever
 * version that member is actually pinned to rather than a second,
 * independently-drifting source of truth).
 */
const LINKS = [
  { pkg: 'astro', from: 'packages/astro' },
  { pkg: 'emdash', from: 'packages/emdash' },
  { pkg: '@emdash-cms/cloudflare', from: 'packages/emdash' },
];
const TEMPLATE = 'packages/create/templates/emdash';

for (const { pkg, from } of LINKS) {
  // Resolve via the sibling's OWN already-installed symlink
  // (`<from>/node_modules/<pkg>`) rather than `require.resolve`: several of
  // these packages (emdash included) declare an `exports` map with no
  // `./package.json` entry, which makes the usual "resolve the package.json"
  // trick throw `ERR_PACKAGE_PATH_NOT_EXPORTED`. Reading the real path
  // straight off pnpm's own symlink sidesteps that entirely.
  const pkgDir = realpathSync(join(root, from, 'node_modules', pkg));
  const nodeModulesDir = join(root, TEMPLATE, 'node_modules', ...pkg.split('/').slice(0, -1));
  const linkPath = join(root, TEMPLATE, 'node_modules', pkg);

  if (existsSync(linkPath)) {
    const isCurrent = (() => {
      try {
        return lstatSync(linkPath).isSymbolicLink() && realpathSync(linkPath) === pkgDir;
      } catch {
        return false;
      }
    })();
    if (isCurrent) continue;
    rmSync(linkPath, { recursive: true, force: true });
  }

  mkdirSync(nodeModulesDir, { recursive: true });
  // 'junction' — the portable choice: works without elevated privileges on
  // Windows (unlike 'dir') and is ignored (any symlink) on POSIX. Junctions
  // require an absolute target, which `pkgDir` already is.
  symlinkSync(pkgDir, linkPath, 'junction');
  console.log(`[link-template-deps] linked ${TEMPLATE}/node_modules/${pkg} -> ${pkgDir}`);
}

// `astro:content` ambient shim — see the file-level docblock for why this
// can't just be another symlink. Written at `.astro/types.d.ts`, the exact
// path the template's own tsconfig.json already lists first in `include`
// (it's where `astro sync` would generate the real thing for an actual
// scaffold) — not `node_modules/@types/`, which oxlint's type-aware engine
// doesn't appear to auto-include the way plain `tsc` does. Loose types on
// purpose: nothing here actually runs `live.config.ts`, it only needs to
// type-check.
const shimPath = join(root, TEMPLATE, '.astro', 'types.d.ts');
mkdirSync(join(root, TEMPLATE, '.astro'), { recursive: true });
writeFileSync(
  shimPath,
  // Only `defineLiveCollection` — the one export `live.config.ts` actually
  // imports. Widen this if the template starts using more of the module.
  "declare module 'astro:content' {\n" +
    '  export function defineLiveCollection(config: unknown): unknown;\n' +
    '}\n',
);
console.log(`[link-template-deps] wrote astro:content ambient shim -> ${shimPath}`);
