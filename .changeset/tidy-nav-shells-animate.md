---
'@getvitops/core': major
'@getvitops/astro': major
'@getvitops/generator': major
---

Nav shells, a top-layer animation driver, and a pile of fixes to things that never worked

### Breaking

- **Two custom elements renamed.** `<copy-button>` → `<wc-copy>`, `<multi-field>` →
  `<wc-multifield>`. Update your markup. The Bricks element keys
  (`vitops-copy-button`, `vitops-multi-field`) are **unchanged**, so elements already
  placed on a Bricks page keep working; so are the `--multi-field-*` custom properties
  and the `multi-field-*` events.
- **`<details>` now animates open and closed** where `prefers-reduced-motion` allows.
  It was previously instant by deliberate choice — the transition used to deadlock the
  disclosure shut. Re-verified on Chrome 149 with a real click; both `block-size` and
  `content-visibility` must stay in the transition list, and dropping the latter
  reproduces the deadlock.
- **Drawers and dialogs now animate on close.** Both drove their entry with
  `animation:` on `[open]`, which by construction plays once — so the close was
  instant. They now use the top-layer driver and animate both ways.
- **`.rhythm` gives every non-heading block heading-spacing before a heading.** The
  pairs used to enumerate `p` (later `p, pre, blockquote, table, dl, ul, ol`), so a
  heading after anything else got paragraph spacing. They are now defined by what a
  heading _is_ — `h1`–`h6` plus the `font-display` / `font-title` / `font-heading` type
  roles — and inverted to `:not(<heading>) + <heading>`. Expect slightly more space
  above headings that follow a code block, table, figure-like `<div>` or component.
- **`popover.css` no longer pins `[popover]:popover-open { opacity: 1 }`.** It never
  animated anything on its own, but it outranked `.transition` and made every
  top-layer fade impossible. Removing it is what lets the driver work.
- **`nav.css`'s `.drawer-menu` timing** now follows `--animation-duration` /
  `--custom-ease-out` instead of hand-set 0.4s / 0.7s.

### Fixed

- **`.sitenav--bp-sm` dropdowns could never open.** Its desktop block had drifted onto
  an older markup shape, selecting `.sitenav__disclosure > .sitenav__submenu` where the
  submenu is the disclosure's _sibling_. The four "intentionally parallel" breakpoint
  blocks are now one shared block behind a style query — `md`/`lg`/`xl` were
  byte-identical and only `sm` had rotted, which is exactly the drift the arrangement
  invited. 583 → 361 lines.
- **Hover dropdowns rendered off-screen.** A closed popover is not in the top layer but
  keeps the UA's `position: fixed`, and `.dropdown--show-on-hover` reset only `inset` —
  so the panel faithfully faded in ~3300px from its trigger. Now anchored to it, and it
  follows on scroll. Affects `.split-link--show-on-hover` too.
- **Horizontal overflow on narrow screens.** `.centered > *` floors at
  `min-inline-size: 0`; `body` gets `overflow-wrap: break-word`; `patterns/code.css`
  gains the `pre` rules it never had (`max-inline-size: 100%`, `overflow-x: auto`) and
  gives inline `<code>` `overflow-wrap: anywhere`. Note a scroll container does _not_
  zero its min-content contribution in Chrome, which is what made a single `<pre>` hold
  a 390px viewport open at 797px.
- **`.split-<a>-<b>` now publishes `--_flex-direction: row`.** Only `.flex-*` did, so
  `class="split flex-col md-split-1-2"` left the variable reading `column` at every
  width and a nested `.grouped` collapsed its borders on the wrong axis.
- **`.toc-layout` uses `minmax(0, 1fr)`** instead of a bare `1fr`, whose automatic
  minimum is min-content.

### Added

- **`patterns/navshell.css` + `<NavShell>` / `<NavShellToggle>`** — a navigation aside
  beside content at width, collapsing to a toggle and drawer below it. **It nests**: a
  site nav wrapping an on-this-page nav, each promoting at its own breakpoint, via a
  style query on an inherited flag rather than four copied blocks. Its content column
  is a container, so an inner shell measures the space it actually has. The toggle can
  live outside the shell (a site header) with `toggle="external"`.
- **`patterns/navbar.css`** — `.navbar` extracted from `nav.css`, where it was only
  half of that file's drawer⇄navbar pair, plus `--start` / `--center` / `--end`,
  `__spacer` and `--sticky` (old `.navbar-sticky` aliased).
- **A top-layer animation driver.** `animation.css` gained the fourth driver alongside
  `animate-view` / `animate-scroll` / `animate-trigger` / `transition`, and every effect
  gained an `open-<fx>` state variant. Overlays now state _where they start_
  (`--translate-x-from`) instead of owning a keyframe: `class="drawer drawer--right
open-fade-in"` composes slide and fade. Applied at zero specificity with identity
  defaults, so a popover that sets no effect vars is unchanged.
- **One scrim.** `--scrim` / `--scrim-filter` tokens and `.no-scrim` in `popover.css`,
  replacing 18 `::backdrop` blocks across seven partials. `.drawer--modeless` is aliased.
- **`<wc-marquee>`** — clones the content enough times to cover the track, so every gap
  matches including the seam. The CSS-only `.marquee` is unchanged and still works
  without it; the element only makes the spacing right. `--marquee-gap` added.
- **`--width-nav`** joins `--width-measure` / `-breakout` / `-spotlight` as the nav
  column width.
- **`.skip-link`** in `patterns/anchor-link.css`, using a clip rather than the
  `-100vw` idiom (which overflows in RTL and ignores the scrollbar gutter).
- **`.table-wrapper`** documented as the scroll wrapper for wide tables.

### Notes

- `patterns/nav.css` is marked legacy. Its header promised a Lit nav component that was
  never written and is not planned — the house pattern is native. Use `navbar`,
  `sitenav` or `navshell`; removal is a later change.
- `scroll-target.css`'s `.is-current` no longer claims to be a JS scroll-spy fallback.
  There is no such code; `:target-current` is the only working highlight, which today
  means Chrome.
- `elements.js` gains one element (`wc-marquee`), so the shared bundle is slightly
  larger for every consumer.
- A registered custom property's `initial-value` must be computationally independent —
  `16rem` is not, so `@property` silently drops the whole rule. `navshell` uses an
  inline fallback instead.
