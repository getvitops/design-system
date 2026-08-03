import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  build,
  CHUNK_LAYER,
  CSS_LAYERS,
  layerForPartial,
  roleColorUtilities,
  splitBasis,
  TAILWIND_SKIP,
} from './generate.ts';
import { LAYER_CONTRACT } from './layer-contract.ts';
import { defaultConfig } from './index.ts';
import { DARK_SEL, TW_CLASH, roleHue, roleKind } from './shared.ts';
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

describe('css ↔ tailwind typography', () => {
  const twCss = () => build(ds(), 'tailwind', ASSETS).tailwind;
  const cssTypo = () => build(ds(), 'css', ASSETS).generated['typography.css'] ?? '';

  it('binds every typography.headings element in BOTH formats', () => {
    // The tailwind path emitted only the `@utility font-<role>` half of
    // typography.css and silently dropped the bare-element bindings, so a
    // Tailwind consumer's <h1> and <body> carried no role styling at all — no
    // family, no size, no text-wrap — while css/bricks styled them.
    const bindings = Object.entries(ds().typography?.headings ?? {});
    expect(bindings.length).toBeGreaterThan(0); // the guard has something to guard
    const tw = twCss();
    const css = cssTypo();
    for (const [tag] of bindings) {
      expect(css, `css binds ${tag}`).toMatch(new RegExp(`(^|\\n)${tag}\\s*\\{`));
      expect(tw, `tailwind binds ${tag}`).toMatch(new RegExp(`\\n\\s*${tag}\\s*\\{`));
    }
  });

  it('keeps those bindings in Tailwind’s base layer', () => {
    // Load-bearing: unlayered, an `h1` rule beats every Tailwind utility, so
    // `.font-body` on a heading would stop working. `base` also puts it behind
    // the patterns, matching css/bricks where the bare tag loses to
    // `.font-<role>` on specificity.
    const tw = twCss();
    const base = /@layer base \{([\s\S]*?)\n\}/.exec(tw)?.[1] ?? '';
    for (const tag of Object.keys(ds().typography?.headings ?? {}))
      expect(base, `${tag} is inside @layer base`).toMatch(new RegExp(`\\n\\s*${tag}\\s*\\{`));
  });

  it('gives every type role a text-wrap in all three formats', () => {
    // `text-wrap` is emitted at its identity for roles that omit it, so a role
    // missing the declaration means the emitter dropped the key, not that the
    // config left it out. Guards css/bricks and tailwind together, since the two
    // reach `roleDecls` by different paths.
    const roles = Object.keys(ds().typography?.roles ?? {});
    expect(roles.length).toBeGreaterThan(0);
    const perFormat: [string, [string, string][]][] = [
      ['css', cssRules(cssTypo())],
      ['bricks', cssRules(build(ds(), 'bricks', ASSETS).generated['typography.css'] ?? '')],
      ['tailwind', utilityRules(twCss())],
    ];
    for (const [label, rules] of perFormat) {
      const byName = new Map(rules);
      for (const role of roles)
        expect(byName.get(`font-${role}`), `${label} font-${role} sets text-wrap`).toMatch(
          /text-wrap:/,
        );
    }
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
    // This used to build `const layers = ['vitops.base', …]` locally and assert
    // `indexOf('utilities') > indexOf('components')` — i.e. 2 > 1 on a literal it
    // had just written. It could not fail. Assert the real mapping instead, which
    // still runs in a clean checkout because CHUNK_LAYER is data, not an artifact.
    expect(layerForPartial('layout.css')).toBe('vitops.components');
    expect(layerForPartial('layout-utilities.css')).toBe('vitops.utilities');
    expect(layerForPartial('utilities.css')).toBe('vitops.utilities');
    expect(layerForPartial('patterns/reveal.css'), 'unmapped ⇒ components').toBe(
      'vitops.components',
    );
    expect(
      CSS_LAYERS.indexOf(layerForPartial('layout-utilities.css')),
      'the utility half must outrank the pattern half',
    ).toBeGreaterThan(CSS_LAYERS.indexOf(layerForPartial('layout.css')));
  });

  it('skips every utilities-mapped partial in the tailwind build', () => {
    // The guard for a failure that is otherwise INVISIBLE. A utilities partial
    // left out of TAILWIND_SKIP gets inlined into tailwind's `@layer components`
    // — the exact inversion this contract exists to remove — but every class in
    // it already exists as an `@utility` that wins on layer, so you get ~30 dead
    // rules, no visual change, and no failing assertion anywhere else.
    //
    // One-way on purpose: `layout.css` is skipped while sitting in `components`,
    // because the tailwind path re-emits its structure by hand.
    const utilityPartials = Object.entries(CHUNK_LAYER)
      .filter(([rel, layer]) => layer === 'vitops.utilities' && !rel.startsWith('generated/'))
      .map(([rel]) => rel);
    expect(utilityPartials.length, 'the guard has something to guard').toBeGreaterThan(0);
    for (const rel of utilityPartials)
      expect(TAILWIND_SKIP.has(rel), `${rel} is vitops.utilities, so tailwind must skip it`).toBe(
        true,
      );
  });
});

/**
 * The tailwind half of the cross-format layer contract, against the same
 * `LAYER_CONTRACT` list `bundle-layers.test.ts` asserts on the css bundle. Two
 * sites, one list — that is what makes it a ⇔ instead of two lists free to drift.
 *
 * Asset-free on purpose: the emitter is the source for all three buckets, so
 * this half runs in a clean checkout even though the css half cannot.
 */
describe('layer contract — tailwind output', () => {
  const tw = () => build(ds(), 'tailwind', ASSETS).tailwind;
  const utilityNames = () => new Set(utilityRules(tw()).map(([c]) => c));

  it('emits every pattern as CSS, never as an @utility', () => {
    // An `@utility` always lands in Tailwind's utilities layer (their docs say so,
    // and it is why `@utility` cannot be nested in a layer at all). So a pattern
    // emitted that way outranks the utilities that should override it — which is
    // what `.split` did until this change.
    const util = utilityNames();
    for (const cls of LAYER_CONTRACT.components)
      expect(util.has(cls), `.${cls} is a pattern, not an @utility`).toBe(false);
  });

  it('emits every utility as an @utility', () => {
    const util = utilityNames();
    for (const cls of LAYER_CONTRACT.utilities)
      expect(util.has(cls), `.${cls} must be an @utility`).toBe(true);
  });

  it('defers to Tailwind for the names it already ships', () => {
    const util = utilityNames();
    for (const cls of LAYER_CONTRACT.tailwindOwns) {
      expect(TW_CLASH.has(cls), `${cls} must be declared in TW_CLASH`).toBe(true);
      expect(util.has(cls), `${cls} is Tailwind's — we must not redefine it`).toBe(false);
    }
  });
});

/**
 * The split family, in both formats.
 *
 * `.split` is the one layout primitive whose CSS lives in TWO places — the
 * literal rules in `layout.css` (css/bricks) and a hand-written re-emit in the
 * tailwind path, because both layout partials are skipped there. Two copies of
 * one contract is the arrangement that let 87 role classes drift, so it gets
 * asserted rather than trusted.
 *
 * The contract:
 *   • the ratio is a flex BASIS, not a grow factor — grow shares out only the
 *     free space, which excludes a child's padding, so a padded column used to
 *     come out wider than its sibling by exactly its padding (measured 540/460
 *     in an equal 1000px split) while the ratio classes looked fine;
 *   • the basis is scoped to a two-child split, because a ratio is a pair
 *     contract and a middle child with no basis would collapse to zero;
 *   • `min-inline-size: 0` and `box-sizing: border-box` are the pattern's job.
 *
 * Note what is NOT asserted: the relative order of a bare ratio and `flex-col`.
 * Measured against tailwindcss@4.3.3, Tailwind's sort of custom utilities is
 * property-based and FLIPS when a declaration is added to the utility body —
 * `@utility split-1-2 { flex-direction: row }` puts `flex-col` first, and adding
 * `--_split-a: 1` puts `split-1-2` first. It is not a contract in either
 * direction, and an earlier version of this suite encoded that artifact.
 *
 * The css side needs the layout partials, which live in the gitignored
 * `assets/` build artifact, so it skips rather than fails in a clean checkout.
 */
describe('css ↔ tailwind split', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const assets = join(HERE, '..', 'assets');
  const cssPath = (rel: string) => join(assets, 'css', rel);
  const hasLayout = existsSync(cssPath('layout.css'));
  const layout = () => readFileSync(cssPath('layout.css'), 'utf8');
  const layoutUtils = () => readFileSync(cssPath('layout-utilities.css'), 'utf8');
  const tw = () => build(ds(), 'tailwind', ASSETS).tailwind;
  /**
   * Every `@layer components` block in the tailwind output, concatenated.
   *
   * Brace-matched rather than regexed: the emitter writes the structure literal's
   * rules at column 0 inside the layer, so a non-greedy `[\s\S]*?\n\}` stops at
   * the first inner rule and silently returns a fragment.
   */
  const twComponents = () => {
    const css = tw();
    const out: string[] = [];
    const NEEDLE = '@layer components {';
    for (let i = css.indexOf(NEEDLE); i !== -1; i = css.indexOf(NEEDLE, i + 1)) {
      let depth = 0;
      for (let j = i + NEEDLE.length - 1; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) {
          out.push(css.slice(i + NEEDLE.length, j));
          break;
        }
      }
    }
    return out.join('\n');
  };
  const twUtilities = () =>
    new Map(
      [...tw().matchAll(/@utility\s+([A-Za-z0-9_-]+)\s*\{([\s\S]*?)\n\}/g)].map((m) => [
        m[1] as string,
        m[2] as string,
      ]),
    );

  it('emits .split as a COMPONENT, not a utility, in both formats', () => {
    // The headline guard. As an `@utility`, `.split` sat in Tailwind's utilities
    // layer alongside `flex-col`, so which one won came down to Tailwind's
    // property sort. As a component it loses to every utility by layer, in both
    // formats, with no ordering to maintain.
    expect([...twUtilities().keys()], 'no @utility split').not.toContain('split');
    expect(twComponents(), 'tailwind emits .split in @layer components').toMatch(/^\.split \{$/m);
    if (hasLayout) expect(layout(), 'layout.css keeps .split').toMatch(/^\.split \{$/m);
  });

  it('expresses the ratio as a basis in both formats', () => {
    const basis = new RegExp(
      `flex-basis: ${splitBasis('--_split-a').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    );
    expect(twComponents(), 'tailwind').toMatch(basis);
    if (hasLayout) expect(layout(), 'layout.css').toMatch(basis);
  });

  it('scopes the basis to a two-child split in both formats', () => {
    // Without the pair guard the bases of a 3+ child split do not sum to 100%
    // and the middle child, having none of its own, resolves to zero width.
    for (const sel of [':first-child:nth-last-child(2)', ':nth-child(2):last-child']) {
      expect(twComponents(), `tailwind scopes ${sel}`).toContain(sel);
      if (hasLayout) expect(layout(), `layout.css scopes ${sel}`).toContain(sel);
    }
  });

  it('builds min-inline-size: 0 and border-box into the children in both formats', () => {
    // border-box is load-bearing: without it the basis sizes the CONTENT box and
    // padding lands outside the ratio again — the exact defect the basis fixed.
    for (const decl of [/min-inline-size: 0/, /box-sizing: border-box/]) {
      expect(twComponents(), 'tailwind').toMatch(decl);
      if (hasLayout) expect(layout(), 'layout.css').toMatch(decl);
    }
  });

  it('keeps the ratio + reversal modifiers as utilities in both formats', () => {
    const util = twUtilities();
    expect(util.get('split-1-2'), 'a ratio asserts the row').toMatch(/flex-direction:\s*row/);
    expect(util.get('split-reverse')).toMatch(/order:\s*1/);
    if (!hasLayout) return;
    const css = layoutUtils();
    expect(css).toMatch(/\.split-1-2 \{[^}]*flex-direction: row/);
    expect(css).toMatch(/\.split-reverse > :first-child \{[^}]*order: 1/);
    for (const bp of ['sm', 'md', 'lg', 'xl']) {
      expect(css, `.${bp}-split-1-2 asserts the row`).toMatch(
        new RegExp(`\\.${bp}-split-1-2 \\{[^}]*flex-direction: row`),
      );
      expect(css, `.${bp}-split-reverse exists`).toContain(`.${bp}-split-reverse > :first-child`);
    }
  });

  it('ships no bare <bp>-split, in either format', () => {
    // `@utility` cannot live in a layer — measured: it throws inside `@layer` AND
    // inside a file imported with `layer(…)` — so once `.split` became a
    // component, tailwind lost `@md:split` and css/bricks must drop the
    // counterpart or the class works in two formats and not the third.
    // `md-flex-row` says "become a row at md" everywhere.
    if (!hasLayout) return;
    for (const bp of ['sm', 'md', 'lg', 'xl']) {
      expect(layoutUtils(), `.${bp}-split must not exist`).not.toMatch(
        new RegExp(`\\.${bp}-split \\{`),
      );
      expect(layoutUtils(), `.${bp}-flex-row is the replacement`).toContain(`.${bp}-flex-row {`);
    }
  });

  it('puts <bp>-split-* after flex-col, the one intra-layer order that matters', () => {
    // Both live in `vitops.utilities`, so `class="split flex-col md-split-1-2"`
    // un-stacking at the breakpoint IS a source-order fact here. Its tailwind
    // counterpart is Tailwind's own "a variant sorts after the un-varianted
    // utility", which is stable in every configuration measured.
    if (!hasLayout) return;
    const css = layoutUtils();
    const at = (sel: string) => {
      const i = css.indexOf(sel);
      expect(i, `${sel} exists`).toBeGreaterThan(-1);
      return i;
    };
    expect(at('.md-split-1-2 {'), 'a <bp> ratio must override flex-col').toBeGreaterThan(
      at('.flex-col {'),
    );
    expect(at('.md-split-1-2 {'), 'and <bp>-flex-col').toBeGreaterThan(at('.md-flex-col {'));
  });

  it('declares reading-flow wherever it reverses', () => {
    // Reversing puts visual order out of step with DOM order, and focus order
    // follows the DOM (WCAG 2.4.3). `reading-flow` is the real fix where it is
    // supported; the documented rule — focusable content in only one panel — is
    // what holds until then. An unknown property is inert, so this costs nothing.
    expect(twUtilities().get('split-reverse')).toMatch(/reading-flow:\s*flex-visual/);
    if (!hasLayout) return;
    const css = layoutUtils();
    expect(css).toMatch(/\.split-reverse \{[^}]*reading-flow: flex-visual/);
    for (const bp of ['sm', 'md', 'lg', 'xl'])
      expect(css, `.${bp}-split-reverse sets reading-flow`).toMatch(
        new RegExp(`\\.${bp}-split-reverse \\{[^}]*reading-flow: flex-visual`),
      );
  });

  it('defines the reversals TW_CLASH already claims css owns', () => {
    // `flex-row-reverse`/`flex-col-reverse` were listed in TW_CLASH — i.e. the
    // tailwind format defers to Tailwind for them — but css/bricks never defined
    // them, so those two entries were dead and a mirrored row was inexpressible
    // in the two formats that have no fallback.
    if (!hasLayout) return;
    const css = layoutUtils();
    for (const cls of ['flex-row-reverse', 'flex-col-reverse']) {
      expect(TW_CLASH.has(cls), `${cls} is a TW_CLASH name`).toBe(true);
      expect(css, `defines .${cls}`).toMatch(new RegExp(`\\.${cls} \\{`));
      for (const bp of ['sm', 'md', 'lg', 'xl'])
        expect(css, `defines .${bp}-${cls}`).toMatch(new RegExp(`\\.${bp}-${cls} \\{`));
    }
  });
});

/**
 * Gap utilities, in every format.
 *
 * These are new, and they close a hole rather than tidy one: `vitops docs css`
 * advertised a `g` class that was never emitted, so a css/bricks consumer's only
 * honest option was an inline `style="gap: …"` — which is what this repo's own
 * `index.html` did throughout. Tailwind cannot derive them either, because the
 * fluid space steps are deliberately kept out of its `--spacing-*` namespace
 * (named keys there shadow the size scales), so `gap-l` needs an explicit
 * `@utility`. Measured against tailwindcss@4.3.3: that utility is honoured,
 * coexists with the built-in numeric `gap-4`, and accepts variants (`@md:gap-l`).
 */
describe('gap utilities, in every format', () => {
  const gapNames = (rules: [string, string][]) =>
    [...new Set(rules.map(([c]) => c))].filter((c) => /^gap(-[xy])?-/.test(c)).sort();
  const spacingCss = () => build(ds(), 'css', ASSETS).generated['spacing.css'] ?? '';
  /** The step names the token layer actually emits — the thing gap classes point at. */
  const stepNames = () => [
    ...new Set(
      [
        ...(build(ds(), 'css', ASSETS).generated['type-tokens.css'] ?? '').matchAll(
          /--space-([\w-]+)\s*:/g,
        ),
      ].map((m) => m[1] as string),
    ),
  ];

  it('emits the same gap vocabulary in css and tailwind', () => {
    const css = gapNames(cssRules(spacingCss()));
    const tw = gapNames(utilityRules(build(ds(), 'tailwind', ASSETS).tailwind));
    expect(css.length, 'the guard has something to guard').toBeGreaterThan(10);
    expect(tw).toEqual(css);
  });

  it('covers every space step x gap / gap-x / gap-y', () => {
    // The whole matrix, not a useful-looking subset: an undefined step produces
    // no rule and no error in EITHER format, so a missing `gap-x-2xl` would be
    // indistinguishable from a working one. Derived from the emitted `--space-*`
    // tokens rather than a hand-written list, so it can't go stale.
    const steps = stepNames();
    expect(steps.length).toBeGreaterThan(0);
    const byName = new Map(cssRules(spacingCss()));
    for (const n of steps)
      for (const [cls, prop] of [
        [`gap-${n}`, 'gap'],
        [`gap-x-${n}`, 'column-gap'],
        [`gap-y-${n}`, 'row-gap'],
      ] as const)
        expect(byName.get(cls), `css .${cls}`).toBe(`${prop}: var(--space-${n})`);
  });

  it('gives css/bricks a breakpoint tier per gap class', () => {
    // Tailwind regenerates these as `@md:gap-l`; the other two formats need them
    // pre-expanded, exactly like the split ratios.
    const spacing = spacingCss();
    const bare = gapNames(cssRules(spacing)).filter((c) => !/^(sm|md|lg|xl)-/.test(c));
    expect(bare.length).toBeGreaterThan(10);
    for (const bp of ['sm', 'md', 'lg', 'xl'])
      for (const cls of bare) expect(spacing, `.${bp}-${cls}`).toContain(`.${bp}-${cls} {`);
  });

  it('emits them for bricks too', () => {
    // Bricks supplies the `--space-*` VARIABLES from its Variables import, but it
    // only generates utility CLASSES for the colour palette — so a bricks build
    // that skipped this file would have tokens and no way to spend them.
    expect(
      gapNames(cssRules(build(ds(), 'bricks', ASSETS).generated['spacing.css'] ?? '')),
    ).toEqual(gapNames(cssRules(spacingCss())));
  });
});

/**
 * Two invariants that became load-bearing only because of the layout split, and
 * one confirmed bug it sat next to.
 */
describe('layout split — knock-on invariants', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const assets = join(HERE, '..', 'assets');
  const hasAssets = existsSync(join(assets, 'css', 'utilities.css'));
  const read = (rel: string) => readFileSync(join(assets, 'css', rel), 'utf8');

  it('keeps utilities.css’s .{bp}-flex re-emit AFTER its own .hidden', () => {
    // `class="hidden md-flex"` reveals at the breakpoint. That used to work by
    // LAYER (utilities.css was vitops.utilities, layout.css vitops.components),
    // so utilities.css's duplicate `.{bp}-flex` rules read as belt-and-braces.
    // Now both files are vitops.utilities and layout-utilities.css comes first,
    // so the duplicate is the ONLY thing beating `.hidden`. Deleting it as
    // "identical declarations" would silently break the reveal idiom.
    if (!hasAssets) return;
    const css = read('utilities.css');
    const hidden = css.indexOf('.hidden {');
    expect(hidden, '.hidden exists').toBeGreaterThan(-1);
    for (const bp of ['sm', 'md', 'lg', 'xl']) {
      const at = css.indexOf(`.${bp}-flex {`);
      expect(at, `.${bp}-flex is re-emitted here`).toBeGreaterThan(-1);
      expect(at, `.${bp}-flex must follow .hidden`).toBeGreaterThan(hidden);
    }
  });

  it('names the body container in the tailwind structure literal', () => {
    // `patterns/scroll-target.css` queries `@container body (…)` for
    // .toc-layout/.toc-sidebar/.toc-inline, and those partials are inlined into
    // the tailwind bundle verbatim. The literal emitted `container-type` without
    // `container-name`, so the TOC was stuck in its narrow layout in this format
    // only — invisible from the css side, which reads the real layout.css.
    const tw = build(ds(), 'tailwind', ASSETS).tailwind;
    expect(tw).toMatch(/body \{[^}]*container-type: inline-size/);
    expect(tw).toMatch(/body \{[^}]*container-name: body/);
  });

  it('keeps components whose name collides with a Tailwind utility', () => {
    // `.sticky` is a pattern; `sticky` is also a Tailwind utility name, and the
    // clash strip matched a rule's leading `.<name>` — deleting patterns/sticky.css
    // from the tailwind bundle wholesale, variants and z-index wiring included.
    if (!hasAssets) return;
    const tw = build(ds(), 'tailwind', assets).tailwind;
    expect(TW_CLASH.has('sticky'), 'the collision is real').toBe(true);
    expect(tw, '.sticky survives the clash strip').toMatch(/^\.sticky \{/m);
    expect(tw, 'and so do its variants').toContain('sticky--bottom');
  });
});
