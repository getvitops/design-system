/**
 * @getvitops/generator — public API.
 *
 * Turn a `design-system.json` into platform outputs (Bricks, standalone CSS,
 * Tailwind v4). The `zod/mini` schema is the single source of truth: types,
 * validation, and the published JSON Schema all derive from it.
 */
export { generate } from './generate.ts';
export type { GenerateOptions, GenerateResult, Format } from './generate.ts';

export { generateDocs } from './docs.ts';
export { TW_CLASH, BASE_HOOK } from './shared.ts';

export { DesignSystemSchema, jsonSchema, SCHEMA_URL, validate } from './schema.ts';
export type { DesignSystem, ValidationResult } from './schema.ts';
export {
  SiteConfigSchema,
  siteJsonSchema,
  SITE_SCHEMA_URL,
  validateSite,
  resolveSiteConfig,
  resolveTheme,
  stripNulls,
  deepMerge,
} from './site.ts';
export type { SiteConfig, SiteValidationResult } from './site.ts';

import { SCHEMA_URL, type DesignSystem } from './schema.ts';

/**
 * A minimal but complete starter design system, used by `vitops init`. It
 * validates against the schema and generates real output in every format, so a
 * new project can `vitops generate` immediately and then tune from here.
 */
export function defaultConfig(): DesignSystem {
  return {
    $schema: SCHEMA_URL,
    colors: {
      // Each hue is generated as an 11-step OKLCH scale from its seed.
      palette: {
        brand: { seed: '#2e9b73' },
        ink: { seed: '#3f4a5c' },
        sky: { seed: '#2f7bc0' },
        sun: { seed: '#d08a1f' },
        rose: { seed: '#c74a42' },
      },
      // role → hue. Functional tokens (bg/text/solid/on-solid/…) derive from
      // the hue's scale; dark mode flips automatically.
      roles: {
        neutral: 'ink',
        surface: 'ink',
        'ui-primary': 'brand',
        'brand-primary': 'brand',
        info: 'sky',
        success: 'brand',
        warning: 'sun',
        danger: 'rose',
      },
      utilities: ['bg', 'text', 'border'],
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
        b: '1px solid var(--color-surface-xl)',
        br: '0.375rem',
        p: '1rem',
        fs: '1rem',
      },
      radii: { pill: '999px', circle: '50%', card: '0.5rem' },
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
            hover: { step: 1, css: { 'background-color': 'var(--color-surface-muted)' } },
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
            color: 'var(--ui-primary-on-solid)',
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
            background: 'var(--color-surface-xxl)',
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
      roles: {
        display: {
          family: 'display',
          size: 'var(--text-3xl)',
          weight: 700,
          'line-height': '1.05',
          tracking: '-0.03em',
        },
        heading: { family: 'display', size: 'var(--text-xl)', weight: 600, 'line-height': '1.3' },
        body: { family: 'sans', size: 'var(--text-m)', weight: 400, 'line-height': '1.55' },
      },
      headings: { h1: 'display', h2: 'heading', h3: 'heading' },
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
        base: { fade: { 'opacity-from': 0 }, slide: {} },
        compose: [['fade'], ['slide'], ['fade', 'slide']],
      },
    },
  };
}
