# @getvitops/astro

## 0.3.0

### Minor Changes

- Extract the framework-agnostic content model + HTML helpers into `@getvitops/utils`
  (new `content`/`html` exports: `Elmnt`/`Link`/`ContentNode` types + guards, `t`,
  `partAttrs`, `parseRenderedSlots`, `toHtml`, `nodesToHtml`, `styleList`, …), and ship
  the generic Astro component tier from `@getvitops/astro/components/*`: `Subgrid`,
  `Cards`, `NodeRenderer`, `WebComponentLoader`, plus `Popover`/`Details`/`Drawer`
  (the latter three use `astro-icon`, now declared as an optional peer). Config-bound
  chrome (Template/SEO/ContentInfo/FormRenderer/Nav/Submenu) stays internal pending the
  EmDash integration.

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/core@0.3.0
  - @getvitops/generator@0.3.0
  - @getvitops/vite@0.3.0

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
