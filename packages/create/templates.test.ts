import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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
});
