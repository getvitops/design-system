# Site chrome: the masthead and nav behaviour

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`site.chrome` (`@getvitops/config`'s `ChromeSchema`) is where a site states how its top bar looks and
how its navigation behaves; `<Masthead>` and `<SiteNav>` (`@getvitops/astro`) read it through
`resolveMasthead()` / `resolveNavOptions()`, and a prop overrides one field for one layout. It is
git-owned design (`vitops.json`, promoted `dev → main`), not an EmDash admin setting: editors own the
menus and widget areas, the design owns how they present.

- **The name is deliberate.** `chrome`, and `masthead` for the bar itself. `<header>` is valid inside
  any section or article, so it does not identify the site bar; `banner` already means the
  announcement bar (`.banner`, `vitops_banner`) and is the ARIA landmark role auditors flag when it
  is written explicitly on a `<header>`. `<Masthead>` emits a plain `<header>` and never a `role`.
- **Three nav sizes are three menus, not three settings.** `primary-mobile`, `primary`, `primary-mega`
  (`sitenav.ts`'s `MENU_NAMES`) each render as their own tier in a width window; `site.chrome.nav`
  only tunes them. `compact: 'dropdown'` swaps the narrow drawer for an anchored columnar panel and
  emits `sitenav--panel-dropdown` **instead of** a `drawer-*` class — both are narrow-state rules at
  the same specificity, so emitting both would leave the winner to source order
  (`state-branch.test.ts` guards the shape).
- **Scroll behaviour is `states`: partial looks over a settled base.** The un-modified `.masthead`
  is visible, solid (or glass), elevated and in flow. `site.chrome.masthead.states` names a partial
  override per scroll state — `atStart`, `atEnd`, `scrollingToEnd`, `scrollingToStart`, later wins —
  with `layout`, `height`, `inset`, `surface`, `elevation` (or `false`) and `hidden`. The
  vocabulary is **shared, not the masthead's**: `SCROLL_STATES` / `scrollStateQuery()`
  (`@getvitops/config` `scroll-states.ts`) is the one place a state is tied to its `scroll-state()`
  query, and `.scroll-edges` (horizontal strips) uses the same words on the inline axis. A state's
  override is the custom property `--<pattern>-<state>-<prop>` (`--masthead-at-start-height`); the
  partial reads it inside the matching `@container page …` query and falls through to the settled
  value when it is unset, so **states only ever override and a browser without `scroll-state()`
  (Firefox today) keeps the settled, readable bar**. This used to be written the other way round —
  base clear, query reveals — which left such a browser with a transparent bar over body text
  forever; `masthead-fallback.e2e.ts` (a Firefox project) is the regression test. Three details
  bite: a state's custom properties are written on the **element**, not `:root`, because they
  reference element-level properties (`--_masthead-base`) a root declaration cannot resolve; the
  state `--_<state>-*` publish-then-chain in `masthead.css` relies on an unset `var()` being
  guaranteed-invalid so the chain falls through; and a state that hides the bar at the start, or
  changes size or layout, promotes it to `fixed` (a sticky bar would reflow the page at the
  threshold and flip back). A masthead with focus inside it, or an open popover/disclosure, never
  slides away, and `atStart.hidden` needs a page that can scroll. The masthead must never set `overflow` (clip/hidden) or a non-`none` `translate` when it has no states: the wide submenu and mega panels are absolutely positioned descendants that hang below the bar, and a clip cut them off in `floating` until this was caught. `behavior`, `surface:
  transparent-until-scrolled` and `elevation.onScroll` were replaced by `states`;
  `resolveMasthead` throws naming each move, and the old `.masthead--*-on-scroll` classes stay in
  the CSS as aliases for hand-written markup. Don't add a JS path for the missing browsers: the
  effect arrives with the feature, the degrade is already correct.
- **`height` and `inset` take fluid lengths, and are validated as a closed grammar.** Both are
  written into a `<style>` on `:root` (`mastheadRootCss()`), so `isSafeLength()` admits only
  numbers-with-units, `calc|clamp|min|max`, balanced parentheses — never `var()`, `url()`, `;` or
  braces. `cqi` resolves against `body` (the container the nav breakpoints use), `vw` against the
  viewport. `--masthead-inset` is written only for a non-`full` layout and always then (defaulted to
  `0.75rem`), because `--header-offset` adds it unconditionally and must agree with the element.
- **Config is read loosely, checked at runtime.** A plain `import site from './vitops.json'` types every
  enum as `string`, which a strict `Config` rejects (the `resolveOrganizationName` trap), so
  `ChromeSource` is structural and `resolveMasthead` validates each value against the schema's
  literal lists. Height, tone and shadow are also checked to be a plain length / role / name, because
  they are written into CSS.
- **Mega panels get rich content from widget areas.** `megaPanel={VitopsMegaPanel}`
  (`@getvitops/emdash/astro`) renders the area `mega-<last URL segment>`, or the item's
  `mega-area:<name>` class (which wins: labels are translated). The prop keeps `@getvitops/astro`
  free of a CMS dependency. Absent area, absent column.
- `site.navigation` (`activeTemplate`) is still unread by any renderer. This is not it.
