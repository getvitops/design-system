# ADR-0001: Move the site config schema below the provider code

**Status:** Proposed
**Date:** 2026-11-02
**Deciders:** Alex Gagnon

## Context

The intended layering has provider and scaffolding code at the bottom, with everything else built on
it. The actual graph inverts one edge:

- **Provider code lives in `@getvitops/utils`** (`crm`, `notify`, `indexing`, `ads`, `onboarding`,
  `email`, `reviews`, `hosting`, `tracking`, `security`, roughly 7,000 lines), which is the graph root.
- **The schema that configures it lives in `@getvitops/generator`** (`config.ts`, 2,269 lines: `site.crm`,
  `site.ads`, `site.notifications`, `site.legal`, and so on), a layer above.

Utils therefore cannot import its own config types. The consequence is concrete:

- Nine config shapes are re-declared by hand in utils (`IndexingConfig`, `OnboardingConfig`,
  `AdsConfig`, `CrmConfig`, `ReviewsConfig`, `TrackingConfig`, `NotificationsConfig`, `HostingSetup`,
  `EmailConfig`).
- Six adapters convert the real config into those copies (`toIndexingConfig`, `toSearchConsoleSetup`,
  `toAdProperties` in the CLI; `toNotifyContext`, `toCrmConfig`, `toGoogleAdsConfig` in astro). Two of
  them return their input unchanged, which shows the shapes are identical.
- Closed lists exist twice (`AD_PROVIDERS` and `AD_PROVIDER_KEYS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`)
  with a test each holding the copies together.

`@getvitops/astro` adds three more mirrors (`GetvitopsSeoOptions`, `GetvitopsAdProperty`,
`GetvitopsTrackingOptions`) that do not even have the cycle as an excuse.

Separately, `utils` carries three unrelated things: primitives that `core` bundles into the browser
(`color`, `icons`, the content model), build tooling with native dependencies (`favicon`, `media`), and
provider integrations split between CLI-only and Worker-safe code.

## Decision

Take **Option B now**, and **Option C only if the cost of B shows it is still wanted**.

## Options Considered

### Option A: Keep the layout, add guards

| Dimension        | Assessment                                                           |
| ---------------- | -------------------------------------------------------------------- |
| Complexity       | Low                                                                  |
| Cost             | Zero now; the mirror and adapter cost recurs with every new provider |
| Scalability      | Each new provider adds a mirror, an adapter and a sync test          |
| Team familiarity | Highest                                                              |

**Pros:** nothing changes; the guards already exist (`worker-safe.test.ts`, the enum-sync tests).
**Cons:** the inverted edge stays, and so does the cost of adding the next provider (CRM number four).

### Option B: Extract `@getvitops/config`, a leaf package holding the `Config` schema

The `zod/mini` config schema, `validateConfig`, `MOVED_KEYS` and the closed provider lists move out of
`generator` into a new package that depends on `zod` and nothing in the workspace. `utils` imports the
inferred types from it (`import type`), and deletes its mirrors and the two enum-sync tests. `generator`
keeps `legal/`, `robots.ts` and the design-system schema, and **re-exports the config API unchanged**, so
no consumer import path changes.

| Dimension        | Assessment                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Complexity       | Medium: one package move, `utils` gains a type-only dependency on it                                                        |
| Cost             | Rough estimate, not measured: a couple of days. Mostly mechanical; the risk is the `fixed` release group and build ordering |
| Scalability      | A new provider is a schema entry plus its executor — no mirror, no adapter                                                  |
| Team familiarity | High: it is existing code relocated                                                                                         |

**Pros:** removes the nine mirrors, six adapters and two sync tests; puts the schema below what reads
it; non-breaking for consumers because `generator` re-exports. `config` joins the `fixed` group, so the
snapshot-skew reasoning in AGENTS.md still holds.
**Cons:** one more package to publish; `config.ts` currently imports capability tables from `utils`
(`AD_PLATFORMS`, `PLATFORM_PARAMS`), so those literal lists must move into `config` as the single source
and `utils` imports them — the opposite direction from today, which is the point.

### Option C: B, plus split provider code out of `utils` into `@getvitops/providers`

Providers move to a package with explicit `./worker/*` and `./node/*` subpath groups. `utils` shrinks to
primitives (`color`, `icons`, content model, `html`).

| Dimension        | Assessment                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Complexity       | High                                                                                                                          |
| Cost             | Rough estimate, not measured: a week or more, and a major version: every `@getvitops/utils/<provider>` subpath import changes |
| Scalability      | Best: provider code gets its own boundary and the Worker/Node split becomes structural, not tested                            |
| Team familiarity | Medium                                                                                                                        |

**Pros:** `utils` is finally small; `sharp` stops reaching `emdash` and the Worker bundles by name rather
than by lazy import; the Worker rule is enforced by package layout.
**Cons:** breaking, and large. Most of what it buys over B is organisational. The one concrete extra
benefit, keeping `sharp` out of installs that do not make favicons, is reachable in B by making it an
optional peer of the packages that use it.

## Trade-off Analysis

B removes the defect — the inverted edge and everything downstream of it — for the cost of one
relocated package, without changing a single consumer import. C reaches a tidier end state but charges a
major version for it, and the audit found no bug that C fixes and B does not. So B is worth doing on its
own merits, and C should be decided later against evidence: whether `sharp` as a hard dependency keeps
hurting, and whether provider count keeps growing.

## Consequences

- Adding a provider becomes: a schema entry in `config`, an executor in `utils`. No mirror, adapter or
  sync test.
- `validateConfig`'s `MOVED_KEYS` migration messages keep working, since the schema moves intact.
- `generator` gains `config` as a dependency and `utils` gains it as a type-only one, so `build:*` task
  ordering in `vite.config.ts` and the ARCHITECTURE.md graph both change.
- `@getvitops/astro`'s three structural mirrors should go in the same change; they never needed to exist.
- Still to revisit after B: whether `utils` should keep `favicon` and `media`, and `sharp` as an optional
  peer.

## Action Items

1. [ ] Create `packages/config` with `ConfigSchema`, `validateConfig`, `MOVED_KEYS` and the closed lists
       (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`, `JURISDICTIONS`); add it to the `fixed` group.
2. [ ] Re-export the config API from `generator` so import paths do not change; keep `legal/` in generator.
3. [ ] Replace the nine `utils` mirror types with `import type` from `config`; delete `ads-config.test.ts`
       and `crm-config.test.ts`'s enum-sync halves and the six adapters.
4. [ ] Delete astro's `GetvitopsSeoOptions`, `GetvitopsAdProperty` and `GetvitopsTrackingOptions`.
5. [ ] Update `vite.config.ts` task `dependsOn`, ARCHITECTURE.md's graph and `scripts/scaffold-check.mjs`.
6. [ ] Re-run `verify:scaffold`; confirm the changeset states "No consumer-facing change" for packages
       that only moved code.
