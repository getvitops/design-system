/**
 * Canonical `design-system.json` schema — the single source of truth.
 *
 * Authored with `zod/mini` (tree-shakeable Zod v4). Everything else derives from it:
 *   • the `DesignSystem` TS type (`z.infer`), used throughout the generator,
 *   • the published JSON Schema (`toJSONSchema`), emitted to `schema.json` for `$schema` refs,
 *   • runtime validation (`validate`) for the CLI and to gate `generate`,
 *   • the generated `authoring.md` reference doc (walks `jsonSchema`'s descriptions).
 */
import * as z from 'zod/mini';
import { REQUIRED_ROLES, type RoleSpec, roleHue } from './shared.ts';

/**
 * Attach a JSON-Schema `description`. zod/mini has no `.describe()` method; the
 * mini-API equivalent is `.check(z.describe(…))`, and `.check()` clones — so a
 * shared sub-schema (`Scale`, `CssDecls`, …) can carry a different description
 * per use-site without mutating the original.
 */
export const desc = <T extends { check(...checks: never[]): T }>(schema: T, text: string): T =>
  schema.check(z.describe(text) as never);

const CssDecls = desc(
  z.record(z.string(), z.string()),
  'A CSS declaration block: property → value. Values stay strings (they can be hex, var(), clamp(), keywords, …); the generator, not the schema, interprets them.',
);
const Scalar = z.union([z.string(), z.number()]);
const VarMap = z.record(z.string(), Scalar);

// ── colors ──────────────────────────────────────────────────────────────────
const SeededRamp = desc(
  z.object({
    seed: desc(
      z.string(),
      'Seed colour (hex or oklch()). An 11-step numeric scale (50…950, tinted near-white → tinted near-black) is generated in OKLCH from it; the seed is preserved at its natural step.',
    ),
    anchors: z.optional(
      desc(
        z.record(z.string(), z.string()),
        'Step → colour overrides (hex or oklch()) pinned VERBATIM at those steps. Every other step takes its lightness from the shared ladder, with chroma and hue interpolated between the anchors — so an anchor is reproduced exactly and is the only step allowed off the ladder. An explicit anchor overrides the seed at that step; two anchors that resolve to the same step are an error.',
      ),
    ),
  }),
  'Seeded hue: the 11-step scale is GENERATED in OKLCH from `seed` (anchors pin specific steps).',
);
const FixedRamp = desc(
  z.object({
    tones: desc(
      z.union([z.array(z.string()), z.record(z.string(), z.string())]),
      'Fixed brand kit: authored tones placed verbatim at their nearest steps plus tinted off-white/off-black endpoints; no interpolation. Either an ordered light → dark array or a step → colour map.',
    ),
  }),
  'Fixed hue: authored brand tones used verbatim; no generation.',
);
const Ramp = desc(
  z.union([SeededRamp, FixedRamp]),
  'A palette hue, authored one of two ways: `{ seed, anchors? }` generates an 11-step numeric OKLCH scale (50…950) from the seed, or `{ tones }` supplies a fixed brand kit used verbatim.',
);

/**
 * A role points at a hue, and optionally declares its kind. The bare-string form
 * is the shorthand for a chromatic role — signal colours are the common case,
 * and the two or three surfaces are worth naming explicitly.
 */
const RoleSpecSchema = z.union([
  desc(z.string(), 'A palette hue name. Shorthand for `{ hue, kind: "chromatic" }`.'),
  z.object({
    hue: desc(z.string(), 'The palette hue this role resolves to.'),
    kind: z.optional(
      desc(
        z.enum(['surface', 'chromatic']),
        '`surface` — a page/panel colour: gets a bare `bg-<role>` plus the full emphasis range and text scale. `chromatic` (default) — a signal colour: tints and solids only, no bare `bg-<role>`.',
      ),
    ),
  }),
]);

const UtilityName = z.enum(['bg', 'text', 'icon', 'border', 'outline', 'fill', 'stroke']);

const Colors = desc(
  z.object({
    palette: desc(
      z.record(z.string(), Ramp),
      'Palette hues by name. Each becomes an 11-step numeric OKLCH scale (`--color-<hue>-50…950`).',
    ),
    roles: desc(
      z.record(z.string(), RoleSpecSchema),
      `Maps semantic role names onto palette hues. Role names are ARBITRARY — add a key and the generator emits that role's token set (\`--color-<target>-<role>[-<variant>]\` for target bg/text/icon/border), its dark-mode flip and its utility classes.\n\nA value is either a hue name (\`"danger": "rust"\`) or \`{ "hue": …, "kind": "surface" | "chromatic" }\`. **The kind decides the shape of the token set.** \`chromatic\` (the default, and what the bare-string form means) is a signal colour: its backgrounds split into tints (\`bg-<role>-x-muted\`/\`-muted\`) and solids (\`bg-<role>-solid[-bold|-x-bold]\`), with deliberately **no bare \`bg-<role>\`** — "how loud?" is a question the author answers. \`surface\` is a page/panel colour: it has a bare \`bg-<role>\` plus the full emphasis range and text scale.\n\nDark mode flips automatically; there is no per-appearance scheme grammar. The solid family and its computed \`text-on-<role>\` foreground stay mode-stable so a filled button keeps its identity. Six roles are a required core, because the shipped framework CSS references them with no fallback: ${REQUIRED_ROLES.join(', ')}. Conventional additions are ui-secondary/accent, brand-secondary, info and success.`,
    ),
    utilities: z.optional(
      desc(
        z.array(UtilityName),
        'Which colour utility-class families to emit (`bg-*`, `text-*`, `icon-*`, `border-*`, `outline-*`, `fill-*`, `stroke-*`). Defaults to bg, text, icon, border. `icon` is a separate non-text tier (a glyph may run more vivid than text); `outline`/`fill`/`stroke` have no tokens of their own and alias the border and icon tiers.',
      ),
    ),
  }),
  'The colour system (the only required section): `palette` hues become generated OKLCH scales; `roles` map semantic roles onto those hues, from which all role tokens and dark mode derive.',
);

// ── fluid modular scale (type + space) ──────────────────────────────────────
const Scale = z.object({
  base: desc(z.string(), 'Anchor size (a CSS length, e.g. "1rem") — the value at `baseStep`.'),
  ratio: desc(z.number(), 'Modular ratio between adjacent steps at large viewports.'),
  steps: desc(
    z.optional(z.number()),
    'Token count when `names` is absent (steps are then named 1..steps).',
  ),
  names: desc(
    z.optional(z.array(z.string())),
    'Step names, smallest → largest (e.g. ["xs","sm","md",…]); each becomes a token suffix.',
  ),
  baseStep: desc(z.optional(z.number()), '1-based index of the step whose value is `base`.'),
  baseline: desc(
    z.optional(z.string()),
    'Named step used as the fluid pivot / GUI scale centre (defaults to `baseStep`).',
  ),
  fluid: desc(
    z.optional(
      z.object({
        minVw: desc(z.string(), 'Viewport width (CSS length) where fluid scaling bottoms out.'),
        maxVw: desc(z.string(), 'Viewport width (CSS length) where fluid scaling tops out.'),
        minRatio: desc(z.number(), 'Modular ratio at/below `minVw` (usually < `ratio`).'),
      }),
    ),
    'Makes the scale fluid: each step compiles to a clamp() that interpolates from `minRatio` at `minVw` to `ratio` at `maxVw`.',
  ),
});

// ── patterns ────────────────────────────────────────────────────────────────
const Pattern = desc(
  z.object({
    group: desc(
      z.optional(z.string()),
      'Token-cascade group this pattern belongs to (e.g. tag / control / panel); base declarations resolve through `--<prop>-<group>` before `--<prop>-default`.',
    ),
    overrides: z.optional(
      desc(CssDecls, 'Per-pattern token overrides, emitted as `--<prop>-<name>-group` values.'),
    ),
    element: desc(
      z.optional(z.string()),
      'Style at element level via zero-specificity `:where(<element>)` (instead of, or alongside, a class).',
    ),
    class: desc(
      z.optional(z.string()),
      "Class name to emit (defaults to the pattern's key when no `element` is set). Combined with `element`, the pattern emits one zero-specificity `:where(<element>, .<class>)` rule so the class works on any tag and any explicit class overrides it.",
    ),
    fill: desc(
      z.optional(z.boolean()),
      'Whether this pattern is colour-filled (states/roles drive `background-color` + `on-solid` text) or text-coloured (they drive `color`). Defaults to true when `base` declares a background.',
    ),
    default_role: desc(
      z.optional(z.string()),
      'Semantic colour role applied to the bare/default variant.',
    ),
    base: z.optional(
      desc(
        CssDecls,
        'Base CSS declarations. Geometry properties (padding, border-radius, border, box-shadow, font-size) are wrapped in per-pattern override hooks (`--p-<name>`, `--br-<name>`, `--b-<name>`, `--ds-<name>`, `--fs-<name>`) so consumers can restyle one pattern by setting one variable.',
      ),
    ),
    states: desc(
      z.optional(z.record(z.string(), z.record(z.string(), z.unknown()))),
      'Interaction states (hover / active / focus-visible), each a map of shortcuts: `step` (intensify the fill or text by n rungs — `bg-<role>-solid` → `-solid-bold`, `text-<role>` → `-bold`), `scale` (transform scale), `lift` (translateY + shadow), `shadow` (a shadow name → drop-shadow(var(--shadow-<name>)), or true → lift shadow), `ring` (focus ring), or raw `css` declarations. Hover rules are wrapped in `@media (hover: hover)`.',
    ),
    roles: desc(
      z.optional(z.array(z.string())),
      'Semantic colour role variants to emit as `<pattern>-<role>` classes (fills use the role solid / on-solid tokens).',
    ),
  }),
  'One component pattern (button, link, badge, card, …): base declarations + interaction states + semantic role variants, resolved through the pattern token cascade.',
);

const Patterns = desc(
  z.object({
    defaults: z.optional(
      desc(CssDecls, 'Cascade-wide fallback tokens, emitted as `--<prop>-default`.'),
    ),
    radii: z.optional(
      desc(CssDecls, 'Shape primitives, emitted as `--br-<name>` (referenced by pattern bases).'),
    ),
    groups: desc(
      z.optional(z.record(z.string(), CssDecls)),
      'Group-level tokens, emitted as `--<prop>-<group>`; patterns opt in via their `group` key.',
    ),
    z: desc(z.optional(z.record(z.string(), z.number())), 'Z-index tiers → `--z-tier-<name>`.'),
    items: desc(
      z.optional(z.record(z.string(), Pattern)),
      'The component patterns to emit, keyed by name.',
    ),
  }),
  'Component patterns and their token cascade: `defaults` → `groups` → per-pattern `overrides`, plus shape (`radii`) and z-index primitives.',
);

// ── typography ──────────────────────────────────────────────────────────────
const TypographyRole = desc(
  z.record(z.string(), Scalar),
  'An open bag of CSS-ish keys (family / size / weight / line-height / tracking / transform / decoration / text-wrap / …); the generator maps known keys and passes the rest through.',
);
const Typography = desc(
  z.object({
    families: desc(
      z.optional(z.record(z.string(), z.string())),
      'Role-facing family aliases → CSS font values, usually referencing the top-level `fonts` tokens (e.g. "var(--font-display)").',
    ),
    roles: desc(
      z.optional(z.record(z.string(), TypographyRole)),
      'Semantic type roles (display, title, heading, body, quote, caption, eyebrow, code, lead, footnote, tag, …), each emitted as a `font-<role>` class.',
    ),
    headings: desc(
      z.optional(z.record(z.string(), z.string())),
      'Maps bare elements to type roles so unclassed markup picks up role styling — `{ "h1": "display", "h2": "heading" }`. The key is used verbatim as a selector, so it is not limited to h1…h6: **map `"body"` to your prose role** to bind base page typography to the role rather than hand-writing it. That binding is what makes the role editable — a stylesheet that re-states `font-family`/`line-height` as literals on `body` shadows `--<role>-ff`/`--<role>-lh`, and the live theme editor then appears to do nothing.',
    ),
  }),
  'Typography: family aliases, semantic type roles (→ `font-<role>` classes), and the bare-element → role mapping.',
);

// ── animations ──────────────────────────────────────────────────────────────
const AnimEffect = desc(
  z.object({
    kf: desc(
      z.string(),
      'Keyframe family driving the effect: composite (transform/opacity), paint, or layout.',
    ),
    css: z.optional(desc(VarMap, 'Extra literal declarations merged into the effect class as-is.')),
    vars: z.optional(
      desc(
        VarMap,
        'Effect endpoint variables (`--<key>: <value>`, e.g. opacity-from, translate-y-to) that override the keyframe defaults.',
      ),
    ),
  }),
  'A named animation effect class — a pure value layer (`--_anim` + `--<prop>-from/-to`) over the static keyframe engine.',
);
const Animations = desc(
  z.object({
    effects: desc(
      z.optional(z.record(z.string(), AnimEffect)),
      'Effect classes to emit (`.fade-in`, `.reveal-left`, …), keyed by class name.',
    ),
    journeys: desc(
      z.optional(
        z.object({
          base: desc(
            z.optional(z.record(z.string(), VarMap)),
            'Named journey building blocks: part name → var map.',
          ),
          compose: desc(
            z.optional(z.array(z.array(z.string()))),
            'Combinations of base parts, each emitted as a `.<parts>-journey` class.',
          ),
        }),
      ),
      'Multi-part journey classes composed from `base` building blocks.',
    ),
  }),
  'Animation effect + journey classes (pure value layers). The animation engine itself — keyframes, drivers, floats, utilities — is static framework CSS, not configured here.',
);

// ── the design system ───────────────────────────────────────────────────────
export const DesignSystemSchema = z.object({
  $schema: desc(
    z.optional(z.string()),
    'URL of the published JSON Schema (stamped by `vitops init`) so editors provide autocomplete + validation.',
  ),
  meta: desc(
    z.optional(
      z.object({
        name: desc(
          z.optional(z.string()),
          'Brand/system name. Used as the `name` field and `<h1>` of the `design` format\'s `DESIGN.md`. Defaults to "Design System".',
        ),
        description: desc(
          z.optional(z.string()),
          "One or two sentences on the brand personality and the feeling the UI should evoke — what an agent needs when no token answers the question. Becomes the DESIGN.md `description` field and opens its Overview section; if omitted, a generic description of the system's mechanics is used instead.",
        ),
      }),
    ),
    'Brand identity for agent-facing output. Consumed only by the `design` format (`DESIGN.md`); it emits no CSS and no tokens.',
  ),
  colors: Colors,
  shadows: desc(
    z.optional(z.record(z.string(), z.string())),
    'Named shadows → `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Values are shadow parameter lists (offset/blur/colour). Each token feeds two consumers with different grammars — `box-shadow` (pattern geometry, via the `--ds-*` group aliases) and `filter: drop-shadow(…)` (the utilities and the `shadow:` state shortcut) — so values must stay in the intersection: **one layer, no spread radius, no `inset`**. `drop-shadow()` rejects all three, and rejecting them invalidates the whole filter, so the shadow vanishes rather than degrading.',
  ),
  fonts: desc(
    z.optional(z.record(z.string(), z.string())),
    'Raw font stacks by name, emitted as `--font-<name>` tokens (referenced by `typography.families`).',
  ),
  typeScale: desc(
    z.optional(Scale),
    'Fluid modular TYPE scale → `--text-<name>` tokens, consumed by typography roles and text-size utilities.',
  ),
  spaceScale: desc(
    z.optional(Scale),
    'Fluid modular SPACE scale → `--space-<name>` tokens, consumed by spacing/gap utilities and vertical rhythm.',
  ),
  patterns: z.optional(Patterns),
  typography: z.optional(Typography),
  animations: z.optional(Animations),
});

export type DesignSystem = z.infer<typeof DesignSystemSchema>;

// A deep-partial view used for theme deltas: `extends` patches and alternate
// schemes supply only what they override, so every field (down through
// colors → schemes → semantic) is optional. Reuses the same leaf schemas, so
// there's no second source of truth. Completeness is enforced after merge
// (validate the resolved theme against `DesignSystemSchema`).
const ColorsPatch = z.object({
  palette: z.optional(z.record(z.string(), Ramp)),
  roles: z.optional(z.record(z.string(), RoleSpecSchema)),
  utilities: z.optional(z.array(UtilityName)),
});
export const DesignSystemPatchSchema = z.extend(z.partial(DesignSystemSchema), {
  colors: z.optional(ColorsPatch),
});
export type DesignSystemPatch = z.infer<typeof DesignSystemPatchSchema>;

/**
 * Stable URL of the published JSON Schema. Resolves once `@getvitops/generator` is on
 * npm (unpkg serves the packaged `schema.json`); `vitops init` stamps this into a
 * scaffolded config's `$schema` so editors light up autocomplete + validation.
 */
export const SCHEMA_URL = 'https://unpkg.com/@getvitops/generator/schema.json';

/** The published JSON Schema (draft-2020-12), derived from the zod schema. */
export const jsonSchema = {
  $id: SCHEMA_URL,
  ...z.toJSONSchema(DesignSystemSchema, { target: 'draft-2020-12' }),
};

/** Split a CSS value on top-level commas, ignoring commas nested in `rgba(…)` etc. */
const splitLayers = (value: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
};

const LENGTH = /^[+-]?(\d+\.?\d*|\.\d+)(px|rem|em|ch|ex|vh|vw|vmin|vmax|cm|mm|in|pt|pc|q)?$/i;

/**
 * Why a shadow can be *valid CSS* and still render nothing: a `--shadow-<name>`
 * token is consumed both as a `box-shadow` (pattern geometry) and inside
 * `filter: drop-shadow(…)` (the `.drop-shadow-<name>` utilities, the `shadow:`
 * state shortcut). `drop-shadow()` accepts a *single* layer of at most three
 * lengths and no `inset` — a spread radius, a second comma-separated layer or an
 * inset keyword makes the function invalid, which drops the entire `filter`
 * declaration. `box-shadow` accepts all three happily, so the value looks fine
 * everywhere it is authored and only the utility silently goes blank.
 */
const dropShadowIssue = (value: string): string | undefined => {
  const layers = splitLayers(value);
  if (layers.length > 1) return `${layers.length} comma-separated layers`;
  const layer = layers[0] ?? '';
  if (/(^|\s)inset(\s|$)/i.test(layer)) return 'an `inset` keyword';
  // Drop function calls (`rgb(0 0 0 / .5)`, `color-mix(…)`) so their numbers
  // aren't miscounted as lengths, then count what's left.
  const lengths = layer
    .replaceAll(/[\w-]*\([^()]*\)/g, ' ')
    .split(/\s+/)
    .filter((t) => LENGTH.test(t));
  if (lengths.length > 3) return `a spread radius (${lengths.length} lengths)`;
  return undefined;
};

export type ValidationResult =
  | { ok: true; data: DesignSystem; errors: []; warnings: string[] }
  | { ok: false; data: undefined; errors: z.core.$ZodIssue[]; warnings: string[] };

/**
 * Validate an unknown value against the design-system schema.
 *
 * `warnings` are configurations that parse and generate, but produce output that
 * won't behave as authored — currently only the token-namespace collisions the
 * flat `--<prop>-<name>` grammar makes possible.
 */
export function validate(input: unknown): ValidationResult {
  const result = z.safeParse(DesignSystemSchema, input);
  if (!result.success)
    return { ok: false, data: undefined, errors: result.error.issues, warnings: [] };
  // Every role must point at a palette hue that exists.
  const { palette, roles } = result.data.colors;
  for (const [role, spec] of Object.entries(roles)) {
    const hue = roleHue(spec as RoleSpec);
    if (palette[hue] == null) {
      return {
        ok: false,
        data: undefined,
        errors: [
          {
            code: 'custom',
            path: ['colors', 'roles', role],
            message: `role "${role}" references unknown palette hue "${hue}"`,
          } as z.core.$ZodIssue,
        ],
        warnings: [],
      };
    }
  }
  const warnings: string[] = [];
  // Role names are arbitrary — but the shipped component CSS is written against
  // a core set, and references them with no fallback. Omitting one doesn't fail
  // validation (the tokens for the roles you DO define are all emitted fine); it
  // silently strips colour from whichever components depended on it, which is
  // far harder to diagnose than a warning here.
  const missing = REQUIRED_ROLES.filter((r) => roles[r] == null);
  if (missing.length)
    warnings.push(
      `colors.roles is missing ${missing.map((r) => `"${r}"`).join(', ')} — ` +
        `the framework's own component CSS references ${missing.length === 1 ? 'it' : 'them'} ` +
        `with no fallback, so those components will render uncoloured. ` +
        `Add any role you like, but keep these defined.`,
    );
  // A radius named after a pattern collides on `--br-<name>`: the radius token and
  // the pattern's own override hook are the same var, so whichever the generator
  // emits last silently wins. Same class of clash as a pattern keyed like its
  // group (see the `tag`/`label` note in AGENTS.md). The pattern hook takes it.
  const radii = Object.keys(result.data.patterns?.radii ?? {});
  const items = new Set(Object.keys(result.data.patterns?.items ?? {}));
  for (const name of radii)
    if (items.has(name))
      warnings.push(
        `patterns.radii.${name} collides with the "${name}" pattern on --br-${name}; ` +
          `the pattern's override hook wins — rename the radius`,
      );
  for (const [name, value] of Object.entries(result.data.shadows ?? {})) {
    const issue = dropShadowIssue(value);
    if (issue)
      warnings.push(
        `shadows.${name} carries ${issue}, which \`filter: drop-shadow()\` rejects — ` +
          `\`.drop-shadow-${name}\` will render no shadow at all (the token still works ` +
          `as a \`box-shadow\`). Use one layer of at most three lengths.`,
      );
  }
  return { ok: true, data: result.data, errors: [], warnings };
}
