# ADR-0000: Architecture review, November 2026

**Status:** Accepted
**Date:** 2026-11-02
**Deciders:** Alex Gagnon

## Context

The toolchain is meant to be layered: a low "core" layer (scaffolding sites, configuring external
providers), a primitives layer (design tokens and UI patterns that are extensible per client and
produce fast, accessible sites), and higher layers that compose those into site types. EmDash is the
most common target, so an editor or agent should be able to build a page from the primitive patterns
through blocks (for example, insert a Carousel). This review checked whether the code matches that,
across package layering, EmDash block coverage, primitive extensibility, accessibility and a security
scan.

## Findings

| Principle                         | Grade | Summary                                                                                                                                                                                             |
| --------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layered packages, no cycles       | B-    | No workspace cycles, every import declared. But the layers are mislabelled — see [ADR-0001](0001-site-config-and-providers-packages.md).                                                            |
| Core infrastructure at the bottom | C     | `utils` mixes primitives, build tooling and provider integrations, and its Worker-safety rule was broken once.                                                                                      |
| Primitives extensible per client  | B+    | `patterns.items` and `colors.roles` are open, tokens cascade through per-pattern hooks, and unlayered client CSS beats the framework layers. The helpers for authoring a new `wc-*` are unexported. |
| Fast and accessible               | B+    | SSR, proven no-JS fallbacks, gzip budgets. Specific defects found below.                                                                                                                            |
| EmDash blocks over primitives     | D     | Six flat blocks reaching 4 of 19 elements, none of the repeating patterns, no nesting, absent from `TIERS`, invisible to agents.                                                                    |

## What was fixed in this pass

- **Security.** JSON-LD inlined as `JSON.stringify` could close its own `<script>` tag (24 schema
  components) — now `jsonLdScript()`. The EmDash link block accepted `javascript:` hrefs — now an
  allowlist. `createConversionRoute()` capped the body only by `Content-Length` and keyed its rate
  limit on a spoofable `X-Forwarded-For` — now a streamed cap and `trustForwardedFor`.
- **Boundaries.** `utils/notify` reached `node:crypto` through the Google token code; it now signs with
  Web Crypto, and `worker-safe.test.ts` walks every Worker subpath's import graph. `utils/ads` no
  longer re-exports Cloudflare network executors. `build:emdash` depends on `build:generator`.
- **EmDash.** Blocks are a tier (`TierEntry.emdash`, `tierPatterns('emdash')`), held to the pattern
  they render by `blocks.test.ts`. New blocks: gallery, cards, accordion, marquee; the carousel edits
  slides as a repeater. `vitopsEmdash({ blocks: { include, exclude, extra } })` selects and extends.
  `vitops docs components` and the docsite list them.
- **Accessibility.** `wc-entries`' focusable column selector is no longer `aria-hidden`; carousel and
  tree scrolling honour `prefers-reduced-motion`; six more elements declare a pre-upgrade `display`;
  a dismiss button no longer shows before it can work.

## Not done, and why

| Item                                                                      | Why it waits                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sharp`/`png-to-ico` as optional dependencies                             | **Withdrawn, not deferred.** The favicon pipeline is needed by essentially every site and Astro's own default image service is Sharp, so it is already in every Astro install. See ADR-0001.                                           |
| Export `BaseElement`/`RovingTabindex`/`DragController` from core          | `BaseElement` extends `LitElement`, and `elements.js` bundles its own Lit. A separate helper bundle would ship a second copy a client element then mixes with the first. Needs Lit as an external peer, which is a packaging decision. |
| `vitops_reviews`, `vitops_tree`, `vitops_entries` blocks                  | Reviews read `.vitops/reviews.json`, which on a Worker needs a build-time import rather than a filesystem read. Tree and entries need nested or structured data beyond a flat repeater.                                                |
| Layout blocks (section, split, hero)                                      | A Portable Text block cannot hold other blocks, and `vitops.*` blocks do not render inside EmDash's built-in `columns`. Layout belongs in an EmDash `blocks` field with its own component map; that is a template-level design.        |
| Real render tests for the block adapters                                  | The Astro container API fails inside `getViteConfig` on Astro 7.1.2 (see the root `vite.config.ts` exclusion). The adapters compile and are source-contract tested; `verify:scaffold` is the integration check.                        |
| DOM tests for `wc-consent`, `wc-image-compare`; e2e for cards and consent | Consent needs a cookie and event harness that does not exist yet. `wc-image-compare` is drag-driven shadow DOM. Playwright was not run in this pass.                                                                                   |
| `wc-image-compare` is shadow DOM                                          | AGENTS.md says tier-2 elements use light DOM. It is the one that does not. Either convert it or name it as an exception beside `wc-tree`, `wc-consent` and `wc-theme-editor`.                                                          |
| `nodesToHtml` does not validate tag or attribute names                    | Safe while every node tree is authored. Becomes a risk if CMS data ever reaches it; validate names before that happens.                                                                                                                |
| Astro's three structural mirrors (`seo.ts`, `ads.ts`, `tracking.ts`)      | They do not have the dependency-cycle excuse the utils mirrors have, so they can be deleted in favour of the generator types.                                                                                                          |

## Update, 2026-11 (later in the month)

Several rows in "Not done" have since closed, and the table above is left as written so the
history stays readable:

| Row                                                    | Status                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitops_reviews`, `vitops_entries` blocks              | Shipped. Reviews read the build-time `virtual:getvitops/reviews` module. `vitops_tree` is still open.                                                                                                                                                                                                     |
| Layout blocks (section, split, hero)                   | `vitops_section` shipped as a block type. Standalone split/hero types do not exist, and the template does not wire it yet.                                                                                                                                                                                |
| Real render tests for the block adapters               | Exist: `packages/emdash/vitest.container.config.ts` (`test:render`). Only the `packages/astro` container test is excluded.                                                                                                                                                                                |
| `nodesToHtml` does not validate tag or attribute names | Done: names (`assertTag`, attribute pattern, `on*` rejected), a tag denylist (`script`, `style`, `iframe`, `object`, `embed`, `template`, `base`, `meta`, `link`, …) and object-form `style` escaping. `toHtml`'s `El.text` is left unescaped on purpose: it is the `set:html` helper and has no callers. |
| Astro's three structural mirrors                       | Resolved by ADR-0001/0002. `seo.ts` stays on purpose: it is the _resolved_ shape.                                                                                                                                                                                                                         |
| DOM tests for `wc-consent`, `wc-image-compare`         | Done: `WCConsent.dom.test.ts` (17) and `WCImageCompare.dom.test.ts` (9). The latter found `position="…"` ignored on first render; fixed.                                                                                                                                                                  |
| `wc-image-compare` is shadow DOM                       | Done. Kept as shadow DOM and named as an exception in AGENTS.md beside `wc-tree`, `wc-consent` and `wc-theme-editor`.                                                                                                                                                                                     |

## Consequences

- The security and boundary fixes are small and shipped as changesets.
- The EmDash tier gives agents one place (`vitops docs components`) to learn which blocks exist, and
  gives the repo a test that fails when a block drifts from its pattern.
- The deferred items are tracked here rather than left implicit.
