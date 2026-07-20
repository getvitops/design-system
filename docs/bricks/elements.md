---
type: "Bricks Elements Reference"
title: "Vitops — Bricks Builder elements reference"
description: "Every repo-owned Bricks element, its controls, defaults, seeded children and keywords, for driving the Bricks Builder UI."
resource: "bricks/elements"
tags: [bricks, wordpress, elements, design-system]
generator: lib/generate-docs.ts
---

# Vitops — Bricks Builder elements reference

Context for driving the Bricks Builder UI (e.g. Claude for Chrome). Every section below
is generated from the element's own source, so this reference always matches the elements
currently deployed. See also the CSS class vocabulary in [/css/classes.md](../css/classes.md)
and the integration guidance in [/bricks/index.md](index.md).

## How they appear in the builder

- The elements register from `dist/bricks/load.php` and group under a **"Vitops"** category
  pinned to the **top** of the element panel. Insert one by searching its **label** (e.g.
  "Split", "Carousel") or any of its **keywords** (listed per element).
- Two rendering families:
  - **Web-component elements** render a Lit custom element (`<wc-*>`, `<copy-button>`, …)
    from `dist/elements.js` and progressively enhance. A few (Image Compare, Split Panel)
    show their children stacked in the builder canvas until the client-side upgrade runs —
    that is expected, not broken.
  - **CSS-pattern elements** (Split, Centered, Menu, Split Link) render plain markup styled
    by the framework CSS — no JS dependency.
- **Nestable** elements accept child elements dropped into them; some seed starter children
  (listed as "Seeded children"). **Non-nestable** elements are configured entirely through
  their controls.

## Configuring layout

Some layout is set through **controls**; some through **CSS classes typed into the element's
built-in "CSS classes" field** (called out per element as modifier classes). Responsive
suffixes on those classes engage from a container breakpoint: `-sm` = 30rem, `-md` = 48rem,
`-lg` = 64rem, `-xl` = 80rem.

Each control below lists its type, default/placeholder, any select options, and the CSS
custom property it writes (when it drives one). Info notes flagged _Note:_ carry the
modifier-class and structural guidance from the element itself.

---

## Split — `vitops-split` · nestable

A nestable flex row rendering the framework's `.split` (src/css/layout.css) — equal
columns by default. Set a ratio by adding a class in the CSS-classes field:
`split-1-2` / `2-1` / `1-3` / `3-1` / `1-4` / `4-1` / `2-3` / `3-2`, each with an
optional `-sm/-md/-lg/-xl` suffix to engage the ratio from a container breakpoint.

The `.split` base rides on the built-in "CSS classes" setting (defaulted below) so it
shows in the builder canvas (assembled from settings) and the frontend.

**Controls**

- **HTML tag** (select, default `div`) — Options: `div`, `section`, `article`, `aside`, `main`, `header`, `footer`, `nav`.
- _Note:_ Equal columns by default. Add a class in "CSS classes" for a ratio: split-1-2, 2-1, 1-3, 3-1, 1-4, 4-1, 2-3, 3-2 (append -sm/-md/-lg/-xl to engage it from a breakpoint).

**Base CSS class:** `split` (applied automatically; add ratio/modifier classes alongside it in the element's "CSS classes" field).

**Seeded children:** Column 1, Column 2.

**Keywords:** split, columns, ratio, flex, container, layout.

---

## Centered — `vitops-centered` · nestable

A nestable container that renders the framework's named-track grid, `.centered`
(src/css/layout.css). Children auto-place in the reading `measure` track; a child
widens by adding `breakout` / `spotlight` / `fullbleed` (+ responsive `-sm/-md/-lg/-xl`)
in its own Bricks "CSS classes" field.

The framework classes ride on the built-in "CSS classes" setting (defaulted below):
a nestable element's root is assembled from settings in the builder canvas, so classes
added only in render()/set_root_attributes() never appear there — _cssClasses does.

**Controls**

- **HTML tag** (select, default `div`) — Options: `div`, `section`, `article`, `aside`, `main`, `header`, `footer`, `nav`.
- **Measure (reading width)** (number+units, default `65ch`) — Bound to `--width-measure`.
- **Breakout width** (number+units, default `90ch`) — Bound to `--width-breakout`.
- **Spotlight width** (number+units, default `120ch`) — Bound to `--width-spotlight`.
- **Gutter** (text, placeholder `clamp(1rem, 4cqi, 3rem)`) — Bound to `--gutter`.

**Base CSS class:** `centered rhythm` (applied automatically; add ratio/modifier classes alongside it in the element's "CSS classes" field).

**Keywords:** centered, measure, grid, container, layout, track.

---

## Carousel — `vitops-carousel` · nestable

Renders the <wc-carousel> Lit component (src/web-components/WCCarousel.ts): an
infinite-loop carousel that progressively enhances the CSS-only `.carousel`. Each
direct child is a slide. Without JS the `.carousel` classes still yield a working
(non-looping) scroll-snap carousel, so the builder canvas stays functional.

The `.carousel` base rides on the built-in "CSS classes" setting (defaulted below) so
it applies in the canvas and the frontend. Add modifier classes there:
`carousel--scroll-buttons`, `carousel--scroll-markers`, `carousel--auto-pages`.

**Controls**

- **Autoplay interval (ms)** (number, placeholder `0`) — Milliseconds between slides. Leave empty / 0 to disable.
- **Accessible label (aria-label)** (text)
- _Note:_ Add modifier classes in "CSS classes": carousel--scroll-buttons, carousel--scroll-markers, carousel--auto-pages. Each direct child is a slide.

**Base CSS class:** `carousel` (applied automatically; add ratio/modifier classes alongside it in the element's "CSS classes" field).

**Seeded children:** Slide 1, Slide 2, Slide 3.

**Keywords:** carousel, slider, slides, gallery, scroll.

---

## Color Scheme Toggle — `vitops-color-scheme-toggle` · not nestable

Renders the <color-scheme-toggle> Lit component (src/web-components/WCColorSchemeToggle.ts):
a segmented System / Light / Dark theme toggle, hidden until JS loads. Optionally seed
the initial `scheme`.

Non-nestable: PHP render() runs in the builder canvas too, so the toggle upgrades
live while editing.

**Controls**

- **Initial scheme** (select, placeholder `System`) — Options: `System`, `Light`, `Dark`.

**Keywords:** color, scheme, theme, dark, light, toggle.

---

## Copy Button — `vitops-copy-button` · not nestable

Renders the <copy-button> Lit component (src/web-components/WCCopy.ts): a
copy-to-clipboard button, hidden until connected (Clipboard API gate). The `value`
is copied; `label` is the button text (falls back to slotted text).

Non-nestable: PHP render() runs in the builder canvas too, so the button upgrades
live while editing.

**Controls**

- **Value to copy** (text)
- **Button label** (text, placeholder `Copy to clipboard`)

**Keywords:** copy, clipboard, button.

---

## Dismissable — `vitops-dismissable` · nestable

Renders the <wc-dismissable> Lit component (src/web-components/WCDismissable.ts): a
light-DOM progressive-enhancement wrapper. A click on any descendant marked
`data-dismiss` (e.g. the seeded close button) fades the wrapper out and removes it.
Optional `duration` auto-dismisses after N ms; `exit` sets the fade time.

Without JS the wrapper is an inert unknown tag and its content still renders, so the
builder canvas stays functional.

**Controls**

- **Auto-dismiss after (ms)** (number) — Leave empty to require a click on a [data-dismiss] element.
- **Fade-out time (ms)** (number)
- _Note:_ Any child with a data-dismiss attribute acts as a close trigger. The seeded button already has it.

**Seeded children:** Content, Close (×).

**Keywords:** dismiss, close, banner, notice, alert.

---

## Entries — `vitops-entries` · nestable

Renders the <wc-entries> Lit component (src/web-components/WCEntries.ts): an adaptive
data display that enhances a series of heading + <dl> pairs into a table / column
projection based on container width. Without JS the heading + <dl> pairs render
stacked (semantic), so the builder canvas stays functional.

Slotted content structure (add via Code / HTML children):
  <h3>Group title</h3>
  <dl><dt>Label</dt><dd>Value</dd> …</dl>
  (repeat)

**Controls**

- **Breakpoint** (text, placeholder `40rem`) — Container width below which the projected/table view engages.
- **Column projection (table)** (checkbox) — Project heading + <dl> pairs into a table.
- **Singular (one row at a time)** (checkbox) — With projection + narrow: show one row with nav.
- _Note:_ Add children as heading + <dl> pairs: an <h3> group title followed by a <dl> of <dt>Label</dt><dd>Value</dd> pairs. Use a Code / HTML element for the <dl>.

**Seeded children:** Group title.

**Keywords:** entries, data, table, definition, list, dl.

---

## Image Compare — `vitops-image-compare` · nestable

Renders the <wc-image-compare> Lit component (src/web-components/WCImageCompare.ts):
a before/after comparison slider. Author fills the two seeded slots (slot="before" /
slot="after") — typically an Image element in each.

Nestable: the live slider appears on the frontend; the builder canvas shows the two
images stacked (upgrade happens client-side via dist/elements.js).

**Controls**

- **Initial position (%)** (number, default `50`, range 0–100)
- **Vertical split** (checkbox)
- **Discrete (step) dragging** (checkbox)
- **Keyboard step (%)** (number)
- **Before label** (text, placeholder `Before`)
- **After label** (text, placeholder `After`)

**Seeded children:** Before, After.

**Keywords:** image, compare, before, after, slider.

---

## Site Nav — `vitops-sitenav` · not nestable

The site's primary navigation, generated from a WordPress menu. Two presentations
from one markup tree, switched purely by container width — no JS beyond the native
Popover API:

  • Mobile (below the chosen breakpoint, .sitenav--bp-{sm,md,lg,xl}): a hamburger
    button (a Popover API invoker) opens a slide-in DRAWER — its own sibling
    [popover] element. Light-dismiss, Esc, and focus handling come free from the
    platform. Inside the drawer, branch items are native <details> ACCORDIONS.
  • Desktop (≥ the breakpoint): the hamburger + drawer chrome fall away and the same
    list lays out inline as a NAVBAR; branch submenus promote to hover/focus/click
    pop-out DROPDOWNS. See sitenav.css.

Each branch item is a SPLIT-LINK: a real parent <a> that navigates, flush with a
separate <details> disclosure whose <summary> is *only* the caret toggle. The link
sits OUTSIDE the summary (a sibling of <details>), so there is no interactive control
nested inside the summary's button role — valid HTML and axe-clean (no
nested-interactive). The submenu lives inside <details> and reveals as an accordion
(mobile) or a dropdown (desktop).

Per-breakpoint depth caps: "Desktop depth" / "Mobile depth" limit how deep the tree
shows at each breakpoint. PHP resolves the caps into `sitenav__item--desktop-branch`
/ `--mobile-branch` classes on the boundary nodes; sitenav.css then hides just the
caret + submenu at the capped breakpoint, leaving the parent link — so a 3-tier
desktop megamenu collapses to a 2-tier tap-through on mobile.

"Menu" was this element's former name; it was renamed to Site Nav so "Menu" can name
a more generic interactive dropdown. Non-nestable: the tree comes from the WP menu,
so render() drives all markup and runs in the builder canvas too.

**Controls**

- **WordPress menu** (select, placeholder `Select a menu`)
- _Note:_ No WordPress menus found. Create one under Appearance → Menus.
- **Accessible label** (text, placeholder `Primary`) — aria-label for the <nav> landmark.
- **Navbar breakpoint** (select, default `md — 48rem`) — Container width at/above which the drawer becomes an inline navbar with pop-out dropdowns. Below it, a hamburger opens a drawer with accordions. Options: `sm — 30rem`, `md — 48rem`, `lg — 64rem`, `xl — 80rem`.
- **Drawer side** (select, default `Inline-end (right)`) — Edge the mobile drawer slides in from. Options: `Inline-start (left)`, `Inline-end (right)`.
- **Toggle label (accessible name)** (text, placeholder `Menu`) — aria-label for the mobile hamburger button.
- **Desktop depth** (number, default `3`, range 1–∞) — Levels shown at/above the breakpoint. Empty = unlimited.
- **Mobile depth** (number, default `2`, range 1–∞) — Levels shown below the breakpoint; deeper toggles/markers are hidden. Empty = unlimited.

**Keywords:** sitenav, site nav, nav, navigation, navbar, drawer, header, menu, megamenu.

---

## Multi Field — `vitops-multi-field` · not nestable

Renders the <multi-field> Lit component (src/web-components/WCMultiField.ts): a
form-associated repeatable input group (add / remove entries, min / max). Default
entries are supplied as slotted <input value="…"> children, which the component reads
on connect.

Non-nestable: PHP render() runs in the builder canvas too, so the field group upgrades
live while editing.

**Controls**

- **Field name** (text) — Submitted as name[] for each entry.
- **Input type** (text, placeholder `text`)
- **Placeholder** (text)
- **Min entries** (number)
- **Max entries** (number)
- **Protect default entries** (checkbox)
- **Add button label** (text, placeholder `Add`)
- **Clear button label** (text, placeholder `Clear`)
- **Delete button label** (text, placeholder `Delete`)
- **Default entries** (repeater) — Fields: Value.

**Keywords:** multi, field, repeatable, form, input.

---

## Split Link — `vitops-split-link` · nestable

A "split button": a primary <a> flush with a <button> that toggles an anchored
[popover] holding secondary, nestable content. Pure native platform — the toggle
is a Popover API invoker (`popovertarget`, which the browser also wires to
`aria-expanded`/`aria-details` for free), and the panel is placed with CSS Anchor
Positioning. No Lit component; the framework's split-link.css does the styling.

Placement is authored via the "Placement" control, which writes a `position-area`
value (logical keywords) to `--split-link-area` on the root; it inherits down to
the panel. Each instance gets a unique anchor-name derived from the element id.

Nestable: the popover's children are authored in the canvas. A live [popover] is
display:none, so in the builder the panel renders WITHOUT the `popover` attribute
(as `.split-link__panel--editing`) to stay visible and droppable; on the frontend
it is a real top-layer popover.

**Controls**

- **Link text** (text, default `View`)
- **Link** (link)
- **Toggle label (accessible name)** (text, placeholder `More options`) — aria-label for the popover toggle button.
- **Toggle glyph** (text, placeholder `▾`) — Character/HTML inside the toggle. It flips 180° while the panel is open.
- **Placement** (select, default `Bottom · start-aligned`) — Options: `Top · start-aligned`, `Top · center`, `Top · end-aligned`, `Inline-start (left)`, `Center (over trigger)`, `Inline-end (right)`, `Bottom · start-aligned`, `Bottom · center`, `Bottom · end-aligned`. Bound to `--split-link-area`.
- **Panel gap** (number+units, placeholder `0.5rem`) — Bound to `--split-link-gap`.

**Base CSS class:** `split-link` (applied automatically; add ratio/modifier classes alongside it in the element's "CSS classes" field).

**Seeded children:** Popover content.

**Keywords:** split, link, button, popover, dropdown, menu.

---

## Split Panel — `vitops-split-panel` · nestable

Renders the <wc-split-panel> Lit component (src/web-components/WCSplitPanel.ts): a
resizable two-panel splitter with a draggable handle. Author fills the two seeded
columns, which carry slot="start" / slot="end" so the component picks them up.

Nestable: the live shadow-DOM handle appears on the frontend; the builder canvas
shows the two columns stacked (upgrade happens client-side via dist/elements.js).

**Controls**

- **Initial position (%)** (number, default `50`, range 0–100)
- **Vertical (stack top/bottom)** (checkbox)
- **Discrete (step) dragging** (checkbox)
- **Min panel size (px)** (number, default `100`)
- **Max panel size (px)** (number)
- **Keyboard step (%)** (number)
- **Collapse threshold (%)** (number)
- **Snap points (%)** (text, placeholder `25,50,75`)
- **Snap distance (%)** (number)

**Seeded children:** Start panel, End panel.

**Keywords:** split, panel, resize, splitter, drag.
