/**
 * @getvitops/generator — public API.
 *
 * Turn a `design-system.json` into platform outputs (Bricks, standalone CSS,
 * Tailwind v4). The `zod/mini` schema is the single source of truth: types,
 * validation, and the published JSON Schema all derive from it.
 */
export { generate, roleColorUtilities } from './generate.ts';
export type {
  GenerateOptions,
  GenerateResult,
  Format,
  StylesheetFormat,
  ColorUtility,
} from './generate.ts';

// Exposed so `vitops lint` can ask what the generator emits instead of
// re-deriving the vocabulary and drifting from it.
export { expandPalette, functionalRole } from './tokens.ts';
export type { ExpandedHue, FunctionalRole } from './tokens.ts';

export {
  generateDocs,
  renderInlineMarkdown,
  schemaTreeNodes,
  type JsonSchemaNode,
  type SchemaTreeNode,
  type SchemaTreeOptions,
} from './docs.ts';

// Which tiers provide each pattern, and the call to make. Authored + drift-guarded;
// see tiers.ts for why it can't be derived from naming convention.
export {
  TIERS,
  TIER_NAMES,
  tierPatterns,
  tierTags,
  type Tier,
  type TierAstro,
  type TierCss,
  type TierEntry,
  type TierProjection,
  type TierWc,
} from './tiers.ts';
/**
 * SVG sprite emitter. `spriteId` is the id grammar `<use href="…#id">` targets;
 * @getvitops/astro's Icon.astro mirrors it, so treat it as a shared contract.
 */
export { buildIconSprite, loadIconSvg, spriteId } from './icons-sprite.ts';
export type { IconSpriteOptions, IconSpriteResult } from './icons-sprite.ts';
export { NUMERIC_STEPS } from './tokens.ts';
export {
  TW_CLASH,
  BASE_HOOK,
  DARK_SEL,
  REQUIRED_ROLES,
  ROLE_TOKEN_KEYS,
  roleHue,
  roleKind,
} from './shared.ts';
export type { RoleSpec } from './shared.ts';
export { tokenVar, tokenClass, CONTRAST } from './tokens.ts';
// The pre-1.0 colour-grammar rename, built from a config's own role names.
// `vitops lint --fix` applies it to consumer source; `validate()` reports it
// inside a design-system.json. One table, both surfaces.
export { movedTokens } from './token-refs.ts';
export type { RoleKind } from './tokens.ts';

export {
  DesignSystemSchema,
  jsonSchema,
  SCHEMA_URL,
  SCHEMA_LOCAL_PATH,
  validate,
} from './schema.ts';
export type { DesignSystem, ValidationResult } from './schema.ts';
export {
  ConfigSchema,
  SiteFontSchema,
  configJsonSchema,
  CONFIG_SCHEMA_URL,
  validateConfig,
  resolveConfig,
  resolvePrivacyContact,
  resolveTheme,
  // Every entry point that takes a config goes through these, so a consumer who
  // keeps their tokens inside the larger three-section config points the same
  // option at that file rather than maintaining a second one.
  isConfig,
  resolveInput,
  stripNulls,
  deepMerge,
  JURISDICTIONS,
  JURISDICTION_COUNTRIES,
  AD_PROVIDERS,
} from './config.ts';
export type {
  AdProvider,
  SiteAdProperty,
  ContactObject,
  Jurisdiction,
  PostalAddress,
  ResolvedInput,
  Config,
  OrganizationConfig,
  SiteSection,
  SiteFont,
  SiteIndexNow,
  SiteIndexing,
  SiteSearchConsole,
  ConfigValidationResult,
} from './config.ts';

// Legal documents. A sibling of `generateDocs`, not a `generate()` format:
// `generate()` is keyed to a DesignSystem, and these render from a Config.
export {
  generateLegal,
  enabledDocs,
  renderMarkdown,
  renderNodes,
  derivePolicyVars,
  detectProcessorKeys,
  processorsMissingLocation,
  resolveProcessors,
  KNOWN_PROCESSORS,
  parseMarkdown,
  toContentNodes,
  toHtmlFragment,
  toPortableText,
  DOC_ORDER,
  DOC_SLUGS,
  TEMPLATES,
} from './legal/index.ts';
export type {
  GenerateLegalOptions,
  LegalDoc,
  LegalOutput,
  PolicyVars,
  Processor,
  ProcessorStorage,
  KnownProcessorKey,
  Block,
  Span,
  DocSet,
} from './legal/index.ts';

import { SCHEMA_LOCAL_PATH, type DesignSystem } from './schema.ts';

/**
 * A minimal but complete starter design system, used by `vitops init`. It
 * validates against the schema and generates real output in every format, so a
 * new project can `vitops generate` immediately and then tune from here.
 */
export function defaultConfig(): DesignSystem {
  return {
    // The installed copy, not the unpinned unpkg URL — see SCHEMA_LOCAL_PATH.
    $schema: SCHEMA_LOCAL_PATH,
    colors: {
      // Each hue is generated as an 11-step OKLCH scale from its seed.
      palette: {
        brand: { seed: '#2e9b73' },
        ink: { seed: '#3f4a5c' },
        sky: { seed: '#2f7bc0' },
        sun: { seed: '#d08a1f' },
        rose: { seed: '#c74a42' },
      },
      // role → hue. Tokens (--color-<target>-<role>-<variant>) derive from the
      // hue's scale; dark mode flips automatically. `kind: "surface"` marks the
      // page/panel colours, which get a bare `bg-<role>`; the bare-string form
      // means chromatic, so a signal colour says tint-or-solid rather than
      // leaving "how loud?" to a guess.
      roles: {
        neutral: { hue: 'ink', kind: 'surface' },
        surface: { hue: 'ink', kind: 'surface' },
        'ui-primary': 'brand',
        'brand-primary': 'brand',
        info: 'sky',
        success: 'brand',
        warning: 'sun',
        danger: 'rose',
      },
      utilities: ['bg', 'text', 'icon', 'border'],
    },
    shadows: {
      sm: '0 1px 2px rgb(0 0 0 / 0.08)',
      md: '0 4px 6px rgb(0 0 0 / 0.12)',
      lg: '0 10px 15px rgb(0 0 0 / 0.18)',
    },
    fonts: {
      display: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "SF Mono", Menlo, monospace',
    },
    typeScale: {
      base: '1rem',
      names: ['2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'],
      baseStep: 4,
      baseline: 'm',
      ratio: 1.2,
      fluid: { minVw: '22.5rem', maxVw: '80rem', minRatio: 1.12 },
    },
    spaceScale: {
      base: '1rem',
      names: ['2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl'],
      baseStep: 4,
      baseline: 'm',
      ratio: 1.25,
      fluid: { minVw: '22.5rem', maxVw: '80rem', minRatio: 1.2 },
    },
    patterns: {
      defaults: {
        ds: 'none',
        b: '1px solid var(--color-border-surface-muted)',
        br: '0.375rem',
        p: '1rem',
        fs: '1rem',
      },
      // No `card` key here: a radii key named after a pattern collides on `--br-<name>`,
      // shadowing that pattern's override hook and leaving its `-group` alias unreachable
      // (validate() warns about exactly this). `card` is in the `panel` group, which already
      // carries the same 0.5rem, so dropping it is value-preserving.
      radii: { circle: '50%' },
      groups: {
        control: {
          ds: 'var(--ds-default)',
          b: 'var(--b-default)',
          br: 'var(--br-default)',
          p: '0.5em 1em',
          fs: 'var(--fs-default)',
        },
        panel: {
          ds: 'var(--shadow-md)',
          b: 'var(--b-default)',
          br: '0.5rem',
          p: '1rem',
          fs: 'var(--fs-default)',
        },
      },
      z: { raised: 1, sticky: 100, overlay: 200, top: 1000 },
      items: {
        // Affordance tier: bare <button> and .btn share one zero-specificity rule,
        // so any explicit class (including .cta) overrides it.
        btn: {
          group: 'control',
          element: 'button',
          class: 'btn',
          fill: false,
          // Geometry resolves through the group alias layer (`--<prop>-btn-group`),
          // so the mapping to the `control` group lives in CSS and stays editable;
          // `overrides` restate only what this tier does differently.
          overrides: { b: '1px solid transparent', fs: 'inherit' },
          base: {
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            gap: '0.4em',
            padding: 'var(--p-btn-group)',
            'border-radius': 'var(--br-btn-group)',
            border: 'var(--b-btn-group)',
            'box-shadow': 'var(--ds-btn-group)',
            background: 'transparent',
            color: 'inherit',
            'font-family': 'inherit',
            'font-size': 'var(--fs-btn-group)',
            'font-weight': 'inherit',
            'text-decoration': 'none',
            cursor: 'pointer',
          },
          states: {
            hover: { step: 1, css: { 'background-color': 'var(--color-bg-surface-muted)' } },
            'focus-visible': { ring: true },
          },
          roles: [],
        },
        // Persuasion tier: opt-in, works on any element (<a>, <button>, <summary>).
        cta: {
          group: 'control',
          class: 'cta',
          fill: true,
          // `ui-primary`, not `brand-primary`: a CTA is a prominent *interface*
          // affordance, and its prominence already comes from fill/weight/padding.
          // Keeping it on the ui role means the whole interaction family (btn,
          // link, cta) shares one hue lineage — otherwise focus rings change
          // colour depending on which tier you tabbed onto. Brand stays reachable
          // as an explicit `.cta-brand-primary` variant.
          default_role: 'ui-primary',
          overrides: { p: '0.75em 1.5em', b: 'none', ds: 'var(--shadow-sm)', fs: 'inherit' },
          base: {
            display: 'inline-flex',
            'align-items': 'center',
            'justify-content': 'center',
            gap: '0.5em',
            padding: 'var(--p-cta-group)',
            'border-radius': 'var(--br-cta-group)',
            border: 'var(--b-cta-group)',
            'font-family': 'inherit',
            'font-size': 'var(--fs-cta-group)',
            'font-weight': '600',
            'text-decoration': 'none',
            cursor: 'pointer',
            color: 'var(--color-text-on-ui-primary)',
            'box-shadow': 'var(--ds-cta-group)',
          },
          states: {
            hover: { step: 1, lift: '1px' },
            active: { scale: 0.97 },
            'focus-visible': { ring: true },
          },
          roles: [],
        },
        card: {
          group: 'panel',
          class: 'card',
          base: {
            'border-radius': 'var(--br-card-group)',
            padding: '1.5rem',
            background: 'var(--color-bg-surface)',
            border: 'var(--b-card-group)',
            'box-shadow': 'var(--ds-card-group)',
          },
          states: {},
          roles: [],
        },
      },
    },
    typography: {
      families: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        code: 'var(--font-mono, ui-monospace, monospace)',
      },
      // `text-wrap` is stated on every role because omitting it is NOT "inherit":
      // it is emitted at its identity (`wrap`) so role classes fully reset one
      // another, which would cancel the `pretty` a role inherits from body.
      roles: {
        display: {
          family: 'display',
          size: 'var(--text-3xl)',
          weight: 700,
          'line-height': '1.05',
          tracking: '-0.03em',
          'text-wrap': 'balance',
        },
        heading: {
          family: 'display',
          size: 'var(--text-xl)',
          weight: 600,
          'line-height': '1.3',
          'text-wrap': 'balance',
        },
        body: {
          family: 'sans',
          size: 'var(--text-m)',
          weight: 400,
          'line-height': '1.55',
          'text-wrap': 'pretty',
        },
      },
      // `body` binds base page typography to the body role, so prose inherits it
      // and the role's tokens stay the single place it's edited.
      headings: { body: 'body', h1: 'display', h2: 'heading', h3: 'heading' },
    },
    animations: {
      effects: {
        'fade-in': { kf: 'composite', vars: { 'opacity-from': 0 } },
        'slide-up': {
          kf: 'composite',
          vars: { 'translate-y-from': 'var(--slide-distance, 2rem)' },
        },
      },
      journeys: {
        // Each part must declare the `from` endpoint its keyframe reads — an
        // empty `slide` leaves slide-journey animating translate 0 → 0, i.e. a
        // journey that silently doesn't slide. Same var as the `slide-up`
        // effect above, so `--slide-distance` tunes both.
        base: {
          fade: { 'opacity-from': 0 },
          slide: { 'translate-y-from': 'var(--slide-distance, 2rem)' },
        },
        compose: [['fade'], ['slide'], ['fade', 'slide']],
      },
    },
  };
}
