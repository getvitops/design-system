---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
'@getvitops/generator': minor
---

Web components now load on demand: a page downloads only the `<wc-*>` elements it uses.

`elements.js` was one 95KB bundle that registered every element, so a page with a single `<wc-copy>` still downloaded the carousel, the tree and the combobox (Lighthouse: 70KB, 75%, unused on a typical home page). Each element is now its own module under `elements/<tag>.js`, and a new `loader.js` scans the page for undefined `wc-*` tags, imports those (plus each class's `static dependencies`, for example `wc-gallery` needs `wc-carousel`), and keeps watching for tags added later. Late upgrade is safe because the pre-upgrade state is the tier-2 no-JS fallback. A page with one Lit element downloads about 11KB gzipped instead of about 38KB. Prerendered pages also get `modulepreload` hints for the elements they use, so the loader, the element and Lit load in parallel.

- **`@getvitops/astro`:** `<Head />` loads `loader.js` by default. `vitops({ componentLoading: 'eager' })` keeps the single `elements.js` (which now loads every element at once, with no observer). All formats.
- **`@getvitops/emdash`:** `fragments` mode follows the same default; `vitops_emdash({ elements: 'eager' })` opts out.
- **`@getvitops/generator` (Bricks):** unchanged behaviour. The theme still enqueues `elements.js`, a builder re-renders markup constantly, which is the hardest case for an observer. The generated `dist/` now carries `elements/` and `chunks/` beside it.
- **`@getvitops/core`:** the shared-chunk folder `polyfills/` is renamed `chunks/` (it holds Lit and shared helpers, not polyfills). **Breaking only if you import `polyfills/*` directly**; nothing documented does. `@getvitops/core/elements` still resolves to the eager entry. `wc-consent`, `wc-stepper`, `wc-config-form`, `wc-color-field` and `wc-config-preview` keep their own entries and are not touched by the loader.
- **Custom elements added by a site** (their own `wc-*` tags) are ignored by the loader, so they never 404; load them yourself.
