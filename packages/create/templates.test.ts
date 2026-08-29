import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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
