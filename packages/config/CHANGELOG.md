# @getvitops/config

## 8.2.0

### Minor Changes

- 89265af: **New package: `@getvitops/config`** — the site-config provider blocks (`site.crm`, `site.ads`,
  `site.reviews`, `site.seo.indexing`, `site.searchConsole`, `site.notifications`, `site.tracking`,
  `site.security`, `site.deployment`) as zod schemas and inferred types, with the closed provider lists
  (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`) on a zod-free `./providers` entry. It joins the
  `fixed` group.

  Why: `@getvitops/utils` holds the provider code but could not import its configuration types — the schema
  lived in `@getvitops/generator`, a layer above — so it kept a hand-copied mirror beside each module,
  an adapter converting into it, and a test holding the copy to the schema. The mirrors are gone.

  - **`@getvitops/generator`**: `AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`, `AdProvider` and
    `CrmProviderConfig` are re-exported unchanged. No import path changes.
  - **`@getvitops/utils`**: the config types in `./crm`, `./ads`, `./indexing`, `./onboarding`, `./reviews`,
    `./tracking` and `./notify` (`CrmConfig`, `HubSpotConfig`, `BiginConfig`, `JobberConfig`,
    `IndexNowConfig`, `SearchConsoleConfig`, `ReviewsConfig`, `ReviewLocationConfig`, `TrackingConfig`,
    `NotificationsConfig`, `EmailChannelConfig`, `DomainSetup`, `AdPropertySetup`) are now inferred from the
    schema. Same names, same fields, but **optional fields now follow zod's inference**, so a hand-written
    object literal typed against them may need `| undefined` handled. `AdPropertySetup` gains the fields the
    schema always had (`conversionActionId`, `reporting`).
  - **`@getvitops/astro`**: `GetvitopsAdProperty` and `GetvitopsTrackingOptions` are aliases of the schema
    types. `toCrmConfig()` and `toGoogleAdsConfig()` are **deprecated** — they returned their argument's
    field unchanged; pass `config.site.crm` / `config.site.ads?.google` directly.
  - **`@getvitops/cli`**: `vitops ads` now passes `conversionActionId` and `reporting` through to the planner;
    it previously copied a hand-picked subset of the block and dropped them.

  Formats reached: none — no CSS change.

- 7fd5f8f: **`site.seo` is now the single source of site-level SEO defaults** (ADR-0002). Until now `site.seo`
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
