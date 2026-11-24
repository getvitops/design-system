---
'@getvitops/astro': minor
'@getvitops/utils': minor
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/config': patch
---

**Added: location and service pages.** One `organization.locations` or `organization.services` entry becomes a page with the right JSON-LD, so local SEO is a few lines per site instead of hand-written markup.

- **`<LocationPage location defaultLocale>`** (`@getvitops/astro/components/LocationPage.astro`): the name, description, `<address>` (phone and email as `tel:` / `mailto:` links), an opening-hours table (`Monday – Friday`, `9:00 AM – 5:00 PM`, localised, with a "Closed" row for a dated closure), photos and the `LocalBusiness` JSON-LD, with a slot for your own copy and a `photos` slot to swap in `<Carousel>` / `<Gallery>`. A plain-string photo renders as decorative (`alt=""`); give it `{ src, alt }` to describe it. Visible words come from `labels`.
- **`<ServicePage service defaultLocale providerName>`**: the name, description, priced offers and the `Service` JSON-LD naming the provider.
- **`serviceGraph()`** and `<Service>` (`@getvitops/utils/schema`, `@getvitops/astro/schemas/Service.astro`), the missing JSON-LD builder, in the style of `localBusinessGraph`.
- **`resolveSlug`, `locationToLocalBusiness`, `serviceToGraph`** (`@getvitops/astro/schemas/graph-adapters.ts`): pure adapters over the structural shapes a plain `import site from './site.json'` has (a weekday is checked at runtime, not trusted to the type). `listings` is never emitted.
- **`GBP_CATEGORY_TYPES` / `localBusinessTypeForCategory()`** (`@getvitops/utils/schema`): a Google Business Profile category id to a `LocalBusiness` subtype, for seeding a location's `type`. Incomplete by design and **not yet verified against Google's category list** (that needs the Business Information API access request); an unknown id returns `undefined`.

Routing is not scaffolded: a `getStaticPaths()` over an empty record is dead weight on every site without locations. The idiom is in `LocationPage.astro`'s docblock and works on EmDash sites too, since a concrete `locations/[slug].astro` wins over the catch-all. One path per location, not per locale. No CSS changed, so no format is affected.

**Also: the container render tests now run in CI.** `@getvitops/astro` and `@getvitops/emdash` render `.astro` components through Astro's container API in their own vitest configs, which the root `vp test run` excludes; nothing ran them, so they could have broken unnoticed. CI has a "Container render tests" step, and `@getvitops/astro` gets the `test:container` script its docblock always named. The note that its `container.test.ts` throws was stale: it passes.

`@getvitops/generator`, `core`, `cli`, `vite` and `config` — no consumer-facing change in these packages.
