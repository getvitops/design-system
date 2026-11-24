---
name: emdash-building-pages
description: Use when authoring or changing a page's layout or content on this EmDash site — composing `vitops_*` blocks, nesting sections, page openers and heroes, widget areas, block `theme`/`anchor`/`className`/`style`, heading levels, card grids, or the header (`site.chrome`, `<Masthead>`, mega menu panels).
---

# Building pages

Reference, rendered from this project: `vp exec vitops docs blocks` (every block and field),
`vp exec vitops docs components` (every pattern, which tiers provide it and which block renders it),
`vp exec vitops docs classes` (class vocabulary), `vp exec vitops docs config` (`site.chrome`).

## Blocks

- The editor's insert menu offers the `vitops_*` blocks.
- **Nesting.** A block type with a `portableText` field, such as `vitops_section`, holds other
  blocks. A `vitops_*` block holds only scalar fields and repeaters (cards, gallery images,
  accordion items, slides), so it can't. EmDash's built-in `columns` doesn't render `vitops_*`
  children. For layout, nest in a section, use a `blocks` field, or hand-write the template with
  `@getvitops/astro` components (`Subgrid`, `Cards`, `Carousel`, …).
- **Page opener.** Use `vitops_section` at heading level 1 with its button fields (`cta_label`,
  `secondary_label`) and `stack: rhythm`; don't nest a `vitops_hero` or another section wrapper in a
  section body, which renders two layers of `section > .centered`. `vitops_hero` is for a hero
  that stands alone (it carries option cards).
- **`<main>` is a landmark, not a layout.** The layout's `<main id="main">` carries no `centered` class: a band owns its own width, so a `.centered` main would hold every band's background to the text column. Plain content takes its own `<div class="centered">` (`<VitopsContent>` wraps the text between bands for you); hand-written page content needs the wrapper added. A site scaffolded before 9.0 that still has `<main class="centered">` gets an error from `vitops lint`, and `vitops lint --fix` removes the class.
- **Width and layout: pick them on purpose.** `width: measure` (about 65ch) and `layout: stack`
  suit running, blog-like text, and they are the defaults, so a section keeps them unless
  something chooses otherwise. A top-level section of a marketing page (services, features, stats,
  pricing, logos, reviews, a call to action) often reads better wider (`spotlight` or `breakout`)
  or with a layout such as `split` (heading beside its content) or `center`; consider that first,
  and keep `measure` where the content is narrow by nature. A full-bleed band with its content in
  the `measure` column shows as a narrow strip on a wide page, and nothing flags it. A section
  nested inside another follows its parent's width.
- **Section, block or widget area?** Copy-and-edit content is an EmDash Section. The same content
  everywhere (announcement bar, pre-footer call to action, sidebar, footer columns) is a **widget
  area**: define it under Widgets in the admin and render it with `<VitopsWidgetArea name="…" />`
  from `@getvitops/emdash/astro` in the layout, or in page content with the `vitops_widgetArea`
  block. Page-specific content is blocks. An area can't hold another area, and prerendered pages
  show an edit after the next deploy (like menus).
- **Escape hatches on every block:** `theme` (a backdrop from the site's colour roles, `surface` or
  `brand-primary:solid`, with the readable text for it picked by the design system, so contrast is
  not the editor's judgement), `anchor` (the `id`, for `#links`), `className` (extra classes; under
  the tailwind format only ones the site already uses) and `style` (CSS custom properties only,
  e.g. `--p-card: 2rem`; anything else is dropped). The same backdrop is available on a widget area
  (`<VitopsWidgetArea theme="…">`) and on your own markup (`themeAttrs('surface')` from
  `@getvitops/emdash/astro`, spread on the layout's `<body>`).
- Override a block per site with `<PortableText components={{ type: { 'vitops_cards': MyCards } }} />`;
  hide one with `vitopsEmdash({ blocks: { exclude: [...] } })`. Before adding a block **type**, use
  the `emdash-custom-blocks` skill: types can't be renamed or deleted once pages use them.
- **One `<h1>` per page.** The template's page routes render the title as an `<h1>`, and a hero's
  heading level defaults to `h1`, so set a hero's level to `2` on those pages (or let the hero own
  the `h1`). Use `p` for a display heading that is not part of the outline. `vitops emdash build`
  warns on any page without exactly one `<h1>`.
- Labels: `badge` is static (status, count, category); `tag` may be editable or dismissable. Don't
  invent `chip` or `pill`. The button class is `btn`.

## Layout foundations — the answer, not a starting point

| About to write…                                         | Write instead   |
| ------------------------------------------------------- | --------------- |
| a `wrap`/`wrapper`/`container`/`inner` class            | **`centered`**  |
| `max-width` + `margin-inline: auto`                     | **`centered`**  |
| `padding-block` on a section                            | **`region`**    |
| margins between headings/paragraphs/lists               | **`rhythm`**    |
| `display: grid` + `grid-template-columns: repeat(n, …)` | **`subgrid`**   |
| `repeat(auto-fit, minmax(…))`                           | **`grid-auto`** |
| `display: flex` + `gap` for a row of controls           | **`cluster`**   |

`centered` is a grid of _named tracks_: a child widens itself with `breakout`/`spotlight`/
`fullbleed` without the parent knowing, which a bespoke `.wrap` can't do.

- **More than one card means `subgrid`**, so headings and CTAs align across the set:
  `<ul class="subgrid subgrid-cols-3" role="list">` with `<li class="card subgrid-card">`, or
  `<Subgrid />` (renders the slot verbatim; author the `<li>`s).
- **A card that is a link:** `stretched-link` inside it is zero-JS but kills text selection;
  `<Cards>` keeps selection and falls back to the same link with no JS. Never both. Never
  `<li><a class="card">`: the `li` is the grid item, so the tranches don't align.
- `vpr lint:design` reports all of these and the pre-commit hook fails on them. Fix the class, not
  the CSS.

## The header: `site.chrome`

The header is configuration, not markup. `site.chrome.masthead` sets position
(`static|sticky|fixed`), `surface` (`solid|glass|transparent`), `layout` (`full|inset|floating`),
`height`, `inset` and `elevation`, plus `states`: a partial look per scroll state (`atStart`, `atEnd`,
`scrollingToEnd`, `scrollingToStart`; later wins; animated) taking `layout`, `height`, `inset`,
`surface`, `elevation` and `hidden`. A full-width banner that floats once scrolled is
`layout: "floating"` with `states.atStart: { layout: "full", height: "6rem", surface: "transparent" }`;
hide-on-scroll is `states.scrollingToEnd.hidden`; a bar hidden until first scroll is
`states.atStart.hidden`. A state that hides at the start, or changes size or layout, makes the bar
`fixed`; `site.chrome.nav` sets `compact` (`drawer|dropdown`), `drawerSide`,
breakpoints and depths. A `<Masthead>` prop overrides one field for a layout (a landing page can be
`position="fixed" states={{ atStart: { surface: 'transparent' } }}`). A sticky masthead sets `--header-offset`
itself, so anchors clear it. Nav tiers are menus: `primary`, optional `primary-mobile` and
`primary-mega`. For the mega panel's featured column, create a widget area named
`mega-<item url slug>` (e.g. `mega-services`), or put `mega-area:<name>` in the menu item's CSS
classes.
