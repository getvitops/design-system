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
| `Subgrid`            | emits `<ul class="grid"><li class="grid-rows-subgrid …">` from slotted children                |
| `Cards`              | content-layout wrapper (composes `Subgrid`)                                                    |
| `NodeRenderer`       | renders a `ContentNode` tree into markup at SSR time                                           |
| `Popover`            | native Popover API + CSS Anchor Positioning (`astro-icon`)                                     |
| `Details`            | native `<details>`/`<summary>` disclosure (`astro-icon`)                                       |
| `Drawer`             | native `<dialog>` + Invoker Commands (`command="show-modal"`, `closedby="any"`) (`astro-icon`) |
| `WebComponentLoader` | client-side lazy-register a specific `<wc-*>` (the JS path for a tier-2 web component)         |

`WebComponentLoader` is the one exception that ships a `<script>` — but it only **loads** a web
component (tier 2), it doesn't implement a pattern. Prefer letting `<Head />` load `elements.js`.

There is deliberately **no site-model layer** here. A `Nav`/`Submenu`/`Template`/`FormRenderer`/
`ContentInfo`/`SEO`/`Layout` set once lived in `src/`, bound to a bare `#site-config` specifier;
it was deleted (2026-07-27) because `#site-config` was defined nowhere, nothing exported it, and it
had rotted. If that layer is ever wanted again, two rules apply: a generic package must **take
config as an argument** rather than importing consumer global state (the old module-scope reads
froze their values at import time — use `Astro.locals` via integration middleware for `.astro` prop
defaults), and it must type against the **existing** `SiteConfig` from `@getvitops/generator`
(`src/site.ts`) instead of casting to `any`. Anything rebuilt has to land in `files` **and**
`exports` or it isn't reachable.

All components live in `src/components/` (alongside `Head.astro`).

## Structured data — Schema.org / JSON-LD (`src/schemas/`)

The Schema.org / JSON-LD **structured-data markup** components live in `src/schemas/`. Each takes
typed props and emits a single `<script type="application/ld+json">` block at SSR time — inert
markup (no runtime JS), so it fits the tier-3 rule. One component per Schema.org type, e.g.
`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
`Breadcrumb`, `JobPosting`, `Course`, `Dataset`, `ProfilePage`, `QAPage`, `SoftwareApp`,
`Carousel`, … Drop one into a page's `<head>` (or via `<Head />`) with the entity's data; use them
alongside `SEO.astro`, which covers the `<meta>`/Open Graph tags.

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
