# ADR-0001: Move the provider config blocks below the provider code

**Status:** Accepted — implemented for the provider blocks (2026-11-03). Option C remains open.
**Date:** 2026-11-02, revised 2026-11-03
**Deciders:** Alex Gagnon

## Context

The intended layering has provider and scaffolding code at the bottom, with everything else built on it.
The actual graph inverted one edge:

- **Provider code lives in `@getvitops/utils`** (`crm`, `notify`, `indexing`, `ads`, `onboarding`, `email`,
  `reviews`, `hosting`, `tracking`, `security`, roughly 7,000 lines), which was the graph root.
- **The schema that configures it lived in `@getvitops/generator`** (`config.ts`, 2,269 lines), a layer above.

Utils could not import its own config types, so it kept field-for-field copies beside each module, an
adapter converting into each, and a test holding each copy to the schema. `@getvitops/astro` added more
copies that did not even have the cycle as an excuse.

## What reading the code changed

The first draft of this ADR proposed moving the whole `Config` schema into a leaf package. That was wrong:
`config.ts` imports the **design-system** schema (`schema.ts`), whose `tokenRefIssues` calls the **token
engine** (`tokens.ts`, `token-refs.ts`, `shared.ts`). The umbrella `Config` embeds a design system, so
moving it would have dragged most of the generator down and produced a "leaf" that was not one.

The provider blocks, though, are standalone: `site.crm`, `site.ads`, `site.reviews`, `site.seo.indexing`,
`site.searchConsole`, `site.notifications`, `site.tracking`, `site.security`, `site.deployment` reference
nothing but zod and a `desc()` helper. Those are the blocks utils mirrored.

## Decision

**Option B, narrowed:** a new leaf package `@getvitops/config` holds the provider blocks as zod schemas and
inferred types. The umbrella `Config`, `resolveInput`, `defaultSiteConfig` and the design-system schema stay in
`@getvitops/generator`, which composes the blocks and re-exports the moved names.

## Options Considered

### Option A: Keep the layout, add guards

Zero cost now; every new provider adds a mirror, an adapter and a sync test. Rejected: the inverted edge
stays and so does the recurring cost.

### Option B: Extract the provider blocks into `@getvitops/config` — chosen

| Dimension        | Assessment                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Complexity       | Medium: one package, two entry points, `utils`/`generator`/`astro` gain a dependency        |
| Cost             | About a day, mostly mechanical. The real work was the dependency graph and zod version skew |
| Scalability      | A new provider is a schema entry plus its executor — no mirror, no adapter                  |
| Team familiarity | High: existing code relocated                                                               |

**Pros:** the schema now sits below what reads it; non-breaking import paths; the type an executor accepts is
the type `validateConfig` accepts.
**Cons:** one more package in the `fixed` group; optional fields in `@getvitops/utils` types now follow zod's
inference.

### Option C: B, plus split provider code out of `utils` into `@getvitops/providers`

A week or more and a major version, since every `@getvitops/utils/<provider>` import changes. The audit found
no defect it fixes that B does not. **Not taken; revisit only on evidence** that the Worker/Node split needs
to be structural rather than tested.

## Consequences

- **Deleted:** the mirror types in `utils` (`crm`, `ads`, `indexing`, `onboarding`, `reviews`, `tracking`,
  `notify`), astro's `GetvitopsAdProperty`/`GetvitopsTrackingOptions` copies, the ads enum-sync test, and the
  CLI's hand-picked field copies (which had been silently dropping `conversionActionId` and `reporting`).
- **Not deleted, and why:** `HostingSetup` and `EmailConfig` are derived plan inputs, not mirrors. The CLI
  adapters `toIndexingConfig`, `toSearchConsoleSetup` and `toAdProperties` do real resolution (environment
  URL precedence, domain defaults, `--provider`/`--domain` filters). `toCrmConfig` and `toGoogleAdsConfig`
  became identity functions and are deprecated rather than removed, since they are public API.
  `GetvitopsSeoOptions` still mirrors `site.seo` because that block was not moved.
- **Two entry points, deliberately.** `.` carries zod; `./providers` carries the closed lists as bare
  literals. Worker code needs the lists as values and must not pull zod along. `worker-safe.test.ts` fails a
  Worker subpath that takes a runtime value from the root.
- **Declare `zod` in `@getvitops/config`.** Leaving `@zod/mini`'s peer to auto-install gave the package
  zod 4.6.7 beside the generator's 4.6.5, and the two copies made the generator's declaration emit fail with
  TS2883.
- **`sharp` stays a hard dependency of `@getvitops/utils`.** The favicon pipeline (png/jpg/svg to the standard
  icon set) is needed by essentially every site, and Astro's own default image service is Sharp — Astro ships
  it, Squoosh was removed in Astro 5, and the only alternatives are a no-op passthrough or an external CDN.
  Making it optional would save nothing in an Astro site and add a failure mode. (An earlier draft of this
  ADR suggested an optional peer; it is withdrawn.)

## Action Items

1. [x] Create `packages/config`: provider schemas, inferred types, `./providers` literals, `desc()`; add it to
       the `fixed` group, the `build:*` task graph and the scaffold check's package list.
2. [x] Re-export the moved names from `generator`; keep the umbrella `Config` there.
3. [x] Replace the `utils` and `astro` mirror types with config types; delete the ads enum-sync test.
4. [x] Add `worker-safe.test.ts` coverage for runtime imports of the config root.
5. [ ] Move `site.seo` into `config` and delete `GetvitopsSeoOptions`.
6. [ ] Decide whether `toCrmConfig`/`toGoogleAdsConfig` are removed in the next major.
