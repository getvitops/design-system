---
'@getvitops/config': minor
'@getvitops/utils': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/cli': patch
---

**New package: `@getvitops/config`** — the site-config provider blocks (`site.crm`, `site.ads`,
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
