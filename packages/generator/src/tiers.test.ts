import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TIERS, TIER_NAMES, tierPatterns, tierTags } from './tiers.ts';
import { defaultConfig } from './index.ts';

/**
 * `patterns.items` is CONSUMER-authored — `defaultConfig()` declares only
 * `btn`/`cta`/`card`. The reference set for "which patterns are config-authored" is
 * therefore this repo's own `src/design-system.json`, which is both the dogfood
 * config and what the docs render from.
 */
function repoPatternItems(): string[] {
  const ds = JSON.parse(readFileSync(join(ROOT, 'src', 'design-system.json'), 'utf8')) as {
    patterns?: { items?: Record<string, unknown> };
  };
  return Object.keys(ds.patterns?.items ?? {});
}

/**
 * `TIERS` is authored, so the only thing keeping it honest is these guards. Each one
 * answers "did someone add a file and forget to register it" — the failure this
 * whole manifest exists to prevent, because an unregistered pattern is simply
 * missing from the docs while everything still builds and reports success.
 *
 * Paths are resolved against the repo's own source, not the generator's `assets/`
 * snapshot, so the guards run in a clean checkout before any build.
 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const CORE_CSS = join(ROOT, 'packages', 'core', 'css');
const WC_DIR = join(ROOT, 'packages', 'core', 'src', 'web-components');

/** Hand-written pattern partials, `patterns/<name>.css`. */
function patternPartials(): string[] {
  return readdirSync(join(CORE_CSS, 'patterns'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `patterns/${f}`)
    .sort();
}

/**
 * Every `customElements.define` in the component directory.
 *
 * Line-based and comment-aware on purpose: `BaseElement.ts` carries a commented-out
 * template, and a naive whole-file grep also matches the block comment in
 * `elements.ts` that NAMES the unregistered components — which is exactly the
 * mistake that produced a wrong inventory while writing this.
 */
function definedTags(): { tag: string; file: string }[] {
  const out: { tag: string; file: string }[] = [];
  for (const f of readdirSync(WC_DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
    for (const line of readFileSync(join(WC_DIR, f), 'utf8').split('\n')) {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue; // commented out
      const m = /customElements\.define\(\s*'([^']+)'/.exec(line);
      if (m) out.push({ tag: m[1]!, file: f });
    }
  }
  return out;
}

/** Components imported by `elements.js` — the shipped set. */
function bundledTags(): Set<string> {
  const els = readFileSync(join(ROOT, 'packages', 'core', 'src', 'js', 'elements.ts'), 'utf8');
  const bundled = new Set<string>();
  const imported = [...els.matchAll(/^import '\.\.\/web-components\/(WC\w+)\.js';/gm)].map(
    (m) => m[1]!,
  );
  for (const base of imported) {
    const src = readFileSync(join(WC_DIR, `${base}.ts`), 'utf8');
    const m = /customElements\.define\(\s*'([^']+)'/.exec(src);
    if (m) bundled.add(m[1]!);
  }
  return bundled;
}

describe('the wc-* prefix rule', () => {
  /**
   * The rule this release installs. Without a guard it is a convention that gets
   * re-violated and nothing notices — `color-scheme-toggle` and `wc-multifield` are
   * the proof that it happens.
   */
  it('every registered custom element is wc-* prefixed', () => {
    const bad = definedTags().filter(({ tag }) => !tag.startsWith('wc-'));
    expect(bad, `not wc-* prefixed: ${bad.map((b) => `${b.tag} (${b.file})`).join(', ')}`).toEqual(
      [],
    );
  });

  it('and so is every tag the manifest claims', () => {
    for (const { tag, pattern } of tierTags()) expect(tag, `TIERS.${pattern}`).toMatch(/^wc-/);
  });
});

describe('TIERS covers what is on disk', () => {
  it('every hand-written CSS pattern partial is registered', () => {
    const claimed = new Set(
      Object.values(TIERS).flatMap((e) => (e.css.partial ? [e.css.partial] : [])),
    );
    const missing = patternPartials().filter((p) => !claimed.has(p));
    expect(
      missing,
      `partials no TIERS entry claims — add them, or the docs silently omit them:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every registered custom element is in TIERS, with the right bundle status', () => {
    const known = new Map(tierTags().map((t) => [t.tag, t]));
    const bundled = bundledTags();
    for (const { tag, file } of definedTags()) {
      const entry = known.get(tag);
      expect(entry, `${tag} (${file}) is defined but absent from TIERS`).toBeDefined();
      // `registered` drives what the docs tell a consumer to load, so a component
      // moved into or out of elements.js must be reflected here.
      expect(entry!.registered, `${tag}: TIERS says registered=${entry!.registered}`).toBe(
        bundled.has(tag),
      );
    }
  });

  it('every pattern-bearing Astro component is in TIERS', () => {
    const pkg = JSON.parse(
      readFileSync(join(ROOT, 'packages', 'astro', 'package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };
    // Infrastructure emits no pattern markup, and TreeNode is Tree's internal recursion.
    const INFRA = new Set([
      'Head',
      'Seo',
      'Analytics',
      'Ads',
      'Tracking',
      'NodeRenderer',
      'WebComponentLoader',
      'TreeNode',
    ]);
    const flat = (v: unknown): string[] =>
      typeof v === 'string'
        ? [v]
        : v && typeof v === 'object'
          ? Object.values(v as Record<string, unknown>).flatMap(flat)
          : [];
    const components = new Set(
      Object.values(pkg.exports)
        .flatMap(flat)
        .filter((p) => p.endsWith('.astro'))
        .map((p) => p.split('/').pop()!.replace('.astro', ''))
        .filter((n) => !INFRA.has(n)),
    );
    const claimed = new Set(
      Object.values(TIERS).flatMap((e) =>
        (e.astro ?? []).map((x) => x.component.split('/').pop()!.replace('.astro', '')),
      ),
    );
    const missing = [...components].filter((n) => !claimed.has(n));
    expect(missing, `exported Astro components absent from TIERS: ${missing.join(', ')}`).toEqual(
      [],
    );

    /**
     * The converse, on the WHOLE specifier rather than the basename. The check above
     * compares file names, so it passed a `component` of
     * `@getvitops/astro/components/../CookieConsent.astro` — produced by handing the
     * `components/` shorthand a `../` name. It reads plausibly, the basename matches,
     * and it is not an importable export: `CookieConsent.astro` ships from the
     * package root. The docs publish these verbatim as the import to copy, so a
     * wrong one fails first in a consumer's project.
     */
    const exported = new Set(
      Object.keys(pkg.exports)
        .filter((k) => k.endsWith('.astro'))
        .map((k) => `@getvitops/astro${k.slice(1)}`),
    );
    const unimportable = Object.entries(TIERS).flatMap(([name, e]) =>
      (e.astro ?? [])
        .filter((x) => !exported.has(x.component))
        .map((x) => `${name} → ${x.component}`),
    );
    expect(
      unimportable,
      `TIERS specifiers that are not exports of @getvitops/astro:\n  ${unimportable.join('\n  ')}`,
    ).toEqual([]);
  });

  it('every Bricks element is in TIERS', () => {
    const dir = join(ROOT, 'bricks', 'elements');
    const names = readdirSync(dir)
      .filter((f) => f.endsWith('.php'))
      .map((f) => /public\s+\$name\s*=\s*'([^']+)'/.exec(readFileSync(join(dir, f), 'utf8'))?.[1])
      .filter((n): n is string => Boolean(n));
    const claimed = new Set(Object.values(TIERS).flatMap((e) => (e.bricks ? [e.bricks] : [])));
    const missing = names.filter((n) => !claimed.has(n));
    expect(missing, `Bricks elements absent from TIERS: ${missing.join(', ')}`).toEqual([]);
  });

  /**
   * A config-authored pattern has the token cascade, `states` and role variants; a
   * structural partial does not. Getting `generated` wrong tells a reader they can
   * use `cta-danger`-style role variants on a pattern that has none.
   */
  it('every patterns.items key is in TIERS and flagged generated', () => {
    const items = repoPatternItems();
    expect(items.length).toBeGreaterThan(20);
    for (const name of items) {
      expect(TIERS[name], `patterns.items.${name} has no TIERS entry`).toBeDefined();
      expect(TIERS[name]!.css.generated, `TIERS.${name}.css.generated`).toBe(true);
    }
  });

  /** The shipped defaults are a subset, and must also be covered. */
  it("the default config's own patterns are covered", () => {
    for (const name of Object.keys(defaultConfig().patterns?.items ?? {})) {
      expect(TIERS[name], `defaultConfig patterns.items.${name} has no TIERS entry`).toBeDefined();
      expect(TIERS[name]!.css.generated).toBe(true);
    }
  });

  it('nothing claims `generated` that the reference config does not declare', () => {
    const items = new Set(repoPatternItems());
    const lying = Object.entries(TIERS)
      .filter(([name, e]) => e.css.generated && !items.has(name))
      .map(([name]) => name);
    expect(lying, `claim generated but absent from patterns.items: ${lying.join(', ')}`).toEqual(
      [],
    );
  });
});

describe('TIERS entries are usable', () => {
  it('every entry says what to write', () => {
    for (const name of TIER_NAMES) {
      const use = TIERS[name]!.use;
      expect(use.length, `TIERS.${name}.use is too thin to help`).toBeGreaterThan(20);
    }
  });

  it('records whether an Astro component wraps a web component', () => {
    // The distinction an agent cannot infer: `Tree` and `CookieConsent` emit the
    // `<wc-*>` tag themselves; `Details`/`Drawer`/`Popover` have no component at all.
    expect(TIERS['tree']!.astro![0]!.wraps).toBe('wc');
    expect(TIERS['consent']!.astro![0]!.wraps).toBe('wc');
    expect(TIERS['details']!.astro![0]!.wraps).toBe('css');
    // Anything claiming to wrap a wc must actually have one.
    for (const [name, e] of Object.entries(TIERS))
      if ((e.astro ?? []).some((x) => x.wraps === 'wc'))
        expect(e.wc, `TIERS.${name} wraps 'wc' but has no wc`).toBeDefined();
  });

  it('warns against double-wrapping where the Astro component emits the tag', () => {
    // The trap this release exists to close: `<wc-tree><Tree /></wc-tree>`.
    expect(TIERS['tree']!.use).toMatch(/do NOT add your own wrapper/i);
  });
});

describe('tierPatterns projects one tier at a time', () => {
  it('agrees with the optional fields for the three component tiers', () => {
    for (const tier of ['wc', 'astro', 'bricks'] as const) {
      const projected = new Set(tierPatterns(tier).map((p) => p.name));
      const expected = TIER_NAMES.filter((n) => {
        const e = TIERS[n]!;
        return tier === 'wc' ? !!e.wc : tier === 'astro' ? !!e.astro?.length : !!e.bricks;
      });
      expect([...projected], `tierPatterns('${tier}')`).toEqual(expected);
    }
  });

  it('excludes patterns that carry no CSS at all', () => {
    // `TierEntry.css` is required, so presence is not membership. The editor-v2
    // entries carry `c([])` — no partial, no classes, not generated — and listing
    // them on a CSS page would promise classes that don't exist.
    const css = new Set(tierPatterns('css').map((p) => p.name));
    expect(css.has('color-wheel')).toBe(false);
    expect(css.has('oklch-color-picker')).toBe(false);
    expect(css.has('tree')).toBe(true);
    // A bare generated pattern has no partial and still belongs.
    expect(css.has('btn')).toBe(true);
    for (const { name, entry } of tierPatterns('css'))
      expect(
        !!entry.css.partial || entry.css.classes.length > 0 || entry.css.generated,
        `tierPatterns('css') includes ${name} with nothing to show`,
      ).toBe(true);
  });

  it('projects every pattern into at least one tier', () => {
    // A pattern in no projection is in the manifest and on no page — the silent
    // omission the guards above exist to prevent, one level up.
    const seen = new Set(
      (['css', 'wc', 'astro', 'bricks'] as const).flatMap((t) =>
        tierPatterns(t).map((p) => p.name),
      ),
    );
    const orphans = TIER_NAMES.filter((n) => !seen.has(n));
    expect(orphans, `patterns no tier projection carries: ${orphans.join(', ')}`).toEqual([]);
  });

  it('returns entries in TIER_NAMES order', () => {
    const names = tierPatterns('wc').map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });
});
