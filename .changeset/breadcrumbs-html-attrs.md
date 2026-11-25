---
'@getvitops/astro': patch
---

**`<Breadcrumbs>` accepts the attributes of the `<nav>` it renders in its types.** It already spread the rest of its props onto the `<nav>`, but `Props` did not admit them, so `<Breadcrumbs id="trail" …>` was a type error under `astro check`. `Props` now extends `HTMLAttributes<'nav'>` (as `<Tabs>` does for its `<div>`); no markup or behaviour changes. All formats (a type-only change). Other fixed-group packages: no consumer-facing change.
