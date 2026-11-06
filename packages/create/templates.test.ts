import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateConfig } from '@getvitops/generator';
// @ts-ignore — a cross-package source import; `allowImportingTsExtensions` is off here.
import { CONSENT_STUB, THEME_SCRIPT } from '../astro/src/inline-scripts.ts';

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

/**
 * Both templates ship a Report-Only CSP in `public/_headers`. Its `script-src` names
 * `<Head />`'s inline scripts by SHA-256, so it is only correct while those hashes
 * match the bytes `@getvitops/astro` emits. The scripts are constants in
 * `inline-scripts.ts` (the same ones `csp.ts` hashes and `Head.astro` emits), imported
 * by relative path rather than through a dependency — `create` ships data, not code,
 * and shouldn't depend on the astro package just to be tested against it.
 */
describe.each(templateNames)('template %s CSP', (name) => {
  const headers = readFileSync(join(TEMPLATES, name, 'public', '_headers'), 'utf8');
  const hash = (s: string) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;

  it('is Report-Only, so it cannot break a page', () => {
    expect(headers).toMatch(/^\s+Content-Security-Policy-Report-Only: /m);
    expect(headers).not.toMatch(/^\s+Content-Security-Policy: /m);
  });

  it("allows each <Head /> inline script by the hash of the bytes it emits, with no 'unsafe-inline'", () => {
    const policy = /Content-Security-Policy-Report-Only: (.*)/.exec(headers)![1]!;
    const scriptSrc = policy.split('; ').find((d) => d.startsWith('script-src '))!;
    expect(scriptSrc).toContain(hash(THEME_SCRIPT));
    expect(scriptSrc).toContain(hash(CONSENT_STUB));
    expect(scriptSrc).not.toContain('unsafe-inline');
  });
});

/**
 * The emdash seed's navigation: three menus, and every URL in them must land on
 * a page the same seed creates. A seeded link that 404s is the first thing a new
 * site's visitor (and any later audit of its routes) finds.
 */
describe('emdash seed menus', () => {
  const seed = JSON.parse(readFileSync(join(TEMPLATES, 'emdash', 'seed', 'seed.json'), 'utf8')) as {
    menus: { name: string; items: { url: string; label: string }[] }[];
    content: { pages: { slug: string }[] };
  };

  it('ships exactly primary, footer-sitemap and footer-legal', () => {
    expect(seed.menus.map((m) => m.name)).toEqual(['primary', 'footer-sitemap', 'footer-legal']);
  });

  it('keeps the logo as the home link: primary holds Contact only', () => {
    const primary = seed.menus.find((m) => m.name === 'primary')!;
    expect(primary.items.map((i) => i.url)).toEqual(['/contact']);
  });

  it('points footer-legal at the three `vitops legal` documents', () => {
    const legal = seed.menus.find((m) => m.name === 'footer-legal')!;
    expect(legal.items.map((i) => i.url)).toEqual(['/privacy', '/terms', '/cookies']);
  });

  it('resolves every menu item to a seeded page', () => {
    const slugs = new Set(seed.content.pages.map((p) => p.slug));
    for (const menu of seed.menus)
      for (const item of menu.items) {
        const slug = item.url === '/' ? 'home' : item.url.slice(1);
        expect(slugs.has(slug), `${menu.name}: ${item.url} has no seeded page`).toBe(true);
      }
  });
});
