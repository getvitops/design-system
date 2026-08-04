---
title: Your config
description: The three-section config — designSystem, organization and site — what belongs in each, and which commands read it.
section: 'Start here'
order: 30
---

A `design-system.json` describes your **tokens**. Once a project needs more than tokens — a privacy
policy, an icon set, a canonical domain, a Search Console property — it wants a **config**: one
document that describes the whole project.

```json title="site.json"
{
  "$schema": "./node_modules/@getvitops/generator/config.schema.json",
  "designSystem": { "themes": { "default": { "colors": { "…": "…" } } } },
  "organization": { "name": "Acme", "email": "hello@acme.ca" },
  "site": {
    "defaultLocale": "en",
    "locales": { "en": { "name": "English" } },
    "environments": { "production": { "url": "https://acme.ca" } }
  }
}
```

Name the file whatever suits you — `site.json`, `company.json`, `vitops.config.json`. It is
recognised by **shape, not filename**: a document with a top-level `designSystem` key is a config,
one without it is a bare `design-system.json`. Nothing breaks when you rename it.

## The three sections

| Section | Holds | Changes when |
| --- | --- | --- |
| `designSystem` | the token set — named themes, which theme, which appearance | the brand's design changes |
| `organization` | the company — name, contact, locations, services, public profiles | the company changes |
| `site` | this published site — locales, domains, environments, templates, SEO, analytics, legal, icons, favicon, deployment | this site changes |

The split is not filing for its own sake. It is what makes the multi-site case expressible: a
marketing site and a support site can carry the **same** `organization` and differ only in `site`.

It is also what the generated legal documents rest on. A privacy policy asserts facts about the
*company* — who a privacy request goes to, where it is held — and facts about the *site* — which
forms exist, which analytics run, whether cookies are set. Those two are separately true, and
keeping them in separate sections is why changing your analytics provider cannot accidentally
rewrite your registered address.

## One file, or two

`designSystem` is a full design system, so a config can stand in for a `design-system.json`
**anywhere the toolchain takes one** — `--input`, the Vite plugin, the Astro integration's
`css.input`. They are told apart by shape, so there is nothing to configure.

```js title="astro.config.mjs"
import vitops from '@getvitops/astro';

export default defineConfig({
  integrations: [vitops({ css: { input: 'site.json', format: 'css' }, legal: {} })],
});
```

Pointing `css.input` at a config is what lets `legal: {}` be the whole declaration — it defaults
its own input to the same file. Keeping the two files separate works too; point `css.input` at
`design-system.json` and name the config once via the top-level `site` option.

## What reads it

| Command | Reads |
| --- | --- |
| `vitops legal` | `site.legal`, `site.templates`, `site.analytics`, `organization` |
| `vitops icons` | `site.icons` |
| `vitops indexing` | `site.seo.indexing`, `site.environments`, `site.domains` |
| `vitops validate` | all of it — shape plus the cross-field integrity a JSON Schema can't express |

Everything else (`generate`, `docs`, `lint`) needs only the tokens, and accepts either kind of file.

## Upgrading from a flat config

Before 3.0 this was one flat document. If you have one, don't work through a migration table by
hand — run `vitops validate` and it names every move:

```
this is the pre-3.0 flat site config. The top level is now three sections —
`designSystem`, `organization`, `site` — and these keys moved:
  defaultLocale → site.defaultLocale
  analytics     → site.analytics
  locations     → organization.locations
```

`designSystem` stays at the root — it is what tells a config apart from a bare design system — and
the fields already inside `organization` stay where they are.

The [Config reference](/reference/config/) documents every field, rendered from the published JSON
Schema so it always matches what validation accepts.
