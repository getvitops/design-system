import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { validateConfig } from '@getvitops/generator';

/**
 * Scaffolded projects live OUTSIDE this monorepo, so every dependency
 * specifier in a template has to be resolvable by a bare `npm install` in an
 * empty directory. `workspace:*` and `catalog:` are not — they are pnpm
 * protocols that only mean something here, and the publish-time rewrite that
 * handles them for a package's OWN dependencies does not reach inside
 * `templates/**`, which ship as verbatim data.
 *
 * The failure is silent in the worst way: `vp create` succeeds, writes a
 * perfectly good-looking project, and the first `install` fails with an
 * unresolvable specifier — in the user's directory, not ours.
 */
const TEMPLATES = join(import.meta.dirname, 'templates');
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const templateNames = readdirSync(TEMPLATES, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

/**
 * `packages/create/assets/` is the source of truth for a few things shipped
 * into every scaffolded project — placeholder imagery, the SOP checklist —
 * but `vp create` copies only the one directory named by
 * `createConfig.templates[].template` (`vite-plus`'s `copyDir`, verbatim, no
 * exclusion list, no hook this repo owns). There is nowhere to put an "also
 * copy the shared assets" step, so each source subdirectory is physically
 * mirrored into every `templates/<name>/`. This asserts every mirror is
 * byte-identical to its source: a drift here is invisible until a scaffolded
 * project ships the wrong file.
 */
const ASSETS_DIR = join(import.meta.dirname, 'assets');
const MIRRORS = [
  { from: 'placeholder', to: join('src', 'assets', 'placeholder') },
  { from: 'sop', to: '.' },
];
const sourceFiles = (dir: string) =>
  new Map(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name))]));

describe.each(templateNames)('template %s', (name) => {
  const pkg = JSON.parse(readFileSync(join(TEMPLATES, name, 'package.json'), 'utf8'));
  const deps = DEP_FIELDS.flatMap((f) => Object.entries(pkg[f] ?? {}));

  it('has no monorepo-only dependency specifiers', () => {
    const bad = deps.filter(([, range]) => /^(workspace|catalog):/.test(String(range)));
    expect(bad).toEqual([]);
  });

  it('tracks the toolchain rather than pinning a version that goes stale', () => {
    // A `^x.y.z` pin on a @getvitops/* package is a version that was current
    // the day it was written and silently is not any more — the emdash
    // template shipped `@getvitops/astro: ^0.7.0` through the whole 1.0
    // release, scaffolding projects a full major behind. `latest` is correct
    // here precisely because these move in lockstep with each other.
    const ours = deps.filter(([dep]) => dep.startsWith('@getvitops/'));
    expect(ours.length).toBeGreaterThan(0);
    for (const [, range] of ours) expect(range).toBe('latest');
  });

  it('pins Node in .node-version, agreeing with .nvmrc and devEngines', () => {
    // Version managers read `.node-version` (fnm, mise, asdf, Volta), the reusable CI workflows
    // read `.nvmrc`, and pnpm reads `devEngines`. Three spellings of one fact: a scaffold that
    // disagrees with itself gets a different Node locally than it builds with in CI.
    const read = (file: string) => readFileSync(join(TEMPLATES, name, file), 'utf8').trim();
    const major = String(pkg.devEngines?.runtime?.version).split('.')[0];
    expect(read('.node-version')).toBe('24');
    expect(read('.nvmrc')).toBe(read('.node-version'));
    expect(major).toBe(read('.node-version'));
  });

  it("applies the repo's release cooldown and exempts the toolchain from it", () => {
    // Every client install is held to the same cooldown this repo uses, so a template that ships
    // a shorter one (or none, which falls back to pnpm's one-day default) is a quieter supply-chain
    // posture than the repo that scaffolds it. `@getvitops/*` is exempt because releases land together.
    const root = readFileSync(join(import.meta.dirname, '..', '..', 'pnpm-workspace.yaml'), 'utf8');
    const age = /^minimumReleaseAge: (\d+)$/m.exec(root)?.[1];
    expect(age).toBe('4320');
    const ws = readFileSync(join(TEMPLATES, name, 'pnpm-workspace.yaml'), 'utf8');
    expect(/^minimumReleaseAge: (\d+)$/m.exec(ws)?.[1]).toBe(age);
    expect(ws).toMatch(/^\s+- '@getvitops\/\*'$/m);
  });

  it("uses the same astro range as this repo's catalog", () => {
    // One bump place. A template left on an older range scaffolds a project a release behind the
    // Astro this repo builds and tests against.
    const catalog = readFileSync(
      join(import.meta.dirname, '..', '..', 'pnpm-workspace.yaml'),
      'utf8',
    );
    const range = /^ {2}astro: (\S+)$/m.exec(catalog)?.[1];
    expect(range).toBeDefined();
    expect(pkg.dependencies?.astro).toBe(range);
  });

  it('ships a site.json that validates as a Config', () => {
    // A shipped config that fails validation is a scaffold that can run no
    // site-anchored command (legal/robots/search/ads/reviews/icons all default
    // to reading site.json) — see AGENTS.md's "Client onboarding" section.
    const raw = JSON.parse(readFileSync(join(TEMPLATES, name, 'site.json'), 'utf8'));
    const result = validateConfig(raw);
    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
  });

  describe.each(MIRRORS)('mirrors assets/$from byte-for-byte into $to', ({ from, to }) => {
    it('matches', () => {
      const sourceFileMap = sourceFiles(join(ASSETS_DIR, from));
      const destDir = join(TEMPLATES, name, to);
      for (const [filename, expected] of sourceFileMap) {
        const actual = readFileSync(join(destDir, filename));
        expect(
          actual.equals(expected),
          `${to}/${filename} drifted from assets/${from}/${filename}`,
        ).toBe(true);
      }
    });
  });
});

/**
 * `.agents/skills/setup/SKILL.md` has no external `packages/create/assets/`
 * home — it was authored directly in one template and copied — so it is
 * asserted byte-identical across templates directly rather than against a
 * shared source, the same drift risk `MIRRORS` guards for the other files.
 */
it('.agents/skills/setup/SKILL.md is identical across templates', () => {
  const SKILL_PATH = join('.agents', 'skills', 'setup', 'SKILL.md');
  const [first, ...rest] = templateNames.map((name) =>
    readFileSync(join(TEMPLATES, name, SKILL_PATH)),
  );
  for (const other of rest) expect(other.equals(first!)).toBe(true);
});

/**
 * `public/_headers` is the one place a scaffolded site gets security headers, so it is held
 * identical across templates and must carry the baseline (and no CSP — see the file's comment).
 */
it('every template ships the same public/_headers security baseline', () => {
  const files = templateNames.map((name) =>
    readFileSync(join(TEMPLATES, name, 'public', '_headers'), 'utf8'),
  );
  for (const file of files) {
    expect(file).toContain('X-Content-Type-Options: nosniff');
    expect(file).toContain('Referrer-Policy:');
    expect(file).not.toMatch(/^\s*Content-Security-Policy/m);
    expect(file).toBe(files[0]);
  }
});

/**
 * Every workflow in a template is a thin caller of this repo's reusable `site-*.yml` (see AGENTS.md's
 * CI/CD section). A caller naming a reusable workflow that doesn't exist, or one pinned to anything but the
 * moving `@v1` tag, fails only when it first runs — in the client's repo, on a push to `main`.
 */
describe.each(templateNames)('template %s workflows', (name) => {
  const dir = join(TEMPLATES, name, '.github', 'workflows');
  const reusable = join(import.meta.dirname, '..', '..', '.github', 'workflows');

  it.each(readdirSync(dir))('%s calls an existing reusable workflow pinned to @v1', (file) => {
    const uses = /uses: getvitops\/design-system\/\.github\/workflows\/(\S+)@(\S+)/.exec(
      readFileSync(join(dir, file), 'utf8'),
    );
    expect(uses, `${file} is not a thin caller`).not.toBeNull();
    expect(uses![2]).toBe('v1');
    expect(readdirSync(reusable)).toContain(uses![1]);
  });

  it('carries the main → dev back-merge caller', () => {
    expect(readdirSync(dir)).toContain('backmerge.yml');
  });
});

/**
 * Magic link is how an editor gets into a dev site whose database was copied from prod (passkeys are
 * origin-bound). It needs the email plugin AND the binding it reads — `cloudflareEmail()` defaults to a
 * binding named `EMAIL` — and a missing half fails only at the first sign-in attempt, as "Email is not
 * configured".
 */
it('emdash template wires the email plugin to a matching send_email binding', () => {
  const read = (file: string) => readFileSync(join(TEMPLATES, 'emdash', file), 'utf8');
  expect(read('astro.config.mjs')).toMatch(/cloudflareEmail\(\{/);
  expect(read('wrangler.jsonc')).toMatch(/"send_email":\s*\[\s*\{\s*"name":\s*"EMAIL"\s*\}\s*\]/);
});

/**
 * `scripts/refresh-dev.mjs` DROPS every table in its target, so the checks between it and production are
 * asserted rather than trusted. Its pure halves are imported (the file only runs `main` when invoked directly).
 */
describe('emdash scripts/refresh-dev.mjs', async () => {
  const { assertSafeTarget, dropStatements, parseBindingNames } = await import(
    join(TEMPLATES, 'emdash', 'scripts', 'refresh-dev.mjs')
  );
  const ok = { devName: 'site-dev', devId: 'dev-id', devReportedId: 'dev-id', prodId: 'prod-id' };

  it('refuses a target that is production, unset, misnamed or mismatched', () => {
    expect(() => assertSafeTarget(ok)).not.toThrow();
    expect(() => assertSafeTarget({ ...ok, devId: 'prod-id', devReportedId: 'prod-id' })).toThrow(
      /production/,
    );
    expect(() => assertSafeTarget({ ...ok, devId: undefined })).toThrow(/not set/);
    expect(() => assertSafeTarget({ ...ok, devName: 'site' })).toThrow(/-dev/);
    expect(() => assertSafeTarget({ ...ok, devReportedId: 'other' })).toThrow(/stale/);
  });

  it('reads names from wrangler.jsonc and ignores commented-out examples', () => {
    const src = readFileSync(join(TEMPLATES, 'emdash', 'wrangler.jsonc'), 'utf8');
    expect(parseBindingNames(src)).toEqual({
      database: 'my-emdash-site',
      bucket: 'my-emdash-site-media',
    });
    expect(parseBindingNames('// "database_name": "nope"\n"database_name": "yes"').database).toBe(
      'yes',
    );
  });

  it("drops views, virtual tables and tables, but not a virtual table's shadow tables", () => {
    const sql = dropStatements([
      { name: 'posts', type: 'table', sql: 'CREATE TABLE posts (id)' },
      { name: 'recent', type: 'view', sql: 'CREATE VIEW recent AS SELECT 1' },
      { name: 'search', type: 'table', sql: 'CREATE VIRTUAL TABLE search USING fts5(a)' },
      { name: 'search_data', type: 'table', sql: 'CREATE TABLE search_data (id)' },
    ]);
    expect(sql).toEqual([
      'PRAGMA defer_foreign_keys = true;',
      'DROP VIEW IF EXISTS "recent";',
      'DROP TABLE IF EXISTS "search";',
      'DROP TABLE IF EXISTS "posts";',
    ]);
  });
});
