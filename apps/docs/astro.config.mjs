// @ts-check
import vitops from '@getvitops/astro';
import { defineConfig } from 'astro/config';

/**
 * Vitops docs site — deliberately a plain Astro site, not a docs framework.
 *
 * The point is to dogfood: every layout, control and piece of chrome on this
 * site is built from the design system's own CSS framework and web components.
 * A themed docs framework would have supplied its own layer and hidden exactly
 * the thing we want under test.
 *
 * Format is `css` (the bundled standalone stylesheet), not `tailwind`, so the
 * framework's own utility vocabulary does the work — `.rhythm`, `.centered`,
 * `.cluster-*`, `.split-*`, `.font-<role>`, `.bg-<role>` — rather than Tailwind's.
 * (`index.html` at the repo root also exercises the css format, but as a static
 * hand-written page; this covers the css format *through the Astro integration*,
 * which nothing did before.)
 */
export default defineConfig({
  site: 'https://docs.vitops.ca',
  integrations: [
    vitops({
      css: {
        input: '../../src/design-system.json',
        format: 'css',
        out: 'src/styles',
      },
      // The framework's Lit components are copied into public/ and loaded by
      // <Head />: the colour-scheme toggle in the header is a real one.
      webComponents: true,
      // The live theme editor. Editing works on the deployed site too; only
      // "Save to source" needs the dev server (`vp run docs:dev`), where it
      // writes back into ../../src/design-system.json and regenerates.
      editor: true,
      // Static output + `site` set + no EmDash — the exact shape the option
      // targets. <Head /> emits the <link rel="sitemap"> for it.
      sitemap: true,
      // Site-level defaults for <Seo /> in Docs.astro; pages override per-page.
      seo: {
        siteName: 'Vitops',
        titleTemplate: '%s · Vitops',
        defaultDescription:
          'A generated design system for Astro and WordPress — variable-driven CSS framework, ' +
          'progressive-enhancement web components, and one config file.',
        openGraph: { locale: 'en_CA' },
      },
    }),
  ],
});
