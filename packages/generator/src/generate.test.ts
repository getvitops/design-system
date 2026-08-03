import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { build } from './generate.ts';
import { defaultConfig } from './index.ts';
import type { DesignSystem } from './schema.ts';

/**
 * The pattern emitter's *selector contract*. These assertions exist because the
 * cascade behaviour of the framework depends on exact specificity:
 *
 *   • element patterns sit at 0-0-0 inside `:where()`, so any explicit class —
 *     a louder pattern (`.cta`) or a component's own BEM rule (`.dialog__close`)
 *     — overrides them with no `!important`;
 *   • class-only patterns stay unwrapped at 0-1-0, or they'd lose to utilities;
 *   • role variants must not outrank a plain class (the old `button.danger` was
 *     0-1-1 and beat `.btn`).
 *
 * A nonexistent assetsDir is fine for `format: 'css'` — `build()` only assembles
 * the generated token/pattern layers; the framework partials are read later, by
 * the bundler in `generate()`.
 */
const patternsOf = (ds: DesignSystem = defaultConfig()) =>
  build(ds, 'css', '/nonexistent-assets').patternsCss;

/** All selectors (the part before `{`) of every rule in the emitted CSS. */
const selectors = (css: string) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '') // comments would otherwise glue onto the first selector
    .split('}')
    .map((chunk) => chunk.split('{')[0] ?? '')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** Split a selector list on top-level commas only — `:where(a, .b)` holds its own. */
const splitList = (sel: string) => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(sel.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(sel.slice(start));
  return parts.map((p) => p.trim()).filter(Boolean);
};

const hasRule = (css: string, selector: string) =>
  selectors(css).some((s) => splitList(s).includes(selector));

describe('pattern selectors', () => {
  it('pairs an element pattern with its class in one zero-specificity rule', () => {
    const css = patternsOf();
    expect(hasRule(css, ':where(button, .btn)')).toBe(true);
    // The bare element selector must never be emitted on its own — that would
    // make `.btn` unusable on a non-<button> host.
    expect(hasRule(css, 'button')).toBe(false);
    expect(hasRule(css, '.btn')).toBe(false);
  });

  it('leaves class-only patterns unwrapped so utilities do not beat them', () => {
    const css = patternsOf();
    expect(hasRule(css, '.cta')).toBe(true);
    expect(css).not.toContain(':where(.cta)');
  });

  it('does not invent a class for element-only patterns', () => {
    const ds = defaultConfig();
    ds.patterns!.items = { plain: { element: 'button', base: { cursor: 'pointer' } } };
    const css = patternsOf(ds);
    expect(hasRule(css, ':where(button)')).toBe(true);
    expect(css).not.toContain('.plain');
  });

  it('emits role variants in both forms, neither outranking a plain class', () => {
    const ds = defaultConfig();
    ds.patterns!.items!.btn!.roles = ['danger'];
    const css = patternsOf(ds);
    // Bare role class on the element (<button class="danger">) …
    expect(hasRule(css, ':where(button, .btn).danger')).toBe(true);
    // … and the <pattern>-<role> form, so it reaches <a class="btn btn-danger">.
    expect(hasRule(css, '.btn-danger')).toBe(true);
    // The pre-existing 0-1-1 form must be gone.
    expect(css).not.toMatch(/(^|[,\s])button\.danger\b/);
  });

  it('applies state pseudos to every selector in a variant list, not just the last', () => {
    const ds = defaultConfig();
    ds.patterns!.items!.btn!.roles = ['danger'];
    const css = patternsOf(ds);
    expect(hasRule(css, ':where(button:focus-visible, .btn:focus-visible).danger')).toBe(true);
    expect(hasRule(css, '.btn-danger:focus-visible')).toBe(true);
  });

  it('keeps an element pattern at zero specificity in its STATE rules too', () => {
    // `:where()` zeroes the element, but a pseudo appended OUTSIDE it does not:
    // `:where(a, .link):hover` is 0-1-0, which tied with `.cta` / `.cta-<role>`
    // and won on source order (`link` is emitted after `cta`). Every
    // `<a class="cta">` therefore flipped to the link colour mid-hover — dark
    // text on a filled button. Inside the `:where()` it is a true 0-0-0.
    const ds = defaultConfig();
    ds.patterns!.items!.link = {
      element: 'a',
      class: 'link',
      default_role: 'ui-primary',
      base: { color: 'var(--color-text-ui-primary)' },
      states: { hover: { step: 1 } },
    };
    const css = patternsOf(ds);
    expect(css).toContain(':where(a:hover, .link:hover)');
    expect(css).not.toContain(':where(a, .link):hover');
  });

  it('leaves the filled CTA foreground alone through every state', () => {
    // The bug this guards is not "the wrong colour is declared" — the right one
    // always was — it is that nothing may out-cascade it. So assert the shape
    // the cascade depends on: no state rule of another pattern may reach a
    // 0-1-0 `color` that could tie with `.cta-<role>`.
    const ds = defaultConfig();
    ds.patterns!.items!.cta!.roles = ['danger'];
    const css = patternsOf(ds);
    expect(hasRule(css, '.cta-danger')).toBe(true);
    expect(css).toMatch(/\.cta-danger\s*\{[^}]*color: var\(--color-text-on-danger\)/);
    // …and the CTA's own hover only touches the fill, never the foreground.
    const hover = /\.cta-danger:hover \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(hover).toContain('background-color:');
    expect(hover).not.toMatch(/(^|;)\s*color:/);
  });
});

describe('pattern fill mode', () => {
  it('honours an explicit fill:false even when base declares a background', () => {
    // `.btn` sets `background: transparent`, which the legacy heuristic would
    // read as "this is a fill" and colour role variants with --<role>-solid.
    const ds = defaultConfig();
    ds.patterns!.items!.btn!.roles = ['danger'];
    const css = patternsOf(ds);
    expect(css).toContain('color: var(--color-text-danger)');
    expect(css).not.toContain(
      'background-color: var(--color-bg-danger-solid); color: var(--color-text-on-danger)',
    );
  });

  it('resolves a fill pattern default background from its default_role', () => {
    // Assert the mechanism, not a particular role — the config is free to point
    // `cta` at whichever role it likes without this needing an edit.
    const ds = defaultConfig();
    const role = ds.patterns!.items!.cta!.default_role!;
    const css = patternsOf(ds);
    expect(css).toMatch(
      // Wrapped in the `--bg-<pattern>` override hook, like every other base
      // property — the role still supplies the value, it is just overridable.
      new RegExp(
        `\\.cta \\{[^}]*background-color: var\\(--bg-cta, var\\(--color-bg-${role}-solid\\)\\)`,
        's',
      ),
    );
    // …and the paired text colour comes from the same role, or the default
    // variant can end up unreadable on its own fill.
    expect(css).toMatch(new RegExp(`\\.cta \\{[^}]*color: var\\(--color-text-on-${role}\\)`, 's'));
  });

  it('gives every base background an override hook, so a fill can be undone', () => {
    // `background` was the one base property with no BASE_HOOK, which made a
    // flat/border-only card inexpressible except by an inline style. Both
    // spellings map to `bg` because patterns author either.
    const ds = defaultConfig();
    const css = patternsOf(ds);
    expect(css).toContain('background: var(--bg-card, var(--color-bg-surface))');
    expect(css).toContain('background: var(--bg-btn, transparent)');
  });

  it('keeps inferring fill for configs that predate the fill key', () => {
    const ds = defaultConfig();
    ds.patterns!.items = {
      badge: {
        class: 'badge',
        default_role: 'neutral',
        base: { padding: '0.2em' },
        roles: ['info'],
      },
    };
    const css = patternsOf(ds);
    // No background in base and no `fill` key — the historical name-based special
    // case must still treat `badge` as a fill. The injected default goes through
    // the `--bg-<pattern>` hook; role VARIANTS are emitted separately and stay
    // unwrapped, so overriding `--bg-badge` doesn't silently defeat `.badge-info`.
    expect(css).toContain('background-color: var(--bg-badge, var(--color-bg-neutral-solid))');
    expect(css).toContain(
      'background-color: var(--color-bg-info-solid); color: var(--color-text-on-info)',
    );
  });
});

/**
 * The tailwind format strips the framework's PRE-EXPANDED breakpoint utilities
 * (`.md-split-1-2`) because Tailwind regenerates them on demand as `@md:`. That
 * strip used to match every `@container (min-width: …)` block, which swept up
 * component *behaviour* too — most visibly the sitenav's desktop layout, so the
 * tailwind format shipped a nav permanently stuck in its mobile state.
 *
 * Needs the framework partials, which live in the gitignored `assets/` build
 * artifact, so skip rather than fail in a clean checkout.
 */
describe('tailwind container-block strip', () => {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const assets = join(HERE, '..', 'assets');
  const hasAssets = existsSync(join(assets, 'css', 'patterns', 'sitenav.css'));
  const tw = () => build(defaultConfig(), 'tailwind', assets).tailwind;

  it.skipIf(!hasAssets)('keeps component container queries', () => {
    const css = tw();
    for (const bp of ['sm', 'md', 'lg', 'xl'])
      expect(css, `.sitenav--bp-${bp} must survive`).toContain(`sitenav--bp-${bp}`);
  });

  it.skipIf(!hasAssets)('still drops pre-expanded breakpoint utilities', () => {
    // These are Tailwind's job in this format (`@md:split-1-2`).
    const css = tw();
    for (const cls of ['.md-split-1-2', '.lg-flex-row', '.sm-items-center'])
      expect(css, `${cls} should be Tailwind's to generate`).not.toContain(cls);
  });
});

/**
 * The typography role key set is CLOSED (`TYPO_KEYMAP`), and an unrecognised key
 * is dropped rather than emitted. That failure is invisible: the role still
 * renders, just without the declaration you asked for.
 *
 * The schema itself advertised `transform` and `decoration` for a while, which
 * are exactly the two plausible-but-wrong short forms — that shipped title-case
 * navigation to production across two deploys. So the warning is the guard, and
 * these assert it names the right replacement rather than only complaining.
 */
describe('typography role keys', () => {
  const withRole = (spec: Record<string, string>) => {
    const ds = defaultConfig();
    ds.typography = { ...ds.typography, roles: { ...ds.typography?.roles, eyebrow: spec } };
    return ds;
  };
  const warningsFor = (ds: DesignSystem) => {
    const seen: string[] = [];
    const real = console.warn;
    console.warn = (...args: unknown[]) => void seen.push(args.join(' '));
    try {
      build(ds, 'css', '/nonexistent-assets');
    } finally {
      console.warn = real;
    }
    return seen.filter((w) => w.includes('typography.roles'));
  };

  it('warns on the short forms, naming the real key', () => {
    const warnings = warningsFor(withRole({ transform: 'uppercase', decoration: 'underline' }));
    expect(warnings).toHaveLength(2);
    expect(warnings.join('\n')).toContain('"text-transform"');
    expect(warnings.join('\n')).toContain('"text-decoration"');
  });

  it('lists the recognised keys for a key it has no suggestion for', () => {
    const warnings = warningsFor(withRole({ colour: 'red' }));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Recognised:');
    expect(warnings[0]).toContain('text-transform');
  });

  it('stays silent on every key it actually maps', () => {
    expect(
      warningsFor(
        withRole({
          family: 'display',
          size: 'sm',
          weight: '700',
          style: 'italic',
          'line-height': '1.2',
          tracking: '0.05em',
          'text-transform': 'uppercase',
          'text-decoration': 'none',
          'text-wrap': 'balance',
          color: 'var(--color-text-muted)',
        }),
      ),
    ).toEqual([]);
  });
});

/**
 * The OS-preference dark block. Opt-in, because switching it on flips a site dark
 * for dark-OS users — that is the site's call, which is why it rides on the site
 * config's `designSystem.defaultColorScheme` rather than on the design system.
 */
describe('prefers-color-scheme block', () => {
  const colorCss = (systemColorScheme: boolean) =>
    build(defaultConfig(), 'css', '/nonexistent-assets', { systemColorScheme }).generated[
      'color.css'
    ] as string;

  it('is absent by default', () => {
    expect(colorCss(false)).not.toContain('prefers-color-scheme');
  });

  it('re-points the same tokens as the explicit-choice block', () => {
    const css = colorCss(true);
    const [, explicit = '', system = ''] =
      /\{([^}]*)\}[\s\S]*?@media \(prefers-color-scheme: dark\)[\s\S]*?\{[\s\S]*?\{([^}]*)\}/.exec(
        css.slice(css.indexOf('Functional role tokens (dark)')),
      ) ?? [];
    const vars = (block: string) => (block.match(/--[\w-]+(?=:)/g) ?? []).sort();
    expect(vars(system).length).toBeGreaterThan(0);
    // Same delta, or the two appearances drift apart depending on how you got there.
    expect(vars(system)).toEqual(vars(explicit));
  });

  it('sits inside the media query, not beside it', () => {
    // Emitted unconditionally it would flip every consumer site dark.
    const css = colorCss(true);
    const at = css.indexOf('@media (prefers-color-scheme: dark)');
    const close = css.indexOf('\n}\n', css.indexOf(':root:not(', at));
    expect(css.slice(at, close)).toContain('--color-bg-neutral');
  });

  it('reaches the tailwind format too', () => {
    const tw = (on: boolean) =>
      build(defaultConfig(), 'tailwind', '/nonexistent-assets', { systemColorScheme: on }).tailwind;
    expect(tw(false)).not.toContain('prefers-color-scheme');
    expect(tw(true)).toContain('@media (prefers-color-scheme: dark)');
  });
});

/**
 * `layout.css` is skipped wholesale in the tailwind format and a hand-maintained
 * subset re-emitted above it. Two families fell through that gap entirely —
 * absent from the format, not present in `TW_CLASH`, and with no Tailwind
 * equivalent to fall back on.
 *
 * That is the worst shape of the bug this round is about: `vitops lint` cannot
 * flag them either, because they are structural classes rather than anything
 * anchored to the consumer's config. A consumer who wrote `grid-auto` got
 * silence and no styling.
 */
describe('tailwind vocabulary parity', () => {
  const tw = () => build(defaultConfig(), 'tailwind', '/nonexistent-assets').tailwind;

  it('emits the auto-fit grid', () => {
    expect(tw()).toContain('@utility grid-auto');
  });

  it('emits every rhythm override, pairs and steps alike', () => {
    const css = tw();
    for (const pair of [
      'h-p',
      'p-p',
      'p-h',
      'h-h',
      'p-list',
      'list-p',
      'li-li',
      'text-media',
      'media-text',
    ])
      expect(css, `m-${pair}`).toContain(`@utility m-${pair} `);
    for (const step of ['0', 'xs', 's', 'm', 'l', 'xl'])
      expect(css, `m-${step}`).toContain(`@utility m-${step} `);
  });

  it('keeps them keyed to the same rhythm variables as the css format', () => {
    // A copy that drifted to literal values would look right and stop responding
    // to `--rhythm-base`, which is the whole point of the scale.
    expect(tw()).toContain('calc(var(--rhythm-base) * var(--rhythm-h-p))');
  });
});
