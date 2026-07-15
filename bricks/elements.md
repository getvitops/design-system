# Vitops — Bricks Builder elements reference

Context for driving the Bricks Builder UI (e.g. Claude for Chrome). Describes every
repo-owned custom element: how it appears in the builder, what it renders, and each
control. Source of truth is `bricks/elements/*.php`; regenerate this file if those change.

## How they appear in the builder

- The elements are registered from `bricks/load.php` and grouped under a **"Vitops"**
  category pinned to the **top** of the element panel (add-element search also matches
  each element's keywords, listed per element below).
- Insert one by searching its **label** (e.g. "Split", "Carousel") or a keyword.
- Two rendering families:
  - **Web-component elements** render a Lit custom element (`<wc-*>`, `<copy-button>`, …)
    from `dist/elements.js`. On the frontend they progressively enhance; in the builder
    canvas most upgrade live, but a few (Image Compare, Split Panel) show their children
    **stacked** until the client-side upgrade runs — that's expected, not broken.
  - **CSS-pattern elements** (Split, Centered, Menu, Split Link) render plain markup
    styled by the framework CSS — no JS dependency.
- **Nestable** elements accept child elements dropped into them in the canvas; some seed
  starter children. **Non-nestable** elements are configured entirely through their
  controls.

## Two ways layout is configured

Some elements expose their layout through **controls**, others through **CSS classes you
type into the built-in "CSS classes" field** of the element. Where a modifier is a class,
it's called out under the element. Responsive suffixes on classes engage from a container
breakpoint: `-sm` = 30rem, `-md` = 48rem, `-lg` = 64rem, `-xl` = 80rem.

---

## Split — `vitops-split` (nestable)

Equal-width flex row (framework `.split`). Ships with two empty columns seeded.

- **Renders:** plain flex container. No JS.
- **Controls:**
  - **HTML tag** — `div` (default) / `section` / `article` / `aside` / `main` / `header` /
    `footer` / `nav`.
- **Ratio via CSS classes** (add in the "CSS classes" field, base class `split` is already
  applied): `split-1-2`, `split-2-1`, `split-1-3`, `split-3-1`, `split-1-4`, `split-4-1`,
  `split-2-3`, `split-3-2` — each accepts a `-sm/-md/-lg/-xl` suffix to engage from a
  breakpoint (e.g. `split-1-2-md`).
- **Keywords:** split, columns, ratio, flex, container, layout

## Centered — `vitops-centered` (nestable)

Named-track grid (framework `.centered`) that centers content in a reading `measure`
column; individual children opt into wider tracks. Starts empty. `rhythm` (vertical
spacing) is on by default.

- **Renders:** plain grid container. No JS.
- **Controls:**
  - **HTML tag** — same options as Split.
  - **Track widths** group:
    - **Measure (reading width)** — number+units, default `65ch` → `--width-measure`.
    - **Breakout width** — number+units, default `90ch` → `--width-breakout`.
    - **Spotlight width** — number+units, default `120ch` → `--width-spotlight`.
    - **Gutter** — text (accepts a clamp), placeholder `clamp(1rem, 4cqi, 3rem)` → `--gutter`.
- **Widen a child via CSS classes** (on the child element, not the container): `breakout`,
  `spotlight`, or `fullbleed`, each with optional `-sm/-md/-lg/-xl`. Default class on the
  container is `centered rhythm` — remove `rhythm` to disable vertical spacing.
- **Keywords:** centered, measure, grid, container, layout, track

## Carousel — `vitops-carousel` (nestable)

Infinite-loop carousel (`<wc-carousel>`) enhancing a CSS scroll-snap carousel. Each direct
child is a slide; three empty slides seeded.

- **Renders:** `<wc-carousel>`. Degrades to a non-looping scroll-snap carousel without JS.
- **Controls:**
  - **Autoplay interval (ms)** — number, empty/0 disables → `autoplay` attr.
  - **Accessible label (aria-label)** — text → `aria-label` attr.
- **Modifier CSS classes** (base `carousel` already applied): `carousel--scroll-buttons`,
  `carousel--scroll-markers`, `carousel--auto-pages`.
- **Keywords:** carousel, slider, slides, gallery, scroll

## Color Scheme Toggle — `vitops-color-scheme-toggle` (not nestable)

Segmented System / Light / Dark theme toggle (`<color-scheme-toggle>`), hidden until JS.

- **Renders:** `<color-scheme-toggle>`. Upgrades live in the canvas.
- **Controls:**
  - **Initial scheme** — `System` (placeholder default) / `Light` / `Dark` → `scheme` attr.
- **Keywords:** color, scheme, theme, dark, light, toggle

## Copy Button — `vitops-copy-button` (not nestable)

Copy-to-clipboard button (`<copy-button>`), hidden until the Clipboard API is available.

- **Renders:** `<copy-button>`. Upgrades live in the canvas.
- **Controls:**
  - **Value to copy** — text → `value` attr.
  - **Button label** — text, placeholder "Copy to clipboard" → `label` attr and button text.
- **Keywords:** copy, clipboard, button

## Dismissable — `vitops-dismissable` (nestable)

Wrapper (`<wc-dismissable>`) that fades out and removes itself when a descendant marked
`data-dismiss` is clicked. Seeds a content block + a close (×) button already carrying
`data-dismiss` and `aria-label="Dismiss"`.

- **Renders:** `<wc-dismissable>`. Content still renders without JS.
- **Controls:**
  - **Auto-dismiss after (ms)** — number, empty = require a click on a `[data-dismiss]`
    element → `duration` attr.
  - **Fade-out time (ms)** — number → `exit` attr.
- **Keywords:** dismiss, close, banner, notice, alert

## Entries — `vitops-entries` (nestable)

Adaptive data display (`<wc-entries>`) that projects heading + `<dl>` pairs into a table /
column view based on container width. Seeds one heading; author adds the `<dl>` (use a
Code / HTML child).

- **Renders:** `<wc-entries>`. Falls back to stacked heading + `<dl>` without JS.
- **Expected child structure:** repeated `<h3>Group title</h3>` followed by
  `<dl><dt>Label</dt><dd>Value</dd>…</dl>`.
- **Controls:**
  - **Breakpoint** — text, placeholder `40rem` → `breakpoint` attr (container width below
    which the projected/table view engages).
  - **Column projection (table)** — checkbox → `projection` attr.
  - **Singular (one row at a time)** — checkbox → `singular` attr (with projection + narrow,
    shows one row with nav).
- **Keywords:** entries, data, table, definition, list, dl

## Image Compare — `vitops-image-compare` (nestable)

Before/after comparison slider (`<wc-image-compare>`). Seeds two Image children tagged
`slot="before"` / `slot="after"`.

- **Renders:** `<wc-image-compare>`. Canvas shows the two images stacked until client-side
  upgrade.
- **Controls:**
  - **Initial position (%)** — number 0–100, default 50 → `position` attr.
  - **Vertical split** — checkbox → `vertical` attr.
  - **Discrete (step) dragging** — checkbox → `discrete` attr.
  - **Keyboard step (%)** — number → `keyboard-step` attr.
  - **Before label** — text, placeholder "Before" → `before-label` attr.
  - **After label** — text, placeholder "After" → `after-label` attr.
- **Keywords:** image, compare, before, after, slider

## Menu — `vitops-menu` (not nestable)

Responsive navigation built from a WordPress menu. No JS — native `<details>` accordions on
mobile promote to hover/focus/click pop-outs at the desktop breakpoint. Branch items render
as split-links.

- **Renders:** `<nav class="menu menu--bp-{sm,md,lg,xl}">` with the WP menu tree.
- **Controls:**
  - **WordPress menu** — select, populated from registered WP nav menus. (If none exist, an
    info notice points to Appearance → Menus.)
  - **Accessible label** — text, placeholder "Primary" → `aria-label` on the `<nav>`.
  - **Desktop breakpoint** — `sm — 30rem` / `md — 48rem` (default) / `lg — 64rem` /
    `xl — 80rem`: container width at/above which submenus become pop-out dropdowns.
  - **Desktop depth** — number, default 3: levels shown at/above the breakpoint (empty =
    unlimited).
  - **Mobile depth** — number, default 2: levels shown below the breakpoint; deeper
    toggles/markers hidden (empty = unlimited).
- **Keywords:** menu, nav, navigation, dropdown, megamenu, split

## Multi Field — `vitops-multi-field` (not nestable)

Form-associated repeatable input group (`<multi-field>`): add/remove entries with min/max.
Default entries become slotted `<input value="…">` children.

- **Renders:** `<multi-field>`. Upgrades live in the canvas.
- **Controls:**
  - **Field name** — text → `name` attr (submitted as `name[]` per entry).
  - **Input type** — text, placeholder `text` → `type` attr.
  - **Placeholder** — text → `placeholder` attr.
  - **Min entries** / **Max entries** — number → `min` / `max` attrs.
  - **Protect default entries** — checkbox → `protect-defaults` attr.
  - **Add / Clear / Delete button label** — text (placeholders "Add" / "Clear" / "Delete")
    → `add-label` / `clear-label` / `delete-label` attrs.
  - **Default entries** — repeater of `value` text fields → seeded `<input>` children.
- **Keywords:** multi, field, repeatable, form, input

## Split Link — `vitops-split-link` (nestable)

A "split button": a primary `<a>` flush with a toggle `<button>` that opens an anchored
Popover holding nestable content. Pure native platform (Popover API + CSS Anchor
Positioning), no Lit. Seeds one block for the popover content.

- **Renders:** `<div class="split-link">` with link, toggle button, and a `[popover]` panel.
  In the builder the panel renders **without** the `popover` attribute so it stays visible
  and droppable.
- **Controls:**
  - **Link text** — text, default "View".
  - **Link** — Bricks link control (href/target/rel).
  - **Toggle label (accessible name)** — text, placeholder "More options" → toggle
    `aria-label`.
  - **Toggle glyph** — text/HTML, placeholder `▾`: character inside the toggle; flips 180°
    while open.
  - **Placement** — select writing a `position-area` to `--split-link-area`: Top
    start/center/end-aligned, Inline-start (left), Center (over trigger), Inline-end
    (right), Bottom start/center/end-aligned. Default "Bottom · start-aligned".
  - **Panel gap** — number+units, placeholder `0.5rem` → `--split-link-gap`.
- **Keywords:** split, link, button, popover, dropdown, menu

## Split Panel — `vitops-split-panel` (nestable)

Resizable two-panel splitter with a draggable handle (`<wc-split-panel>`). Seeds two blocks
tagged `slot="start"` / `slot="end"`.

- **Renders:** `<wc-split-panel>`. Canvas shows the two columns stacked until client-side
  upgrade.
- **Controls:**
  - **Initial position (%)** — number 0–100, default 50 → `position` attr.
  - **Vertical (stack top/bottom)** — checkbox → `vertical` attr.
  - **Discrete (step) dragging** — checkbox → `discrete` attr.
  - **Min panel size (px)** — number, default 100 → `min-size` attr.
  - **Max panel size (px)** — number → `max-size` attr.
  - **Keyboard step (%)** — number → `keyboard-step` attr.
  - **Collapse threshold (%)** — number → `collapse-threshold` attr.
  - **Snap points (%)** — text, placeholder `25,50,75` → `snap-points` attr.
  - **Snap distance (%)** — number → `snap-distance` attr.
- **Keywords:** split, panel, resize, splitter, drag
