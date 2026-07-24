---
'@getvitops/astro': minor
---

Add `css.inject` option to `getvitops()` (default `true`). Set `inject: false` to stop the global `page-ssr` stylesheet injection and import the generated CSS from your site layout instead — needed when other integrations add routes that must not inherit the design system (e.g. EmDash's `/_emdash/admin`, which the auto-injected CSS was bleeding into).
