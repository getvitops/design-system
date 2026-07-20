/**
 * Codegen: src/colors.json -> src/css/color.css + dist/bricks-colors-*.json
 * Not bundling — pure generation. Run via the `generate:colors` task.
 *
 * Schema (src/design-system.json → colors):
 *   palette:  { <ramp>: { xxd, xd, d, base, l, xl, xxl } }   raw hex values
 *   schemes:  { default: Scheme, [alt]: Scheme }             `default` is the base
 *     Scheme  = { appearance: 'light'|'dark', semantic: { <role>: RoleSpec } }
 *     RoleSpec = <ramp> | { ramp?, invert?, shift?, steps?, value? }
 *       - string  → that ramp, identity step mapping
 *       - default scheme roles must fully resolve; alternate schemes are deltas
 *
 * Per-slot resolution, in priority order:
 *   1. explicit literal in `value`
 *   2. explicit step in `steps`
 *   3. shiftStep(invert ? MIRROR[slot] : slot, shift)   (invert/shift/ramp compose)
 * Alternate schemes emit only the slots whose source differs from `default`,
 * under `:root[data-brx-theme="<appearance>"]`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const STEP_ORDER = ['xxd', 'xd', 'd', 'base', 'l', 'xl', 'xxl'] as const;
type Step = (typeof STEP_ORDER)[number];
const suffix = (step: string) => (step === 'base' ? '' : `-${step}`);

// Mirror for `invert`: reverse position in STEP_ORDER (base maps to itself).
const MIRROR: Record<Step, Step> = {
  xxd: 'xxl',
  xd: 'xl',
  d: 'l',
  base: 'base',
  l: 'd',
  xl: 'xd',
  xxl: 'xxd',
};

const STEP_INDEX: Record<string, number> = Object.fromEntries(STEP_ORDER.map((s, i) => [s, i]));
// Shift a step along the ramp order by n (clamped). Positive = darker.
const shiftStep = (step: string, by: number): string => {
  const i = STEP_INDEX[step] ?? STEP_ORDER.indexOf('base');
  const j = Math.max(0, Math.min(STEP_ORDER.length - 1, i - by)); // darker = lower index
  return STEP_ORDER[j] as string;
};

type Ramp = Record<string, string>;
type RoleSpec =
  | string
  | {
      ramp?: string;
      invert?: boolean;
      shift?: number;
      steps?: Record<string, string>;
      value?: Record<string, string>;
    };
type Scheme = { appearance: 'light' | 'dark'; semantic: Record<string, RoleSpec> };
// The resolved source for one role slot: a ramp step, or a literal value.
type Src = { ramp: string; step: string } | { value: string };

// The ramp a role draws from (falls back to the inherited base-scheme ramp).
const roleRamp = (spec: RoleSpec, inherited = ''): string =>
  typeof spec === 'string' ? spec : (spec.ramp ?? inherited);
// Resolve one slot: value > explicit step > shiftStep(invert ? mirror : slot, shift).
const resolveSlot = (spec: RoleSpec, step: Step, inherited: string): Src => {
  if (typeof spec === 'string') return { ramp: spec, step };
  if (spec.value?.[step] != null) return { value: spec.value[step] as string };
  const ramp = spec.ramp ?? inherited;
  const s = spec.steps?.[step] ?? shiftStep(spec.invert ? MIRROR[step] : step, spec.shift ?? 0);
  return { ramp, step: s };
};
const srcVar = (s: Src): string =>
  'value' in s ? s.value : `var(--color-${s.ramp}${suffix(s.step)})`;
const srcEq = (a: Src, b: Src): boolean =>
  'value' in a || 'value' in b
    ? 'value' in a && 'value' in b && a.value === b.value
    : a.ramp === b.ramp && a.step === b.step;
interface Pattern {
  group?: string; // token-cascade group (tag/control/panel/area/content/pull)
  overrides?: Record<string, string>; // per-pattern token overrides (prop -> value)
  element?: string; // styled at element level via :where()
  class?: string; // or styled as a class
  default_role?: string; // role for the bare/default variant
  base?: Record<string, string>;
  states?: Record<string, Record<string, unknown>>;
  roles?: string[]; // semantic roles to generate variants for
}
// Pattern token cascade: global defaults + group defaults + per-pattern items.
// Partials consume the live chain var(--p-x, var(--p-x-group, var(--p-default))).
interface PatternsConfig {
  defaults?: Record<string, string>; // --<prop>-default
  radii?: Record<string, string>; // --br-<name> shape primitives (pill/circle); Bricks-editable
  groups?: Record<string, Record<string, string>>; // --<prop>-<group>
  z?: Record<string, number>; // --z-tier-<name>
  items?: Record<string, Pattern>; // per-pattern group assignment + interaction CSS
}
interface TypographyRole {
  family?: string;
  [key: string]: string | number | undefined;
}
interface TypographyConfig {
  families?: Record<string, string>;
  roles?: Record<string, TypographyRole>;
  headings?: Record<string, string>; // optional: style bare h1..h6
}
interface ColorConfig {
  palette: Record<string, Ramp>;
  schemes: Record<string, Scheme>;
  utilities?: string[];
}
// Fluid modular scale config (type + spacing). Tokens are named by `names`
// (Bricks' t-shirt scale, e.g. 2xs..2xl) or numeric 1..steps when `names` is
// absent. Values anchor at `baseStep`, modular `ratio` between adjacent steps.
// With `fluid`, each step is a clamp() easing from a tighter `minRatio` scale at
// minVw to the full `ratio` scale at maxVw. `baseline` is the Bricks GUI scale
// centre (metadata only — emitted values are always explicit).
interface ScaleConfig {
  base: string; // anchor size, e.g. "1.125rem" (assumed rem)
  ratio: number; // modular ratio between steps at large viewports
  steps?: number; // token count when `names` is absent (numeric tokens)
  names?: string[]; // token names (t-shirt scale); default 1..steps
  baseStep?: number; // 1-based index of the value anchor (default: middle)
  baseline?: string; // Bricks GUI scale centre (default: middle name)
  fluid?: { minVw: string; maxVw: string; minRatio: number };
}
// Animation effects: pure value layer emitted as .<name> { --_anim; --<var>; }.
// The keyframes + drivers (the engine) stay hand-written in src/css/animation.css.
type Vars = Record<string, string | number>;
interface AnimEffect {
  kf: string; // --_anim keyframe (composite | paint | layout)
  css?: Vars; // extra literal declarations (e.g. overflow: clip)
  vars?: Vars; // --<key>: <value> (only non-default from/to values)
}
interface AnimationsConfig {
  effects?: Record<string, AnimEffect>; // composite/paint/layout effect classes
  // Journeys: compose base parts → .<parts>-journey with merged vars + a
  // multi-value --_anim, so new compositions are one line in `compose`.
  journeys?: { base?: Record<string, Vars>; compose?: string[][] };
}
interface DesignSystem {
  colors: ColorConfig;
  shadows?: Record<string, string>;
  patterns?: PatternsConfig;
  typography?: TypographyConfig;
  fonts?: Record<string, string>; // --font-<name> family stacks
  typeScale?: ScaleConfig; // --text-<name> fluid scale
  spaceScale?: ScaleConfig; // --space-<name> fluid scale (additive)
  animations?: AnimationsConfig; // effect + journey classes (engine stays static)
}

const rootPath = join(import.meta.dirname, '..');
const entryPath = join(rootPath, 'src', 'design-system.json');
// All generated CSS lands here so static and codegen output are visually separated.
const cssPath = join(rootPath, 'src', 'css', 'generated');
const distPath = join(rootPath, 'dist');

// Output format (see CLAUDE.md "--format mode"):
//   css      — full standalone CSS layer (tokens + dark + every utility); self-contained.
//   bricks   — Bricks owns colours/fonts/scales (palette + Variables managers generate them
//              live), so color.css / type-tokens.css are stubs; patterns/shadows/JSON still emit.
//   tailwind — one self-contained dist/tailwind.css for Tailwind v4 (Astro): @theme tokens +
//              @custom-variant + @utility (bespoke families) + inlined engine/structure.
// `--bricks` is a back-compat alias for `--format=bricks`; the default is `bricks`.
const parseFormat = (argv: string[]): 'css' | 'bricks' | 'tailwind' => {
  if (argv.includes('--bricks')) return 'bricks';
  const i = argv.findIndex((a) => a === '--format' || a.startsWith('--format='));
  if (i === -1) return 'bricks';
  const raw = argv[i]?.includes('=') ? (argv[i]?.split('=')[1] ?? '') : argv[i + 1];
  if (raw === 'css' || raw === 'bricks' || raw === 'tailwind') return raw;
  console.error(`✖ unknown --format "${raw ?? ''}" (expected: css | bricks | tailwind)`);
  process.exit(1);
};
const FORMAT = parseFormat(process.argv);
const BRICKS = FORMAT === 'bricks';
const TAILWIND = FORMAT === 'tailwind';

// Tailwind builds a single bundle (emitTailwind, at the end of this file), so it must
// NOT emit the per-file standalone/bricks outputs. Route every generated-file write
// through this: for --format=tailwind it no-ops, keeping the run to dist/tailwind.css.
const write = (path: string, content: string, note = '') => {
  if (TAILWIND) return;
  writeFileSync(path, content);
  console.log(`✓ ${path}${note ? ` ${note}` : ''}`);
};

// Bricks toggles dark mode with this selector (confirmed).
// All known utility types (name -> CSS property). The design-system.json
// `utilities` array selects which of these to generate.
const UTILITY_PROPS: Record<string, string> = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  outline: 'outline-color',
  fill: 'fill',
  stroke: 'stroke',
};

const ds: DesignSystem = JSON.parse(readFileSync(entryPath, 'utf8'));
const { palette, schemes, utilities } = ds.colors;
const { patterns, shadows, typography } = ds;
const baseScheme = schemes.default;
if (baseScheme == null) throw new Error('colors.schemes must include a "default" scheme');
const defaultSemantic = baseScheme.semantic;
const altSchemes = Object.entries(schemes).filter(([k]) => k !== 'default');
// Bricks' Color Manager models a single light+dark pair: use the first dark scheme.
const darkScheme = altSchemes.map(([, s]) => s).find((s) => s.appearance === 'dark');

// Which utility types to generate (CSS) and request of Bricks (utilityClasses).
// Configured in design-system.json; falls back to bg/text/border.
const UTILITIES = (utilities ?? ['bg', 'text', 'border']).filter((u) => u in UTILITY_PROPS);

// ── color.css (standalone mode only) ────────────────────────────────────────
// In --bricks mode we skip this entirely; Bricks generates tokens + utilities.
mkdirSync(cssPath, { recursive: true });
const colorOutputPath = join(cssPath, 'color.css');

if (BRICKS) {
  // Minimal stub so the @import in index.css resolves; Bricks owns the colours.
  write(
    colorOutputPath,
    '/* Colours provided by Bricks (palette import generates tokens + utilities). */\n',
    '(bricks mode — colours owned by Bricks)',
  );
} else {
  const base = baseScheme;
  let css = `/* GENERATED from design-system.json — do not edit by hand. */\n:root {\n`;
  css += `  color-scheme: ${base.appearance};\n`;

  css += `  /* Palette ramps */\n`;
  for (const [name, steps] of Object.entries(palette)) {
    for (const step of STEP_ORDER) {
      if (steps[step] == null) continue;
      css += `  --color-${name}${suffix(step)}: ${steps[step]};\n`;
    }
  }

  css += `\n  /* Semantic roles → ramps (default: ${base.appearance}) */\n`;
  for (const [role, spec] of Object.entries(defaultSemantic)) {
    const ramp = roleRamp(spec);
    for (const step of STEP_ORDER) {
      if (palette[ramp]?.[step] == null) continue;
      css += `  --color-${role}${suffix(step)}: ${srcVar(resolveSlot(spec, step, ramp))};\n`;
    }
  }
  css += `}\n\n`;

  // Alternate schemes: emit only the slots whose source differs from `default`.
  for (const [key, scheme] of altSchemes) {
    let block = '';
    for (const [role, spec] of Object.entries(scheme.semantic)) {
      const baseSpec = defaultSemantic[role];
      if (baseSpec == null) continue;
      const ramp = roleRamp(baseSpec);
      for (const step of STEP_ORDER) {
        if (palette[ramp]?.[step] == null) continue;
        const alt = resolveSlot(spec, step, ramp);
        if (srcEq(alt, resolveSlot(baseSpec, step, ramp))) continue;
        block += `  --color-${role}${suffix(step)}: ${srcVar(alt)};\n`;
      }
    }
    if (block) {
      css += `/* Semantic roles → ramps (${key}: ${scheme.appearance}) */\n`;
      css += `:root[data-brx-theme="${scheme.appearance}"] {\n  color-scheme: ${scheme.appearance};\n${block}}\n\n`;
    }
  }

  // Utility classes: bg-/text-/border-/outline-/fill-/stroke- per token.
  const utilityFor = (token: string) =>
    UTILITIES.map(
      (cls) => `.${cls}-${token} { ${UTILITY_PROPS[cls]}: var(--color-${token}); }`,
    ).join('\n') + '\n';

  const allTokens: string[] = [];
  for (const [name, steps] of Object.entries(palette))
    for (const step of STEP_ORDER)
      if (steps[step] != null) allTokens.push(`${name}${suffix(step)}`);
  for (const [role, spec] of Object.entries(defaultSemantic)) {
    const ramp = roleRamp(spec);
    for (const step of STEP_ORDER)
      if (palette[ramp]?.[step] != null) allTokens.push(`${role}${suffix(step)}`);
  }
  css += `/* Colour utilities — ${UTILITIES.join(', ')} */\n`;
  for (const token of allTokens) css += utilityFor(token);

  write(colorOutputPath, css, '(standalone — tokens + utilities + dark)');
}

// ── shadow.css (drop-shadow tokens + utilities) ─────────────────────────────
// Always emitted (independent of --bricks): Bricks doesn't own filter utilities.
// Patterns can reference these by name via `"shadow": "<name>"` in a state spec.
const shadowOutputPath = join(cssPath, 'shadows.css');
{
  const entries = Object.entries(shadows ?? {});
  let sh = `/* GENERATED drop-shadow tokens + utilities — do not edit by hand. */\n`;
  if (entries.length) {
    sh += `:root {\n`;
    for (const [name, value] of entries) sh += `  --shadow-${name}: ${value};\n`;
    sh += `}\n\n`;
    for (const [name] of entries)
      sh += `.drop-shadow-${name} { filter: drop-shadow(var(--shadow-${name})); }\n`;
  }
  write(shadowOutputPath, sh, `(${entries.length} shadows)`);
}

// ── patterns.css (component interaction patterns) ───────────────────────────
// Resolve a role's base step. Patterns sit at "d" (the role's main usable shade).
const BASE_STEP = 'd';

// Pattern base geometry props → their token shorthand. Each base declaration is
// wrapped in a component override hook — var(--<sfx>-<item>, <literal>) — the same
// indirection roleDecls uses for typography, so a consumer (e.g. the docs live
// editor) can retune one component's geometry at runtime. Unset hook → the exact
// literal fallback, so current output is byte-identical. Deliberately a single
// layer over the literal (NOT spliced with --<prop>-<group>): a pattern's base
// intentionally differs from its group (button padding 0.6em 1.2em vs control
// 0.5em 1em), and card's group refs already live in its literal base value.
const BASE_HOOK: Record<string, string> = {
  padding: 'p',
  'border-radius': 'br',
  border: 'b',
  'box-shadow': 'ds',
  'font-size': 'fs',
};

const decls = (obj: Record<string, string>, indent = '  ') =>
  Object.entries(obj)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');

// Resting value of each animatable prop (its identity). Used by the animation
// state-flip variants (animation-effects.css) and the Tailwind flip utilities to
// resolve `--t-<prop>: var(--<prop>-to, <default>)`.
const STATE_DEFAULT: Record<string, string> = {
  opacity: '1',
  'translate-x': '0',
  'translate-y': '0',
  'scale-x': '1',
  'scale-y': '1',
  rotate: '0deg',
  blur: '0px',
  shadow: '0 0 0 transparent',
  brightness: '1',
  grayscale: '0',
  contrast: '1',
  saturate: '1',
  sepia: '0',
  'hue-rotate': '0deg',
  clip: 'none',
};

// ── type-tokens.css (font families + fluid type scale) ──────────────────────
// Bricks-gated like color.css: outside Bricks emit the CSS tokens (--font-*,
// --text-N); in Bricks the Font + Fluid Typography managers provide them live
// from the imported settings, so we emit a stub. The .font-* role classes
// (typography.css) always emit either way — Bricks doesn't generate those.
const round = (n: number) => Number(n.toFixed(4)).toString();
const rem = (v: string) => parseFloat(v); // values assumed in rem

// One step of a built scale: its token `name`, the fluid `value` (clamp() or a
// plain rem), the `max` rem alone (the large-viewport size, used as a literal
// fallback), and `offset` from the GUI `baseline` (Bricks' signed scale index).
interface ScaleStep {
  name: string;
  value: string;
  max: string;
  offset: number;
}

// Build the steps for a ScaleConfig. Names come from `names` (t-shirt) or 1..steps.
const buildScale = (s: ScaleConfig): ScaleStep[] => {
  const names = s.names ?? Array.from({ length: s.steps ?? 0 }, (_, i) => String(i + 1));
  const base = rem(s.base);
  const baseStep = s.baseStep ?? Math.ceil(names.length / 2); // 1-based value anchor
  const baselineIdx = s.baseline ? names.indexOf(s.baseline) : baseStep - 1; // GUI centre
  return names.map((name, i) => {
    const k = i - (baseStep - 1); // 0 at the value anchor, +1 per step up
    const vMax = base * Math.pow(s.ratio, k); // size at large viewport
    const max = `${round(vMax)}rem`;
    let value = max;
    if (s.fluid) {
      const { minVw, maxVw, minRatio } = s.fluid;
      const vMin = base * Math.pow(minRatio, k); // size at small viewport
      const lo = Math.min(vMin, vMax);
      const hi = Math.max(vMin, vMax);
      if (lo !== hi) {
        // Linear interp vMin@minVw → vMax@maxVw: pref = intercept + slope·100vw.
        const slope = (vMax - vMin) / (rem(maxVw) - rem(minVw));
        const intercept = vMin - slope * rem(minVw);
        const sign = slope < 0 ? '-' : '+';
        const pref = `calc(${round(intercept)}rem ${sign} ${round(Math.abs(slope * 100))}vw)`;
        value = `clamp(${round(lo)}rem, ${pref}, ${round(hi)}rem)`;
      }
    }
    return { name, value, max, offset: i - baselineIdx };
  });
};

// Built scales, reused across type-tokens.css, typography.css fallback, and the
// Bricks variables JSON. `text-<name>` → max rem lookup feeds the literal fallback.
const typeSteps = ds.typeScale ? buildScale(ds.typeScale) : [];
const spaceSteps = ds.spaceScale ? buildScale(ds.spaceScale) : [];
const textMax: Record<string, string> = Object.fromEntries(
  typeSteps.map((s) => [`text-${s.name}`, s.max]),
);

// ── Typography role → declarations (module scope) ───────────────────────────
// Lifted so both typography.css (.font-<role>) and the Tailwind emitter
// (@utility font-<role>) build role rules from one source.
const typographyFamilies = typography?.families ?? {};
// schema key -> [css property, override-hook suffix]
const TYPO_KEYMAP: Record<string, [string, string]> = {
  family: ['font-family', 'ff'],
  size: ['font-size', 'fs'],
  weight: ['font-weight', 'fw'],
  style: ['font-style', 'fst'],
  'line-height': ['line-height', 'lh'],
  tracking: ['letter-spacing', 'ls'],
  'text-decoration': ['text-decoration', 'td'],
  'text-transform': ['text-transform', 'tt'],
  'text-wrap': ['text-wrap', 'tw'],
  color: ['color', 'color'],
};
// Give scale refs an ultimate literal fallback so type still sizes before the
// Bricks Variables import: var(--text-l) → var(--text-l, <max rem>).
const withScaleFallback = (v: string) =>
  v.replace(/var\(\s*(--text-[\w-]+)\s*\)/g, (m, name) =>
    textMax[name.slice(2)] ? `var(${name}, ${textMax[name.slice(2)]})` : m,
  );
// Decorative props are ALWAYS emitted (even when a role doesn't set them), using
// the CSS identity as the fallback, so their override hook (e.g. --eyebrow-tt)
// always has a consumer and can be tuned live from the docs editor. Structural
// props (family/size/weight/line-height/color) are emitted only when defined —
// there's no meaningful identity to default them to.
const TYPO_IDENTITY: Record<string, string> = {
  'font-style': 'normal',
  'letter-spacing': 'normal',
  'text-decoration': 'none',
  'text-transform': 'none',
  'text-wrap': 'wrap',
};
const roleDecls = (role: string, spec: TypographyRole): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, [prop, sfx]] of Object.entries(TYPO_KEYMAP)) {
    const identity = TYPO_IDENTITY[prop];
    if (spec[key] == null && identity == null) continue;
    const raw =
      spec[key] == null
        ? (identity as string)
        : key === 'family'
          ? (typographyFamilies[spec.family as string] ?? String(spec.family))
          : key === 'size'
            ? withScaleFallback(String(spec[key]))
            : String(spec[key]);
    out[prop] = `var(--${role}-${sfx}, ${raw})`;
  }
  return out;
};

// Captured token-layer CSS, reused by the Tailwind emitter. The tailwind bundle
// inlines the component partials, which consume the framework's full token layer
// (--br-*/--b-*/--p-*/--space-*/--z-tier-*/…) — not just the @theme subset — so
// these `:root` blocks must ship alongside the components for them to resolve.
let twTypeTokensCss = '';
let twPatternTokensCss = '';

const typeTokensOutputPath = join(cssPath, 'type-tokens.css');
{
  if (BRICKS) {
    write(
      typeTokensOutputPath,
      '/* Fonts + type/space scales provided by Bricks (Font + Variables managers). */\n',
      '(bricks mode — fonts/scales owned by Bricks)',
    );
  } else {
    const root: Record<string, string> = {};
    for (const [name, stack] of Object.entries(ds.fonts ?? {})) root[`--font-${name}`] = stack;
    for (const s of typeSteps) root[`--text-${s.name}`] = s.value;
    for (const s of spaceSteps) root[`--space-${s.name}`] = s.value;
    const css = `/* GENERATED font families + fluid type/space scales — do not edit by hand. */\n:root {\n${decls(root)}\n}\n`;
    twTypeTokensCss = css;
    write(typeTokensOutputPath, css, '(standalone — fonts + fluid scales)');
  }
}

// ── tokens.css (pattern token cascade) ──────────────────────────────────────
// Always emitted (independent of --bricks): structural tokens Bricks doesn't own.
// Emits global defaults (--<prop>-default), group defaults (--<prop>-<group>),
// z-tiers (--z-tier-<name>), and per-pattern → group aliases (--<prop>-<item>-group).
// Static partials consume the live 3-level chain:
//   padding: var(--p-dialog, var(--p-dialog-group, var(--p-default)));
const tokensOutputPath = join(cssPath, 'tokens.css');
{
  const tDefaults = patterns?.defaults ?? {};
  const tRadii = patterns?.radii ?? {};
  const tGroups = patterns?.groups ?? {};
  const tZ = patterns?.z ?? {};
  const tItems = patterns?.items ?? {};

  const root: Record<string, string> = {};
  for (const [prop, val] of Object.entries(tDefaults)) root[`--${prop}-default`] = val;
  // Shape primitives (--br-pill/--br-circle): Bricks-gated like fonts/scales — in
  // bricks mode the Variables manager owns them (emitted to bricks-variables.json,
  // editable in the theme designer); consumers carry a literal fallback so they
  // resolve before the import. Standalone/tailwind ship them here.
  if (!BRICKS) for (const [name, val] of Object.entries(tRadii)) root[`--br-${name}`] = val;
  for (const [group, props] of Object.entries(tGroups))
    for (const [prop, val] of Object.entries(props)) root[`--${prop}-${group}`] = val;
  for (const [name, n] of Object.entries(tZ)) root[`--z-tier-${name}`] = String(n);

  // per-pattern → group aliases (only props the assigned group defines); overrides win.
  const aliases: Record<string, string> = {};
  for (const [name, p] of Object.entries(tItems)) {
    if (!p.group) continue;
    for (const prop of Object.keys(tGroups[p.group] ?? {}))
      aliases[`--${prop}-${name}-group`] = `var(--${prop}-${p.group})`;
    for (const [prop, val] of Object.entries(p.overrides ?? {}))
      aliases[`--${prop}-${name}-group`] = val;
  }

  let tok = `/* GENERATED pattern token cascade — do not edit by hand. */\n:root {\n`;
  tok += decls(root) + '\n';
  if (Object.keys(aliases).length) tok += '\n' + decls(aliases) + '\n';
  tok += `}\n`;
  twPatternTokensCss = tok;
  write(tokensOutputPath, tok);
}

// ── typography.css (.font-* role classes) ───────────────────────────────────
// Always emitted (independent of --bricks): type roles are framework structure.
// Each property is wrapped in an override-hook var (e.g. --display-fw) so a
// consumer can retune one role per-instance without a rebuild.
const typographyOutputPath = join(cssPath, 'typography.css');
{
  const roles = typography?.roles ?? {};
  const headings = typography?.headings ?? {};

  let typo = `/* GENERATED typography roles — do not edit by hand. */\n`;
  for (const [role, spec] of Object.entries(roles))
    typo += `.font-${role} {\n${decls(roleDecls(role, spec))}\n}\n`;
  for (const [tag, role] of Object.entries(headings))
    if (roles[role]) typo += `${tag} {\n${decls(roleDecls(role, roles[role]))}\n}\n`;
  write(typographyOutputPath, typo);
}

// Build the state rules for a pattern instance, given its colour role (or none).
// `colorProp` is which property the `step` shortcut shifts: background-color
// for filled patterns (button/badge), color for text patterns (link).
const stateRules = (
  sel: string,
  role: string | null,
  states: Record<string, Record<string, unknown>>,
  colorProp: 'background-color' | 'color' = 'background-color',
) => {
  let out = '';
  const roleVar = (step: string) => (role ? `var(--color-${role}-${step})` : '');

  for (const [state, spec] of Object.entries(states)) {
    const body: string[] = [];

    // semantic shortcuts
    if (typeof spec.step === 'number' && role) {
      body.push(`${colorProp}: ${roleVar(shiftStep(BASE_STEP, spec.step))};`);
    }
    if (typeof spec.scale === 'number') body.push(`scale: ${spec.scale};`);
    if (typeof spec.lift === 'string') body.push(`translate: 0 calc(-1 * ${spec.lift});`);
    // shadow: "<name>" → drop-shadow filter referencing a token from `shadows`.
    // `true` kept as a back-compat fallback to the inline lift box-shadow.
    if (typeof spec.shadow === 'string' && shadows?.[spec.shadow]) {
      body.push(`filter: drop-shadow(var(--shadow-${spec.shadow}));`);
    } else if (spec.shadow === true) {
      body.push(`box-shadow: var(--lift-shadow, 0 8px 20px -6px rgb(0 0 0 / 0.25));`);
    }
    if (spec.ring === true) {
      const ringColor = role ? `var(--color-${role}-l)` : `var(--color-brand-primary-l)`;
      body.push(`outline: none;`, `box-shadow: 0 0 0 3px ${ringColor};`);
    }
    // escape hatch: raw CSS overrides under a "css" key
    if (spec.css && typeof spec.css === 'object') {
      for (const [k, v] of Object.entries(spec.css as Record<string, string>))
        body.push(`${k}: ${v};`);
    }
    if (!body.length) continue;

    const pseudo =
      state === 'hover'
        ? ':hover'
        : state === 'active'
          ? ':active'
          : state === 'focus-visible'
            ? ':focus-visible'
            : `:${state}`;
    const rule = `${sel}${pseudo} {\n  ${body.join('\n  ')}\n}\n`;
    out += state === 'hover' ? `@media (hover: hover) {\n${rule}}\n` : rule;
  }
  return out;
};

let pat = `/* GENERATED component patterns — do not edit by hand. */\n`;
pat += `/* Interaction transitions for patterned elements (independent props compose). */\n`;
for (const [pname, p] of Object.entries(patterns?.items ?? {})) {
  // Group-only items (dialog/drawer/…) carry just a token group and are styled
  // by static partials; they emit no interaction CSS here.
  if (!p.base) continue;
  const states = p.states ?? {};
  const isElement = !!p.element;
  // default selector: :where(element) for zero-specificity, or .class
  const defaultSel = isElement ? `:where(${p.element})` : `.${p.class ?? pname}`;
  const defaultRole = p.default_role
    ? defaultSemantic[p.default_role.replace(/^.*$/, p.default_role)]
      ? p.default_role
      : p.default_role
    : null;

  // base block + the transition machinery + resting transform values
  const base = { ...p.base };
  // Does this pattern colour via background (button/badge) or text (link)?
  const fills =
    pname === 'button' ||
    pname === 'badge' ||
    base['background-color'] != null ||
    base['background'] != null;
  const colorProp: 'background-color' | 'color' = fills ? 'background-color' : 'color';

  pat += `${defaultSel} {\n`;
  // Transition machinery only for patterns that actually have interaction states.
  const hasStates = Object.keys(states).length > 0;
  if (hasStates) {
    pat += `  transition-property: translate, scale, rotate, filter, box-shadow, background-color, color;\n`;
    pat += `  transition-duration: var(--interact-duration, 200ms);\n`;
    pat += `  transition-timing-function: var(--interact-easing, ease);\n`;
    pat += `  translate: 0 0; scale: 1; rotate: 0deg;\n`;
  }
  // default role background for filled patterns, if role-colored
  if (defaultRole && fills && base['background-color'] == null && base['background'] == null) {
    base['background-color'] = `var(--color-${defaultRole}-${BASE_STEP})`;
  }
  // Wrap geometry props in per-component override hooks (literal as the fallback).
  const wrappedBase: Record<string, string> = {};
  for (const [prop, val] of Object.entries(base)) {
    const sfx = BASE_HOOK[prop];
    wrappedBase[prop] = sfx ? `var(--${sfx}-${pname}, ${val})` : String(val);
  }
  pat += decls(wrappedBase) + '\n}\n';

  // default-variant states (use default role)
  pat += stateRules(defaultSel, defaultRole, states, colorProp);

  // role variants: button.success, .badge-danger, etc.
  for (const role of p.roles ?? []) {
    const variantSel = isElement ? `${p.element}.${role}` : `.${p.class ?? pname}-${role}`;
    const variantColorDecl = fills
      ? `background-color: var(--color-${role}-${BASE_STEP})`
      : `color: var(--color-${role}-${BASE_STEP})`;
    pat += `${variantSel} { ${variantColorDecl}; }\n`;
    pat += stateRules(variantSel, role, states, colorProp);
  }
  pat += '\n';
}

const patternsOutputPath = join(cssPath, 'patterns.css');
write(patternsOutputPath, pat);

// ── animation-effects.css (effect + journey classes) ────────────────────────
// Always emitted (structural, like typography). Each effect is a pure value
// layer: .<name> { --_anim: <kf>; <css>; --<var>: <val>; }. The keyframes,
// drivers, floats, and utilities stay hand-written in src/css/animation.css.
{
  const anim = ds.animations ?? {};
  const asStr = (v: string | number) => String(v);
  const block = (sel: string, d: Record<string, string>) => `.${sel} {\n${decls(d)}\n}\n`;

  let out = `/* GENERATED animation effects + journeys — do not edit by hand. */\n`;

  for (const [name, e] of Object.entries(anim.effects ?? {})) {
    const d: Record<string, string> = { '--_anim': e.kf };
    for (const [k, v] of Object.entries(e.css ?? {})) d[k] = asStr(v);
    for (const [k, v] of Object.entries(e.vars ?? {})) d[`--${k}`] = asStr(v);
    out += block(name, d);
  }

  // Journeys: each composition merges its base parts' vars + a multi-value --_anim.
  const base = anim.journeys?.base ?? {};
  for (const parts of anim.journeys?.compose ?? []) {
    const d: Record<string, string> = {
      '--_anim': parts.map((p) => `${p}-journey`).join(', '),
      'animation-range': 'entry exit',
    };
    for (const p of parts)
      for (const [k, v] of Object.entries(base[p] ?? {})) d[`--${k}`] = asStr(v);
    out += block(`${parts.join('-')}-journey`, d);
  }

  // State-flip variants: compose with the `.transition` base. For each
  // composite/paint effect, hover-<fx>/active-<fx> funnel the effect's from/to
  // into per-state --t-<prop> vars, so different effects bind to different
  // states on one element (e.g. hover-slide-up + active-elevate-up).
  // Distinct states so different effects bind independently. hover/focus are
  // split (not bundled) so you can pair them for a11y (hover-fx focus-fx) or
  // give focus its own effect.
  const STATES: [string, (s: string) => string][] = [
    ['hover', (s) => `.${s}:hover`],
    ['focus', (s) => `.${s}:focus-visible`],
    ['active', (s) => `.${s}.is-active, .${s}[data-active]`],
  ];
  out += `\n/* State-flip variants — compose with .transition (hover-/focus-/active-<fx>). */\n`;
  for (const [name, e] of Object.entries(anim.effects ?? {})) {
    if (e.kf !== 'composite' && e.kf !== 'paint') continue; // no layout/journey state-flips
    const props: Record<string, { from?: string; to?: string }> = {};
    for (const [k, v] of Object.entries(e.vars ?? {})) {
      const m = /^(.*)-(from|to)$/.exec(k);
      if (m) (props[m[1] as string] ??= {})[m[2] as 'from' | 'to'] = asStr(v);
    }
    // Rest: the shared --<prop>-from/-to endpoints (the same vars the keyframes
    // read); emit only non-defaults. The .transition base reads --<prop>-from.
    const rest: Record<string, string> = {};
    for (const [p, ft] of Object.entries(props)) {
      if (ft.from != null && ft.from !== STATE_DEFAULT[p]) rest[`--${p}-from`] = ft.from;
      if (ft.to != null && ft.to !== STATE_DEFAULT[p]) rest[`--${p}-to`] = ft.to;
    }
    // State: flip the internal current var to the shared `to` endpoint.
    const flip: Record<string, string> = Object.fromEntries(
      Object.keys(props).map((p) => [`--t-${p}`, `var(--${p}-to, ${STATE_DEFAULT[p]})`]),
    );
    if (Object.keys(rest).length)
      out += `${STATES.map(([s]) => `.${s}-${name}`).join(', ')} {\n${decls(rest)}\n}\n`;
    for (const [s, sel] of STATES) out += `${sel(`${s}-${name}`)} {\n${decls(flip)}\n}\n`;
  }

  const animOutputPath = join(cssPath, 'animation-effects.css');
  write(animOutputPath, out);
}

// ── Bricks palettes ─────────────────────────────────────────────────────────
mkdirSync(distPath, { recursive: true });

const id = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 6);

// Named: each colour defines its own --color-<name> var; light is the hex.
const namedColors = [];
for (const [name, steps] of Object.entries(palette)) {
  for (const step of STEP_ORDER) {
    const hex = steps[step];
    if (hex == null) continue;
    const token = `${name}${suffix(step)}`;
    namedColors.push({
      raw: `var(--color-${token})`,
      light: hex,
      id: id(`named:${token}`),
      utilityClasses: UTILITIES,
    });
  }
}

// Semantic: each role defines its own --color-<role> var; light references the
// default-scheme source; dark references the dark alternate scheme's source.
// True indirection in both modes (remap in design-system.json, rebuild, re-import).
const semanticColors = [];
for (const [role, spec] of Object.entries(defaultSemantic)) {
  const ramp = roleRamp(spec);
  const altSpec = darkScheme?.semantic[role];
  for (const step of STEP_ORDER) {
    if (palette[ramp]?.[step] == null) continue;
    const lightSrc = resolveSlot(spec, step, ramp);
    const darkSrc = altSpec != null ? resolveSlot(altSpec, step, ramp) : lightSrc;
    const hasDark = !srcEq(darkSrc, lightSrc);
    semanticColors.push({
      raw: `var(--color-${role}${suffix(step)})`,
      light: srcVar(lightSrc),
      darkModeEnabled: hasDark,
      dark: srcVar(darkSrc),
      id: id(`semantic:${role}${suffix(step)}`),
      utilityClasses: UTILITIES,
    });
  }
}

const namedPalette = { id: id('palette:named'), name: 'Named', colors: namedColors };
const semanticPalette = { id: id('palette:semantic'), name: 'Semantic', colors: semanticColors };

write(join(distPath, 'bricks-colors-named.json'), JSON.stringify(namedPalette, null, 2));
write(
  join(distPath, 'bricks-colors-semantic.json'),
  JSON.stringify(semanticPalette, null, 2),
  `(${namedColors.length} named + ${semanticColors.length} semantic colours)`,
);

// ── Bricks Global Variables (fonts + type/space scales) ─────────────────────
// Confirmed schema (captured from a UI export): a category carrying a `scale`
// object becomes a GUI-selectable Typography/Spacing scale; its variables carry
// `scale`/`scaleName` + a literal clamp() value. Fonts ride along as
// uncategorized variables. Always emitted (like the colour palettes). Bricks
// stores each `value` verbatim, so the scale metadata is best-effort — its
// generator params only matter if the user regenerates the scale in the GUI.
{
  type BrxScale = { scale: number; scaleName: string };
  type BrxVar = { id: string; name: string; value: string; category?: string; scale?: BrxScale };
  type BrxCat = { id: string; name: string; scale: Record<string, unknown>; utilityClasses: [] };

  const scaleMeta = (scope: string, prefix: string, s: ScaleConfig, names: string[]) => {
    const px = Math.round(rem(s.base) * 16);
    const lo = s.fluid?.minRatio ?? s.ratio;
    return {
      scaleScope: scope,
      scaleType: 'tshirt',
      scaleNames: names,
      prefix,
      minFontSize: px,
      minScaleRatio: lo,
      minScaleRatioSelect: lo,
      maxFontSize: px,
      maxScaleRatio: s.ratio,
      maxScaleRatioSelect: s.ratio,
      baseline: s.baseline ?? names[Math.floor((names.length - 1) / 2)],
    };
  };

  const categories: BrxCat[] = [];
  const variables: BrxVar[] = [];

  const addScale = (
    label: string,
    scope: string,
    prefix: string,
    cfg: ScaleConfig | undefined,
    steps: ScaleStep[],
  ) => {
    if (!cfg || !steps.length) return;
    const names = steps.map((s) => s.name);
    const catId = id(`varcat:${scope}`);
    categories.push({
      id: catId,
      name: label,
      scale: scaleMeta(scope, prefix, cfg, names),
      utilityClasses: [],
    });
    for (const st of steps)
      variables.push({
        id: id(`var:${prefix}${st.name}`),
        name: `${prefix}${st.name}`,
        value: st.value,
        category: catId,
        scale: { scale: st.offset, scaleName: st.name },
      });
  };

  addScale('Typography', 'typography', 'text-', ds.typeScale, typeSteps);
  addScale('Spacing', 'spacing', 'space-', ds.spaceScale, spaceSteps);

  // Fonts: uncategorized variables ({id,name,value}).
  for (const [name, stack] of Object.entries(ds.fonts ?? {}))
    variables.push({ id: id(`var:font-${name}`), name: `font-${name}`, value: stack });

  // Shape radii (--br-pill/--br-circle): uncategorized variables so they're
  // editable in the Bricks Variables manager. A design system can retune "pill"
  // to a squircle here and every pill/circle component follows.
  for (const [name, val] of Object.entries(ds.patterns?.radii ?? {}))
    variables.push({ id: id(`var:br-${name}`), name: `br-${name}`, value: val });

  write(
    join(distPath, 'bricks-variables.json'),
    JSON.stringify({ variables, categories }, null, 2),
    `(${variables.length} vars, ${categories.length} scales)`,
  );
}

// ── Live-editor manifest (dist/design-manifest.json — --format=css / docs) ───
// Describes the editable surface (ramps/roles/steps, type roles + override hooks,
// scale steps, pattern defaults/groups/items) plus a reverseIndex mapping each
// override CSS var back to its design-system.json path. The docs live editor
// reads this to render controls and export a source-mergeable JSON patch without
// re-deriving the generator's naming logic (avoids drift). Docs build only.
if (FORMAT === 'css') {
  const reverseIndex: Record<string, string> = {};

  // Colours — named ramps carry the editable hex; roles are var() indirections,
  // so editing a ramp propagates to every role that maps to it.
  for (const [name, steps] of Object.entries(palette))
    for (const step of STEP_ORDER)
      if (steps[step] != null)
        reverseIndex[`--color-${name}${suffix(step)}`] = `colors.palette.${name}.${step}`;
  const colorRoles = Object.entries(defaultSemantic).map(([name, spec]) => ({
    name,
    ramp: roleRamp(spec),
  }));

  // Typography — each per-role hook maps to its schema key (inverse TYPO_KEYMAP).
  const typoRoles = typography?.roles ?? {};
  const hooks: Record<string, { prop: string; key: string }> = {};
  for (const [key, [prop, sfx]] of Object.entries(TYPO_KEYMAP)) hooks[sfx] = { prop, key };
  for (const [role, spec] of Object.entries(typoRoles))
    for (const [key, [, sfx]] of Object.entries(TYPO_KEYMAP))
      if (spec[key] != null) reverseIndex[`--${role}-${sfx}`] = `typography.roles.${role}.${key}`;

  // Pattern defaults / radii / groups / per-item base geometry.
  const pDefaults = patterns?.defaults ?? {};
  const pRadii = patterns?.radii ?? {};
  const pGroups = patterns?.groups ?? {};
  const pItems = patterns?.items ?? {};
  for (const prop of Object.keys(pDefaults))
    reverseIndex[`--${prop}-default`] = `patterns.defaults.${prop}`;
  for (const name of Object.keys(pRadii)) reverseIndex[`--br-${name}`] = `patterns.radii.${name}`;
  for (const [group, props] of Object.entries(pGroups))
    for (const prop of Object.keys(props))
      reverseIndex[`--${prop}-${group}`] = `patterns.groups.${group}.${prop}`;
  const items = Object.entries(pItems).map(([name, p]) => {
    const base = p.base ?? {};
    const wrappable = Object.keys(base)
      .filter((prop) => prop in BASE_HOOK)
      .map((prop) => ({ sfx: BASE_HOOK[prop] as string, prop }));
    for (const { sfx, prop } of wrappable)
      reverseIndex[`--${sfx}-${name}`] = `patterns.items.${name}.base.${prop}`;
    return { name, group: p.group ?? null, base, wrappable, roles: p.roles ?? [] };
  });

  const manifest = {
    colors: { ramps: Object.keys(palette), steps: STEP_ORDER, palette, roles: colorRoles },
    typography: {
      roles: Object.keys(typoRoles),
      hooks,
      families: typographyFamilies,
      specs: typoRoles,
    },
    scales: {
      text: typeSteps.map((s) => ({ name: s.name, value: s.value, max: s.max })),
      space: spaceSteps.map((s) => ({ name: s.name, value: s.value, max: s.max })),
    },
    fonts: ds.fonts ?? {},
    patterns: { defaults: pDefaults, radii: pRadii, groups: pGroups, items },
    shadows: shadows ?? {},
    interaction: { duration: '200ms', easing: 'ease' },
    reverseIndex,
  };

  write(
    join(distPath, 'design-manifest.json'),
    JSON.stringify(manifest, null, 2),
    '(live-editor manifest)',
  );
}

// ── Tailwind v4 bundle (--format=tailwind) ──────────────────────────────────
// Single self-contained dist/tailwind.css: @theme tokens (colours, fonts, type &
// spacing scales, shadows, container breakpoints) + a dark block + @custom-variant
// + @utility for the bespoke families (type roles, animation effects + flips, split
// ratios, track placement) + the inlined engine/structural plain CSS. Tailwind's own
// engine expands @md:/hover:/… variants, so we emit BASE utilities only — no
// pre-expanded per-breakpoint/pseudo classes. Native families (flex/items/justify/
// text/bg/p/gap) come from Tailwind + @theme, so we don't re-emit them.
if (TAILWIND) emitTailwind();

function emitTailwind() {
  const nl = (arr: string[]) => arr.filter(Boolean).join('\n');
  const parts: string[] = [`/* GENERATED for Tailwind v4 (Astro) — do not edit by hand. */`];
  parts.push(`@import "tailwindcss";\n`);

  // ── @theme: design tokens Tailwind turns into utilities + variants ──────────
  const theme: string[] = [];
  theme.push(`  /* Colour ramps → bg-* text-* border-* */`);
  for (const [name, steps] of Object.entries(palette))
    for (const step of STEP_ORDER)
      if (steps[step] != null) theme.push(`  --color-${name}${suffix(step)}: ${steps[step]};`);
  theme.push(`\n  /* Semantic roles → ramps (default scheme) */`);
  for (const [role, spec] of Object.entries(defaultSemantic)) {
    const ramp = roleRamp(spec);
    for (const step of STEP_ORDER)
      if (palette[ramp]?.[step] != null)
        theme.push(`  --color-${role}${suffix(step)}: ${srcVar(resolveSlot(spec, step, ramp))};`);
  }
  theme.push(`\n  /* Fonts → font-* */`);
  for (const [name, stack] of Object.entries(ds.fonts ?? {}))
    theme.push(`  --font-${name}: ${stack};`);
  theme.push(`\n  /* Fluid type scale → text-* */`);
  for (const s of typeSteps) theme.push(`  --text-${s.name}: ${s.value};`);
  theme.push(`\n  /* Fluid spacing scale → p-* m-* gap-* */`);
  for (const s of spaceSteps) theme.push(`  --spacing-${s.name}: ${s.value};`);
  theme.push(`\n  /* Drop-shadows → shadow-* */`);
  for (const [name, value] of Object.entries(shadows ?? {}))
    theme.push(`  --shadow-${name}: ${value};`);
  // Container-query breakpoints → @sm:/@md:/@lg:/@xl: variants (framework model).
  theme.push(`\n  /* Container breakpoints → @sm:/@md:/@lg:/@xl: */`);
  for (const [name, val] of [
    ['sm', '30rem'],
    ['md', '48rem'],
    ['lg', '64rem'],
    ['xl', '80rem'],
  ])
    theme.push(`  --container-${name}: ${val};`);
  parts.push(`@theme {\n${theme.join('\n')}\n}\n`);

  // ── Framework token layer (plain :root, NOT @theme) ─────────────────────────
  // @theme drives Tailwind's utility generation; the inlined components below
  // instead consume the framework's own token cascade (border/padding/z-tier +
  // the fluid font/type/space scales). Ship both `:root` blocks so components
  // resolve their vars. Values are literal, so order vs @theme doesn't matter.
  parts.push(
    `/* ── Framework tokens (consumed by the inlined components) ── */\n` +
      `${twTypeTokensCss}\n${twPatternTokensCss}`,
  );

  // ── Dark block: only roles whose source differs from the default scheme ──────
  let darkBlock = '';
  if (darkScheme) {
    for (const [role, spec] of Object.entries(darkScheme.semantic)) {
      const baseSpec = defaultSemantic[role];
      if (baseSpec == null) continue;
      const ramp = roleRamp(baseSpec);
      for (const step of STEP_ORDER) {
        if (palette[ramp]?.[step] == null) continue;
        const alt = resolveSlot(spec, step, ramp);
        if (srcEq(alt, resolveSlot(baseSpec, step, ramp))) continue;
        darkBlock += `  --color-${role}${suffix(step)}: ${srcVar(alt)};\n`;
      }
    }
  }
  if (darkBlock && darkScheme)
    parts.push(
      `/* Dark-mode semantic overrides */\n:root[data-brx-theme="${darkScheme.appearance}"] {\n${darkBlock}}\n`,
    );

  // ── Variants: hover/focus-visible are built in; add the active state ─────────
  parts.push(
    `/* State variant for the active flip (hover/focus-visible are built in). */\n` +
      `@custom-variant is-active (&.is-active, &[data-active]);\n`,
  );

  // ── @utility: bespoke families Tailwind lacks (base only; TW expands variants) ─
  const util: string[] = [];

  // Typography roles → @utility font-<role>.
  util.push(`/* Typography roles */`);
  for (const [role, spec] of Object.entries(typography?.roles ?? {}))
    util.push(`@utility font-${role} {\n${decls(roleDecls(role, spec))}\n}`);

  // Animation effects → @utility <fx> (base endpoints); composite/paint also get
  // @utility flip-<fx> (used under a state variant: hover:flip-<fx>) that funnels
  // the effect's `to` endpoint into the --t-<prop> the `.transition` base reads.
  util.push(`\n/* Animation effects (pair with .transition or a driver) */`);
  const asStr = (v: string | number) => String(v);
  for (const [name, e] of Object.entries(ds.animations?.effects ?? {})) {
    const d: Record<string, string> = { '--_anim': e.kf };
    for (const [k, v] of Object.entries(e.css ?? {})) d[k] = asStr(v);
    for (const [k, v] of Object.entries(e.vars ?? {})) d[`--${k}`] = asStr(v);
    util.push(`@utility ${name} {\n${decls(d)}\n}`);
    if (e.kf !== 'composite' && e.kf !== 'paint') continue;
    const props = new Set<string>();
    for (const k of Object.keys(e.vars ?? {})) {
      const m = /^(.*)-(from|to)$/.exec(k);
      if (m) props.add(m[1] as string);
    }
    const flip = Object.fromEntries(
      [...props].map((p) => [`--t-${p}`, `var(--${p}-to, ${STATE_DEFAULT[p]})`]),
    );
    util.push(`@utility flip-${name} {\n${decls(flip)}\n}`);
  }

  // Split (internal fractions) → @utility split + split-<a>-<b>.
  util.push(`\n/* Split — internal fractions (pair split with a ratio) */`);
  util.push(
    `@utility split {\n  display: flex;\n` +
      `  & > * { flex: 1; }\n` +
      `  & > :first-child { flex: var(--_split-a, 1); }\n` +
      `  & > :last-child { flex: var(--_split-b, 1); }\n}`,
  );
  const RATIOS: [number, number][] = [
    [1, 2],
    [2, 1],
    [1, 3],
    [3, 1],
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
  ];
  for (const [a, b] of RATIOS)
    util.push(`@utility split-${a}-${b} {\n  --_split-a: ${a};\n  --_split-b: ${b};\n}`);

  // Track placement (inside .centered's named grid) → @utility.
  util.push(`\n/* Track placement (inside .centered) */`);
  for (const track of ['measure', 'breakout', 'spotlight', 'fullbleed'])
    util.push(`@utility ${track} {\n  grid-column: ${track};\n}`);

  parts.push(util.join('\n') + '\n');

  // ── Inlined plain CSS: engine + structure (not variant-expandable) ──────────
  // Structural layout mirrors src/css/layout.css (keep in sync). The utility
  // families (flex/items/justify/text/split responsive) are NOT inlined — Tailwind
  // provides them or they're @utility above. The fixed rhythm margins .m-{0..xl}
  // are dropped (they collide with Tailwind's spacing m-*; use mt-<name> instead).
  parts.push(`/* ── Structure (mirrors src/css/layout.css) ── */
:root {
  --rhythm-scale: 1;
  --rhythm-base: calc(1rlh * var(--rhythm-scale));
  --rhythm-h-p: 0.4;
  --rhythm-p-p: 0.9;
  --rhythm-p-h: 1.6;
  --rhythm-h-h: 0.6;
  --rhythm-p-list: 0.5;
  --rhythm-list-p: 0.9;
  --rhythm-li-li: 0.3;
  --rhythm-text-media: 1.2;
  --rhythm-media-text: 1.2;
  --width-measure: 65ch;
  --width-breakout: 90ch;
  --width-spotlight: 120ch;
  --gutter: clamp(1rem, 4cqi, 3rem);
}

body {
  container-type: inline-size;
}

.rhythm {
  display: flow-root;
}
.rhythm > * + * {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-p));
}
.rhythm > :where(h1, h2, h3, h4, h5, h6) + p {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-h-p));
}
.rhythm > p + :where(h1, h2, h3, h4, h5, h6) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-h));
}
.rhythm > :where(h1, h2, h3, h4, h5, h6) + :where(h1, h2, h3, h4, h5, h6) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-h-h));
}
.rhythm > p + :where(ul, ol) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-p-list));
}
.rhythm > :where(ul, ol) + p {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-list-p));
}
.rhythm :where(ul, ol) > li + li {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-li-li));
}
.rhythm > :where(p, h1, h2, h3, h4, h5, h6, ul, ol) + :where(figure, img, picture, video) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-text-media));
}
.rhythm > :where(figure, img, picture, video) + :where(p, h1, h2, h3, h4, h5, h6, ul, ol) {
  margin-top: calc(var(--rhythm-base) * var(--rhythm-media-text));
}

.centered {
  --_measure: min(var(--width-measure), 100% - var(--gutter) * 2);
  --_breakout: minmax(0, calc((var(--width-breakout) - var(--width-measure)) / 2));
  --_spotlight: minmax(0, calc((var(--width-spotlight) - var(--width-breakout)) / 2));
  position: relative;
  display: grid;
  grid-template-columns:
    [fullbleed-start] minmax(var(--gutter), 1fr)
    [spotlight-start] var(--_spotlight)
    [breakout-start] var(--_breakout)
    [measure-start] var(--_measure) [measure-end]
    var(--_breakout) [breakout-end]
    var(--_spotlight) [spotlight-end]
    minmax(var(--gutter), 1fr) [fullbleed-end];
}
.centered > * {
  grid-column: measure;
}

.region {
  padding-block: clamp(
    var(--region-space-min, 3rem),
    var(--region-space, 8vh),
    var(--region-space-max, 8rem)
  );
}
`);

  // Animation engine (keyframes, drivers, floats, reduced-motion) — as-is.
  const animEngine = readFileSync(join(rootPath, 'src', 'css', 'animation.css'), 'utf8');
  parts.push(`/* ── Animation engine (src/css/animation.css) ── */\n${animEngine}`);

  // Component patterns (button/link/badge/card/…), reusing the string built above.
  parts.push(`/* ── Component patterns ── */\n${pat}`);

  // ── Inlined component + extended-structural partials ────────────────────────
  // The full framework component library ships in the tailwind bundle too. Two
  // things are stripped so Tailwind (not us) owns the utility layer:
  //   1. Pre-expanded breakpoint variant blocks (`@container (min-width: …)` that
  //      define `.{bp}-*` utilities) — Tailwind expands `@md:`/etc. from the base.
  //   2. Rules whose leading class collides with a Tailwind static utility
  //      (`flex`, `justify-center`, `hidden`, `table`, `sticky`, …) — Tailwind's
  //      own version wins; we don't shadow it.
  // Everything else (every bespoke component + structural class) is emitted as-is.
  // `layout.css` is intentionally NOT listed — its utility families are already
  // @utility above (split/tracks) or provided by Tailwind (flex/items/justify/…).
  const COMPONENT_PARTIALS = [
    'layout-extra',
    'utilities',
    'overlays',
    'forms',
    'content',
    'typographic',
    'scroll',
    'text-effects',
    'svg',
    'marquee',
    'nav',
    'carousel',
    'copy',
  ];
  const TW_CLASH = new Set<string>([
    // display / box
    'block',
    'inline',
    'inline-block',
    'flow-root',
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'table',
    'inline-table',
    'table-caption',
    'table-cell',
    'table-row',
    'contents',
    'hidden',
    'list-item',
    // position
    'static',
    'fixed',
    'absolute',
    'relative',
    'sticky',
    'isolate',
    // visibility
    'visible',
    'invisible',
    'collapse',
    // accessibility
    'sr-only',
    'not-sr-only',
    // flex direction / wrap
    'flex-row',
    'flex-row-reverse',
    'flex-col',
    'flex-col-reverse',
    'flex-wrap',
    'flex-nowrap',
    // alignment families (exact common members)
    'items-start',
    'items-end',
    'items-center',
    'items-baseline',
    'items-stretch',
    'justify-start',
    'justify-end',
    'justify-center',
    'justify-between',
    'justify-around',
    'justify-evenly',
    'content-start',
    'content-end',
    'content-center',
    'content-between',
    'content-around',
    'content-evenly',
    'text-left',
    'text-center',
    'text-right',
    'text-justify',
    'text-start',
    'text-end',
  ]);

  const droppedClashes = new Set<string>();
  let droppedVariantBlocks = 0;
  // Brace-aware top-level rule walk: keep each block unless it's a `.{bp}-*`
  // responsive-variant `@container (min-width:)` block or its leading class is a
  // Tailwind clash. The scanner skips `/* … */` comments and quoted strings so
  // stray `{`/`}` in them (e.g. a `.{bp}-flex` mention in a comment) can't throw
  // off brace depth. Comments preceding a selector stay attached to their rule.
  const stripForTailwind = (css: string): string => {
    const kept: string[] = [];
    let depth = 0;
    let start = 0;
    let preludeEnd = -1;
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === '/' && css[i + 1] === '*') {
        const end = css.indexOf('*/', i + 2);
        i = end === -1 ? css.length : end + 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        i += 1;
        while (i < css.length && css[i] !== ch) i += css[i] === '\\' ? 2 : 1;
        continue;
      }
      if (ch === '{') {
        if (depth === 0) preludeEnd = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) {
          const raw = css.slice(start, i + 1).trim();
          const prelude = css
            .slice(start, preludeEnd)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
          const clash = /^\.([A-Za-z0-9_-]+)/.exec(prelude);
          if (/^@container\s*\(\s*min-width:/.test(prelude)) {
            droppedVariantBlocks++;
          } else if (clash && TW_CLASH.has(clash[1] as string)) {
            droppedClashes.add(clash[1] as string);
          } else if (raw) {
            kept.push(raw);
          }
          start = i + 1;
        }
      }
    }
    return kept.join('\n\n');
  };

  const componentCss = COMPONENT_PARTIALS.map((name) => {
    const css = readFileSync(join(rootPath, 'src', 'css', `${name}.css`), 'utf8');
    return `/* ── ${name}.css ── */\n${stripForTailwind(css)}`;
  }).join('\n\n');
  parts.push(
    `/* ── Component + structural partials (Tailwind-clashing utilities dropped) ── */\n${componentCss}`,
  );

  mkdirSync(distPath, { recursive: true });
  const outPath = join(distPath, 'tailwind.css');
  writeFileSync(outPath, nl(parts) + '\n');
  console.log(
    `✓ ${outPath} (tailwind format — @theme + @utility + engine + patterns + components)`,
  );
  if (droppedVariantBlocks)
    console.log(`  ↳ dropped ${droppedVariantBlocks} pre-expanded breakpoint-variant blocks`);
  if (droppedClashes.size)
    console.log(
      `  ↳ dropped ${droppedClashes.size} Tailwind-clashing base classes: ${[...droppedClashes].sort().join(', ')}`,
    );
}
