---
'@getvitops/astro': minor
---

Add Schema.org / JSON-LD structured-data components, exported at `@getvitops/astro/schemas/*`
(`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
`Breadcrumb`, `JobPosting`, and more) — each emits a typed `<script type="application/ld+json">`
block at SSR time with no runtime JS. `Head.astro` moved to `src/components/` (the public
`@getvitops/astro/Head.astro` import is unchanged).
