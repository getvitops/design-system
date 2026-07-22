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
        button: {
          group: 'control',
          element: 'button',
          default_role: 'brand-primary',
          base: {
            padding: '0.6em 1.2em',
            'border-radius': 'var(--br-control, 0.25rem)',
            border: 'none',
            'font-weight': '600',
            color: '#fff',
            cursor: 'pointer',
            'box-shadow': 'var(--shadow-sm)',
          },
          states: { hover: { step: 1 }, active: { scale: 0.97 }, 'focus-visible': { ring: true } },
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
