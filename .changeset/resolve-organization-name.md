---
'@getvitops/astro': patch
'@getvitops/create': patch
---

**New: `resolveOrganizationName(config, locale?)`**, exported from `@getvitops/astro/routes`
alongside `toNotifyContext`/`toCrmConfig` — the same `organization.name` → `legalName` →
`undefined` fallback chain `toNotifyContext` already used for its `organizationName` field,
now usable standalone anywhere a build-time-only display name is needed (favicon generation,
a scaffold's `astro.config.mjs`, a `Layout.astro` fallback). `toNotifyContext` is unchanged —
it now delegates to this helper internally.

The emdash scaffold uses it to remove a three-way duplicated `'My EmDash Site'` string:
`astro.config.mjs`'s favicon `name` and `Layout.astro`'s title fallback both previously
hardcoded it independently of `site.json`'s `organization.name`. EmDash's own
`getSiteSettings().title` (set in the admin) still wins at render time when it's set — it's a
runtime-only fact that can't be read at build time at all — this only replaces the two
hardcoded _fallback_ strings.
