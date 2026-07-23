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

| component                      | what it wraps                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `Subgrid`                      | emits `<ul class="grid"><li class="grid-rows-subgrid …">` from slotted children        |
| `Popover`                      | native Popover API + CSS Anchor Positioning                                            |
| `Details`                      | native `<details>`/`<summary>` disclosure                                              |
| `Drawer`                       | native `<dialog>` + Invoker Commands (`command="show-modal"`, `closedby="any"`)        |
| `Nav`, `Submenu`               | navigation (drawer / navbar / vertical), composing `Details` + `Drawer`                |
| `NodeRenderer`, `FormRenderer` | render a `ContentNode` / form data model into markup at SSR time                       |
| `Template`                     | dispatches a named `siteConfig.templates[id]` to `Nav`/`FormRenderer`/`NodeRenderer`   |
| `Cards`, `ContentInfo`, `SEO`  | content-layout + `<head>`/SEO wrappers                                                 |
| `WebComponentLoader`           | client-side lazy-register a specific `<wc-*>` (the JS path for a tier-2 web component) |

`WebComponentLoader` is the one exception that ships a `<script>` — but it only **loads** a web
component (tier 2), it doesn't implement a pattern. Prefer letting `<Head />` load `elements.js`.

All of the above live in `src/components/` (alongside `Head.astro`).

## Structured data — Schema.org / JSON-LD (`src/schemas/`)

The Schema.org / JSON-LD **structured-data markup** components live in `src/schemas/`. Each takes
typed props and emits a single `<script type="application/ld+json">` block at SSR time — inert
markup (no runtime JS), so it fits the tier-3 rule. One component per Schema.org type, e.g.
`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
`Breadcrumb`, `JobPosting`, `Course`, `Dataset`, `ProfilePage`, `QAPage`, `SoftwareApp`,
`Carousel`, … Drop one into a page's `<head>` (or via `<Head />`) with the entity's data; use them
alongside `SEO.astro`, which covers the `<meta>`/Open Graph tags.

## Authoring helpers

`html.ts` (parse rendered slots, build markup, `styleList`), `parts.ts` (`partAttrs`), `i18n.ts`
(`t()`), and the shared `types.ts` — used when authoring the components (e.g. `Subgrid` parses its
rendered slots to re-emit per-child attrs on the `<li>` wrappers). Re-exported from the package root.

## Conventions

- **No component may require runtime JS.** A feature-detected polyfill for a native CSS/HTML feature
  is fine (handled centrally by core's polyfill bundle); behaviour JS is not — build a web component.
- **Accessible fallback first.** The rendered markup must be usable without JS; a web component then
  parses + augments it (see `WCEntries` in `@getvitops/core`).
- Icons resolve through an injectable `iconResolver` (pass-through by default; the integration wires
  the site's icon set). Text is `Localizable`; resolve with `t(value, locale, defaultLocale)`.
- Deps use the workspace `catalog:`; `astro` is a peer (`>=7`). Versions independently of the
  `fixed` `core`/`generator`/`utils`/`cli`/`vite` group.
