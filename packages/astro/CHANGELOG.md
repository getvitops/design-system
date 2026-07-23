# @getvitops/astro

## 0.2.0

### Minor Changes

- 4d89eca: Add Schema.org / JSON-LD structured-data components, exported at `@getvitops/astro/schemas/*`
  (`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
  `Breadcrumb`, `JobPosting`, and more) — each emits a typed `<script type="application/ld+json">`
  block at SSR time with no runtime JS. `Head.astro` moved to `src/components/` (the public
  `@getvitops/astro/Head.astro` import is unchanged).

## 0.1.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/vite@0.2.1
  - @getvitops/core@0.2.1
  - @getvitops/utils@0.2.1
