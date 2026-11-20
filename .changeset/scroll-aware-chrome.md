---
'@getvitops/config': minor
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
---

Scroll-aware chrome (new CSS: all formats).

- **Scroll states (BREAKING for `site.chrome.masthead`).** `masthead.states` describes the bar as a partial look per scroll state — `atStart`, `atEnd`, `scrollingToEnd`, `scrollingToStart`, later wins — with `layout`, `height`, `inset`, `surface`, `elevation` (or `false`) and `hidden`, and every change animates. That makes a full-width banner at the top that floats once scrolled, a bar hidden until first scroll (a hero fills the viewport), and hide-on-scroll all the same feature. A state that hides the bar at the start, or changes size or layout, implies `position: fixed`; the bar never hides while focused or a menu is open; Firefox (no `scroll-state()`) keeps the settled look. The vocabulary is shared (`SCROLL_STATES` / `scrollStateQuery()` from `@getvitops/config`; the custom-property hooks are `--<pattern>-<state>-<prop>`), and the page container is now named `page`.
  - **Migration** (`resolveMasthead` throws naming each): `behavior: "reveal-on-scroll"` → `states.atStart.hidden: true`; `behavior: "hide-on-scroll"` → `states.scrollingToEnd.hidden: true`; `surface: "transparent-until-scrolled"` → the settled `surface` plus `states.atStart.surface: "transparent"`; `elevation.onScroll` → `states.atStart.elevation: false`. The old `.masthead--hide-on-scroll` / `--transparent-until-scrolled` / `--shadow-on-scroll` / `--border-on-scroll` classes remain in the CSS as aliases for hand-written markup; `<Masthead>` no longer emits them.
- **`.scroll-edges`, `<ScrollEdges>`** (new `scroll-edges.css`): a horizontal strip that fades at an edge while there is more to scroll that way, using the same `at-start` / `at-end` states on the inline axis. Both fades show where `scroll-state()` is unsupported.
- **`<BackToTop>`, `site.chrome.backToTop`** (rendered by `<SiteFooter config={site}>`) and **`<ScrollCue>`** (`.back-to-top`, `.scroll-cue`, new `scroll-button.css`). Plain `#anchor` links; hidden by `scroll-state()` queries, always shown where unsupported.
- **`<Toc headings>`** and a scrollspy fallback: `polyfills.js` now loads a small IntersectionObserver (`scroll-target-group` polyfill) that sets `.is-current` and `aria-current="location"` where `:target-current` is missing. New polyfill name `scroll-target-group` is valid in `vitops({ polyfills: { disable } })`.
- **`vitops_hero`** gains `scrollCue` and `scrollCueLabel` fields.
