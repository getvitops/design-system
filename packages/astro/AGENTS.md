# @getvitops/astro

The Astro integration for the Vitops design system: a `getvitops()` integration, a `<Head />`
component, **tier-3 platform wrappers** for the framework's HTML/CSS patterns, and HTML/type
authoring helpers. See the root [`AGENTS.md`](../../AGENTS.md) for the shared **Component
architecture** (CSS framework → web components → platform wrappers) and the `@getvitops/*` toolchain.

## Integration + `<Head />`

`getvitops(opts)` (default export, `src/integration.ts`) wires the design system into an Astro build
via the `astro:config:setup` hook:

- **favicons + PWA** → generates favicons + `site.webmanifest` into `public/` (`@getvitops/utils`).
- **web-component runtime** → copies `@getvitops/core`'s prebuilt bundles (`polyfills.js`,
  `elements.js`, `deferred.js` + code-split chunks) into `public/vitops/`.
- **CSS (opt-in `css:`)** → generates the design-system CSS from `design-system.json` (via
  `@getvitops/vite` + the generator) and auto-injects it — no manual stylesheet import.
- **sitemap (opt-in `sitemap:`)** → registers the official `@astrojs/sitemap` (an **optional peer**,
  dynamically imported like `@tailwindcss/vite`) via `updateConfig({ integrations })`, and hands
  `<Head />` the href to link. Skipped with a warning when `site` is unset or `emdash()` is
  registered — EmDash serves its own DB-driven `/sitemap.xml` — and deferred to when the consumer
  already lists `@astrojs/sitemap` themselves, which is the documented escape hatch for the options
  `GetvitopsSitemapOptions` does not mirror.
- **analytics + consent (opt-in `analytics:` / `consent:`)** → resolves the provider tags via the
  pure `resolveAnalytics()` and bakes them into the virtual module for `<Analytics />`; copies
  `@getvitops/core`'s `consent.js` into `public/vitops/` for `<CookieConsent />`. Two options, not
  one, because **consent is not an analytics feature** — the gate is general (`data-consent` on any
  element) and a site can enable it with no analytics at all.

  The `consent.js` copy is deliberately **outside** the `webComponents` gate. That bundle decides
  whether third-party tags run, so switching off the element runtime must not switch off consent
  along with it; the failure mode is tags loading for everyone.

  **The option type is hand-declared, not re-exported.** Aliasing `SitemapOptions` would put an
  `@astrojs/sitemap` import (and transitively a `sitemap` one, via `SitemapItem`) into the published
  `.d.mts` — unresolvable for the consumers who don't install the optional peer, and `skipLibCheck`
  makes that fail _silently_ as `any` rather than loudly. Same reasoning as `css.format` narrowing
  the generator's `Format`. The handoff casts through `unknown` because the two disagree on
  `serialize`'s entry type (upstream's `changefreq` is the `EnumChangefreq` enum, ours the string
  union a consumer wants to write); the values are forwarded verbatim.

Resolved config is exposed through the `virtual:getvitops/head` module. `<Head />`
(`src/components/Head.astro`, imported by consumers as `@getvitops/astro/Head.astro`, placed in the
layout `<head>`) renders the favicon/PWA tags and the runtime scripts in canonical order —
`polyfills.js` (module + `modulepreload`) → `deferred.js` → `elements.js`.

**Polyfills come from `@getvitops/core`'s feature-detected loader** (`src/js/polyfills.ts`, shipped
as `polyfills.js` and loaded by `<Head />`) — it imports only the polyfills whose native feature is
actually missing, and reports failures via a `polyfills:degraded` event. There is **no** separate
`Polyfills` component (a former CDN-based one was removed as redundant).

## Components — tier-3 wrappers (must not require runtime JS)

Per the root AGENTS.md rule, these are **authoring conveniences**: they render the correct
markup/classes for pure-HTML/CSS patterns and **must not require runtime JS**. They build on native
platform features — Popover API, CSS Anchor Positioning, Invoker Commands (`command`/`commandfor`),
`<dialog>`, `<details>`, subgrid. **If a pattern needs JS, it belongs in `@getvitops/core` as a
`<wc-*>` web component**, and a wrapper here just emits its tag with the accessible fallback inside.

**Published generic tier** — exported as `@getvitops/astro/components/<Name>.astro`, depend only on
Astro + `@getvitops/utils` (the icon ones also on the optional `astro-icon` peer):

| component            | what it wraps                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `Subgrid`            | emits `<ul class="subgrid"><li>` from slotted children — styling is the `subgrid` pattern's    |
| `Cards`              | the same, with `card` on every item (composes `Subgrid`)                                       |
| `NodeRenderer`       | renders a `ContentNode` tree into markup at SSR time                                           |
| `Popover`            | native Popover API + CSS Anchor Positioning (`astro-icon`)                                     |
| `Details`            | native `<details>`/`<summary>` disclosure (`astro-icon`)                                       |
| `Drawer`             | native `<dialog>` + Invoker Commands (`command="show-modal"`, `closedby="any"`) (`astro-icon`) |
| `WebComponentLoader` | client-side lazy-register a specific `<wc-*>` (the JS path for a tier-2 web component)         |

`WebComponentLoader` is the one exception that ships a `<script>` — but it only **loads** a web
component (tier 2), it doesn't implement a pattern. Prefer letting `<Head />` load `elements.js`.

**A component may only emit classes every format emits unconditionally** — defined in
`@getvitops/core`'s CSS and _not_ in the generator's `TW_CLASH` list. Never a Tailwind utility:
Tailwind doesn't scan `node_modules`, so a class only it can emit is silently never generated —
even in a `tailwind`-format consumer — and `TW_CLASH` names (`grid`, `flex`, `sr-only`, …) are
deliberately stripped from the tailwind bundle in favour of Tailwind's own. Anything a pattern
doesn't cover goes in the component's scoped `<style>` (see `visually-hidden` in `Popover`/`Drawer`).

There is deliberately **no site-model layer** here. A `Nav`/`Submenu`/`Template`/`FormRenderer`/
`ContentInfo`/`SEO`/`Layout` set once lived in `src/`, bound to a bare `#site-config` specifier;
it was deleted (2026-07-27) because `#site-config` was defined nowhere, nothing exported it, and it
had rotted. If that layer is ever wanted again, two rules apply: a generic package must **take
config as an argument** rather than importing consumer global state (the old module-scope reads
froze their values at import time — use `Astro.locals` via integration middleware for `.astro` prop
defaults), and it must type against the **existing** `SiteConfig` from `@getvitops/generator`
(`src/site.ts`) instead of casting to `any`. Anything rebuilt has to land in `files` **and**
`exports` or it isn't reachable.

**`<Seo />` (`src/components/Seo.astro`) is the one sanctioned piece of that layer**, and it obeys
those rules rather than bending them: its config arrives as an **argument** — `getvitops({ seo })`
bakes the defaults into `virtual:getvitops/head`, the component reads `head.seo` and per-page props
override it — so nothing imports consumer global state, and no value is frozen at module scope. It
does **not** import `SiteConfig`; `GetvitopsSeoOptions` (`src/seo.ts`) deliberately mirrors that
schema's `seo` block field-for-field so an adapter would be a flat map, while staying
JSON-serialisable (it is `JSON.stringify`d into the virtual module — no functions, no `URL`s).
Resolution lives in the pure `resolveSeo()` and the component only renders its output; the version
this replaces fused the two, which is why it was never unit-tested and why its `<title>` drifted
from its `og:title`. It is in both `files` and `exports` — and so is `src/seo.ts`, which the shipped
component imports.

**`<Analytics />` and `<CookieConsent />` follow the same rules and one more.** Config arrives as an
argument (`getvitops({ analytics, consent })` → the virtual module), resolution lives in the pure
`resolveAnalytics()` (`src/analytics.ts`, unit-tested), and the components only render. Both are in
`files` **and** `exports`, and so is `src/analytics.ts`.

The extra rule is the one that matters: **a gated tag must never carry a live `src`.** It renders as
`<script type="text/plain" …data-src="…">`, so the browser neither parses the body nor fetches the
library and an ungated visitor's page issues no third-party request at all. Emitting a real `src`
would make the gate cosmetic while looking correct in the markup — `components/analytics.test.ts`
asserts there is exactly one `src=` in the file and that it belongs to the ungated branch.

Two things that look like omissions and are not: no `preconnect` (warming a third-party connection
during parse is the critical-path cost the `idle` strategy exists to avoid), and **basic** consent
mode for GA rather than Consent Mode v2 advanced (nothing reaches Google pre-consent, at the price of
modelled conversions). Provider cookie names live in `analytics.ts` and travel with the tag on
`data-consent-cookies`; a table of them in `@getvitops/core` would be a second copy to keep in step
with the generator's processor table.

**`analytics` also has a cross-package invariant.** `vitops legal` derives the cookie notice from the
_site config's_ `analytics` block, which is a different surface (the integration must not import
`SiteConfig`). A provider configured here and absent there is a tag the site runs and its own notice
never discloses, so when `legal` is configured too the integration reads that file and warns —
`undisclosedProviders()` in `integration.ts`. Adding a provider means touching **both**: here, and
`KNOWN_PROCESSORS` + `detectProcessorKeys` in `@getvitops/generator`'s `legal/providers.ts`.

All components live in `src/components/` (alongside `Head.astro`).

## Structured data — Schema.org / JSON-LD (`src/schemas/`)

The Schema.org / JSON-LD **structured-data markup** components live in `src/schemas/`. Each takes
typed props and emits a single `<script type="application/ld+json">` block at SSR time — inert
markup (no runtime JS), so it fits the tier-3 rule. One component per Schema.org type, e.g.
`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
`Breadcrumb`, `JobPosting`, `Course`, `Dataset`, `ProfilePage`, `QAPage`, `SoftwareApp`,
`Carousel`, … Drop one into a page's `<head>` (or via `<Head />`) with the entity's data.

**They stay orthogonal to `<Seo />`, and that split is deliberate.** These take **entity** data
(an organisation, a product, a recipe); `<Seo />` takes **page** data (this page's title, canonical,
share image). Fold them together and `<Seo />` needs an `organization` prop, a `localBusiness` prop,
… which is exactly how the deleted `SEO.astro` reached 276 lines and a `siteConfig.locations` import.
`Seo.astro` therefore emits no `ld+json` and imports nothing from here — `components/seo.test.ts`
asserts both. Consumers compose:

```astro
<Seo title={title} description={description} />
<Organization {...org} />
```

Skip a `WebPage` graph: it only restates the `<title>`/description/canonical a crawler already reads.

## Authoring helpers

The framework-agnostic content model + HTML helpers now live in **`@getvitops/utils`** (no Astro
dependency): the content-model types/guards (`Elmnt`/`Link`/`ContentNode`, `isElmnt`, …), i18n `t()`,
`partAttrs`, and the parse5 helpers (`parseRenderedSlots`, `toHtml`, `nodesToHtml`, `styleList`) —
used when authoring the components (e.g. `Subgrid` parses its rendered slots to re-emit per-child
attrs on the `<li>` wrappers). They're re-exported from this package's root (`@getvitops/astro`) for
back-compat, but new code should import them from `@getvitops/utils`.

## Conventions

- **No component may require runtime JS.** A feature-detected polyfill for a native CSS/HTML feature
  is fine (handled centrally by core's polyfill bundle); behaviour JS is not — build a web component.
- **Accessible fallback first.** The rendered markup must be usable without JS; a web component then
  parses + augments it (see `WCEntries` in `@getvitops/core`).
- Icons resolve through an injectable `iconResolver` (pass-through by default; the integration wires
  the site's icon set). Text is `Localizable`; resolve with `t(value, locale, defaultLocale)`.
- Deps use the workspace `catalog:`; `astro` is a peer (`>=7`) and `astro-icon` an **optional** peer
  (`>=1`, only for `Popover`/`Details`/`Drawer`). Versions independently of the `fixed`
  `core`/`generator`/`utils`/`cli`/`vite` group.
