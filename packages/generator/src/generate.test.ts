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
    expect(hasRule(css, ':where(button, .btn).danger:focus-visible')).toBe(true);
    expect(hasRule(css, '.btn-danger:focus-visible')).toBe(true);
  });
});

describe('pattern fill mode', () => {
  it('honours an explicit fill:false even when base declares a background', () => {
    // `.btn` sets `background: transparent`, which the legacy heuristic would
    // read as "this is a fill" and colour role variants with --<role>-solid.
    const ds = defaultConfig();
    ds.patterns!.items!.btn!.roles = ['danger'];
    const css = patternsOf(ds);
    expect(css).toContain('color: var(--color-danger-bold)');
    expect(css).not.toContain(
      'background-color: var(--danger-solid); color: var(--danger-on-solid)',
    );
  });

  it('resolves a fill pattern default background from its default_role', () => {
    const css = patternsOf();
    expect(css).toMatch(/\.cta \{[^}]*background-color: var\(--brand-primary-solid\)/s);
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
    // case must still treat `badge` as a fill.
    expect(css).toContain('background-color: var(--neutral-solid)');
    expect(css).toContain('background-color: var(--info-solid); color: var(--info-on-solid)');
  });
});
