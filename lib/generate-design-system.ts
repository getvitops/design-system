/**
 * Codegen: src/colors.json -> src/css/color.css + dist/bricks-colors-*.json
 * Not bundling — pure generation. Run via the `generate:colors` task.
 *
 * Schema (src/colors.json):
 *   named:    { <ramp>: { xxd, xd, d, base, l, xl, xxl } }   raw hex values
 *   semantic: { <role>: <name> | { name, invert?, dark? } }
 *     - string form  → light maps 1:1 to that named ramp; dark same as light
 *     - object form  → name (required, the named ramp); invert? (mirror steps in dark);
 *                      dark? (per-step overrides: { <lightStep>: <darkStep> })
 *
 * Dark step resolution per role/step, in priority order:
 *   1. explicit override in `dark`
 *   2. mirrored step if `invert: true`  (xxd↔xxl, xd↔xl, d↔l, base→base)
 *   3. identity (same step as light)
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

type Ramp = Record<string, string>;
type SemanticConfig = string | { name: string; invert?: boolean; dark?: Record<string, string> };
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
  named: Record<string, Ramp>;
  semantic: Record<string, SemanticConfig>;
  utilities?: string[];
}
interface DesignSystem {
  colors: ColorConfig;
  shadows?: Record<string, string>;
  patterns?: PatternsConfig;
  typography?: TypographyConfig;
}

const rootPath = join(import.meta.dirname, '..');
const entryPath = join(rootPath, 'src', 'design-system.json');
// All generated CSS lands here so static and codegen output are visually separated.
const cssPath = join(rootPath, 'src', 'css', 'generated');
const distPath = join(rootPath, 'dist');

// When Bricks owns colours (palette import generates :root tokens, dark-mode
// overrides, and utility classes), pass --bricks so this script emits NO colour
// CSS — Bricks provides it live. Without the flag, emit the full standalone
// colour layer (tokens + dark + all utilities) so the CSS is self-contained
// (for the docs, non-Bricks use, or portability).
const BRICKS = process.argv.includes('--bricks');

// Bricks toggles dark mode with this selector (confirmed).
const DARK_SELECTOR = ':root[data-brx-theme="dark"]';

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
const { named, semantic, utilities } = ds.colors;
const { patterns, shadows, typography } = ds;

// Which utility types to generate (CSS) and request of Bricks (utilityClasses).
// Configured in design-system.json; falls back to bg/text/border.
const UTILITIES = (utilities ?? ['bg', 'text', 'border']).filter((u) => u in UTILITY_PROPS);

// Normalize a semantic entry to { name, invert, dark }.
const normalize = (cfg: SemanticConfig) =>
  typeof cfg === 'string'
    ? { name: cfg, invert: false, dark: {} as Record<string, string> }
    : { name: cfg.name, invert: !!cfg.invert, dark: cfg.dark ?? {} };

// Resolve which ramp step a role/step uses in dark mode.
const darkStep = (cfg: ReturnType<typeof normalize>, step: Step): Step => {
  if (cfg.dark[step]) return cfg.dark[step] as Step; // 1. explicit
  if (cfg.invert) return MIRROR[step]; // 2. invert
  return step; // 3. identity
};

// ── color.css (standalone mode only) ────────────────────────────────────────
// In --bricks mode we skip this entirely; Bricks generates tokens + utilities.
mkdirSync(cssPath, { recursive: true });
const colorOutputPath = join(cssPath, 'color.css');

if (BRICKS) {
  // Minimal stub so the @import in index.css resolves; Bricks owns the colours.
  writeFileSync(
    colorOutputPath,
    '/* Colours provided by Bricks (palette import generates tokens + utilities). */\n',
  );
  console.log(`✓ ${colorOutputPath} (bricks mode — colours owned by Bricks)`);
} else {
  let css = `/* GENERATED from design-system.json — do not edit by hand. */\n:root {\n`;

  css += `  /* Named ramps */\n`;
  for (const [name, steps] of Object.entries(named)) {
    for (const step of STEP_ORDER) {
      if (steps[step] == null) continue;
      css += `  --color-${name}${suffix(step)}: ${steps[step]};\n`;
    }
  }

  css += `\n  /* Semantic roles → named ramps (light) */\n`;
  for (const [role, cfg] of Object.entries(semantic)) {
    const { name } = normalize(cfg);
    for (const step of STEP_ORDER) {
      if (named[name]?.[step] == null) continue;
      css += `  --color-${role}${suffix(step)}: var(--color-${name}${suffix(step)});\n`;
    }
  }
  css += `}\n\n`;

  // Dark block: only roles whose dark mapping differs from light need overrides.
  let darkBlock = '';
  for (const [role, cfg] of Object.entries(semantic)) {
    const n = normalize(cfg);
    for (const step of STEP_ORDER) {
      if (named[n.name]?.[step] == null) continue;
      const ds = darkStep(n, step);
      if (ds === step) continue;
      darkBlock += `  --color-${role}${suffix(step)}: var(--color-${n.name}${suffix(ds)});\n`;
    }
  }
  if (darkBlock) {
    css += `/* Semantic roles → named ramps (dark overrides) */\n`;
    css += `${DARK_SELECTOR} {\n${darkBlock}}\n\n`;
  }

  // Utility classes: bg-/text-/border-/outline-/fill-/stroke- per token.
  const utilityFor = (token: string) =>
    UTILITIES.map(
      (cls) => `.${cls}-${token} { ${UTILITY_PROPS[cls]}: var(--color-${token}); }`,
    ).join('\n') + '\n';

  const allTokens: string[] = [];
  for (const [name, steps] of Object.entries(named))
    for (const step of STEP_ORDER)
      if (steps[step] != null) allTokens.push(`${name}${suffix(step)}`);
  for (const [role, cfg] of Object.entries(semantic)) {
    const { name } = normalize(cfg);
    for (const step of STEP_ORDER)
      if (named[name]?.[step] != null) allTokens.push(`${role}${suffix(step)}`);
  }
  css += `/* Colour utilities — ${UTILITIES.join(', ')} */\n`;
  for (const token of allTokens) css += utilityFor(token);

  writeFileSync(colorOutputPath, css);
  console.log(`✓ ${colorOutputPath} (standalone — tokens + utilities + dark)`);
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
  writeFileSync(shadowOutputPath, sh);
  console.log(`✓ ${shadowOutputPath} (${entries.length} shadows)`);
}

// ── patterns.css (component interaction patterns) ───────────────────────────
// Shift a step along the ramp order by n (clamped). Positive = darker.
const STEP_INDEX: Record<string, number> = Object.fromEntries(STEP_ORDER.map((s, i) => [s, i]));
const shiftStep = (step: string, by: number): string => {
  const i = STEP_INDEX[step] ?? STEP_ORDER.indexOf('base');
  const j = Math.max(0, Math.min(STEP_ORDER.length - 1, i - by)); // darker = lower index
  return STEP_ORDER[j];
};

// Resolve a role's base step. Patterns sit at "d" (the role's main usable shade).
const BASE_STEP = 'd';

const decls = (obj: Record<string, string>, indent = '  ') =>
  Object.entries(obj)
    .map(([k, v]) => `${indent}${k}: ${v};`)
    .join('\n');

// ── tokens.css (pattern token cascade) ──────────────────────────────────────
// Always emitted (independent of --bricks): structural tokens Bricks doesn't own.
// Emits global defaults (--<prop>-default), group defaults (--<prop>-<group>),
// z-tiers (--z-tier-<name>), and per-pattern → group aliases (--<prop>-<item>-group).
// Static partials consume the live 3-level chain:
//   padding: var(--p-dialog, var(--p-dialog-group, var(--p-default)));
const tokensOutputPath = join(cssPath, 'tokens.css');
{
  const tDefaults = patterns?.defaults ?? {};
  const tGroups = patterns?.groups ?? {};
  const tZ = patterns?.z ?? {};
  const tItems = patterns?.items ?? {};

  const root: Record<string, string> = {};
  for (const [prop, val] of Object.entries(tDefaults)) root[`--${prop}-default`] = val;
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
  writeFileSync(tokensOutputPath, tok);
  console.log(`✓ ${tokensOutputPath}`);
}

// ── typography.css (.font-* role classes) ───────────────────────────────────
// Always emitted (independent of --bricks): type roles are framework structure.
// Each property is wrapped in an override-hook var (e.g. --display-fw) so a
// consumer can retune one role per-instance without a rebuild.
const typographyOutputPath = join(cssPath, 'typography.css');
{
  const families = typography?.families ?? {};
  const roles = typography?.roles ?? {};
  const headings = typography?.headings ?? {};

  // schema key -> [css property, override-hook suffix]
  const KEYMAP: Record<string, [string, string]> = {
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

  const roleDecls = (role: string, spec: TypographyRole): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [key, [prop, sfx]] of Object.entries(KEYMAP)) {
      if (spec[key] == null) continue;
      const raw =
        key === 'family'
          ? (families[spec.family as string] ?? String(spec.family))
          : String(spec[key]);
      out[prop] = `var(--${role}-${sfx}, ${raw})`;
    }
    return out;
  };

  let typo = `/* GENERATED typography roles — do not edit by hand. */\n`;
  for (const [role, spec] of Object.entries(roles))
    typo += `.font-${role} {\n${decls(roleDecls(role, spec))}\n}\n`;
  for (const [tag, role] of Object.entries(headings))
    if (roles[role]) typo += `${tag} {\n${decls(roleDecls(role, roles[role]))}\n}\n`;
  writeFileSync(typographyOutputPath, typo);
  console.log(`✓ ${typographyOutputPath}`);
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
    ? semantic[p.default_role.replace(/^.*$/, p.default_role)]
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
  pat += decls(base) + '\n}\n';

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
writeFileSync(patternsOutputPath, pat);
console.log(`✓ ${patternsOutputPath}`);

// ── Bricks palettes ─────────────────────────────────────────────────────────
mkdirSync(distPath, { recursive: true });

const id = (key: string) => createHash('sha256').update(key).digest('hex').slice(0, 6);

// Named: each colour defines its own --color-<name> var; light is the hex.
const namedColors = [];
for (const [name, steps] of Object.entries(named)) {
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
// mapped named var; dark references the dark-resolved named var. True
// indirection in both modes (remap in colors.json, rebuild, re-import).
const semanticColors = [];
for (const [role, cfg] of Object.entries(semantic)) {
  const n = normalize(cfg);
  for (const step of STEP_ORDER) {
    if (named[n.name]?.[step] == null) continue;
    const lightRef = `var(--color-${n.name}${suffix(step)})`;
    const darkRef = `var(--color-${n.name}${suffix(darkStep(n, step))})`;
    const hasDark = darkStep(n, step) !== step;
    semanticColors.push({
      raw: `var(--color-${role}${suffix(step)})`,
      light: lightRef,
      darkModeEnabled: hasDark,
      dark: darkRef,
      id: id(`semantic:${role}${suffix(step)}`),
      utilityClasses: UTILITIES,
    });
  }
}

const namedPalette = { id: id('palette:named'), name: 'Named', colors: namedColors };
const semanticPalette = { id: id('palette:semantic'), name: 'Semantic', colors: semanticColors };

writeFileSync(join(distPath, 'bricks-colors-named.json'), JSON.stringify(namedPalette, null, 2));
writeFileSync(
  join(distPath, 'bricks-colors-semantic.json'),
  JSON.stringify(semanticPalette, null, 2),
);
console.log(
  `✓ dist/bricks-colors-named.json (${namedColors.length}) + bricks-colors-semantic.json (${semanticColors.length})`,
);
