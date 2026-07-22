/**
 * Canonical `design-system.json` schema — the single source of truth.
 *
 * Authored with `zod/mini` (tree-shakeable Zod v4). Everything else derives from it:
 *   • the `DesignSystem` TS type (`z.infer`), used throughout the generator,
 *   • the published JSON Schema (`toJSONSchema`), emitted to `schema.json` for `$schema` refs,
 *   • runtime validation (`validate`) for the CLI and to gate `generate`.
 */
import * as z from 'zod/mini';

// A CSS declaration block: prop -> value. Values stay strings (they can be hex,
// var(), clamp(), keywords, …); the generator, not the schema, interprets them.
const CssDecls = z.record(z.string(), z.string());
// Animation/effect vars + typography role values are string | number.
const Scalar = z.union([z.string(), z.number()]);
const VarMap = z.record(z.string(), Scalar);

// ── colors ──────────────────────────────────────────────────────────────────
// A palette hue, authored one of two ways:
//   • `{ seed, anchors? }` — an 11-step numeric scale (50…950) is GENERATED in
//     OKLCH from the seed (anchors pin specific steps; hex or oklch() values).
//   • `{ tones }` — a fixed brand kit: authored tones used verbatim at their
//     nearest steps + tinted off-white/off-black endpoints; no interpolation.
const SeededRamp = z.object({
  seed: z.string(),
  anchors: z.optional(z.record(z.string(), z.string())),
});
const FixedRamp = z.object({
  tones: z.union([z.array(z.string()), z.record(z.string(), z.string())]),
});
const Ramp = z.union([SeededRamp, FixedRamp]);

const UtilityName = z.enum(['bg', 'text', 'border', 'outline', 'fill', 'stroke']);

// `roles` maps each semantic role (neutral, surface, ui-primary, …) to the
// palette hue backing it. The generator derives every role's FUNCTIONAL tokens
// (bg / text / solid / on-solid / borders / muted stops) from the hue's scale,
// and dark mode flips automatically — there is no per-appearance scheme grammar.
const Colors = z.object({
  palette: z.record(z.string(), Ramp),
  roles: z.record(z.string(), z.string()),
  utilities: z.optional(z.array(UtilityName)),
});

// ── fluid modular scale (type + space) ──────────────────────────────────────
const Scale = z.object({
  base: z.string(), // anchor size, e.g. "1rem"
  ratio: z.number(), // modular ratio at large viewports
  steps: z.optional(z.number()), // token count when `names` is absent
  names: z.optional(z.array(z.string())), // t-shirt names (else 1..steps)
  baseStep: z.optional(z.number()), // 1-based index of the value anchor
  baseline: z.optional(z.string()), // GUI scale centre (metadata)
  fluid: z.optional(
    z.object({
      minVw: z.string(),
      maxVw: z.string(),
      minRatio: z.number(),
    }),
  ),
});

// ── patterns ────────────────────────────────────────────────────────────────
const Pattern = z.object({
  group: z.optional(z.string()), // token-cascade group (tag/control/panel/…)
  overrides: z.optional(CssDecls), // per-pattern token overrides
  element: z.optional(z.string()), // styled at element level via :where()
  class: z.optional(z.string()), // or as a class
  default_role: z.optional(z.string()), // role for the bare/default variant
  base: z.optional(CssDecls),
  states: z.optional(z.record(z.string(), z.record(z.string(), z.unknown()))),
  roles: z.optional(z.array(z.string())), // semantic role variants to emit
});

const Patterns = z.object({
  defaults: z.optional(CssDecls), // --<prop>-default
  radii: z.optional(CssDecls), // --br-<name> shape primitives
  groups: z.optional(z.record(z.string(), CssDecls)), // --<prop>-<group>
  z: z.optional(z.record(z.string(), z.number())), // --z-tier-<name>
  items: z.optional(z.record(z.string(), Pattern)),
});

// ── typography ──────────────────────────────────────────────────────────────
// A role is an open bag of CSS-ish keys (family/size/weight/tracking/…); values
// are string | number. The generator maps known keys and ignores the rest.
const TypographyRole = z.record(z.string(), Scalar);
const Typography = z.object({
  families: z.optional(z.record(z.string(), z.string())),
  roles: z.optional(z.record(z.string(), TypographyRole)),
  headings: z.optional(z.record(z.string(), z.string())),
});

// ── animations ──────────────────────────────────────────────────────────────
const AnimEffect = z.object({
  kf: z.string(), // keyframe family: composite | paint | layout
  css: z.optional(VarMap), // extra literal declarations
  vars: z.optional(VarMap), // --<key>: <value> (non-default endpoints)
});
const Animations = z.object({
  effects: z.optional(z.record(z.string(), AnimEffect)),
  journeys: z.optional(
    z.object({
      base: z.optional(z.record(z.string(), VarMap)),
      compose: z.optional(z.array(z.array(z.string()))),
    }),
  ),
});

// ── the design system ───────────────────────────────────────────────────────
export const DesignSystemSchema = z.object({
  $schema: z.optional(z.string()),
  colors: Colors,
  shadows: z.optional(z.record(z.string(), z.string())),
  fonts: z.optional(z.record(z.string(), z.string())),
  typeScale: z.optional(Scale),
  spaceScale: z.optional(Scale),
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
  roles: z.optional(z.record(z.string(), z.string())),
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

export type ValidationResult =
  | { ok: true; data: DesignSystem; errors: [] }
  | { ok: false; data: undefined; errors: z.core.$ZodIssue[] };

/** Validate an unknown value against the design-system schema. */
export function validate(input: unknown): ValidationResult {
  const result = z.safeParse(DesignSystemSchema, input);
  if (!result.success) return { ok: false, data: undefined, errors: result.error.issues };
  // Every role must point at a palette hue that exists.
  const { palette, roles } = result.data.colors;
  for (const [role, hue] of Object.entries(roles)) {
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
      };
    }
  }
  return { ok: true, data: result.data, errors: [] };
}
