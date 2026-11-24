---
'@getvitops/astro': minor
'@getvitops/core': minor
---

**`vitops({ polyfills: { disable, enable } })` chooses which feature-detected polyfills load, and the Temporal polyfill is now opt-in.** `polyfills.js` used to load every polyfill whose feature test failed, including `temporal-polyfill/global` for every visitor on an engine without `Temporal`, although nothing in core reads that API (`<wc-format>` uses `Intl`). Now:

- Everything core depends on stays **on by default** (`webcomponents`, `template-shadowroot`, `popover`, `constructed-stylesheets`, `invoker-commands`, `css-anchor-positioning`). `disable: ['popover']` leaves one out, for a site whose browser support policy makes it dead weight.
- `temporal` is **off by default**; `enable: ['temporal']` turns it on.
- Names are a closed union (`PolyfillName`, exported from `@getvitops/astro`), and an unknown name, or one listed in both lists, fails the build instead of silently loading the wrong set. `<Head />` passes the choice to the bundle as `data-polyfills-enable` / `data-polyfills-disable` on the `polyfills.js` tag (omitted when empty, so a default page's markup is unchanged).

**Migration:** a site whose own scripts call `Temporal` and relied on core to supply it adds `polyfills: { enable: ['temporal'] }` to `vitops()`. A site that loads `polyfills.js` by hand, with no `<Head />`, gets the default set, which no longer includes Temporal. Nothing in this repo or the scaffolded templates used it. Affects the browser bundle in all formats; no CSS change. Other fixed-group packages: no consumer-facing change.
