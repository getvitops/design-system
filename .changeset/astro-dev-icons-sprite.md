---
'@getvitops/astro': patch
---

Fix `astro dev` answering every route with `module is not defined` on the Cloudflare adapter. `<Icon>` imports `@getvitops/generator/icons-sprite`, which imports `@iconify/utils`; workerd's dev runner cannot load that un-prebundled, and Vite only pre-bundles what a site's own sources import, so a site that reached `<Icon>` only through a package's `.astro` file (for example the `vitops.reviews` EmDash block, which renders `<ReviewCard>`) crashed in dev while building fine. `vitops()` now adds the module to `ssr.optimizeDeps.include`. No change to builds or to output.

No consumer-facing change in the other toolchain packages.
