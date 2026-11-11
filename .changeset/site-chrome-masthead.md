---
'@getvitops/config': minor
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
'@getvitops/create': minor
---

**Added: `site.chrome` — a configurable masthead and nav behaviour.** Non-breaking.

- `site.chrome.masthead` (new `@getvitops/config` schema): `position` (`static|sticky|fixed`), `behavior` (`always|hide-on-scroll`), `surface` (`solid|glass|transparent|transparent-until-scrolled`), `tone` (a `colors.roles` key), `layout` (`full|inset|floating`), `width`, `elevation` (`shadow`, `border`, `onScroll`), `height` and `inset`. `height` and `inset` take fluid lengths (`calc()`, `clamp()`, `min()`, `max()`, with `cqi`/`vw`/… units), checked against a closed grammar because they are written into CSS. `validateConfig` rejects a `tone` or `shadow` the design system does not define (only when the default theme states them directly, not via `extends`).
- `site.chrome.nav`: `compact` (`drawer|dropdown`), `drawerSide`, `breakpoint`/`mobileBreakpoint`/`megaBreakpoint`, `depth`, `megaDepth`.
- `<Masthead config={site}>` (`@getvitops/astro`, slots `brand`/default/`actions`) and `resolveMasthead()` / `resolveNavOptions()`. A prop overrides one field per layout. The key is `chrome`/`masthead` on purpose: `<header>` is valid in any section and `banner` already means the announcement bar and the landmark role.
- `<SiteNav>` gains `compact="dropdown"` (a columnar panel anchored under the toggle), `drawerSide` (previously hardcoded to the end edge in Astro), `megaDepth` and `megaPanel`. `.sitenav--mega` now styles second-level items as column headings and has an optional featured column.
- `@getvitops/emdash`: `VitopsMegaPanel` fills that column from the widget area `mega-<item url slug>` (or a `mega-area:<name>` class on the menu item). No area means no column.
- `@getvitops/create` (emdash template): the layout renders through `<Masthead>`; `site.json` ships a sticky glass masthead with a shadow once scrolled. The hand-written `.navbar { block-size: 64px }` is gone (use `masthead.height`).
- CSS (`patterns/masthead.css`, `patterns/sitenav.css`): **all formats**, including tailwind, where the patterns are inlined into `@layer components`. Hide-on-scroll and the `*-on-scroll` states are `scroll-state()` container queries that only subtract from a settled (solid, elevated, visible) bar, so a browser without them (Firefox today) shows that bar rather than a transparent one. A sticky or fixed masthead sets `--header-offset` / `--top-offset` so anchors land below it.
- `@getvitops/generator`: new `TIERS.masthead`; `TIERS.sitenav` documents the new props.
