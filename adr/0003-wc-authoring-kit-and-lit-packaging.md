# ADR-0003: Whether to export the web-component authoring helpers (and so how Lit is packaged)

**Status:** Accepted — keep the status quo; revisit on a stated trigger.
**Date:** 2026-11-11
**Deciders:** Alex Gagnon

## Context

`@getvitops/core` has three helpers a client's own `<wc-*>` element would want: `BaseElement` (a Lit element
with signals), `RovingTabindex` (a Lit reactive controller, used by the carousel, tree and tabs) and
`DragController` (used by the split panel and image compare). They are collected in
`src/web-components/index.ts`, but that file is not a package export: `package.json` exposes only the built
bundles (`./elements`, `./consent`, `./editor`, `./polyfills`, `./deferred`) and `./css/*`. So a client
cannot import them.

The obstacle is Lit. `BaseElement` extends `LitElement` and `RovingTabindex` is a `ReactiveController`, and
`elements.js` **bundles its own copy of Lit** (`deps.alwaysBundle` covers `/^lit/` and `@lit-labs/*` in
`packages/core/vite.config.ts`; Lit is only a devDependency). That is deliberate: the output resolves
standalone in a browser with no import map and no bundler on the consumer's side. It also means that
exporting the helpers as their own bundle would ship a **second** Lit, and a client element mixing the two
would run two copies of Lit's runtime on one page (Lit warns when it detects this). Today `elements.js` is
about 31.5 KB gzipped, most of it Lit and the helpers.

## Options

- **A. A shared chunk and a `./kit` export.** Split Lit and the helpers into one chunk that `elements.js` and
  a new `./kit` entry both import, so a client element and ours share one Lit. No consumer setup. Costs: the
  chunk becomes a published, versioned file (`@getvitops/astro` copies the installed core's bundles into
  `public/` and would have to copy the chunk too, as would the Bricks payload, which enqueues the JS as
  modules); the size budget in `lib/verify-bundle-size.ts` needs rethinking per entry; and the `fixed`
  version group, which exists so the CSS and the components agree, now also has to cover a file a client's
  own code imports.
- **B. Lit as an external peer dependency, with an import map.** Smallest bundles, one Lit if the consumer
  resolves it once. Costs: every consumer must provide Lit and an import map (or a bundler that does), the
  standalone-in-the-browser property is lost, and a consumer's Lit version can now disagree with ours.
- **C. Status quo.** Nothing exported.
- **D. A client writes a plain `HTMLElement` custom element** and does not use the helpers. This is already
  how `<wc-consent>` and `<wc-theme-editor>` are written, for the reason in AGENTS.md (no rendering framework
  for a site that needs consent). It needs no change here. The cost is that a client re-implements roving
  focus or dragging, or copies the pure parts.

## Decision

**C, with D as the supported route today.** No client site has asked for a custom element, so any packaging
work would be built against an imagined need, and each of A and B changes something every consumer
depends on (what gets copied into `public/`, what the version lock protects, whether a page needs an import
map). The cost of waiting is only that the first client who wants one writes it as plain `HTMLElement`.

## Trigger to revisit

The first client request for a custom element that genuinely needs one of the helpers (arrow-key focus
management, a drag interaction). Then do **A**, not B: B trades the standalone-bundle property that makes
the framework easy to drop into Bricks and EmDash for a smaller file, and A keeps it. Before doing A, settle
how `@getvitops/astro`'s copy step and the Bricks payload carry a shared chunk, and give the `./kit` entry
its own budget in `verify-bundle-size.ts`.

## Consequences

- The three helpers stay internal. Their only consumers are the elements in this repo, so they can change
  shape without a major version.
- `index.ts` stays as a convenience for those elements, and is not documentation of a supported surface.
- The pure parts (`keynav.ts`, `tabs.ts`, `combobox.ts`, `range.ts`, `format.ts`) are plain functions with
  tests and no Lit dependency, so they are the cheapest thing to export first if the decision changes.
- ADR-0000's "Export `BaseElement`/`RovingTabindex`/`DragController` from core" row is resolved by this one.
