---
'@getvitops/generator': major
'@getvitops/astro': major
'@getvitops/utils': major
'@getvitops/core': major
'@getvitops/vite': major
'@getvitops/cli': major
---

**Breaking:** the site config is now a three-section `Config` — `designSystem`,
`organization`, `site`.

The flat `SiteConfig` held the company (`organization`, `contact`, `locations`) and the
deployment (`analytics`, `environments`, `seo`, `legal`) as peers, so no single noun
described it, and a second site sharing the same company had no way to say so. The three
sections split those apart: several sites can now carry one `organization` and differ only
in `site`.

**Migrating.** `designSystem` stays at the root, and the fields already under
`organization` stay where they are. Everything else moves into one of two sections:

- → `site`: `defaultLocale`, `locales`, `domains`, `dns`, `cloudflare`, `environments`,
  `abTesting`, `fonts`, `tags`, `postTypes`, `galleries`, `testimonials`, `templates`,
  `navigation`, `seo`, `analytics`, `notifications`, `tracking`, `security`, `legal`,
  `icons`, `favicon`, `deployment`
- → `organization`: `contact`, `primaryLocation`, `locations`, `services`, `links`

You do not have to work this out from the list: `vitops validate` detects a pre-3.0 flat
config and prints every move by name, rather than reporting a dozen unknown keys.

```jsonc
{
  "designSystem": {
    "themes": {
      "default": {
        /* … */
      },
    },
  },
  "organization": {
    "name": "Acme",
    "contact": "hq",
    "locations": {
      "hq": {
        /* … */
      },
    },
  },
  "site": {
    "defaultLocale": "en",
    "domains": {
      /* … */
    },
    "analytics": {
      /* … */
    },
  },
}
```

**Renamed exports** (`@getvitops/generator`): `SiteConfigSchema` → `ConfigSchema`,
`SiteConfig` → `Config`, `validateSite` → `validateConfig`, `resolveSiteConfig` →
`resolveConfig`, `isSiteConfig` → `isConfig`, `siteJsonSchema` → `configJsonSchema`,
`SITE_SCHEMA_URL` → `CONFIG_SCHEMA_URL`, `SiteValidationResult` →
`ConfigValidationResult`. `ResolvedInput.site` is now `ResolvedInput.config`. New:
`OrganizationConfig` and `SiteSection` for the two sections.

**Renamed schema file:** `@getvitops/generator/site.schema.json` →
`@getvitops/generator/config.schema.json`. Update the `$schema` key in your config.

Option names are unchanged — `vitops({ site: { input } })`, the Vite plugin's `site`,
and `generate({ site })` still point at the config file.

**The Astro integration is now `vitops()`, not `getvitops()`.** It is a default export,
so the name is yours and nothing breaks on upgrade, but every example now reads
`import vitops from '@getvitops/astro'` — matching the Vite plugin, which has always been
`vitops`. The `@getvitops/*` package scope and the internal `virtual:getvitops/*` module
ids are unchanged; neither is an import name.

**Added:** a generated config authoring reference — `vitops docs config`, `docs/config.md`
in the OKF bundle, and _Config reference_ on the docs site. It is walked from the published
JSON Schema by the same helper that renders the `design-system.json` reference, so it
cannot describe a field validation does not accept.
