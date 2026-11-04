---
'@getvitops/config': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
---

**`site.seo` is now the single source of site-level SEO defaults** (ADR-0002). Until now `site.seo`
declared `titleTemplate`, verification tokens, `openGraph` and `twitter` that nothing read, while
`<Seo />` took a second, differently-shaped vocabulary through `vitops({ seo })` that no other stack
could see.

- `SeoSchema` moves to `@getvitops/config` and gains what only the integration had: `siteName`,
  `defaultTitle`, `defaultDescription`, `openGraph.localeAlternates` and `openGraph.image` as
  `{ src, alt, width, height, type }`. Text fields are localisable.
- `@getvitops/astro` exports `resolveSeoDefaults(config, { locale, env })`. The integration reads
  `site.seo` from the site config it already loads; `siteName` falls back to `organization.name`, and
  the environment's `robots` wins over `site.seo.robots`, the same fact `vitops robots` and
  `search notify` read.
- `vitops({ seo })` keeps working unchanged and is now an **override** merged over the config, field by
  field (`openGraph` and `twitter` merge key by key).
- **Removed from the config schema** (nothing read them): `descriptionTemplate` → use
  `defaultDescription`; `openGraph.siteName`/`title`/`description` and
  `twitter.title`/`description`/`image` → set per page on `<Seo />`, or the site-wide values above.
  A config that still carries one now fails `vitops validate` with an unrecognised-key error.
- `openGraph.type` is now `website | article | profile`.
