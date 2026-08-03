import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { generate } from './generate.ts';
import { defaultConfig } from './index.ts';

/**
 * The generated animation layer, asserted on the BUNDLED css rather than on the
 * emitter's strings — which is the only level at which the bug this file exists
 * for was visible.
 *
 * `animation-range: entry exit` left the emitter correct and arrived in the
 * bundle as `entry exit 0%`: lightningcss defaults an omitted offset on the END
 * of the shorthand to 0% instead of the spec's 100%, so every journey returned
 * to its hidden `from` state as the element reached the top of the viewport. A
 * test on the emitter output would have passed throughout.
 *
 * Needs the framework partials from `packages/generator/assets/`, a gitignored
 * build artifact, so skip rather than fail in a clean checkout.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, '..', 'assets');
const hasAssets = existsSync(join(ASSETS, 'css', 'index.css'));

const tmp = mkdtempSync(join(tmpdir(), 'vitops-anim-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

/**
 * `defaultConfig()` carries a deliberately small animation block (two composite
 * effects), so the `paint` and `layout` families it doesn't ship are declared
 * here — otherwise the layout assertion would pass vacuously against a config
 * that has no layout effect to leave alone.
 */
function config() {
  const ds = defaultConfig();
  const anim = ds.animations ?? { effects: {}, journeys: { base: {}, compose: [] } };
  return {
    ...ds,
    animations: {
      ...anim,
      effects: {
        ...anim.effects,
        'reveal-left': {
          kf: 'paint',
          vars: { 'clip-from': 'inset(0 100% 0 0)', 'clip-to': 'inset(0)' },
        },
        'size-grow': {
          kf: 'layout',
          css: { overflow: 'clip' },
          vars: { 'height-from': 0, 'height-to': 'auto' },
        },
      },
    },
  } as ReturnType<typeof defaultConfig>;
}

let cached: string | undefined;
async function bundle(): Promise<string> {
  if (cached === undefined) {
    await generate({ input: config(), format: 'css', outDir: tmp, assetsDir: ASSETS });
    cached = readFileSync(join(tmp, 'styles.css'), 'utf8');
  }
  return cached;
}

const effects = () => config().animations?.effects ?? {};
const kindOf = (kf: string) =>
  Object.entries(effects())
    .filter(([, e]) => (e as { kf: string }).kf === kf)
    .map(([name]) => name);

describe.skipIf(!hasAssets)('generated animation effects', () => {
  it('keeps every journey on a full entry → exit range through the bundler', async () => {
    const css = await bundle();
    const journeys = config().animations?.journeys?.compose ?? [];
    expect(journeys.length).toBeGreaterThan(0);

    for (const parts of journeys) {
      const rule = new RegExp(`\\.${parts.join('-')}-journey\\{([^}]*)\\}`).exec(css);
      expect(rule, `${parts.join('-')}-journey missing`).not.toBeNull();
      const range = /animation-range:([^;}]*)/.exec(rule?.[1] ?? '')?.[1]?.trim();
      // Starts on the same midpoint pivot as .animate-view (entry 50% + 10vh)
      // and runs to the end of the exit phase, so the hold sits in the middle of
      // the crossing. `exit` bare would be the corrupted end — lightningcss
      // reads an omitted end offset as 0%, not the spec's 100%.
      expect(range).toBe('entry calc(50% + 10vh) exit');
    }
    // Scoped to the property: `exit 0%` is legitimate as a timeline-range
    // KEYFRAME selector (carousel.css uses one), it's only wrong as a range end.
    for (const [, value] of css.matchAll(/animation-range:([^;}]*)/g))
      expect(value?.trim()).not.toMatch(/exit 0%$/);
  });

  it('gives slide journeys a distance to travel', async () => {
    // journeys.base.slide used to be `{}`, so slide-journey animated
    // translate 0 → 0 and the slide half of four journeys did nothing.
    const css = await bundle();
    const rule = /\.slide-journey\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rule).toContain('--translate-y-from:');
  });

  it('emits both the self and parent form of every hover/focus state variant', async () => {
    // The parent form is what makes `reveal-*` usable: it rests at a zero-area
    // clip-path, and clip-path clips hit-testing, so `:hover` alone can never
    // fire on the element itself.
    const css = await bundle();
    const flippable = [...kindOf('composite'), ...kindOf('paint')];
    expect(flippable.length).toBeGreaterThan(0);

    for (const fx of flippable) {
      expect(css, `hover-${fx} self form`).toContain(`.hover-${fx}:hover`);
      expect(css, `hover-${fx} parent form`).toContain(`:hover>.hover-${fx}`);
      expect(css, `focus-${fx} self form`).toContain(`.focus-${fx}:focus-visible`);
      expect(css, `focus-${fx} parent form`).toContain(`:focus-within>.focus-${fx}`);
    }
  });

  it('emits state variants for layout effects too, carrying their css block', async () => {
    // `hover-size-grow` used to be skipped, leaving the docs advertising a class
    // that resolved to nothing. `.transition` now covers `height` behind
    // `@supports (interpolate-size: allow-keywords)` — the same feature the
    // `layout` keyframe already needed, so excluding it bought no portability.
    const css = await bundle();
    const layout = kindOf('layout');
    expect(layout.length).toBeGreaterThan(0);
    for (const fx of layout)
      for (const state of ['hover', 'focus', 'active'])
        expect(css, `${state}-${fx} missing`).toContain(`.${state}-${fx}`);

    // Without `overflow: clip` a collapsed (0-height) box spills its content
    // rather than hiding it, so the effect's own css block must travel too.
    const rest = /\.hover-size-grow,[^{]*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(rest).toContain('overflow:clip');
  });

  it('gates the height transition on interpolate-size', async () => {
    // `height: 0 → auto` is not interpolable without it, and a bare
    // `transition-behavior: allow-discrete` would only snap at the midpoint.
    const css = await bundle();
    const gated = /@supports \(interpolate-size:allow-keywords\)\{\.transition\{([^}]*)\}/.exec(
      css,
    )?.[1];
    expect(gated, '.transition height must sit inside the @supports block').toBeTruthy();
    expect(gated).toContain('height:var(--t-height,var(--height-from,auto))');
    expect(gated).toContain('height');
    // The ungated base rule must NOT declare height — that is the whole point of
    // the gate: engines without interpolate-size keep no height transition
    // rather than a snap.
    const base = /\.transition\{(opacity[^}]*)\}/.exec(css)?.[1] ?? '';
    expect(base).not.toContain('height:');
  });

  it('lets .stagger offset a scroll-driven child, not just a timed one', async () => {
    // animation-delay is time-based and is ignored outright on a view()
    // timeline, so `.stagger > .animate-view` used to arrive all at once.
    const css = await bundle();
    const stagger = /\.stagger>\*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(stagger).toContain('animation-delay:');
    expect(stagger).toContain('--_anim-range-offset:');

    const view = /\.animate-view\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(view).toContain('--_anim-range-offset');
    // Both stops pivot on `entry 50%` — where the element's midpoint sits exactly
    // on the viewport edge, whatever its height — and are then pushed in by
    // viewport units. Earlier defaults were fractions of the element's OWN
    // height, which is why they fired before it was on screen.
    expect(view).toContain('entry calc(50%');
    expect(view).toContain('10vh');
    expect(view).toContain('25vh');
    expect(view).not.toContain('entry 0% entry 20%');
  });

  it('guards every sibling-index() use with a test that can actually fail', async () => {
    // `@supports (--x: <anything>)` is always true — any token stream is a valid
    // custom-property value — so a guard spelled that way guards nothing, and on
    // an engine without sibling-index() the declaration goes
    // invalid-at-computed-value-time instead of being skipped. Asserted across
    // the whole bundle because the same mistake was made twice independently
    // (animation.css's .stagger and subgrid.css's row index).
    const css = await bundle();
    expect(css).toContain('@supports (animation-delay:calc(sibling-index() * 1s))');
    for (const [, cond] of css.matchAll(/@supports \(([^)]*\([^)]*\)[^)]*|[^)]*)\)\s*\{/g))
      if (cond?.includes('sibling-index'))
        expect(cond, 'guard must name a real property').not.toMatch(/^--/);
  });
});
