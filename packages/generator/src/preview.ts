/**
 * `@getvitops/generator/preview`: the design system's generated CSS, in a browser or a Worker.
 *
 * `previewCss(config)` runs the same `build()` the CLI does and returns the generated token layers
 * (colour, shadows, type, spacing, tokens, typography, patterns, animation effects) as one
 * stylesheet, each wrapped in the cascade layer `generate()`'s bundle gives it. It is meant to be
 * injected AFTER the page's built stylesheet: the layer names repeat, and a later rule wins inside
 * a layer, so the edited values override the built ones with no change to specificity or order.
 *
 * What it leaves out is what a config edit cannot change: the hand-written framework partials
 * (the page already loads them), and everything `generate()` does with files (lightningcss
 * minification, the Bricks payload, docs, legal, the icon sprite). Nothing here imports
 * `node:*`, so `preview-worker-safe.test.ts` can hold it to that.
 *
 * Tailwind sites: the same `--color-*` and related variables drive Tailwind's utilities, so the
 * css-format layers preview them too. A utility the config newly creates is not previewed.
 */
import { resolveInput, type Config } from './config.ts';
import { validate, type DesignSystem } from './schema.ts';
import { build, layerForPartial, wcagRatioMode, CSS_LAYERS } from './build.ts';

export interface PreviewResult {
  /** The stylesheet to inject. Empty when `errors` is not, so a caller keeps the last good one. */
  css: string;
  /** Schema errors, an unknown palette hue, or a contrast failure `generate()` would refuse. */
  errors: string[];
  /** What the build would have printed with `console.warn`. */
  warnings: string[];
}

/** `index.css`'s `@import` order for the generated chunks; the order is the cascade order. */
const GENERATED_ORDER = [
  'animation-effects.css',
  'color.css',
  'shadows.css',
  'type-tokens.css',
  'tokens.css',
  'typography.css',
  'typography-headings.css',
  'spacing.css',
  'patterns.css',
];

export function previewCss(
  input: Config | DesignSystem | unknown,
  opts: { theme?: string } = {},
): PreviewResult {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    const { designSystem, config } = resolveInput(input, opts);
    const checked = validate(designSystem);
    if (!checked.ok)
      return {
        css: '',
        errors: checked.errors.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
        warnings,
      };
    const built = build(checked.data as DesignSystem, 'css', '', {
      systemColorScheme: config?.designSystem?.defaultColorScheme === 'system',
      darkOnly: config?.designSystem?.defaultColorScheme === 'dark',
      wcagRatio: wcagRatioMode(config?.site?.accessibility?.level),
      contrastToggle: config?.site?.accessibility?.contrastToggle === true,
    });
    const chunks = GENERATED_ORDER.filter((name) => built.generated[name]).map(
      (name) => `@layer ${layerForPartial(`generated/${name}`)} {\n${built.generated[name]}\n}`,
    );
    return {
      css: `@layer ${CSS_LAYERS.join(', ')};\n${chunks.join('\n')}\n`,
      errors: [],
      warnings,
    };
  } catch (e) {
    return { css: '', errors: [(e as Error).message], warnings };
  } finally {
    console.warn = warn;
  }
}
