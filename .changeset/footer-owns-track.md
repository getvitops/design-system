---
'@getvitops/astro': minor
'@getvitops/core': patch
'@getvitops/cli': minor
'@getvitops/create': patch
---

`<SiteFooter>` owns its page track. The footer now renders an inner `.sitefooter__inner.centered` row (`width="content"`, the default), so the gutters come from the page track like `<Masthead width="content">`; `width="full"` runs it edge to edge inside `--sitefooter-gutter`. The starter used to pass `class="centered"` to the footer, where `.sitefooter { display: flex }` cancelled it and left the footer against the viewport edge.

**Migration:** run `vitops lint --fix`. The new `SiteFooter.centered` error finds `<SiteFooter class="centered">` and removes the token. A site that styled `.sitefooter` as the flex container should retarget `.sitefooter__inner`. The lint summary now reports layout findings as "layout errors" rather than "unresolvable classes". CSS: **all formats**.
