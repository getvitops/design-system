---
'@getvitops/generator': minor
---

**Config validation now rejects unknown keys instead of silently stripping them.** Every
object in `ConfigSchema` (the `Config` type — `organization`/`site` and everything nested under
them) switched from `z.object` to `z.strictObject`, matching what the published JSON Schema has
always asserted (`additionalProperties: false` at ~95 points) but the runtime validator never
actually enforced. A typo'd field (`site.ntoifications`, an add-on key on the wrong nesting
level, …) now fails `validateConfig()`/`vitops validate` with an `unrecognized_keys` error naming
the bad key, instead of validating successfully and doing nothing. `site.icons` stays
deliberately loose (`z.looseObject`, unchanged) — its per-set keys are open-ended by design.

**Breaking for any config carrying a field that isn't in the schema** — this is the point of the
change, but if a real config was relying on the old silent-strip behavior (an extra key kept
around for another tool to read), move it under a block the schema already permits `z.unknown()`
on (`site.cloudflare`, `site.tags`, `site.postTypes`) or open an issue.

Also:

- Added `configVersion` (optional, currently `1`) to `Config` — the document's own SHAPE
  version, distinct from this package's release version (which is CSS-driven and bumps on every
  design-system change regardless of `Config`'s shape). `defaultSiteConfig()` stamps it.
  Exported as `CONFIG_VERSION`.
- Re-exported several `Config`-related types/values that were defined but missing from the
  package root: `SiteReviews`, `SiteReviewLocation`, `SiteSearchConsoleSetup`,
  `CrmProviderConfig`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`.
- Added a `@getvitops/generator/config` subpath export — `ConfigSchema`, `Config`,
  `validateConfig`, `resolveConfig`, `isConfig`, `resolveInput` and friends, on their own, with no
  `node:fs`/`node:crypto`/lightningcss in the import graph (verified: `publint` clean, and the
  built chunk's own imports are `@zod/mini` + `@getvitops/utils`'s Worker-safe `ads`/`tracking`/
  `color` subpaths only). This is what makes `Config` bundleable in a Cloudflare Worker — the
  EmDash plugin's own admin route being the motivating case — without pulling in code that only
  ever runs at build time.
