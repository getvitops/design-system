/**
 * Pure, parameterized port of the Vitops design-system generator.
 *
 * `generate({ input, format, outDir })` reads a consumer's `design-system.json`,
 * validates it, and emits consumer-ready output for the chosen format into
 * `outDir`. Unlike the original CWD-bound script it mutates no shared state: every
 * generated token layer is built in memory and either bundled (css/bricks) or
 * inlined (tailwind) before writing.
 *
 * Framework-static assets (the hand-written CSS partials, the Bricks PHP + loader,
 * and the pre-built JS bundles) live under `assets/` in this package and are read /
 * copied from there — they are the same for every consumer.
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { transform } from 'lightningcss';
import { validate, type DesignSystem } from './schema.ts';
import { generateDocs } from './docs.ts';
import { emitDesignMd } from './design-md.ts';
import { generateLegal } from './legal/index.ts';
import { buildIconSprite } from './icons-sprite.ts';
import { resolveSiteConfig, type SiteConfig } from './site.ts';
import { generateIconInclude, resolveIcon } from '@getvitops/utils';
import { BASE_HOOK, DARK_SEL, TW_CLASH, type RoleSpec, roleHue, roleKind } from './shared.ts';
import {
  checkContrast,
  expandPalette,
  functionalRole,
  ladderWarnings,
  NUMERIC_STEPS,
  tokenClass,
  tokenVar,
  type ExpandedHue,
  type FunctionalRole,
} from './tokens.ts';

export type Format = 'bricks' | 'css' | 'tailwind' | 'design';

/**
 * Formats that emit a stylesheet. `design` is the odd one out — it emits a
 * single `DESIGN.md` brief and no CSS at all — so anything that expects to
 * import the generator's output (the Vite plugin's injected stylesheet, the
 * Astro integration) types against this narrower set.
 */
export type StylesheetFormat = Exclude<Format, 'design'>;

export interface GenerateOptions {
  /** Path to a design-system.json, OR an already-parsed config object. */
  input: string | DesignSystem;
  /** Output target. Default: 'bricks'. */
  format?: Format;
  /** Directory to write outputs into. Default: 'dist'. */
  outDir?: string;
  /** Override the framework asset root (advanced/testing). */
  assetsDir?: string;
  /**
   * Optional site config (path, or already-parsed) enabling legal-document
   * output into `<outDir>/legal/*.html`.
   *
   * Separate from `input` because it is a different config kind: `input` is a
   * `design-system.json`, this is a `SiteConfig`. Nothing else in `generate`
   * reads it, and omitting it emits no legal files.
   */
  site?: string | SiteConfig;
}

export interface GenerateResult {
  format: Format;
  outDir: string;
  written: string[];
}

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ASSETS = join(HERE, '..', 'assets');

// ── colour machinery ─────────────────────────────────────────────────────────
// Every hue is an 11-step numeric OKLCH scale on a shared lightness ladder (see
// tokens.ts); every role resolves to `--color-<target>-<role>[-<variant>]`.
// Dark mode re-points which step each token reads; the solid family is stable.
const UTILITY_PROPS: Record<string, string> = {
  bg: 'background-color',
  text: 'color',
  icon: 'color',
  border: 'border-color',
  outline: 'outline-color',
  fill: 'fill',
  stroke: 'stroke',
};

/**
 * Which token target a utility family draws from. Four families have tokens of
 * their own; the other three are aliases, because an SVG fill wants the icon
 * tier (3:1, may run vivid) and an outline wants the border tier — minting
 * separate tokens for them would be three more things to keep in contrast.
 */
const UTILITY_SOURCE: Record<string, string> = {
  bg: 'bg',
  text: 'text',
  icon: 'icon',
  border: 'border',
  outline: 'border',
  fill: 'icon',
  stroke: 'icon',
};

/** The target segment of a token key (`bg-solid-bold` → `bg`). */
const targetOf = (key: string): string => {
  const i = key.indexOf('-');
  return i === -1 ? key : key.slice(0, i);
};

export interface ColorUtility {
  /** Class name, without the leading dot. */
  cls: string;
  /** CSS property the class sets. */
  prop: string;
  /** `var(--…)` reference the class resolves to. */
  value: string;
}

/**
 * Every role colour utility, each class name emitted EXACTLY once.
 *
 * There is now a single axis. The target lives *inside* the token name, so
 * `bg-danger-muted` and `text-danger-muted` are different tokens and the
 * collision the old plane/stop precedence rule existed to arbitrate cannot
 * arise. Both the css/bricks and tailwind paths render from this one list, which
 * is what keeps the three formats in step; `format-parity.test.ts` holds them
 * there.
 *
 * The class name IS the token name minus `--color-`, so there is no separate
 * naming rule to drift — see `tokenClass` in tokens.ts.
 */
export function roleColorUtilities(
  roles: readonly FunctionalRole[],
  utilities: readonly string[],
): ColorUtility[] {
  const out: ColorUtility[] = [];
  for (const fr of roles) {
    for (const fam of utilities) {
      const source = UTILITY_SOURCE[fam];
      if (source == null) continue;
      for (const key of Object.keys(fr.light)) {
        if (targetOf(key) !== source) continue;
        const canonical = tokenClass(fr.role, key);
        // Alias families keep the token but rename the leading segment:
        // `border-danger-bold` → `outline-danger-bold`.
        const cls = fam === source ? canonical : fam + canonical.slice(source.length);
        out.push({
          cls,
          prop: UTILITY_PROPS[fam] as string,
          value: `var(${tokenVar(fr.role, key)})`,
        });
      }
    }
  }
  return out;
}

/** Render the shared set as plain rules (css/bricks formats). */
const colorUtilityRules = (u: ColorUtility[]): string =>
  u.map(({ cls, prop, value }) => `.${cls} { ${prop}: ${value}; }`).join('\n');

const decls = (obj: Record<string, string>, indent = '  ') =>
  Object.entries(obj)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');

// ── fluid modular scale ───────────────────────────────────────────────────────
interface ScaleConfig {
  base: string;
  ratio: number;
  steps?: number;
  names?: string[];
  baseStep?: number;
  baseline?: string;
  fluid?: { minVw: string; maxVw: string; minRatio: number };
}
interface ScaleStep {
  name: string;
  value: string;
  max: string;
  offset: number;
}
const round = (n: number) => Number(n.toFixed(4)).toString();
const rem = (v: string) => parseFloat(v);
const buildScale = (s: ScaleConfig): ScaleStep[] => {
  const names = s.names ?? Array.from({ length: s.steps ?? 0 }, (_, i) => String(i + 1));
  const base = rem(s.base);
  const baseStep = s.baseStep ?? Math.ceil(names.length / 2);
  const baselineIdx = s.baseline ? names.indexOf(s.baseline) : baseStep - 1;
  return names.map((name, i) => {
    const k = i - (baseStep - 1);
    const vMax = base * Math.pow(s.ratio, k);
    const max = `${round(vMax)}rem`;
    let value = max;
    if (s.fluid) {
      const { minVw, maxVw, minRatio } = s.fluid;
      const vMin = base * Math.pow(minRatio, k);
      const lo = Math.min(vMin, vMax);
      const hi = Math.max(vMin, vMax);
      if (lo !== hi) {
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

// ── typography ─────────────────────────────────────────────────────────────────
interface TypographyRole {
  family?: string;
  [key: string]: string | number | undefined;
}
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
const TYPO_IDENTITY: Record<string, string> = {
  'font-style': 'normal',
  'letter-spacing': 'normal',
  'text-decoration': 'none',
  'text-transform': 'none',
  'text-wrap': 'wrap',
};

// ── animation state defaults ─────────────────────────────────────────────────
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

interface Pattern {
  group?: string;
  overrides?: Record<string, string>;
  element?: string;
  class?: string;
  fill?: boolean;
  default_role?: string;
  base?: Record<string, string>;
  states?: Record<string, Record<string, unknown>>;
  roles?: string[];
}

const id = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 6);

/**
 * The in-memory output of building a design system. String fields are CSS/JSON
 * ready to write; the generated CSS partials feed the css/bricks bundler.
 */
interface Built {
  generated: Record<string, string>; // filename (under generated/) -> css
  bricksColorsNamed: string;
  bricksColorsSemantic: string;
  bricksVariables: string;
  tokensJson: string;
  designManifest: string;
  tailwind: string;
  designMd: string;
  // captured for the tailwind bundler
  twTypeTokensCss: string;
  twPatternTokensCss: string;
  patternsCss: string;
}

// Exported for tests only — deliberately NOT re-exported from index.ts, so the
// package's public API stays `generate` / `generateDocs` / `validate`.
export function build(ds: DesignSystem, format: Format, assetsDir: string): Built {
  const BRICKS = format === 'bricks';
  // Every hue expands to its 11-step numeric OKLCH scale; every role resolves
  // to functional tokens over its hue. Dark mode is the automatic flip.
  const expandedPalette = expandPalette(ds.colors.palette as Record<string, unknown>);
  const roleMap = ds.colors.roles as Record<string, RoleSpec>;
  const scaleRoles: FunctionalRole[] = [];
  for (const [role, spec] of Object.entries(roleMap)) {
    const hueName = roleHue(spec);
    const hue = expandedPalette[hueName];
    if (hue == null) throw new Error(`role "${role}" references unknown palette hue "${hueName}"`);
    scaleRoles.push(functionalRole(role, hueName, hue, roleKind(spec)));
  }
  const surfaceRole = scaleRoles.find((r) => r.role === 'surface');
  // The focus ring is role-less by default, so it needs one nominated source.
  // `ui-primary` is the interaction hue — a ring in the brand colour would drift
  // away from the buttons and links it appears on.
  const focusRole = scaleRoles.find((r) => r.role === 'ui-primary') ?? scaleRoles[0];

  // A pinned brand colour that sits off the shared lightness ladder is legal —
  // the author asked for that exact colour — but past ~0.03 L the hue reads
  // visibly heavier or lighter than its siblings at that step, so say so.
  for (const w of ladderWarnings(expandedPalette)) console.warn(`[vitops] ${w}`);

  // The contrast contract runs at BUILD time, not only in tests: a consumer
  // editing their own palette has no test suite, and an illegible pairing that
  // ships is far more expensive than a build that stops. Chromatic roles are
  // checked against the surface planes they actually sit on, since coloured text
  // appears over the page far more often than over its own tint.
  {
    const numericOf = (hueName: string) => expandedPalette[hueName]?.numeric ?? {};
    const resolve = (val: string): string => {
      const m = /^var\(--color-([a-z0-9-]+)-(\d+)\)$/.exec(val);
      return m ? (numericOf(m[1] as string)[m[2] as never] ?? val) : val;
    };
    const planeKeys = ['bg', 'bg-muted', 'bg-x-muted'] as const;
    const surfaceBg = surfaceRole
      ? {
          light: planeKeys.flatMap((k) =>
            surfaceRole.light[k] ? [resolve(surfaceRole.light[k] as string)] : [],
          ),
          dark: planeKeys.flatMap((k) =>
            surfaceRole.dark[k] ? [resolve(surfaceRole.dark[k] as string)] : [],
          ),
        }
      : undefined;
    const failures = scaleRoles.flatMap((fr) => checkContrast(fr, numericOf, surfaceBg));
    if (failures.length)
      throw new Error(
        `colour contrast contract failed (${failures.length} pairing${
          failures.length === 1 ? '' : 's'
        }):\n  ${failures.join('\n  ')}`,
      );
  }
  const patterns = ds.patterns;
  const shadows = ds.shadows;
  const typography = ds.typography;
  const UTILITIES = (ds.colors.utilities ?? ['bg', 'text', 'icon', 'border']).filter(
    (u) => u in UTILITY_PROPS,
  );

  const generated: Record<string, string> = {};

  /**
   * The two background utilities that aren't derived from the palette, so
   * neither the generated scale nor Bricks' own palette import produces them.
   *
   * They exist to undo a pattern's fill — `class="card bg-transparent"` for a
   * flat, border-only card. Tailwind ships both as built-ins, so the tailwind
   * format deliberately emits neither and defers, exactly as it does for the
   * `TW_CLASH` names.
   */
  const NON_PALETTE_BG =
    `/* Undo a pattern's fill (Tailwind provides these natively in that format). */\n` +
    `.bg-transparent { background-color: transparent; }\n` +
    `.bg-inherit { background-color: inherit; }\n`;

  // ── color.css ──────────────────────────────────────────────────────────────
  if (BRICKS) {
    generated['color.css'] =
      '/* Colours provided by Bricks (palette import generates tokens + utilities). */\n' +
      NON_PALETTE_BG;
  } else {
    let css = `/* GENERATED from design-system.json — do not edit by hand. */\n:root {\n`;
    css += `  color-scheme: light;\n`;
    css += `  /* Hue scales (numeric steps, 50 = tinted near-white … 950 = tinted near-black) */\n`;
    for (const [name, hue] of Object.entries(expandedPalette))
      for (const [n, hex] of Object.entries(hue.numeric))
        css += `  --color-${name}-${n}: ${hex};\n`;
    css += `\n  /* Role tokens (the public API) */\n`;
    for (const fr of scaleRoles)
      for (const [t, val] of Object.entries(fr.light))
        css += `  ${tokenVar(fr.role, t)}: ${val};\n`;
    if (focusRole) {
      css += `\n  /* Focus ring — a boundary, so it takes the solid tone, not a border tint. */\n`;
      css += `  --color-border-focus: ${focusRole.light['bg-solid']};\n`;
    }
    if (surfaceRole) {
      css += `\n  /* Translucent surface + scrim */\n`;
      css += `  --surface-glass: color-mix(in oklch, var(--color-bg-surface) 72%, transparent);\n`;
      css += `  --overlay: color-mix(in oklch, var(--color-${surfaceRole.hue}-950) 45%, transparent);\n`;
    }
    css += `}\n\n`;
    // Dark appearance: the automatic functional flip (solid stays mode-stable).
    {
      let fb = '';
      for (const fr of scaleRoles)
        for (const [t, val] of Object.entries(fr.dark))
          if (fr.light[t] !== val) fb += `  ${tokenVar(fr.role, t)}: ${val};\n`;
      if (surfaceRole)
        fb += `  --overlay: color-mix(in oklch, var(--color-${surfaceRole.hue}-950) 60%, transparent);\n`;
      if (fb) {
        css += `/* Functional role tokens (dark) */\n`;
        css += `${DARK_SEL} {\n  color-scheme: dark;\n${fb}}\n\n`;
      }
    }
    // Raw hue steps, then the role set. One axis means every class here is
    // emitted exactly once by construction — no precedence rule, and no reliance
    // on the minifier dropping a shadowed rule.
    css += `/* Colour utilities — ${UTILITIES.join(', ')} */\n`;
    for (const [name, hue] of Object.entries(expandedPalette))
      for (const n of Object.keys(hue.numeric))
        css +=
          UTILITIES.map(
            (cls) => `.${cls}-${name}-${n} { ${UTILITY_PROPS[cls]}: var(--color-${name}-${n}); }`,
          ).join('\n') + '\n';
    css += `\n/* Role utilities (the public API) */\n`;
    css += `${colorUtilityRules(roleColorUtilities(scaleRoles, UTILITIES))}\n`;
    if (surfaceRole)
      css += `.glass { background-color: var(--surface-glass); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }\n`;
    css += NON_PALETTE_BG;
    generated['color.css'] = css;
  }

  // ── shadows.css ──────────────────────────────────────────────────────────────
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
    generated['shadows.css'] = sh;
  }

  // ── scales ───────────────────────────────────────────────────────────────────
  const typeSteps = ds.typeScale ? buildScale(ds.typeScale as ScaleConfig) : [];
  const spaceSteps = ds.spaceScale ? buildScale(ds.spaceScale as ScaleConfig) : [];
  const textMax: Record<string, string> = Object.fromEntries(
    typeSteps.map((s) => [`text-${s.name}`, s.max]),
  );

  const typographyFamilies = typography?.families ?? {};
  const withScaleFallback = (v: string) =>
    v.replace(/var\(\s*(--text-[\w-]+)\s*\)/g, (m, name) =>
      textMax[name.slice(2)] ? `var(${name}, ${textMax[name.slice(2)]})` : m,
    );
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

  // ── type-tokens.css ──────────────────────────────────────────────────────────
  let twTypeTokensCss = '';
  if (BRICKS) {
    generated['type-tokens.css'] =
      '/* Fonts + type/space scales provided by Bricks (Font + Variables managers). */\n';
  } else {
    const root: Record<string, string> = {};
    for (const [name, stack] of Object.entries(ds.fonts ?? {})) root[`--font-${name}`] = stack;
    for (const s of typeSteps) root[`--text-${s.name}`] = s.value;
    for (const s of spaceSteps) root[`--space-${s.name}`] = s.value;
    const css = `/* GENERATED font families + fluid type/space scales — do not edit by hand. */\n:root {\n${decls(root)}\n}\n`;
    twTypeTokensCss = css;
    generated['type-tokens.css'] = css;
  }

  // ── tokens.css (pattern token cascade) ───────────────────────────────────────
  let twPatternTokensCss = '';
  {
    const tDefaults = patterns?.defaults ?? {};
    const tRadii = patterns?.radii ?? {};
    const tGroups = patterns?.groups ?? {};
    const tZ = patterns?.z ?? {};
    const tItems = (patterns?.items ?? {}) as Record<string, Pattern>;
    const root: Record<string, string> = {};
    for (const [prop, val] of Object.entries(tDefaults)) root[`--${prop}-default`] = val;
    if (!BRICKS) for (const [name, val] of Object.entries(tRadii)) root[`--br-${name}`] = val;
    for (const [group, props] of Object.entries(tGroups))
      for (const [prop, val] of Object.entries(props)) root[`--${prop}-${group}`] = val;
    for (const [name, n] of Object.entries(tZ)) root[`--z-tier-${name}`] = String(n);
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
    generated['tokens.css'] = tok;
  }

  // ── typography.css (.font-* roles) ───────────────────────────────────────────
  {
    const roles = (typography?.roles ?? {}) as Record<string, TypographyRole>;
    const headings = typography?.headings ?? {};
    let typo = `/* GENERATED typography roles — do not edit by hand. */\n`;
    for (const [role, spec] of Object.entries(roles))
      typo += `.font-${role} {\n${decls(roleDecls(role, spec))}\n}\n`;
    for (const [tag, role] of Object.entries(headings))
      if (roles[role]) typo += `${tag} {\n${decls(roleDecls(role, roles[role]))}\n}\n`;
    generated['typography.css'] = typo;
  }

  // ── patterns.css (component interaction patterns) ────────────────────────────
  // `sel` may be a selector list (an element pattern emits both `:where(el, .cls).role`
  // and `.cls-role`); the pseudo must be appended to each one, not just the last.
  const stateRules = (
    sel: string | string[],
    role: string | null,
    states: Record<string, Record<string, unknown>>,
    colorProp: 'background-color' | 'color' = 'background-color',
  ) => {
    const sels = Array.isArray(sel) ? sel : [sel];
    let out = '';
    for (const [state, spec] of Object.entries(states)) {
      const body: string[] = [];
      // `step` intensifies the pattern's colour: fills swap solid → solid-bold;
      // text swaps the bold emphasis stop → x-bold.
      if (typeof spec.step === 'number' && role) {
        const stateVar =
          colorProp === 'background-color'
            ? `var(--color-bg-${role}-${spec.step >= 1 ? 'solid-bold' : 'solid'})`
            : spec.step >= 1
              ? `var(--color-text-${role}-bold)`
              : `var(--color-text-${role})`;
        body.push(`${colorProp}: ${stateVar};`);
      }
      if (typeof spec.scale === 'number') body.push(`scale: ${spec.scale};`);
      if (typeof spec.lift === 'string') body.push(`translate: 0 calc(-1 * ${spec.lift});`);
      if (typeof spec.shadow === 'string' && shadows?.[spec.shadow])
        body.push(`filter: drop-shadow(var(--shadow-${spec.shadow}));`);
      else if (spec.shadow === true)
        body.push(`box-shadow: var(--lift-shadow, 0 8px 20px -6px rgb(0 0 0 / 0.25));`);
      if (spec.ring === true) {
        // A focus ring has to be *seen*, so it uses the solid tone rather than a
        // decorative border tint. `--color-border-focus` is the role-less
        // default, emitted once from ui-primary and contrast-checked as a
        // non-text boundary.
        const ringColor = role ? `var(--color-bg-${role}-solid)` : `var(--color-border-focus)`;
        body.push(`outline: none;`, `box-shadow: 0 0 0 3px ${ringColor};`);
      }
      if (spec.css && typeof spec.css === 'object')
        for (const [k, v] of Object.entries(spec.css as Record<string, string>))
          body.push(`${k}: ${v};`);
      if (!body.length) continue;
      const pseudo =
        state === 'hover'
          ? ':hover'
          : state === 'active'
            ? ':active'
            : state === 'focus-visible'
              ? ':focus-visible'
              : `:${state}`;
      const rule = `${sels.map((s) => `${s}${pseudo}`).join(',\n')} {\n  ${body.join('\n  ')}\n}\n`;
      out += state === 'hover' ? `@media (hover: hover) {\n${rule}}\n` : rule;
    }
    return out;
  };

  let pat = `/* GENERATED component patterns — do not edit by hand. */\n`;
  pat += `/* Interaction transitions for patterned elements (independent props compose). */\n`;
  for (const [pname, p] of Object.entries((patterns?.items ?? {}) as Record<string, Pattern>)) {
    if (!p.base) continue;
    const states = p.states ?? {};
    // `class` defaults to the pattern key only for class-only patterns, so an
    // `element`-only entry never sprouts a surprise class.
    const cls = p.class ?? (p.element ? undefined : pname);
    // Element patterns style at zero specificity (`:where(…)`) so any explicit
    // class — a louder pattern, or a component's own BEM rule — wins without
    // !important. Class-only patterns stay unwrapped at 0-1-0, or they'd lose to
    // every utility. With both, the element and the class share one rule, which
    // is what lets `.btn` / `.link` be applied to any tag.
    const elementSel = (extra = '') =>
      `:where(${[p.element, cls && `.${cls}`].filter(Boolean).join(', ')})${extra}`;
    const defaultSel = p.element ? elementSel() : `.${cls}`;
    const defaultRole = p.default_role ?? null;
    const base = { ...p.base };
    // Explicit `fill` wins; otherwise infer, keeping the historical name-based
    // special cases so existing consumer configs don't shift behaviour.
    const fills =
      p.fill ??
      (pname === 'button' ||
        pname === 'badge' ||
        base['background-color'] != null ||
        base['background'] != null);
    const colorProp: 'background-color' | 'color' = fills ? 'background-color' : 'color';
    pat += `${defaultSel} {\n`;
    const hasStates = Object.keys(states).length > 0;
    if (hasStates) {
      pat += `  transition-property: translate, scale, rotate, filter, box-shadow, background-color, color;\n`;
      pat += `  transition-duration: var(--interact-duration, 200ms);\n`;
      pat += `  transition-timing-function: var(--interact-easing, ease);\n`;
      pat += `  translate: 0 0; scale: 1; rotate: 0deg;\n`;
    }
    if (defaultRole && fills && base['background-color'] == null && base['background'] == null)
      base['background-color'] = `var(--color-bg-${defaultRole}-solid)`;
    const wrappedBase: Record<string, string> = {};
    for (const [prop, val] of Object.entries(base)) {
      const sfx = BASE_HOOK[prop];
      wrappedBase[prop] = sfx ? `var(--${sfx}-${pname}, ${val})` : String(val);
    }
    pat += decls(wrappedBase) + '\n}\n';
    pat += stateRules(defaultSel, defaultRole, states, colorProp);
    for (const role of p.roles ?? []) {
      // Element patterns take the role as a bare class (`<button class="danger">`)
      // AND as the `<pattern>-<role>` form that class patterns use, so the same
      // variant reaches a non-element host (`<a class="btn btn-danger">`). Both
      // land at 0-1-0 — the element half stays inside :where() so a role variant
      // can't outrank a plain class the way `button.danger` (0-1-1) used to.
      const variantSels = p.element
        ? [elementSel(`.${role}`), ...(cls ? [`.${cls}-${role}`] : [])]
        : [`.${cls}-${role}`];
      // Fills sit on the role's solid and pair with the foreground computed
      // against it; text variants use the role's text token, which is the one
      // guaranteed legible over a surface in both appearances.
      const variantColorDecl = fills
        ? `background-color: var(--color-bg-${role}-solid); color: var(--color-text-on-${role})`
        : `color: var(--color-text-${role})`;
      pat += `${variantSels.join(',\n')} { ${variantColorDecl}; }\n`;
      pat += stateRules(variantSels, role, states, colorProp);
    }
    pat += '\n';
  }
  generated['patterns.css'] = pat;

  // ── animation-effects.css ────────────────────────────────────────────────────
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
    const STATES: [string, (s: string) => string][] = [
      ['hover', (s) => `.${s}:hover`],
      ['focus', (s) => `.${s}:focus-visible`],
      ['active', (s) => `.${s}.is-active, .${s}[data-active]`],
    ];
    out += `\n/* State-flip variants — compose with .transition (hover-/focus-/active-<fx>). */\n`;
    for (const [name, e] of Object.entries(anim.effects ?? {})) {
      if (e.kf !== 'composite' && e.kf !== 'paint') continue;
      const props: Record<string, { from?: string; to?: string }> = {};
      for (const [k, v] of Object.entries(e.vars ?? {})) {
        const m = /^(.*)-(from|to)$/.exec(k);
        if (m) (props[m[1] as string] ??= {})[m[2] as 'from' | 'to'] = asStr(v);
      }
      const rest: Record<string, string> = {};
      for (const [p, ft] of Object.entries(props)) {
        if (ft.from != null && ft.from !== STATE_DEFAULT[p]) rest[`--${p}-from`] = ft.from;
        if (ft.to != null && ft.to !== STATE_DEFAULT[p]) rest[`--${p}-to`] = ft.to;
      }
      const flip: Record<string, string> = Object.fromEntries(
        Object.keys(props).map((p) => [`--t-${p}`, `var(--${p}-to, ${STATE_DEFAULT[p]})`]),
      );
      if (Object.keys(rest).length)
        out += `${STATES.map(([s]) => `.${s}-${name}`).join(', ')} {\n${decls(rest)}\n}\n`;
      for (const [s, sel] of STATES) out += `${sel(`${s}-${name}`)} {\n${decls(flip)}\n}\n`;
    }
    generated['animation-effects.css'] = out;
  }

  // ── Bricks palettes ──────────────────────────────────────────────────────────
  // Named = the hue scales (numeric steps); Semantic = the functional role
  // tokens with their automatic light/dark pairing.
  const namedColors: unknown[] = [];
  for (const [name, hue] of Object.entries(expandedPalette))
    for (const [n, hex] of Object.entries(hue.numeric)) {
      const token = `${name}-${n}`;
      namedColors.push({
        raw: `var(--color-${token})`,
        light: hex,
        id: id(`named:${token}`),
        utilityClasses: UTILITIES,
      });
    }
  const semanticColors: unknown[] = [];
  for (const fr of scaleRoles)
    for (const [t, light] of Object.entries(fr.light)) {
      const dark = fr.dark[t] as string;
      semanticColors.push({
        raw: `var(${tokenVar(fr.role, t)})`,
        light,
        darkModeEnabled: light !== dark,
        dark,
        id: id(`semantic:${fr.role}-${t}`),
        utilityClasses: UTILITIES,
      });
    }
  const bricksColorsNamed = JSON.stringify(
    { id: id('palette:named'), name: 'Named', colors: namedColors },
    null,
    2,
  );
  const bricksColorsSemantic = JSON.stringify(
    { id: id('palette:semantic'), name: 'Semantic', colors: semanticColors },
    null,
    2,
  );

  // ── Bricks Global Variables (fonts + scales) ─────────────────────────────────
  const bricksVariables = (() => {
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
    addScale('Typography', 'typography', 'text-', ds.typeScale as ScaleConfig, typeSteps);
    addScale('Spacing', 'spacing', 'space-', ds.spaceScale as ScaleConfig, spaceSteps);
    for (const [name, stack] of Object.entries(ds.fonts ?? {}))
      variables.push({ id: id(`var:font-${name}`), name: `font-${name}`, value: stack });
    for (const [name, val] of Object.entries(ds.patterns?.radii ?? {}))
      variables.push({ id: id(`var:br-${name}`), name: `br-${name}`, value: val });
    return JSON.stringify({ variables, categories }, null, 2);
  })();

  // ── tokens.json (trimmed token export for programmatic consumers) ────────────
  const numericPalette = Object.fromEntries(
    Object.entries(expandedPalette).map(([k, v]) => [k, v.numeric]),
  );
  const tokensJson = JSON.stringify(
    {
      colors: {
        palette: numericPalette,
        roles: roleMap,
        functional: Object.fromEntries(
          scaleRoles.map((fr) => [fr.role, { light: fr.light, dark: fr.dark }]),
        ),
      },
      fonts: ds.fonts ?? {},
      text: Object.fromEntries(typeSteps.map((s) => [s.name, s.value])),
      spacing: Object.fromEntries(spaceSteps.map((s) => [s.name, s.value])),
      shadows: shadows ?? {},
      radii: ds.patterns?.radii ?? {},
    },
    null,
    2,
  );

  // ── design-manifest.json (live-editor manifest; css format) ──────────────────
  const designManifest = (() => {
    const reverseIndex: Record<string, string> = {};
    // A numeric step maps back to that step's `anchors` entry, NOT to the hue's
    // `seed`: the seed regenerates the whole ramp (and every step would collapse
    // to one path, so editing two steps of a hue would silently keep only one),
    // whereas `anchors.<step>` is precisely the per-step override (see schema.ts).
    for (const [name, hue] of Object.entries(expandedPalette))
      for (const n of Object.keys(hue.numeric))
        reverseIndex[`--color-${name}-${n}`] = `colors.palette.${name}.anchors.${n}`;
    // `kind` travels with the role so the editor picks the right `roleTokens`
    // variant on a remap — it used to infer that from `role === 'surface'`, which
    // silently did the wrong thing for any other surface-kind role.
    const colorRoles = Object.entries(roleMap).map(([name, spec]) => ({
      name,
      ramp: roleHue(spec),
      kind: roleKind(spec),
    }));
    // Per-hue token sets, so a client (the live editor) can re-point a role at
    // another hue. It can't derive these itself: `text-on` is a computed contrast
    // literal, not a var() ref. One variant per role KIND, because the two kinds
    // emit different token sets — a chromatic role has no bare `bg`, a surface
    // role has no solid tints.
    //
    // Keys are token keys (`bg`, `text-on`, `border-bold`, …) — the same ones
    // `tokenVar()` turns into `--color-<target>-<role>[-<variant>]`.
    const roleTokens = Object.fromEntries(
      Object.entries(expandedPalette).map(([hueName, hue]) => {
        const chromatic = functionalRole('_', hueName, hue, 'chromatic');
        const surface = functionalRole('_', hueName, hue, 'surface');
        return [
          hueName,
          {
            chromatic: { light: chromatic.light, dark: chromatic.dark },
            surface: { light: surface.light, dark: surface.dark },
          },
        ];
      }),
    );
    const typoRoles = (typography?.roles ?? {}) as Record<string, TypographyRole>;
    const hooks: Record<string, { prop: string; key: string }> = {};
    for (const [key, [prop, sfx]] of Object.entries(TYPO_KEYMAP)) hooks[sfx] = { prop, key };
    // Index EVERY hook for every role, not just the ones the role already
    // declares. The editor builds its control set from `typography.hooks` (all
    // of TYPO_KEYMAP), so a role that omits `tracking` still gets a `--<role>-ls`
    // control; without an entry here that edit previews live and is then dropped
    // as "skipped" on save. The path is a valid place to write whether or not it
    // exists yet — `roles` is an open record and the patch deep-merges.
    for (const role of Object.keys(typoRoles))
      for (const [key, [, sfx]] of Object.entries(TYPO_KEYMAP))
        reverseIndex[`--${role}-${sfx}`] = `typography.roles.${role}.${key}`;
    const pDefaults = patterns?.defaults ?? {};
    const pRadii = patterns?.radii ?? {};
    const pGroups = patterns?.groups ?? {};
    const pItems = (patterns?.items ?? {}) as Record<string, Pattern>;
    for (const prop of Object.keys(pDefaults))
      reverseIndex[`--${prop}-default`] = `patterns.defaults.${prop}`;
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
    // Radii last, and only where a pattern hasn't already claimed the var: a
    // `patterns.radii` key that equals a pattern name collides on `--br-<name>`
    // (e.g. radii `card` vs the `card` pattern — a live collision in the example
    // config). The pattern's BASE_HOOK is the documented override, so it wins,
    // and `validate()` surfaces the collision as a warning so it isn't silent.
    for (const name of Object.keys(pRadii))
      if (!(`--br-${name}` in reverseIndex))
        reverseIndex[`--br-${name}`] = `patterns.radii.${name}`;
    return JSON.stringify(
      {
        colors: {
          ramps: Object.keys(expandedPalette),
          steps: NUMERIC_STEPS,
          palette: numericPalette,
          roles: colorRoles,
          roleTokens,
        },
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
        reverseIndex,
      },
      null,
      2,
    );
  })();

  // ── Tailwind bundle ──────────────────────────────────────────────────────────
  // Only the tailwind format consumes this (see `generate`), and assembling it
  // reads every framework partial off disk — so skip the work for css/bricks.
  const tailwind =
    format !== 'tailwind'
      ? ''
      : emitTailwind({
          ds,
          expandedPalette,
          scaleRoles,
          shadows,
          typeSteps,
          spaceSteps,
          typography,
          roleDecls,
          twTypeTokensCss,
          twPatternTokensCss,
          patternsCss: pat,
          assetsDir,
          utilities: UTILITIES,
        });

  // ── DESIGN.md ────────────────────────────────────────────────────────────────
  // Same deal as the tailwind bundle: only its own format consumes it, so the
  // other three don't pay for building it.
  const designMd =
    format !== 'design'
      ? ''
      : emitDesignMd({ ds, expandedPalette, scaleRoles, typeSteps, spaceSteps, shadows });

  return {
    generated,
    bricksColorsNamed,
    bricksColorsSemantic,
    bricksVariables,
    tokensJson,
    designManifest,
    tailwind,
    designMd,
    twTypeTokensCss,
    twPatternTokensCss,
    patternsCss: pat,
  };
}

// ── Tailwind emitter ──────────────────────────────────────────────────────────
interface TwCtx {
  ds: DesignSystem;
  expandedPalette: Record<string, ExpandedHue>;
  scaleRoles: FunctionalRole[];
  shadows: Record<string, string> | undefined;
  typeSteps: ScaleStep[];
  spaceSteps: ScaleStep[];
  typography: DesignSystem['typography'];
  roleDecls: (role: string, spec: TypographyRole) => Record<string, string>;
  twTypeTokensCss: string;
  twPatternTokensCss: string;
  patternsCss: string;
  assetsDir: string;
  /**
   * The configured `colors.utilities`. Was previously hardcoded to
   * bg/text/border at the emit site, so a consumer who enabled `outline`/
   * `fill`/`stroke` got them in css/bricks but not tailwind.
   */
  utilities: string[];
}

function emitTailwind(ctx: TwCtx): string {
  const {
    ds,
    expandedPalette,
    scaleRoles,
    shadows,
    typeSteps,
    spaceSteps,
    typography,
    roleDecls,
    twTypeTokensCss,
    twPatternTokensCss,
    patternsCss,
    assetsDir,
    utilities,
  } = ctx;
  const cssDir = join(assetsDir, 'css');
  const nl = (arr: string[]) => arr.filter(Boolean).join('\n');
  const parts: string[] = [
    `/* GENERATED for Tailwind v4 (Astro) — do not edit by hand.\n` +
      `   Class reference: npx vitops docs classes  ·  All topics: npx vitops docs */`,
  ];
  parts.push(`@import "tailwindcss";\n`);

  const theme: string[] = [];
  theme.push(`  /* Hue scales → bg-<hue>-<step> text-* border-* (numeric, 50…950) */`);
  for (const [name, hue] of Object.entries(expandedPalette))
    for (const [n, hex] of Object.entries(hue.numeric))
      theme.push(`  --color-${name}-${n}: ${hex};`);
  theme.push(`\n  /* Fonts → font-* */`);
  for (const [name, stack] of Object.entries(ds.fonts ?? {}))
    theme.push(`  --font-${name}: ${stack};`);
  theme.push(`\n  /* Fluid type scale → text-* */`);
  for (const s of typeSteps) theme.push(`  --text-${s.name}: ${s.value};`);
  // Fluid space steps are NOT put in Tailwind's --spacing-* namespace: named
  // spacing keys shadow the size scales (e.g. `max-w-7xl` would resolve to
  // var(--spacing-7xl) ≈ 6rem and collapse layouts). They ship as --space-*
  // (matching the css format) in a plain :root below; use var(--space-<name>)
  // or the TW4 arbitrary form p-(--space-md). Numeric spacing (p-4 …) keeps
  // Tailwind's default --spacing multiplier.
  theme.push(`\n  /* Drop-shadows → shadow-* */`);
  for (const [name, value] of Object.entries(shadows ?? {}))
    theme.push(`  --shadow-${name}: ${value};`);
  theme.push(`\n  /* Container breakpoints → @sm:/@md:/@lg:/@xl: */`);
  for (const [name, val] of [
    ['sm', '30rem'],
    ['md', '48rem'],
    ['lg', '64rem'],
    ['xl', '80rem'],
  ])
    theme.push(`  --container-${name}: ${val};`);
  parts.push(`@theme {\n${theme.join('\n')}\n}\n`);

  if (spaceSteps.length)
    parts.push(
      `/* Fluid space scale — var(--space-<name>) or p-(--space-<name>) */\n:root {\n` +
        spaceSteps.map((s) => `  --space-${s.name}: ${s.value};`).join('\n') +
        `\n}\n`,
    );

  // Role tokens go in a plain :root block, NOT @theme — including the emphasis
  // stops, despite those living in the --color-* namespace. The @utility set
  // below is the public API.
  //
  // This is load-bearing, not stylistic. Measured against tailwindcss@4.3.3:
  // when a token is in @theme AND an @utility of the derived name exists,
  // Tailwind merges both into one rule with the @theme declaration LAST, and it
  // does so regardless of source order. Putting `--color-<role>-<stop>` in
  // @theme would therefore silently substitute the stop for the plane on the
  // five colliding classes — including `text-<role>-muted` (step 800 → 300) and
  // `text-<role>-x-muted` (600 → 100), i.e. exactly the tokens tokens.ts's APCA
  // test guarantees are readable. Raw hue scales are safe in @theme because no
  // @utility competes for those names.
  if (scaleRoles.length) {
    let fn = '';
    for (const fr of scaleRoles)
      for (const [t, val] of Object.entries(fr.light)) fn += `  ${tokenVar(fr.role, t)}: ${val};\n`;
    const focus = scaleRoles.find((r) => r.role === 'ui-primary') ?? scaleRoles[0];
    if (focus) fn += `  --color-border-focus: ${focus.light['bg-solid']};\n`;
    const surface = scaleRoles.find((r) => r.role === 'surface');
    if (surface) {
      fn += `  --surface-glass: color-mix(in oklch, var(--color-bg-surface) 72%, transparent);\n`;
      fn += `  --overlay: color-mix(in oklch, var(--color-${surface.hue}-950) 45%, transparent);\n`;
    }
    parts.push(`/* Role tokens (the public API) */\n:root {\n${fn}}\n`);
  }

  parts.push(
    `/* ── Framework tokens (consumed by the inlined components) ── */\n` +
      `${twTypeTokensCss}\n${twPatternTokensCss}`,
  );

  // Dark appearance: the automatic functional flip (solid stays mode-stable).
  let darkBlock = '';
  for (const fr of scaleRoles)
    for (const [t, val] of Object.entries(fr.dark))
      if (fr.light[t] !== val) darkBlock += `  ${tokenVar(fr.role, t)}: ${val};\n`;
  {
    const surface = scaleRoles.find((r) => r.role === 'surface');
    if (surface)
      darkBlock += `  --overlay: color-mix(in oklch, var(--color-${surface.hue}-950) 60%, transparent);\n`;
  }
  if (darkBlock)
    parts.push(
      `/* Functional role tokens (dark) */\n${DARK_SEL} {\n  color-scheme: dark;\n${darkBlock}}\n`,
    );

  parts.push(
    `/* State variant for the active flip (hover/focus-visible are built in). */\n` +
      `@custom-variant is-active (&.is-active, &[data-active]);\n`,
  );

  const util: string[] = [];
  if (scaleRoles.length) {
    util.push(`/* Role colour utilities (the public API) */`);
    // Same source as the css/bricks formats — the two used to diverge because
    // this path re-parsed the other's generated strings and only ever ran the
    // functional half. See roleColorUtilities().
    for (const { cls, prop, value } of roleColorUtilities(scaleRoles, utilities))
      util.push(`@utility ${cls} {\n  ${prop}: ${value};\n}`);
    if (scaleRoles.some((r) => r.role === 'surface'))
      util.push(
        `@utility glass {\n  background-color: var(--surface-glass);\n  backdrop-filter: blur(12px);\n  -webkit-backdrop-filter: blur(12px);\n}`,
      );
  }
  util.push(`/* Typography roles */`);
  for (const [role, spec] of Object.entries(
    (typography?.roles ?? {}) as Record<string, TypographyRole>,
  ))
    util.push(`@utility font-${role} {\n${decls(roleDecls(role, spec))}\n}`);
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
  util.push(`\n/* Track placement (inside .centered) */`);
  for (const track of ['measure', 'breakout', 'spotlight', 'fullbleed'])
    util.push(`@utility ${track} {\n  grid-column: ${track};\n}`);
  parts.push(util.join('\n') + '\n');

  // Structure mirrors layout.css (kept literal for parity with the original emitter).
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

/* Class-level structure rules live in \`components\` so track/spacing utilities
   (@layer utilities — later in the layer order) can override them; unlayered
   CSS would beat ALL layered utilities regardless of specificity (e.g.
   \`.centered > *\` pinning children to \`measure\` over \`.spotlight\`). */
@layer components {
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
}
`);

  // Same layering rationale as the structure block above. Guarded on existence
  // like componentPartialOrder below: `assets/**` is a gitignored build artifact
  // that `vp test` does not produce, so an unguarded read makes the tailwind
  // format untestable in a clean checkout — which is how an 87-class vocabulary
  // gap between css and tailwind went unnoticed. The token layer still emits.
  const animPath = join(cssDir, 'animation.css');
  const animEngine = existsSync(animPath) ? readFileSync(animPath, 'utf8') : '';
  if (animEngine)
    parts.push(
      `/* ── Animation engine (animation.css) ── */\n@layer components {\n${animEngine}\n}`,
    );
  // Patterns live in Tailwind's `components` layer so single-purpose utilities
  // (@layer utilities — declared later in the layer order) override them, e.g.
  // `.text-on-ui-primary` beating the link pattern's element-level `a { color }`.
  // Unlayered CSS would win over ALL layered utilities regardless of specificity.
  parts.push(`/* ── Component patterns ── */\n@layer components {\n${patternsCss}\n}`);

  // Component + structural partials: the full framework library, minus the
  // Tailwind-owned utility layer. Sourced live from the CSS partials (in index.css
  // cascade order) so this never goes stale, then run through stripForTailwind
  // (dropping the TW_CLASH names Tailwind provides itself).
  const droppedClashes = new Set<string>();
  let droppedVariantBlocks = 0;
  /**
   * Is this `@container (min-width: …)` block a PRE-EXPANDED VARIANT block —
   * i.e. only `.sm-*`/`.md-*`/`.lg-*`/`.xl-*` utility classes, which Tailwind
   * regenerates on demand as `@md:`?
   *
   * Anything else in a container query is component *behaviour*, not a variant,
   * and dropping it breaks the component. `sitenav.css` is the case that caught
   * this: its `@container (min-width: 48rem) { .sitenav--bp-md { … } }` is what
   * switches the nav to its desktop layout, and blanket-dropping every
   * container block meant the tailwind format shipped a nav stuck in mobile.
   */
  const isVariantBlock = (raw: string): boolean => {
    const open = raw.indexOf('{');
    const body = raw.slice(open + 1, raw.lastIndexOf('}'));
    const selectors: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '{') {
        if (depth === 0) selectors.push(body.slice(start, i));
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0) start = i + 1;
      }
    }
    const names = selectors
      .flatMap((s) => s.split(','))
      .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
      .filter(Boolean);
    return names.length > 0 && names.every((n) => /^\.(sm|md|lg|xl)-/.test(n));
  };
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
          if (/^@container\s*\(\s*min-width:/.test(prelude) && isVariantBlock(raw))
            droppedVariantBlocks++;
          else if (clash && TW_CLASH.has(clash[1] as string))
            droppedClashes.add(clash[1] as string);
          else if (raw) kept.push(raw);
          start = i + 1;
        }
      }
    }
    return kept.join('\n\n');
  };

  const partials = componentPartialOrder(cssDir);
  const componentCss = partials
    .map((rel) => {
      const css = readFileSync(join(cssDir, rel), 'utf8');
      return `/* ── ${rel} ── */\n${stripForTailwind(css)}`;
    })
    .join('\n\n');
  // Same layering rationale as the patterns block above. `componentPartialOrder`
  // already returns [] when assets are absent, so this is empty in that case.
  if (componentCss)
    parts.push(
      `/* ── Component + structural partials (Tailwind-clashing utilities dropped) ── */\n` +
        `/* Dropped ${droppedVariantBlocks} pre-expanded breakpoint block(s) — write @sm:/@md:/@lg:/@xl: instead.\n` +
        `   Dropped ${droppedClashes.size} clashing utilit(ies) Tailwind provides itself:\n` +
        `   ${[...droppedClashes].sort().join(' ') || '(none)'} */\n` +
        `@layer components {\n${componentCss}\n}`,
    );

  return nl(parts) + '\n';
}

/**
 * The component/structural CSS partials to inline into the Tailwind bundle, in
 * index.css cascade order. Everything the aggregator imports EXCEPT the engine
 * (global/animation), the layout utilities (Tailwind owns them), and the generated
 * token layer (Tailwind builds its own via @theme).
 */
function componentPartialOrder(cssDir: string): string[] {
  const indexPath = join(cssDir, 'index.css');
  const skip = new Set(['global.css', 'animation.css', 'layout.css']);
  const order: string[] = [];
  const seen = new Set<string>();
  const text = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  for (const m of text.matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)) {
    const rel = m[1] as string;
    if (rel.startsWith('generated/')) continue;
    if (skip.has(rel)) continue;
    if (!seen.has(rel) && existsSync(join(cssDir, rel))) {
      seen.add(rel);
      order.push(rel);
    }
  }
  // Fallback: if no index.css, inline utilities + every pattern partial.
  if (!order.length) {
    if (existsSync(join(cssDir, 'utilities.css'))) order.push('utilities.css');
    const pdir = join(cssDir, 'patterns');
    if (existsSync(pdir))
      for (const f of readdirSync(pdir).sort()) if (f.endsWith('.css')) order.push(`patterns/${f}`);
  }
  return order;
}

// ── CSS bundling (css + bricks formats) ───────────────────────────────────────

/** The bundle's cascade layers, in precedence order (last wins). */
export const CSS_LAYERS = ['vitops.base', 'vitops.components', 'vitops.utilities'] as const;

/**
 * Which layer each `index.css` chunk belongs to. Anything unmapped defaults to
 * `vitops.components` — the safe default, since an unrecognised partial is far
 * more likely to be a component than a utility family.
 *
 * The split is by what the file *emits*, not what it's named:
 *   • base       — the UA reset and the pure `:root` token blocks.
 *   • components — the animation engine, structural layout, and every pattern.
 *   • utilities  — the single-purpose classes that must be able to override a
 *                  pattern (`bg-*`, `drop-shadow-*`, `font-*`, effects, …).
 *
 * `color.css` and `shadows.css` each mix a `:root` block with utility classes
 * and go to `utilities` whole. That is safe because custom-property resolution
 * is NOT source-order dependent — a `:root` block declared after a rule that
 * reads it still resolves.
 *
 * `layout.css` is genuinely mixed (structural `.rhythm`/`.centered` AND
 * `.m-*`/`.flex`/`.split-*` utilities) and stays in `components` whole, so its
 * utility half still can't override a pattern. Splitting it is a separate
 * change; see the 0.9.0 changelog.
 */
const CHUNK_LAYER: Record<string, (typeof CSS_LAYERS)[number]> = {
  'global.css': 'vitops.base',
  'generated/type-tokens.css': 'vitops.base',
  'generated/tokens.css': 'vitops.base',
  'generated/color.css': 'vitops.utilities',
  'generated/shadows.css': 'vitops.utilities',
  'generated/typography.css': 'vitops.utilities',
  'generated/animation-effects.css': 'vitops.utilities',
  'utilities.css': 'vitops.utilities',
};

/**
 * Assemble the full stylesheet by resolving index.css's @import order against the
 * static partials (from assets) and the freshly generated token partials (in
 * memory), then minify with lightningcss. No @import survives, so no disk
 * resolution / shared `generated/` dir is needed.
 *
 * Each chunk is wrapped in a cascade layer. This is what lets a single-purpose
 * utility override a component pattern — `class="card bg-danger-muted"` — which
 * previously depended on source order and so silently did nothing here while
 * working in the tailwind format, where Tailwind's own layers already ordered
 * them correctly.
 *
 * Consequence worth knowing: unlayered CSS beats ALL layered CSS regardless of
 * specificity, so a consumer's own stylesheet now wins over the framework by
 * default. That is deliberate — it is the override story every layered
 * framework ships — but it means an unlayered *reset* will beat framework
 * component rules it used to lose to. Such a reset belongs in a layer declared
 * before `vitops.base` (see the `<style>` block in this repo's index.html).
 */
function bundleCss(
  generated: Record<string, string>,
  assetsDir: string,
  minify: boolean,
): { code: string; map: string | undefined } {
  const cssDir = join(assetsDir, 'css');
  const indexPath = join(cssDir, 'index.css');
  const index = readFileSync(indexPath, 'utf8');
  const chunks: string[] = [];
  for (const line of index.split('\n')) {
    const m = /@import\s+['"]\.\/([^'"]+)['"]/.exec(line);
    if (!m) continue;
    const rel = m[1] as string;
    const body = rel.startsWith('generated/')
      ? (generated[rel.slice('generated/'.length)] ?? '')
      : readFileSync(join(cssDir, rel), 'utf8');
    if (!body.trim()) continue;
    chunks.push(`@layer ${CHUNK_LAYER[rel] ?? 'vitops.components'} {\n${body}\n}`);
  }
  // `/*!` rather than `/*`: lightningcss strips ordinary comments when
  // minifying, and both the css and bricks bundles are minified — so a plain
  // banner would never reach the file anyone actually opens. Whoever opens this
  // is looking for a class name; point them at the live reference.
  const banner =
    `/*! GENERATED by @getvitops/generator — do not edit by hand.\n` +
    `    Class reference: npx vitops docs classes  ·  All topics: npx vitops docs */\n`;
  // Declare the order up front so it is explicit rather than an artifact of
  // which chunk happened to appear first.
  const merged = banner + `@layer ${CSS_LAYERS.join(', ')};\n` + chunks.join('\n');
  const res = transform({
    filename: 'styles.css',
    code: Buffer.from(merged),
    minify,
    sourceMap: minify,
  });
  return {
    code: res.code.toString(),
    map: res.map ? res.map.toString() : undefined,
  };
}

// ── public generate() ─────────────────────────────────────────────────────────
function loadConfig(input: string | DesignSystem): DesignSystem {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  const result = validate(raw);
  if (!result.ok) {
    const lines = result.errors
      .slice(0, 12)
      .map((e) => `  • ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid design-system.json:\n${lines}`);
  }
  for (const w of result.warnings) console.warn(`[vitops] ${w}`);
  return result.data;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const format: Format = options.format ?? 'bricks';
  const outDir = options.outDir ?? 'dist';
  const assetsDir = options.assetsDir ?? DEFAULT_ASSETS;
  const ds = loadConfig(options.input);
  const built = build(ds, format, assetsDir);
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const put = (rel: string, content: string) => {
    const p = join(outDir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
    written.push(p);
  };

  if (format === 'design') {
    // Deliberately the only output: DESIGN.md conventionally lives at the repo
    // root next to AGENTS.md, not in a build directory, so this format is meant
    // to be run with `--out .` — writing a stylesheet alongside it would be
    // surprising. Compose it when you want both: `--format css,design`.
    put('DESIGN.md', built.designMd);
  } else if (format === 'tailwind') {
    put('tailwind.css', built.tailwind);
    put('tokens.json', built.tokensJson);
  } else if (format === 'css') {
    const { code } = bundleCss(built.generated, assetsDir, true);
    put('styles.css', code);
    put('tokens.json', built.tokensJson);
    put('design-manifest.json', built.designManifest);
  } else {
    // bricks: bundled minified CSS + Bricks import JSON + copied JS/PHP/docs.
    const { code, map } = bundleCss(built.generated, assetsDir, true);
    put('styles.min.css', map ? code + `\n/*# sourceMappingURL=styles.min.css.map */` : code);
    if (map) put('styles.min.css.map', map);
    put('bricks-colors-named.json', built.bricksColorsNamed);
    put('bricks-colors-semantic.json', built.bricksColorsSemantic);
    put('bricks-variables.json', built.bricksVariables);
    put('tokens.json', built.tokensJson);
    // Framework-static JS bundles → outDir root (theme enqueues them).
    const jsDir = join(assetsDir, 'js');
    if (existsSync(jsDir)) {
      cpSync(jsDir, outDir, { recursive: true });
      for (const f of readdirSync(jsDir)) written.push(join(outDir, f));
    }
    // Bricks PHP elements + loader → outDir/bricks.
    const bricksSrc = join(assetsDir, 'bricks');
    if (existsSync(bricksSrc)) {
      cpSync(bricksSrc, join(outDir, 'bricks'), { recursive: true });
      written.push(join(outDir, 'bricks'));
    }
    // OKF docs bundle (generated per-config) → outDir/docs.
    const docs = generateDocs(ds, assetsDir);
    for (const [rel, content] of Object.entries(docs)) put(join('docs', rel), content);
  }

  // Legal documents → outDir/legal, as HTML fragments.
  //
  // Opt-in via `site`, and emitted for every format that emits files at all —
  // passing a site config and silently getting nothing back would be the
  // surprising behaviour. `design` is excluded because it emits DESIGN.md and
  // deliberately nothing else.
  //
  // HTML rather than markdown because this is the fragment a WordPress theme,
  // a Bricks shortcode or a plain page can include with no build step of its own.
  if (options.site != null && format !== 'design') {
    const site = loadSiteConfigFile(options.site);
    const legal = generateLegal(site, { output: 'html' });
    for (const [name, content] of Object.entries(legal)) put(join('legal', name), content);

    // Icon sprite → outDir/icons.svg.
    //
    // Opt-in via `icons.sprite`, because building it needs the @iconify-json/*
    // collections and most consumers render icons through their framework's own
    // integration instead. This is the path for the ones that can't: Bricks,
    // EmDash renderers, any plain HTML — `<use href="…/icons.svg#id">`, no JS.
    const icons = site.icons as
      | { sprite?: boolean; ui?: string; brand?: string; weight?: string; semantic?: string[] }
      | undefined;
    if (icons?.sprite) {
      const { ui, brand, weight, semantic, sprite: _sprite, ...sets } = icons;
      const include = generateIconInclude({
        ...(ui ? { ui } : {}),
        ...(brand ? { brand } : {}),
        ...(weight ? { weight } : {}),
        ...(semantic ? { semantic } : {}),
        ...sets,
      });
      // Semantic names get a set-independent alias (`icon-menu`) alongside the
      // qualified id, so markup written against a sprite survives a set swap —
      // the same guarantee `resolveIcon` gives Astro consumers.
      const aliases: Record<string, string> = {};
      for (const name of semantic ?? []) {
        try {
          aliases[`icon-${name}`] = resolveIcon(name, ui ?? 'fa7-solid', weight ? { weight } : {});
        } catch {
          // Already reported by generateIconInclude, which throws on the same input.
        }
      }
      const built = await buildIconSprite({ include, aliases });
      put('icons.svg', built.svg);
      if (built.missing.length)
        console.warn(
          `[vitops] icons.sprite: ${built.missing.length} icon(s) were not found and are ` +
            `absent from the sprite: ${built.missing.join(', ')}.`,
        );
    }
  }

  return { format, outDir, written };
}

function loadSiteConfigFile(input: string | SiteConfig): SiteConfig {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  // resolveSiteConfig validates and throws with one issue per line.
  return resolveSiteConfig(raw);
}
