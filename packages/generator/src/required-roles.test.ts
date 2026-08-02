import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from './index.ts';
import { validate } from './schema.ts';
import { REQUIRED_ROLES, ROLE_TOKEN_KEYS } from './shared.ts';

/**
 * `REQUIRED_ROLES` is hand-maintained (validate() must stay filesystem-free),
 * so this re-derives it from the framework CSS and fails if the two disagree.
 *
 * Add a partial that hard-references `--color-bg-info-solid` and this test tells
 * you to add `info` to the list — rather than a consumer discovering it as an
 * uncoloured component months later.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const CSS_ROOTS = [
  join(HERE, '../../core/css'),
  join(HERE, '../assets/css'), // the snapshot, when it has been built
];

function cssFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? cssFiles(join(dir, e.name))
      : e.name.endsWith('.css')
        ? [join(dir, e.name)]
        : [],
  );
}

/**
 * Roles referenced by `var(--color-<target>-<role>[-<variant>])` with NO fallback.
 *
 * The role now sits in the MIDDLE of the property, so this matches on the target
 * prefix and the variant suffix around it. `text-on-<role>` is the irregular one
 * — the role follows `on` — so it gets its own alternative.
 */
function hardReferencedRoles(files: string[], roles: string[]): Set<string> {
  const alt = [...roles].sort((a, b) => b.length - a.length).join('|');
  const targets = [...new Set(ROLE_TOKEN_KEYS.map((k) => k.split('-')[0]))].join('|');
  const variants = [...new Set(ROLE_TOKEN_KEYS.flatMap((k) => k.split('-').slice(1).join('-')))]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .join('|');
  const scoped = new RegExp(
    `var\\(\\s*--color-(?:${targets})-(${alt})(?:-(?:${variants}))?\\s*\\)`,
    'g',
  );
  const on = new RegExp(`var\\(\\s*--color-(?:${targets})-on-(${alt})(?:-bold)?\\s*\\)`, 'g');
  const found = new Set<string>();
  for (const f of files) {
    const txt = readFileSync(f, 'utf8');
    for (const re of [scoped, on]) for (const m of txt.matchAll(re)) found.add(m[1] as string);
  }
  return found;
}

describe('required roles', () => {
  const roles = Object.keys(defaultConfig().colors.roles);
  const files = CSS_ROOTS.flatMap(cssFiles);

  it.skipIf(files.length === 0)('matches what the framework CSS hard-references', () => {
    const derived = [...hardReferencedRoles(files, roles)].sort();
    expect(derived).toEqual([...REQUIRED_ROLES].sort());
  });

  it('are all present in the scaffolded config', () => {
    // `vitops init` must not emit a config that trips its own warning.
    const defined = Object.keys(defaultConfig().colors.roles);
    expect(REQUIRED_ROLES.filter((r) => !defined.includes(r))).toEqual([]);
  });
});

describe('validate() role warnings', () => {
  it('warns when a required role is dropped', () => {
    const ds = defaultConfig();
    delete (ds.colors.roles as Record<string, string>).surface;
    const res = validate(ds);
    expect(res.ok, 'dropping a role is a warning, not an error').toBe(true);
    expect(res.warnings.join('\n')).toContain('"surface"');
  });

  it('stays quiet for a config that defines them all', () => {
    expect(validate(defaultConfig()).warnings).toEqual([]);
  });

  it('does not warn about extra, non-core roles', () => {
    // Roles are extensible — inventing one must be silent.
    const ds = defaultConfig();
    (ds.colors.roles as Record<string, string>)['ui-tertiary'] = Object.values(
      ds.colors.roles,
    )[0] as string;
    expect(validate(ds).warnings).toEqual([]);
  });
});
