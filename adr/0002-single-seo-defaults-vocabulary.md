# ADR-0002: One vocabulary for site-level SEO defaults

**Status:** Accepted (implemented 2026-11-04)
**Date:** 2026-11-03
**Deciders:** Alex Gagnon

## Context

Site-level SEO defaults are described twice, in two shapes, and only one of them does anything.

|                                                              | `site.seo` (config schema, `packages/generator/src/config.ts`)                                                        | `GetvitopsSeoOptions` (`packages/astro/src/seo.ts`)                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Read by                                                      | `robots`, `indexing` only (`robots.ts`, `search notify`, `validateConfig`)                                            | `<Seo />`, through `vitops({ seo })` baked into `virtual:getvitops/head`            |
| `titleTemplate`, verification tokens, `openGraph`, `twitter` | declared, **consumed by nothing**                                                                                     | consumed                                                                            |
| Title / description defaults                                 | `descriptionTemplate` (no title default)                                                                              | `defaultTitle`, `defaultDescription`                                                |
| Site name                                                    | `openGraph.siteName`                                                                                                  | top-level `siteName`                                                                |
| Open Graph                                                   | `type`, `siteName`, `title`, `description` (localizable), `image` (string or `{ src, alt, width, height }`), `locale` | `type`, `locale`, `localeAlternates`, `image` (`{ url, alt, width, height, type }`) |
| Twitter                                                      | `card`, `site`, `creator`, `title`, `description`, `image`                                                            | `card`, `site`, `creator`                                                           |
| Text values                                                  | `Localizable` (string or per-locale map)                                                                              | plain strings                                                                       |

So a client who fills in `site.seo.titleTemplate` (the documented place) gets no effect, and one who sets
`vitops({ seo })` in `astro.config.mjs` has SEO defaults that the legal documents, `robots`, `search notify`
and every non-Astro stack cannot see. The two have also drifted in field names and shapes, so this is not a
mechanical type move.

The layering rule from ADR-0001 applies: a type the executor accepts and the document `validateConfig`
accepts should be one type. Here the executor (`<Seo />`) and the document disagree about what exists.

## Decision

**`site.seo` is the single source. `GetvitopsSeoOptions` stops being a hand-written interface.**

1. **Schema in `@getvitops/config`.** Add `SeoSchema` (the whole `site.seo` object, including the existing
   `indexing` block) to the leaf package, and have the generator's `SiteSchema` import it. The schema is the
   superset of the two columns above:
   - keep the config names where they are already published (`titleTemplate`, `robots`, verification tokens,
     `openGraph`, `twitter`, `indexing`);
   - add what only the integration had (`defaultTitle`, `defaultDescription`, `openGraph.localeAlternates`,
     `openGraph.image.type`), and fold `descriptionTemplate` into `defaultDescription` (nothing reads it);
   - `siteName` is `organization.name` unless `site.seo.siteName` overrides it, so most sites state it once.
2. **A resolver, not a mirror.** `@getvitops/astro` gains `resolveSeoDefaults(config, locale)`: it takes the
   parsed `Config` (the Worker-safe `import type` rule already used by `config-adapters.ts`), resolves each
   `Localizable` for the build locale, and returns a plain JSON-serialisable object. That output type is
   internal (`ResolvedSeoDefaults`); it is derived from the schema with `Localizable` replaced by `string`, so
   the shape cannot drift. `resolveSeo()`/`<Seo />` consume it unchanged.
3. **Where the input comes from.** `vitops({ site: { input } })` already reads the site config (locales,
   legal, icons). `seo` defaults then come from there with no extra option. `vitops({ seo })` stays as an
   _override_ merged over the config (so an app can still set one field in code), typed as
   `DeepPartial<ResolvedSeoDefaults>`. With neither a config nor an option, behaviour is unchanged.
4. **Per-environment robots stays as it is.** `site.environments.<env>.robots` already wins over
   `site.seo.robots` in `robots.ts` and `search notify`; `<Seo />` should read the same resolved value, which
   closes a third place that could disagree (a staging page emitting `index` while `robots.txt` says
   `Disallow`).
5. **No rename, so nothing to deprecate.** As built, `GetvitopsSeoOptions` keeps its field names — they became
   the names in `site.seo` — and is now documented as the _resolved_ shape; `vitops({ seo })` still accepts
   it unchanged. What was removed is the dead config surface: `descriptionTemplate` (→ `defaultDescription`),
   `openGraph.siteName`/`title`/`description` and `twitter.title`/`description`/`image` (per-page values, not
   defaults; nothing read them, and no existing client config set them).

## Options considered

### A: Leave both, document that `site.seo` display fields do nothing

Lowest cost, and wrong: the schema and the generated `config.md` reference keep advertising fields with no
effect. Rejected.

### B: Delete the display fields from `site.seo`, keep `GetvitopsSeoOptions` as the only vocabulary

Removes the dead fields cheaply, but leaves SEO defaults unreachable from the config — the opposite of the
direction the rest of the toolchain moved (one document describes the site). Also loses localisation:
`GetvitopsSeoOptions` takes single strings on a toolchain that already models locales. Rejected.

### C: `site.seo` is the source; the integration derives its options (this ADR)

One vocabulary, localisable, visible to every stack and to the legal/robots tooling. Costs a schema change
(additive, pre-1.0 alpha group, so a minor) and a resolver.

### D: Move `GetvitopsSeoOptions` into `@getvitops/config` as-is and make `site.seo` an alias

Cheapest type move, but it freezes the integration's non-localisable shape into the document schema and keeps
two names for one thing. Rejected.

## Consequences

- **Easier:** one place to set title template, OG defaults and verification tokens; `vitops docs config`
  becomes truthful; EmDash sites (where `<EmDashHead>` owns per-page tags) can still take verification tokens
  and the OG fallback image from config.
- **Harder:** the config schema grows by about four fields and `Localizable` resolution moves into the
  integration. `<Seo />` tests need a resolved-defaults fixture instead of a literal options object.
- **Revisit:** `organization.name` as the default `siteName` — confirm it is the brand name, not the legal
  name, for the existing client configs before relying on it.

## Action items

1. [x] Inventory (only this repo's docs site sets `vitops({ seo })`; no client `site.json` sets any `site.seo` display field) every existing consumer of `vitops({ seo })` (the two templates do not set it; check
       `vitops-website` and `vitops-portal`) to size the migration.
2. [x] Add `SeoSchema` to `@getvitops/config` with the merged fields; point `SiteSchema` at it; regenerate
       `config.schema.json` and the docs bundle.
3. [x] Write `resolveSeoDefaults(config, locale)` in `@getvitops/astro` with tests over `Localizable`,
       per-environment `robots`, and `organization.name` fallback.
4. [x] Make the integration read it from `site.input`; merge `vitops({ seo })` over it; warn on the old names.
5. [x] Replace the `seo.ts` interface with the derived type; keep a deprecated alias.
6. [x] Add a drift test: every `site.seo` display field is read by `resolveSeoDefaults` (the guard that was
       missing, and the reason four fields went unused).
7. [x] Changeset with the field-by-field migration table; note it in the root `CHANGELOG.md`.
