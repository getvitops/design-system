---
'@getvitops/astro': minor
'@getvitops/utils': minor
---

`vitops()` now strips unused CSS from the built site, on by default.

The tailwind format inlines every pattern partial into `@layer components`, which Tailwind never prunes, so a site shipped the rules for patterns it never renders. After the build, the integration scans the prerendered HTML and the web-component bundles (which add classes at runtime) and writes a purged stylesheet under a new hashed name (`*.p<hash>.css`), repointing only the prerendered pages. On-demand routes (CMS pages, admin) keep the full sheet. On this repo's docs site it takes the sheet from 270KB to 203KB.

State rules a page cannot show at build time are kept: every `data-*` / `aria-*` attribute the framework CSS selects on (including `:root[data-contrast=more]`), `:is(:popover-open, .\:popover-open)`, `[href=\#anchor]`, and the `is-` / `has-` / `wc-` prefixes. A test fails if the framework CSS gains a new state attribute that is not on the list.

Opt out with `css: { purge: false }` or `VITOPS_PURGE_CSS=0`. Applies to `css.format` `tailwind` and `css`; `bricks` is skipped, and `vitops build` output outside Astro is unchanged. `@getvitops/utils` gains a `./purge` entry (`purgeStylesheet`, `purgeBuildOutput`). A site that wrote its own PurgeCSS step (for example `integrations/purge-css.ts`) should delete it.
