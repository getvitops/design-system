/**
 * Font LOADING — turning declarations into Astro's `fonts:` config.
 *
 * The design system NAMES fonts (`design-system.json`'s `fonts` block → `--font-<name>`
 * tokens) and loads none of them: a stack is a `font-family` list, with no `@font-face`,
 * no preload, and no metrics-matched fallback behind it. Something has to load them, and
 * the failure mode when nothing does is invisible — installing a `@fontsource*` package
 * and importing its CSS renders correctly while silently giving up subsetting, preload
 * and the `size-adjust`/`ascent-override` metrics that keep CLS down.
 *
 * So this module is the seam, in the same spirit as `vitopsHosting()`: declare the family
 * once and let the integration wire it, rather than hand-rolling the config.
 *
 * The declaration shape is `SiteFont` from the generator — deliberately not a new type.
 * The site config has carried a `fonts` array (provider / weights / subsets / preload)
 * since it was written; what was missing was anything that read it.
 */
import type { SiteFont } from '@getvitops/generator';
import { fontProviders } from 'astro/config';

/**
 * Provider names, matching `fontProviders`' keys 1:1 (verified against astro@7.1.2).
 * The generator's `SiteFontSchema` enumerates the same set, so a mismatch is a
 * compile-time-invisible drift — `resolveFonts` throws on an unknown name rather than
 * quietly dropping the family and leaving the token resolving to a fallback stack.
 */
const PROVIDERS = new Set(Object.keys(fontProviders));

/**
 * Providers a declaration can construct with no arguments.
 *
 * `adobe` is the one that can't: `fontProviders.adobe({ id })` takes a project API id,
 * and the point of that id being an argument is that it comes from the environment. A
 * JSON declaration has nowhere to put `process.env.ADOBE_ID` without either inlining the
 * key into a committed file or inventing an interpolation syntax, so Adobe families are
 * declared in `astro.config` directly — see the error thrown below.
 */
const NEEDS_OPTIONS = new Set(['adobe']);

/**
 * What `<Head />` needs to emit `<Font />` for each family the integration registered.
 *
 * `preload` is passed to the component verbatim: Astro's `PreloadFilter` is
 * `boolean | Array<{weight?, style?, subset?}>`, and the declaration's per-face form is a
 * subset of that — so "preload the 700 upright only" survives instead of flattening to
 * "preload everything", which would preload the whole family.
 */
export interface HeadFont {
  cssVariable: string;
  preload: NonNullable<SiteFont['preload']> | false;
}

export interface ResolvedFonts {
  /** Spread into `updateConfig({ fonts })`. Astro's own `FontFamily` shape. */
  fonts: Record<string, unknown>[];
  /** Passed through the virtual head module so `<Head />` can render `<Font />`. */
  head: HeadFont[];
}

/**
 * Map declarations onto Astro's `fonts:` entries.
 *
 * `preload` is dropped from the Astro entry on purpose — it is not part of the config
 * schema there, it is a prop on the `<Font />` component. It rides along in `head`
 * instead, which is what makes preload a property of the declaration rather than
 * something the consumer hand-picks in their layout.
 */
export function resolveFonts(decls: readonly SiteFont[]): ResolvedFonts {
  const fonts: Record<string, unknown>[] = [];
  const head: HeadFont[] = [];
  const seen = new Set<string>();

  for (const decl of decls) {
    if (!PROVIDERS.has(decl.provider))
      throw new Error(
        `[getvitops] fonts: unknown provider "${decl.provider}" for "${decl.name}". ` +
          `Astro provides: ${[...PROVIDERS].sort().join(', ')}.`,
      );
    if (NEEDS_OPTIONS.has(decl.provider))
      throw new Error(
        `[getvitops] fonts: provider "${decl.provider}" needs an API id from your environment ` +
          `("${decl.name}"), and a JSON declaration has nowhere to hold one. Declare this family ` +
          `in astro.config instead — fonts: [{ provider: fontProviders.${decl.provider}` +
          `({ id: process.env.ADOBE_ID }), name: '${decl.name}', cssVariable: '${decl.cssVariable}' }] — ` +
          'and render its <Font /> yourself; the design-system token can still point at it.',
      );
    if (!decl.cssVariable.startsWith('--'))
      throw new Error(
        `[getvitops] fonts: cssVariable "${decl.cssVariable}" (${decl.name}) must start with "--".`,
      );
    // Two families on one variable is the documented failure of Astro's Fonts API:
    // it warns and the last one wins, so the first family silently never loads.
    if (seen.has(decl.cssVariable))
      throw new Error(
        `[getvitops] fonts: two families both declare ${decl.cssVariable} ` +
          `(the second is "${decl.name}"). Astro resolves one family per variable — ` +
          `give them separate variables, or drop one.`,
      );
    seen.add(decl.cssVariable);

    const { provider, preload, ...rest } = decl;
    fonts.push({
      ...rest,
      provider: (fontProviders as unknown as Record<string, () => unknown>)[provider]!(),
    });
    head.push({ cssVariable: decl.cssVariable, preload: preload ?? false });
  }

  return { fonts, head };
}
