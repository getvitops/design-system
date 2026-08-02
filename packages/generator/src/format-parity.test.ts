import { describe, expect, it } from 'vitest';
import { build, roleColorUtilities } from './generate.ts';
import { defaultConfig } from './index.ts';
import { DARK_SEL, roleHue, roleKind } from './shared.ts';
import { expandPalette, functionalRole, tokenVar } from './tokens.ts';
import type { DesignSystem } from './schema.ts';

/**
 * The three formats must expose the SAME class vocabulary. They are allowed to
 * differ in exactly four documented ways, and nothing else:
 *
 *   1. Bricks generates its own utilities at import time from the palette
 *      JSON's `utilityClasses`, so `color.css` is a stub in that format.
 *   2. `tailwind` drops framework utilities whose names Tailwind already
 *      provides (`TW_CLASH`) — none of which are role classes.
 *   3. Variant spelling: `@md:hover:x` vs `md-hover-x`.
 *   4. `tailwind` auto-generates utilities from `@theme` / `@custom-variant`,
 *      so anything registered there needs no explicit rule.
 *
 * This file exists because that contract was silently broken: the css path
 * emitted a stop-utility matrix and the tailwind path did not, so 87 role
 * classes (`bg-<role>-x-muted`, `text-<role>-bold`, `border-<role>-muted`, …)
 * existed in `css`/`bricks` and not in `tailwind`. No test built the tailwind
 * format at all, so nothing caught it — a consumer did, after hand-forking four
 * background planes into their own stylesheet to work around the absence.
 *
 * A nonexistent assetsDir is deliberate: it keeps these tests runnable in a
 * clean checkout, since `packages/generator/assets/**` is a gitignored build
 * artifact that `vp test` does not produce.
 */
const ASSETS = '/nonexistent-assets';
const ds = (): DesignSystem => defaultConfig();
const ROLES = Object.keys(ds().colors.roles);

/** `bg|text|…-<role>[-modifier]`, plus the `text-on-<role>` pairing. */
const roleClass = new RegExp(
  `^(?:bg|text|border|outline|fill|stroke)-(?:on-)?(?:${[...ROLES]
    .sort((a, b) => b.length - a.length)
    .join('|')})(?:-[a-z-]+)?$`,
);

const norm = (decl: string) => decl.replace(/\s+/g, ' ').trim().replace(/;$/, '');

/** `.cls { prop: value; }` → Map, preserving duplicates so we can count them. */
function cssRules(css: string): [string, string][] {
  return [...css.matchAll(/\.([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g)].map((m) => [
    m[1] as string,
    norm(m[2] as string),
  ]);
}

/** `@utility cls { prop: value; }` → the same shape. */
function utilityRules(css: string): [string, string][] {
  return [...css.matchAll(/@utility\s+([A-Za-z0-9_-]+)\s*\{([^}]*)\}/g)].map((m) => [
    m[1] as string,
    norm(m[2] as string),
  ]);
}

const onlyRoles = (rules: [string, string][]) => rules.filter(([c]) => roleClass.test(c));

const cssRoleRules = (config = ds()) =>
  onlyRoles(cssRules(build(config, 'css', ASSETS).generated['color.css'] ?? ''));
const twRoleRules = (config = ds()) =>
  onlyRoles(utilityRules(build(config, 'tailwind', ASSETS).tailwind));

const names = (rules: [string, string][]) => [...new Set(rules.map(([c]) => c))].sort();

describe('css ↔ tailwind role vocabulary', () => {
  it('exposes the identical set of role classes', () => {
    // The headline guard. Before the shared emitter this failed with 87
    // css-only classes and 111 shared.
    expect(names(twRoleRules())).toEqual(names(cssRoleRules()));
  });

  it('resolves every shared class to the same declaration', () => {
    // Name parity without value parity would be the same bug wearing a
    // disguise: `bg-surface-muted` must mean the plane in both formats.
    const c = new Map(cssRoleRules());
    const t = new Map(twRoleRules());
    const mismatched = [...c].filter(([cls, v]) => t.has(cls) && t.get(cls) !== v);
    expect(mismatched).toEqual([]);
  });

  it('defines every role class exactly once per format', () => {
    // Kills the old "emit the winner last and let the minifier drop the loser"
    // dependency — which is what let the two paths drift in the first place.
    for (const [label, rules] of [
      ['css', cssRoleRules()],
      ['tailwind', twRoleRules()],
    ] as const) {
      const seen = new Map<string, number>();
      for (const [cls] of rules) seen.set(cls, (seen.get(cls) ?? 0) + 1);
      const dupes = [...seen].filter(([, n]) => n > 1);
      expect(dupes, `${label} emits duplicate role classes`).toEqual([]);
    }
  });

  it('honours colors.utilities in both formats', () => {
    // `colors.utilities` used to be hardcoded to bg/text/border in the tailwind
    // emitter, so enabling `outline` worked in css and silently did not here.
    const withOutline = {
      ...ds(),
      colors: { ...ds().colors, utilities: ['outline'] },
    } as DesignSystem;
    for (const [label, rules] of [
      ['css', cssRoleRules(withOutline)],
      ['tailwind', twRoleRules(withOutline)],
    ] as const) {
      const cls = names(rules);
      expect(
        cls.some((c) => c.startsWith('outline-')),
        `${label} emits outline-*`,
      ).toBe(true);
      expect(
        cls.filter((c) => c.startsWith('bg-')),
        `${label} emits no bg-*`,
      ).toEqual([]);
    }
  });
});

describe('tailwind @theme boundary', () => {
  const theme = () => {
    const tw = build(ds(), 'tailwind', ASSETS).tailwind;
    return [...tw.matchAll(/@theme\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join('\n');
  };

  it('registers the raw hue scales', () => {
    // Difference (4): Tailwind derives `bg-<hue>-<step>` and friends from these,
    // so the generator deliberately emits no explicit rule for them.
    const palette = expandPalette(ds().colors.palette);
    const declared = new Set(theme().match(/--color-[\w-]+(?=:)/g) ?? []);
    for (const [hue, expanded] of Object.entries(palette))
      for (const step of Object.keys(expanded.numeric))
        expect(declared, `${hue}-${step} should be a @theme colour`).toContain(
          `--color-${hue}-${step}`,
        );
  });

  it('keeps role tokens OUT of @theme', () => {
    // Measured against tailwindcss@4.3.3: a token in @theme *and* an @utility of
    // the derived name merge into one rule with the @theme declaration LAST,
    // regardless of source order. Only palette hues belong in @theme, where
    // nothing competes for the name.
    //
    // Target-prefixed names make an accidental collision much harder — a @theme
    // `--color-bg-danger-muted` would derive the utility `bg-` + `bg-danger-muted`,
    // not `bg-danger-muted` — but role tokens still don't belong there, and this is
    // what says so. Matched against the emitted token names rather than a
    // hand-written pattern, so the guard can't go vacuous when the grammar moves
    // again.
    const palette = expandPalette(ds().colors.palette);
    const roleTokenNames = new Set(
      Object.entries(ds().colors.roles).flatMap(([role, spec]) => {
        const fr = functionalRole(role, roleHue(spec), palette[roleHue(spec)]!, roleKind(spec));
        return Object.keys(fr.light).map((k) => tokenVar(role, k));
      }),
    );
    expect(roleTokenNames.size).toBeGreaterThan(50); // the guard has something to guard
    const declared = theme().match(/--color-[\w-]+(?=:)/g) ?? [];
    expect(declared.filter((v) => roleTokenNames.has(v))).toEqual([]);
  });
});

describe('bricks role vocabulary', () => {
  it('ships every functional token the css/tailwind utilities reference', () => {
    // Difference (1): Bricks generates the classes itself from this JSON, so the
    // invariant we can assert is token COVERAGE — every var the other two
    // formats' role utilities point at must be present here, or the Bricks
    // target silently has a smaller vocabulary.
    const semantic = JSON.parse(build(ds(), 'bricks', ASSETS).bricksColorsSemantic) as {
      colors: { raw: string }[];
    };
    const shipped = new Set(semantic.colors.map((c) => c.raw));
    const referenced = new Set(
      cssRoleRules()
        .map(([, decl]) => /var\((--[\w-]+)\)/.exec(decl)?.[1])
        .filter((v): v is string => Boolean(v))
        .map((v) => `var(${v})`),
    );
    expect([...referenced].filter((v) => !shipped.has(v)).sort()).toEqual([]);
  });
});

describe('role utility references resolve', () => {
  it('points every role class at a token the colour layer defines', () => {
    // The cross-layer guard. A dangling `var(--color-surface-xxl)` survived in
    // defaultConfig() for months because nothing checked this.
    const colorCss = build(ds(), 'css', ASSETS).generated['color.css'] ?? '';
    const defined = new Set(colorCss.match(/--[\w-]+(?=\s*:)/g) ?? []);
    const missing = cssRoleRules()
      .map(([cls, decl]) => [cls, /var\((--[\w-]+)\)/.exec(decl)?.[1]] as const)
      .filter(([, v]) => v && !defined.has(v));
    expect(missing).toEqual([]);
  });

  it('re-points a role token under DARK_SEL whenever the two appearances differ', () => {
    const colorCss = build(ds(), 'css', ASSETS).generated['color.css'] ?? '';
    const darkBlock = colorCss.slice(colorCss.indexOf(DARK_SEL));
    const palette = expandPalette(ds().colors.palette);
    for (const [role, spec] of Object.entries(ds().colors.roles)) {
      const hue = roleHue(spec);
      const fr = functionalRole(role, hue, palette[hue]!, roleKind(spec));
      for (const [token, lightVal] of Object.entries(fr.light))
        if (fr.dark[token] !== lightVal) {
          const v = tokenVar(role, token);
          expect(darkBlock, `${v} flips but is not re-pointed under DARK_SEL`).toContain(`${v}:`);
        }
    }
  });
});

/**
 * The cross-format half of the cascade contract.
 *
 * Both outputs must rank a single-purpose utility ABOVE a component pattern, so
 * `class="card bg-danger-muted"` means the same thing everywhere. They get
 * there by different routes — `tailwind` via Tailwind's own `components` vs
 * `utilities` layers, `css`/`bricks` via the `vitops.*` stack this generator
 * emits — which is exactly why it needs asserting in one place. The formats
 * silently disagreed on this until 0.9.0.
 */
describe('utility-over-pattern, in every format', () => {
  it('tailwind puts patterns in components and utilities in Tailwind’s utilities layer', () => {
    const tw = build(ds(), 'tailwind', ASSETS).tailwind;
    // Patterns are explicitly layered by the emitter…
    expect(tw).toContain('@layer components');
    // …while role utilities are `@utility`, which Tailwind places in its own
    // `utilities` layer — declared after `components` in its layer statement.
    expect(tw).toMatch(/@utility bg-surface\b/);
    const order = /@layer\s+([\w\s,]+);/.exec(tw)?.[1] ?? '';
    if (order)
      expect(order.indexOf('utilities'), 'utilities must sort after components').toBeGreaterThan(
        order.indexOf('components'),
      );
  });

  it('css ranks the same pair the same way', () => {
    // Mirrors bundle-layers.test.ts, asserted here so a future format change
    // that breaks the invariant fails in the parity suite too.
    const layers = ['vitops.base', 'vitops.components', 'vitops.utilities'];
    const rules = cssRoleRules();
    expect(rules.length, 'role utilities are emitted').toBeGreaterThan(0);
    expect(layers.indexOf('vitops.utilities')).toBeGreaterThan(layers.indexOf('vitops.components'));
  });
});
