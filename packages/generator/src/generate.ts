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
import { resolveInput, resolveConfig, type Config } from './config.ts';
import { generateIconInclude, resolveIcon } from '@getvitops/utils';
import {
  BASE_HOOK,
  DARK_SEL,
  SYSTEM_DARK_SEL,
  TW_CLASH,
  type RoleSpec,
  roleHue,
  roleKind,
} from './shared.ts';
import {
  checkContrast,
  expandPalette,
  functionalRole,
  ladderWarnings,
  monotonicityErrors,
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
  /**
   * The config to build from — a path, or an already-parsed object.
   *
   * **Either kind is accepted.** A bare `design-system.json`, or the larger
   * `Config` that embeds one (commonly `company.json` / `site.json`), in
   * which case the design system is `designSystem.themes[theme]` with its
   * `extends` chain resolved. The two are told apart by shape, not by filename —
   * see `isConfig`.
   *
   * Passing a site config here also supplies `site`, so the site-level facts
   * generation depends on (`designSystem.defaultColorScheme`, the legal
   * documents, the icon sprite) don't need the same path declared twice. Each of
   * those is still gated on a field in that config, so nothing new appears
   * unless the config asks for it.
   */
  input: string | DesignSystem | Config;
  /** Output target. Default: 'bricks'. */
  format?: Format;
  /** Directory to write outputs into. Default: 'dist'. */
  outDir?: string;
  /** Override the framework asset root (advanced/testing). */
  assetsDir?: string;
  /**
   * Which `designSystem.themes` entry to build. Default: the config's
   * `defaultTheme`, else `default`. An error on a bare `design-system.json`,
   * which holds one design system and no themes map.
   */
  theme?: string;
  /**
   * Environment whose A/B variant applies to the site config, wherever it came
   * from (`input` or `site`). Default: `'production'`.
   */
  siteEnv?: string;
  /**
   * The site config, when it is a *different* file from `input` — enabling
   * legal-document output into `<outDir>/legal/*.html` and supplying
   * `designSystem.defaultColorScheme`.
   *
   * Redundant when `input` is already a site config; set both and this one wins.
   */
  site?: string | Config;
  /**
   * Emit the `prefers-color-scheme: dark` block (see `BuildOptions`).
   *
   * Normally this comes from the site config's `designSystem.defaultColorScheme: "system"`, which
   * is where the fact belongs. This is the escape hatch for consumers with a
   * `design-system.json` and no site config at all: requiring a whole
   * `Config` — which must carry a full `designSystem` — to set one boolean
   * would be out of proportion. Set explicitly, it wins over the site config.
   */
  systemColorScheme?: boolean;
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
 * The framework's container breakpoints. `sm-`/`md-`/`lg-`/`xl-` prefixes in the
 * css/bricks formats; `@sm:`/`@md:`/… in tailwind, where they are registered as
 * `--container-*` in `@theme` and Tailwind expands the variants itself.
 */
export const BREAKPOINTS: readonly (readonly [string, string])[] = [
  ['sm', '30rem'],
  ['md', '48rem'],
  ['lg', '64rem'],
  ['xl', '80rem'],
] as const;

/**
 * Gap utilities over the space scale, emitted from one list into all three
 * formats — same arrangement as `roleColorUtilities`, for the same reason.
 *
 * These did not exist. `vitops docs css` advertised a `g` class that was never
 * emitted, so the honest answer for a css/bricks consumer was an inline
 * `style="gap: …"`, which is what this repo's own `index.html` does throughout.
 * Tailwind does not fill the hole either: the fluid space steps are deliberately
 * kept OUT of Tailwind's `--spacing-*` namespace (named keys there shadow the
 * size scales — `max-w-7xl` would resolve to `var(--spacing-7xl)`), so `gap-md`
 * is not something Tailwind can derive on its own. Measured against
 * tailwindcss@4.3.3: an explicit `@utility gap-md` is honoured, coexists with
 * the built-in numeric `gap-4`, and picks up variants (`@md:gap-md`).
 *
 * The whole matrix is emitted rather than a useful-looking subset: an undefined
 * step produces no rule and no error in either format, so a missing
 * `md-gap-x-2xl` would be indistinguishable from a working one.
 */
export function gapUtilities(steps: { name: string }[]): ColorUtility[] {
  const FAMILIES: [string, string][] = [
    ['gap', 'gap'],
    ['gap-x', 'column-gap'],
    ['gap-y', 'row-gap'],
  ];
  return steps.flatMap(({ name }) =>
    FAMILIES.map(([prefix, prop]) => ({
      cls: `${prefix}-${name}`,
      prop,
      value: `var(--space-${name})`,
    })),
  );
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
/**
 * Wrong spellings worth naming explicitly, because each is a plausible reading of
 * the key it isn't. `transform`/`decoration` were documented in the schema for a
 * while and shipped title-case navigation to production; `letter-spacing` and
 * `font-*` are the natural guesses for keys we chose to shorten.
 */
const ALSO_MEANT: Record<string, string> = {
  transform: 'text-transform',
  decoration: 'text-decoration',
  'letter-spacing': 'tracking',
  wrap: 'text-wrap',
  'font-family': 'family',
  'font-size': 'size',
  'font-weight': 'weight',
  'font-style': 'style',
  lineHeight: 'line-height',
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
  // The layout stage. `.transition` only declares `height` inside
  // `@supports (interpolate-size: allow-keywords)`, since `0 → auto` is not
  // interpolable without it — but the default belongs here either way, so the
  // flip resolves to the element's natural height rather than to nothing.
  height: 'auto',
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
export interface BuildOptions {
  /**
   * Also flip to dark when the OS asks and no explicit choice has been made —
   * `@media (prefers-color-scheme: dark)`.
   *
   * A build flag rather than a `DesignSystem` field: it describes what a *site*
   * wants, not what the system defines, so it comes from the site config's
   * `designSystem.defaultColorScheme` and `generate()` stays keyed to a `DesignSystem`.
   * Off by default, because turning it on flips a site dark for dark-OS users.
   */
  systemColorScheme?: boolean;
}

export function build(
  ds: DesignSystem,
  format: Format,
  assetsDir: string,
  buildOpts: BuildOptions = {},
): Built {
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
  // Found by name AND kind. Only a surface-kind role has a bare `bg` token, and
  // `--surface-glass` / `.glass` / `--overlay` are written against
  // `--color-bg-surface` — so matching on the name alone emitted three
  // declarations pointing at a token that does not exist whenever `surface` was
  // authored as a bare hue string (the shorthand for `chromatic`). Skipping them
  // is the honest outcome: the config did not ask for a surface.
  const surfaceRole = scaleRoles.find((r) => r.role === 'surface' && 'bg' in r.light);
  if (!surfaceRole && roleMap['surface'] != null)
    console.warn(
      `[vitops] colors.roles.surface is chromatic, so no --color-bg-surface exists — ` +
        `skipping --surface-glass, --overlay and .glass. Declare it as ` +
        `{ "hue": "…", "kind": "surface" } if you meant a surface role.`,
    );
  // The focus ring is role-less by default, so it needs one nominated source.
  // `ui-primary` is the interaction hue — a ring in the brand colour would drift
  // away from the buttons and links it appears on.
  const focusRole = scaleRoles.find((r) => r.role === 'ui-primary') ?? scaleRoles[0];

  // A pinned brand colour that sits off the shared lightness ladder is legal —
  // the author asked for that exact colour — but past ~0.03 L the hue reads
  // visibly heavier or lighter than its siblings at that step, so say so.
  for (const w of ladderWarnings(expandedPalette)) console.warn(`[vitops] ${w}`);

  // A pinned colour far enough off the ladder can leave the ramp non-monotonic —
  // some step lighter than the one above it. That is an error, not a warning:
  // `snap`, the mode-stable solid family and the dark tables all assume the
  // order, so an inverted ramp runs hover states backwards. Same reasoning as the
  // contrast contract below — this is exactly the drift the fixed ladder exists
  // to eliminate, and it is always author-caused, so it is always actionable.
  {
    const errors = monotonicityErrors(expandedPalette);
    if (errors.length) throw new Error(errors.join('\n'));
  }

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
        // The same delta again, for "no explicit choice + a dark OS". Opt-in,
        // because switching it on flips a site dark for dark-OS users.
        //
        // This is what makes <wc-color-scheme-toggle>'s "System" position mean
        // anything: System *removes* data-theme, so with only the block above it
        // fell through to light on every machine. It also gives a no-JS page the
        // OS appearance, which the toggle alone never could.
        //
        // Yes, `fb` is emitted twice. It is a delta — only the tokens whose dark
        // value differs, and the raw hue ramps never re-point — and two identical
        // runs of text compress to almost nothing, so the cost is far below what
        // a second full colour layer would suggest.
        if (buildOpts.systemColorScheme)
          css +=
            `/* Functional role tokens (dark) — OS preference, no explicit choice */\n` +
            `@media (prefers-color-scheme: dark) {\n` +
            `  ${SYSTEM_DARK_SEL} {\n    color-scheme: dark;\n${fb.replace(/^ {2}/gm, '    ')}  }\n}\n\n`;
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

  // The recognised key set is closed (TYPO_KEYMAP), and an unrecognised key is
  // dropped rather than emitted — so a typo, or one of the plausible-but-wrong
  // short forms (`transform` for `text-transform`, `decoration` for
  // `text-decoration`), produces a role that looks configured and renders
  // unstyled. That is invisible in the output and survives review, so say it here
  // rather than leaving it to be noticed on a live page.
  {
    const known = new Set(Object.keys(TYPO_KEYMAP));
    for (const [role, spec] of Object.entries(typography?.roles ?? {}))
      for (const key of Object.keys(spec as TypographyRole)) {
        if (known.has(key)) continue;
        const near = ALSO_MEANT[key];
        console.warn(
          `[vitops] typography.roles.${role}: unknown key "${key}" — ignored` +
            (near ? `. Did you mean "${near}"?` : `. Recognised: ${[...known].join(', ')}.`),
        );
      }
  }
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
    const css =
      `/* GENERATED font families + fluid type/space scales — do not edit by hand.\n` +
      `   --font-* are STACKS ONLY; no @font-face is emitted here. Load webfonts with\n` +
      `   Astro's fonts: config and point the token at the family's cssVariable. */\n` +
      `:root {\n${decls(root)}\n}\n`;
    twTypeTokensCss = css;
    generated['type-tokens.css'] = css;
  }

  // ── spacing.css (gap utilities) ──────────────────────────────────────────────
  // Emitted for css AND bricks: the `--space-*` tokens come from this file in the
  // css format and from Bricks' Variables import in the bricks format, but the
  // class names are ours either way — Bricks generates utility classes only for
  // the colour palette.
  {
    const gaps = gapUtilities(spaceSteps);
    let sp = `/* GENERATED gap utilities — do not edit by hand. */\n`;
    if (gaps.length) {
      for (const { cls, prop, value } of gaps) sp += `.${cls} { ${prop}: ${value}; }\n`;
      for (const [bp, width] of BREAKPOINTS) {
        sp += `\n@container (min-width: ${width}) {\n`;
        for (const { cls, prop, value } of gaps) sp += `  .${bp}-${cls} { ${prop}: ${value}; }\n`;
        sp += `}\n`;
      }
    }
    generated['spacing.css'] = sp;
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
  // `sel` is a *builder* taking the state's pseudo, not a finished selector, and
  // that indirection is load-bearing rather than stylistic: an element pattern
  // has to place the pseudo INSIDE its `:where()`, because `:where()` zeroes the
  // element but a pseudo appended outside it still counts. `:where(a, .link):hover`
  // is 0-1-0 — the same weight as `.cta-brand-primary` — so the link pattern's
  // hover colour tied with every `<a class="cta">` and won on source order,
  // turning a filled CTA's text dark mid-hover. `:where(a:hover, .link:hover)` is
  // a true 0-0-0 and loses to any explicit class, which is what the base rule
  // already promised. It returns a list because an element pattern emits both
  // `:where(el, .cls).role` and `.cls-role`.
  const stateRules = (
    sel: (pseudo: string) => string[],
    role: string | null,
    states: Record<string, Record<string, unknown>>,
    colorProp: 'background-color' | 'color' = 'background-color',
  ) => {
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
      const rule = `${sel(pseudo).join(',\n')} {\n  ${body.join('\n  ')}\n}\n`;
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
    //
    // `pseudo` goes inside the `:where()` so a state rule keeps that promise —
    // see the note on `stateRules`. `extra` (a role class) stays outside it,
    // since the variant is meant to carry a class's weight.
    const elementSel = (extra = '', pseudo = '') =>
      `:where(${[p.element, cls && `.${cls}`]
        .filter(Boolean)
        .map((s) => `${s}${pseudo}`)
        .join(', ')})${extra}`;
    const defaultSel = p.element ? elementSel() : `.${cls}`;
    const defaultSelFor = (pseudo: string) =>
      p.element ? [elementSel('', pseudo)] : [`.${cls}${pseudo}`];
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
    pat += stateRules(defaultSelFor, defaultRole, states, colorProp);
    for (const role of p.roles ?? []) {
      // Element patterns take the role as a bare class (`<button class="danger">`)
      // AND as the `<pattern>-<role>` form that class patterns use, so the same
      // variant reaches a non-element host (`<a class="btn btn-danger">`). Both
      // land at 0-1-0 — the element half stays inside :where() so a role variant
      // can't outrank a plain class the way `button.danger` (0-1-1) used to.
      const variantSelsFor = (pseudo: string) =>
        p.element
          ? [elementSel(`.${role}`, pseudo), ...(cls ? [`.${cls}-${role}${pseudo}`] : [])]
          : [`.${cls}-${role}${pseudo}`];
      const variantSels = variantSelsFor('');
      // Fills sit on the role's solid and pair with the foreground computed
      // against it; text variants use the role's text token, which is the one
      // guaranteed legible over a surface in both appearances.
      const variantColorDecl = fills
        ? `background-color: var(--color-bg-${role}-solid); color: var(--color-text-on-${role})`
        : `color: var(--color-text-${role})`;
      pat += `${variantSels.join(',\n')} { ${variantColorDecl}; }\n`;
      pat += stateRules(variantSelsFor, role, states, colorProp);
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
        // A journey is entry → hold → exit (keyframes at 0%/100% hidden,
        // 25%–75% held), so it needs the long range that a one-shot entrance
        // doesn't. It starts on the same pivot as `.animate-view` — the
        // element's midpoint 15% into the viewport, which is `entry 50%` plus
        // 10vh (see the note on .animate-view in core's animation.css) — and
        // runs to the end of the exit phase, so the hold occupies the middle of
        // the crossing rather than the bottom edge of the screen.
        //
        // The END is spelled `exit 100%` rather than the equivalent bare `exit`,
        // because lightningcss misparses the shorthand: an omitted offset on the
        // END defaults to 0% there instead of the spec's 100%, so `entry exit`
        // bundled as `entry exit 0%` and every journey snapped back to its hidden
        // `from` state as the element reached the top of the viewport. Guarded by
        // animation-effects.test.ts, which asserts on the BUNDLED css.
        'animation-range': 'entry calc(50% + 10vh) exit 100%',
      };
      for (const p of parts)
        for (const [k, v] of Object.entries(base[p] ?? {})) d[`--${k}`] = asStr(v);
      out += block(`${parts.join('-')}-journey`, d);
    }
    // Each state matches the element itself OR its direct parent, mirroring the
    // precedent animation.css already sets for the trigger driver
    // (`:is(.is-active, [data-active]) > .animate-trigger`). The parent form is
    // load-bearing, not a convenience: a `hover-reveal-*` element rests at
    // `clip-path: inset(0 100% 0 0)`, and clip-path clips HIT-TESTING as well as
    // painting — so with `:hover` alone the element has zero hittable area and
    // can never receive the hover that would reveal it. Same specificity (0,2,0)
    // as the self form, so nothing reorders.
    const STATES: [string, (s: string) => string][] = [
      ['hover', (s) => `.${s}:hover, :hover > .${s}`],
      ['focus', (s) => `.${s}:focus-visible, :focus-within > .${s}`],
      ['active', (s) => `.${s}.is-active, .${s}[data-active]`],
      // The top layer's own state. A popover/dialog rests CLOSED at the effect's
      // `from` values and flips to `to` when it opens — the same shape as hover,
      // so it costs one row here rather than a bespoke driver, and every effect
      // gains `open-<fx>` in all three formats for free. `:popover-open` covers
      // the Popover API; `[open]` covers `<dialog open>` (and `<details open>`,
      // which is a legitimate use of the same flip).
      //
      // The MECHANISM a top-layer element additionally needs — `display`/`overlay`
      // in transition-property with `allow-discrete`, plus the `@starting-style`
      // that makes the entry run at all — is not per-effect, so it lives once in
      // animation.css rather than being multiplied across every effect here.
      ['open', (s) => `.${s}:popover-open, .${s}[open]`],
    ];
    out += `\n/* State-flip variants — compose with .transition (hover-/focus-/active-<fx>). */\n`;
    // Every keyframe family gets state variants, `layout` included: `.transition`
    // covers `height` inside `@supports (interpolate-size: allow-keywords)`, and
    // the `layout` keyframe depends on exactly the same feature — so excluding
    // layout here bought no portability, it only made `hover-size-grow` a class
    // that resolved to nothing while the docs advertised it.
    for (const [name, e] of Object.entries(anim.effects ?? {})) {
      const props: Record<string, { from?: string; to?: string }> = {};
      for (const [k, v] of Object.entries(e.vars ?? {})) {
        const m = /^(.*)-(from|to)$/.exec(k);
        if (m) (props[m[1] as string] ??= {})[m[2] as 'from' | 'to'] = asStr(v);
      }
      // The effect's own `css` block travels with the variant too — `size-grow`
      // declares `overflow: clip`, without which a collapsed (0-height) box
      // spills its content instead of hiding it.
      const rest: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.css ?? {})) rest[k] = asStr(v);
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
          systemColorScheme: buildOpts.systemColorScheme === true,
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
  /** `BuildOptions.systemColorScheme` — see the OS-preference block below. */
  systemColorScheme: boolean;
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
      `   Class reference: npx vitops docs classes  ·  All topics: npx vitops docs\n` +
      `   Fonts below are STACKS ONLY — this file loads no webfonts. Load them with\n` +
      `   Astro's fonts: config and point the token at the family's cssVariable. */`,
  ];
  parts.push(`@import "tailwindcss";\n`);

  const theme: string[] = [];
  theme.push(`  /* Hue scales → bg-<hue>-<step> text-* border-* (numeric, 50…950) */`);
  for (const [name, hue] of Object.entries(expandedPalette))
    for (const [n, hex] of Object.entries(hue.numeric))
      theme.push(`  --color-${name}-${n}: ${hex};`);
  theme.push(`\n  /* Fonts → font-* (stacks only; no @font-face is emitted — see header) */`);
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
  for (const [name, val] of BREAKPOINTS) theme.push(`  --container-${name}: ${val};`);
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
    // Same precondition as the css path: only a surface-kind role has the bare
    // `bg` token these two declarations read.
    const surface = scaleRoles.find((r) => r.role === 'surface' && 'bg' in r.light);
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
  if (darkBlock) {
    parts.push(
      `/* Functional role tokens (dark) */\n${DARK_SEL} {\n  color-scheme: dark;\n${darkBlock}}\n`,
    );
    // Same opt-in OS-preference block as the css/bricks path — see the comment
    // there. Emitted unlayered here for the same reason the rest of this format
    // is: Tailwind owns the layering, and role tokens must stay out of `@theme`.
    if (ctx.systemColorScheme)
      parts.push(
        `/* Functional role tokens (dark) — OS preference, no explicit choice */\n` +
          `@media (prefers-color-scheme: dark) {\n  ${SYSTEM_DARK_SEL} {\n` +
          `    color-scheme: dark;\n${darkBlock.replace(/^ {2}/gm, '    ')}  }\n}\n`,
      );
  }

  parts.push(
    `/* State variant for the active flip (hover/focus-visible are built in). */\n` +
      `@custom-variant is-active (&.is-active, &[data-active]);\n`,
  );

  // `typography.headings` — the bare-element → role bindings, the same rules the
  // css/bricks path emits into typography.css. This format used to emit only the
  // `@utility font-<role>` half, so a Tailwind consumer's <h1> and <body> got no
  // role styling at all: no family, no size, no text-wrap.
  //
  // Tailwind's `base` layer, deliberately. It puts these behind BOTH `@utility
  // font-<role>` (utilities layer) and the patterns (components layer), matching
  // css/bricks — where typography.css sits in vitops.utilities and the bare tag
  // selector loses to `.font-<role>` on specificity rather than on layer. Emitted
  // unlayered, an `h1` rule here would beat every Tailwind utility.
  {
    const roles = (typography?.roles ?? {}) as Record<string, TypographyRole>;
    const bindings = Object.entries(typography?.headings ?? {}).filter(([, r]) => roles[r]);
    if (bindings.length)
      parts.push(
        `/* Bare-element type roles (typography.headings) */\n@layer base {\n` +
          bindings
            .map(
              ([tag, role]) =>
                `  ${tag} {\n${decls(roleDecls(role, roles[role] as TypographyRole), '    ')}\n  }`,
            )
            .join('\n') +
          `\n}\n`,
      );
  }

  const util: string[] = [];
  if (scaleRoles.length) {
    util.push(`/* Role colour utilities (the public API) */`);
    // Same source as the css/bricks formats — the two used to diverge because
    // this path re-parsed the other's generated strings and only ever ran the
    // functional half. See roleColorUtilities().
    for (const { cls, prop, value } of roleColorUtilities(scaleRoles, utilities))
      util.push(`@utility ${cls} {\n  ${prop}: ${value};\n}`);
    if (scaleRoles.some((r) => r.role === 'surface' && 'bg' in r.light))
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
    // No `kf` filter — see the css path. `flip-size-grow` is as real as
    // `flip-fade-in`; both rest on `.transition`, which covers height behind
    // `@supports (interpolate-size: allow-keywords)`.
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
  // The `.split` PATTERN itself is not here — it is emitted into `@layer
  // components` with the rest of the structure, so `flex-col` beats it by layer
  // exactly as it does in css/bricks. Only its modifiers are utilities.
  //
  // That placement costs `@md:split`, and nothing recovers it. Measured against
  // tailwindcss@4.3.3: `@utility` throws "`@utility` cannot be nested" inside
  // `@layer`, AND inside a file pulled in with `@import … layer(…)` — the layer
  // clause is itself a nesting context. A `@custom-variant` doesn't help either:
  // a variant applied to a components-layer class emits nothing, because variants
  // attach to utility candidates only. `md-flex-row` says "become a row at md" in
  // every format, so the loss is a bare `<bp>-split` that had no unique job.
  //
  // `order`, not `row-reverse`, so the swap applies on whichever axis the split
  // is currently on — which is the point: it decides which panel comes FIRST,
  // and that is mostly a question about the stacked state. `reading-flow` keeps
  // focus order with the visual order where supported; until that is broad,
  // only one of the two panels should hold focusable content (WCAG 2.4.3).
  util.push(
    `@utility split-reverse {\n  reading-flow: flex-visual;\n  & > :first-child { order: 1; }\n}`,
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
    util.push(
      `@utility split-${a}-${b} {\n  flex-direction: row;\n  --_split-a: ${a};\n  --_split-b: ${b};\n}`,
    );
  // Not derivable from `@theme`: the fluid space steps are deliberately kept out
  // of Tailwind's `--spacing-*` namespace (see the note above the `:root` block),
  // so `gap-md` has to be an explicit utility here. Verified against
  // tailwindcss@4.3.3 to win over the built-in functional `gap-*` and to accept
  // variants (`@md:gap-md`), which is why no per-breakpoint classes are emitted.
  const gaps = gapUtilities(spaceSteps);
  if (gaps.length) {
    util.push(`\n/* Gap — the fluid space scale (var(--space-<name>)) */`);
    for (const { cls, prop, value } of gaps)
      util.push(`@utility ${cls} {\n  ${prop}: ${value};\n}`);
  }
  util.push(`\n/* Track placement (inside .centered) */`);
  for (const track of ['measure', 'breakout', 'spotlight', 'fullbleed'])
    util.push(`@utility ${track} {\n  grid-column: ${track};\n}`);

  // `layout.css` is skipped wholesale in this format and a subset re-emitted
  // above, which left these two families missing from tailwind ENTIRELY — not
  // dropped via TW_CLASH, just never re-emitted. Unlike the `<bp>-` classes they
  // have no Tailwind equivalent to fall back on, and unlike a misspelt class
  // `vitops lint` cannot flag them, because they are not anchored to the
  // consumer's config. A consumer who used them got silence and no styling.
  util.push(`\n/* Auto-fit grid — column count is content-driven, unlike .split */`);
  util.push(
    `@utility grid-auto {\n  display: grid;\n  gap: var(--grid-gap, 1rem);\n` +
      `  grid-template-columns: repeat(auto-fit, minmax(var(--grid-min, 13rem), 1fr));\n` +
      // Was missing here while layout.css carried it, so in THIS format a
      // `<ul class="grid-auto">` inside `.rhythm` kept the `li + li` margin: the
      // grid stretched the row to the tallest and the first cell alone looked
      // vertically offset — the exact symptom layout.css warns about.
      `  &:is(ul, ol) > li + li { margin-block-start: 0; }\n}`,
  );
  // Applied to the SECOND element of a pair, to override the rhythm it inherited.
  util.push(`\n/* Vertical-rhythm overrides (mirrors layout.css) */`);
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
    util.push(
      `@utility m-${pair} {\n  margin-top: calc(var(--rhythm-base) * var(--rhythm-${pair}));\n}`,
    );
  for (const [name, mult] of [
    ['0', null],
    ['xs', '0.25'],
    ['s', '0.5'],
    ['m', '1'],
    ['l', '1.5'],
    ['xl', '2'],
  ] as const)
    util.push(
      `@utility m-${name} {\n  margin-top: ${mult == null ? '0' : `calc(var(--rhythm-base) * ${mult})`};\n}`,
    );
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
  /* Named so \`patterns/scroll-target.css\`'s \`@container body (…)\` queries
     resolve — .toc-layout/.toc-sidebar/.toc-inline. Those partials are inlined
     into this bundle verbatim, so dropping the name (as this literal did) left
     the TOC permanently in its narrow layout in the tailwind format only. */
  container-name: body;
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

/* \`.split\` is a PATTERN, so it belongs here rather than in an \`@utility\` — that
   is what makes \`flex-col\` beat it by layer instead of by a source-order race
   whose winner depends on Tailwind's property-based sort of custom utilities.
   Its ratio/reversal modifiers stay utilities. Mirrors layout.css, where each
   rule's rationale is written out; in short: \`min-inline-size: 0\` because a flex
   item's automatic minimum is its min-content size; the ratio as a flex BASIS
   rather than a grow factor, because grow shares out only the free space and a
   child's padding is not part of it; scoped to a two-child split because a ratio
   is a pair contract and a middle child with no basis would collapse to zero;
   \`box-sizing: border-box\` because a basis only sizes the border box on a
   border-box item (Tailwind's preflight sets it, the other formats' reset does). */
.split {
  display: flex;
  flex-direction: row;
}
.split > * {
  flex: 1;
  box-sizing: border-box;
  min-inline-size: 0;
}
.split > :first-child {
  flex-grow: var(--_split-a, 1);
}
.split > :last-child {
  flex-grow: var(--_split-b, 1);
}
.split > :first-child:nth-last-child(2) {
  flex-basis: ${splitBasis('--_split-a')};
}
.split > :nth-child(2):last-child {
  flex-basis: ${splitBasis('--_split-b')};
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
          const name = clash?.[1] as string | undefined;
          if (/^@container\s*\(\s*min-width:/.test(prelude) && isVariantBlock(raw))
            droppedVariantBlocks++;
          else if (name && TW_CLASH.has(name) && !CLASH_KEEP.has(name)) droppedClashes.add(name);
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
 * Partials the tailwind format does NOT inline, because it re-creates them by
 * hand: the engine (`global.css` — Tailwind's preflight covers the reset;
 * `animation.css` — read directly and wrapped in `@layer components`), and the
 * two layout partials, whose utilities are re-emitted as `@utility` and whose
 * structure is re-emitted in the `@layer components` literal.
 *
 * **Every partial mapped to `vitops.utilities` must be listed here.** Inlining a
 * utility family lands it in tailwind's `@layer components`, the exact inversion
 * the layer split exists to remove — and it fails SILENTLY, because each of those
 * classes already exists as an `@utility` that wins on layer anyway. You would get
 * ~30 dead rules and no test failure. `format-parity.test.ts` asserts the
 * implication structurally rather than spot-checking the output.
 *
 * The implication is one-way: `layout.css` is skipped while sitting in
 * `vitops.components`, because its structure is re-emitted by hand.
 */
/**
 * Framework COMPONENTS whose class name collides with a Tailwind utility, and
 * which must therefore survive the `TW_CLASH` strip.
 *
 * The clash test matches a rule's leading `.<name>`, which is right for a
 * single-purpose utility (Tailwind ships its own) and wrong for a pattern that
 * merely shares the name. `patterns/sticky.css` opens `.sticky { … }` and was
 * being deleted from the tailwind bundle WHOLESALE — the `--_sticky-offset`
 * wiring, the z-index, and every `&.sticky--bottom`/`--inline-start` variant —
 * so a consumer writing `class="sticky sticky--bottom"` got bare
 * `position: sticky` and nothing else.
 *
 * `table` is here for the same reason but was never actually hit: `table.css`'s
 * prelude is `table,\n.table`, which doesn't start with `.`, so the regex missed
 * it by luck. Listing it makes that explicit rather than accidental.
 */
const CLASH_KEEP: ReadonlySet<string> = new Set(['sticky', 'table']);

export const TAILWIND_SKIP: ReadonlySet<string> = new Set([
  'global.css',
  'animation.css',
  'layout.css',
  'layout-utilities.css',
  // Everything left here after the reveal family moved to patterns/reveal.css is
  // either a TW_CLASH name (display, sr-only, text-wrap) or a pre-expanded
  // variant block, so the strip already emptied it — reading it was pure waste,
  // and leaving it out made the invariant above look violated when it wasn't.
  'utilities.css',
]);

/**
 * The component/structural CSS partials to inline into the Tailwind bundle, in
 * index.css cascade order. Everything the aggregator imports EXCEPT `TAILWIND_SKIP`
 * and the generated token layer (Tailwind builds its own via @theme).
 */
function componentPartialOrder(cssDir: string): string[] {
  const indexPath = join(cssDir, 'index.css');
  const order: string[] = [];
  const seen = new Set<string>();
  const text = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  for (const m of text.matchAll(/@import\s+['"]\.\/([^'"]+)['"]/g)) {
    const rel = m[1] as string;
    if (rel.startsWith('generated/')) continue;
    if (TAILWIND_SKIP.has(rel)) continue;
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
export const CHUNK_LAYER: Record<string, (typeof CSS_LAYERS)[number]> = {
  'global.css': 'vitops.base',
  'generated/type-tokens.css': 'vitops.base',
  'generated/tokens.css': 'vitops.base',
  'generated/color.css': 'vitops.utilities',
  'generated/shadows.css': 'vitops.utilities',
  'generated/typography.css': 'vitops.utilities',
  'generated/animation-effects.css': 'vitops.utilities',
  'generated/spacing.css': 'vitops.utilities',
  'layout-utilities.css': 'vitops.utilities',
  'utilities.css': 'vitops.utilities',
};

/**
 * A `.split` child's flex basis. The ratio is a BASIS rather than a grow factor
 * because grow shares out only the FREE space, which a child's padding is not
 * part of — so a padded column came out wider than its sibling by exactly its
 * horizontal padding. Must stay character-identical to layout.css; the parity
 * suite matches this expression against both.
 */
export const splitBasis = (v: '--_split-a' | '--_split-b'): string =>
  `calc(var(${v}, 1) / (var(--_split-a, 1) + var(--_split-b, 1)) * 100%)`;

/** The layer a partial's rules are wrapped in; unmapped partials are components. */
export const layerForPartial = (rel: string): (typeof CSS_LAYERS)[number] =>
  CHUNK_LAYER[rel] ?? 'vitops.components';

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
    chunks.push(`@layer ${layerForPartial(rel)} {\n${body}\n}`);
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
/**
 * Read `input` as whichever config kind it is, and return the design system to
 * build from plus the site config if that is what it was.
 *
 * The design system is validated here rather than in `resolveInput` so the error
 * can name where it came from: a theme inside a site config reports its `themes`
 * path, which is the difference between "your config is wrong" and "your config
 * is wrong *here*" when the file is a few hundred lines of company facts.
 */
function loadInput(
  input: string | DesignSystem | Config,
  opts: { theme?: string; siteEnv?: string },
): { ds: DesignSystem; config?: Config } {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  const resolved = resolveInput(raw, opts);
  const result = validate(resolved.designSystem);
  if (!result.ok) {
    const where =
      resolved.theme != null
        ? `design system at designSystem.themes.${resolved.theme}`
        : 'design-system.json';
    const lines = result.errors
      .slice(0, 12)
      .map((e) => `  • ${e.path.join('.') || '(root)'}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid ${where}:\n${lines}`);
  }
  for (const w of result.warnings) console.warn(`[vitops] ${w}`);
  return { ds: result.data, ...(resolved.config ? { config: resolved.config } : {}) };
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const format: Format = options.format ?? 'bricks';
  const outDir = options.outDir ?? 'dist';
  const assetsDir = options.assetsDir ?? DEFAULT_ASSETS;
  const { ds, config: embedded } = loadInput(options.input, {
    ...(options.theme != null ? { theme: options.theme } : {}),
    ...(options.siteEnv != null ? { siteEnv: options.siteEnv } : {}),
  });
  // Loaded before `build` because `designSystem.defaultColorScheme` decides what
  // the colour layer emits. (It is read again below for legal documents;
  // resolving twice would validate twice and double any warning.)
  //
  // An explicit `site` wins over one embedded in `input` — it is the more
  // specific statement, and the two are the same file in every case but the one
  // where a consumer deliberately split them.
  const config = options.site != null ? loadConfigFile(options.site, options.siteEnv) : embedded;
  const built = build(ds, format, assetsDir, {
    systemColorScheme:
      options.systemColorScheme ?? config?.designSystem?.defaultColorScheme === 'system',
  });
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
  if (config != null && format !== 'design') {
    const legal = generateLegal(config, { output: 'html' });
    for (const [name, content] of Object.entries(legal)) put(join('legal', name), content);

    // Icon sprite → outDir/icons.svg.
    //
    // Opt-in via `icons.sprite`, because building it needs the @iconify-json/*
    // collections and most consumers render icons through their framework's own
    // integration instead. This is the path for the ones that can't: Bricks,
    // EmDash renderers, any plain HTML — `<use href="…/icons.svg#id">`, no JS.
    const icons = config.site.icons as
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

function loadConfigFile(input: string | Config, siteEnv?: string): Config {
  const raw = typeof input === 'string' ? JSON.parse(readFileSync(input, 'utf8')) : input;
  // resolveConfig validates and throws with one issue per line.
  return resolveConfig(raw, siteEnv);
}
