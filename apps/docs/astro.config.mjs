// @ts-check
import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

/**
 * Vitops docs site.
 *
 * Two kinds of page live here and they are NOT edited the same way:
 *   • hand-written guides under `src/content/docs/{guides,packages}/`
 *   • generated reference under `src/content/docs/reference/`, synced from
 *     `@getvitops/generator`'s `generateDocs()` by `scripts/sync-reference.mjs`
 *     (gitignored — never hand-edit; change the generator or design-system.json).
 *
 * The generated half is the same OKF bundle that ships to consumers via
 * `vitops docs <topic>` and `<theme>/dist/docs/`, so the site cannot drift from
 * what the toolchain actually emits.
 */
export default defineConfig({
  site: 'https://docs.vitops.ca',
  integrations: [
    starlight({
      title: 'Vitops',
      description:
        'A design-system toolchain: generate Bricks, standalone CSS, or Tailwind v4 output from one design-system.json.',
      editLink: {
        baseUrl: 'https://github.com/getvitops/design-system/edit/main/apps/docs/',
      },
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is Vitops?', slug: 'index' },
            { label: 'Installation', slug: 'guides/installation' },
            { label: 'Your design system', slug: 'guides/design-system' },
          ],
        },
        {
          label: 'Packages',
          items: [{ autogenerate: { directory: 'packages' } }],
        },
        {
          label: 'Reference',
          badge: { text: 'generated', variant: 'note' },
          items: [{ autogenerate: { directory: 'reference' } }],
        },
        {
          label: 'Releases',
          items: [{ label: 'Changelog', slug: 'changelog' }],
        },
      ],
    }),
  ],
});
