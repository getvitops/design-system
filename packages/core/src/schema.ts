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
// A ramp: any subset of the 7 tonal steps (dark → light). Values are hex.
const Ramp = z.object({
  xxd: z.optional(z.string()),
  xd: z.optional(z.string()),
  d: z.optional(z.string()),
  base: z.optional(z.string()),
  l: z.optional(z.string()),
  xl: z.optional(z.string()),
  xxl: z.optional(z.string()),
});

// A semantic role → a ramp, plus optional per-slot transforms. One grammar,
// three placements: the `default` scheme (must fully resolve), a delta scheme
// (partial patch over `default`), and cross-theme `extends` (partial patch).
// String form is shorthand for `{ ramp: <name> }` (identity step mapping).
// Resolution per slot: `value` > `steps` > shiftStep(invert ? MIRROR : slot, shift);
// `ramp` defaults to the inherited base ramp.
const RoleSpec = z.union([
  z.string(),
  z.object({
    ramp: z.optional(z.string()), // swap to a different ramp
    invert: z.optional(z.boolean()), // mirror steps (xxd↔xxl … base→base)
    shift: z.optional(z.number()), // shift every slot N steps darker(+)/lighter(−)
    steps: z.optional(z.record(z.string(), z.string())), // explicit slot → ramp step
    value: z.optional(z.record(z.string(), z.string())), // explicit hex/var per slot
  }),
]);

// An appearance scheme. `appearance` drives `color-scheme` + the toggle selector.
const Scheme = z.object({
  appearance: z.enum(['light', 'dark']),
  semantic: z.record(z.string(), RoleSpec),
});

const UtilityName = z.enum(['bg', 'text', 'border', 'outline', 'fill', 'stroke']);

// `schemes` is an open map: the `default` key is the fully-authored base; any
// other key (e.g. `alternate`) is a delta patch over `default`. `default`
// presence is enforced at runtime (validate), not expressible in JSON Schema.
const Colors = z.object({
  palette: z.record(z.string(), Ramp),
  utilities: z.optional(z.array(UtilityName)),
  schemes: z.record(z.string(), Scheme),
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
  utilities: z.optional(z.array(UtilityName)),
  schemes: z.optional(
    z.record(
      z.string(),
      z.object({
        appearance: z.optional(z.enum(['light', 'dark'])),
        semantic: z.optional(z.record(z.string(), RoleSpec)),
      }),
    ),
  ),
});
export const DesignSystemPatchSchema = z.extend(z.partial(DesignSystemSchema), {
  colors: z.optional(ColorsPatch),
});
export type DesignSystemPatch = z.infer<typeof DesignSystemPatchSchema>;

/**
 * Stable URL of the published JSON Schema. Resolves once `@getvitops/core` is on
 * npm (unpkg serves the packaged `schema.json`); `vitops init` stamps this into a
 * scaffolded config's `$schema` so editors light up autocomplete + validation.
 */
export const SCHEMA_URL = 'https://unpkg.com/@getvitops/core/schema.json';

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
  // JSON Schema can't require a specific map key; enforce the base scheme here.
  if (result.data.colors.schemes.default == null) {
    return {
      ok: false,
      data: undefined,
      errors: [
        {
          code: 'custom',
          path: ['colors', 'schemes', 'default'],
          message: 'colors.schemes must include a "default" (base) scheme',
        } as z.core.$ZodIssue,
      ],
    };
  }
  return { ok: true, data: result.data, errors: [] };
}
