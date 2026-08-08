---
type: "Design Concept"
title: "Vitops components — which tier provides a pattern, and what to write"
description: "Every UI pattern across the three tiers (CSS classes, wc-* web components, and the platform wrappers: Astro components and Bricks elements): which tiers provide it, which call to make, and how the tiers compose."
resource: "design-system.json"
tags: [components, web-components, astro, bricks, tiers, design-system]
generator: "@getvitops/generator"
---

# Components

A pattern is provided by up to **three tiers**, and they **compose** rather than compete:

1. **CSS framework classes** — every pattern expressible in pure HTML/CSS. Reach here first.
2. **Web components** (`<wc-*>`, Lit) — only where a pattern genuinely benefits from
   progressive enhancement. The slotted markup is the fallback and must be usable with no JS;
   the element parses and augments it in place.
3. **Platform wrappers** — authoring conveniences that generate the correct markup at build
   time, using the classes and elements of tiers 1 and 2. They must not require runtime JS.
   Where a pattern has a web component, the wrapper emits that tag **with the accessible
   fallback inside it**. Two platforms:
   - **Astro components** (`@getvitops/astro`)
   - **Bricks elements** (WordPress / Bricks Builder)

**Astro and Bricks are the same tier**, not tiers 3 and 4. They are siblings chosen by which
platform you are on — no project uses both, and neither outranks the other. The tables below
give them separate columns because they are separate packages, not separate levels.

## Choosing

**Use the highest tier available for your stack, and write only its call.** In Astro
that is the Astro component; in Bricks the element; anywhere else the classes, plus the
`<wc-*>` tag when one exists.

The trap is composing two tiers by hand. When `wraps` below says the Astro component
emits the tag, that one call is the whole composition —
`<wc-tree><Tree /></wc-tree>` nests two elements on one tree. A tier-3 component that
would need runtime JS is in the wrong tier: build a web component instead and have the wrapper
emit its tag.

## Every pattern

| Pattern | Tiers | What to write |
| --- | --- | --- |
| `badge` | css | `.badge` — a STATIC label. Use `tag` if it is dismissable or editable. |
| `banner` | css | `.banner`; wrap in `<wc-dismissable>` for a close button that works. |
| `btn` | css | `<button>` gets it with no class; `.btn` carries it to other tags. `fill: false`, so states drive `color`. |
| `card` | css · wc · astro | `<Cards>` — it emits `<wc-cards>` itself, so do NOT add your own wrapper. `<Subgrid>` is the same grid without the click enhancement. |
| `carousel` | css · wc · bricks | `<wc-carousel>` around your slides; each child is a slide. Works unenhanced as a scroll-snap strip. |
| `centered` | css · bricks | `.centered` as a track grid. Children land in `measure` — give it a track child to lay out inside. |
| `cluster` | css | `.cluster` plus an alignment variant. |
| `code` | css | Element selectors on `pre`/`code`; no class needed. |
| `color-scheme-toggle` | css · wc · bricks | `<wc-color-scheme-toggle></wc-color-scheme-toggle>`. Renamed from `<color-scheme-toggle>` in 4.0. Shadow DOM, so it is absent rather than broken without JS. |
| `color-wheel` | wc | Not shipped. Registered but absent from every bundle, so the tag is inert in a consumer project. |
| `combobox` | css | CSS shell only — the Lit component is a TODO, so it is not interactive yet. |
| `comment` | css | `.comment` inside `.comment-thread`. |
| `consent` | css · wc · astro | `<CookieConsent />`. Its own Lit-free bundle so a site needing consent does not download a rendering framework. |
| `copy` | css · wc · bricks | `<wc-copy>` around the content and a `[data-copy]` button. |
| `cta` | css | `.cta` on any element — usually `<a>`, since a CTA navigates. Filled, with role variants. |
| `details` | css · astro | `<Details>` — or hand-write `<details>`. No JS at either tier; `::details-content` animates in CSS. |
| `dialog` | css | Native `<dialog>` plus the `.dialog__*` parts. No JS beyond `showModal()`. |
| `dismissable` | css · wc · bricks | `<wc-dismissable>` around any banner/notification containing a `[data-dismiss]` control. |
| `drawer` | css · astro | `<Drawer>` — `<dialog class="drawer">` plus an Invoker Commands trigger. No JS. |
| `dropdown` | css | `.dropdown` — Popover API based. |
| `entries` | css · wc · bricks | `<wc-entries>` around `<h3>` + `<dl>` pairs. The tier-2 exemplar: semantic pairs with no JS, a table with it. |
| `forms` | css | Wrap text controls in `.form-group` or `.input-group` — a bare `<input>` gets browser defaults. |
| `grouped` | css | `.group-inline` / `.group-block` to join adjacent controls. |
| `horizontal-scroll` | css | `.horizontal-scroll` for a snap strip. |
| `icon` | css · astro · bricks | `<Icon name="menu" />`. Names are semantic and resolve per configured set; a name containing `:` passes through. |
| `icon-picker` | css · wc | Not shipped. See `color-wheel`. |
| `image-compare` | css · wc · bricks | `<wc-image-compare>` with two images. Both are visible without JS. |
| `lightbox` | css | `.lightbox` thumbnails plus a `<dialog>`. |
| `link` | css | `<a>` gets it at zero specificity; `.link` for other tags. `.stretched-link` makes one link cover its positioned ancestor (whole-card click, no JS — but the card text stops being selectable); `.raised` lifts content back above that overlay. |
| `list` | css | `.facet-list` / `.filtered-list`. |
| `marquee` | css · wc | `<wc-marquee>` around one `.marquee__content`. Scrolls via CSS alone; JS only removes the seam. |
| `masonry` | css | `.masonry` — CSS columns based. |
| `media` | css | `.media` for a figure/body pair; `.tile` for the stacked form. |
| `multi-field` | css · wc · bricks | `<wc-multi-field>` around a field template. One row submits fine with no JS. |
| `nav` | css | `.menu` / `.navbar`. See `navbar` and `navshell` for the newer shells. |
| `navbar` | css | `.navbar` with `--start/--center/--end`. |
| `navshell` | css · astro | `<NavShell>` with a `nav` slot, plus `<NavShellToggle>` if the toggle must live outside the shell. |
| `notification` | css | `.notification` with a role variant; wrap in `<wc-dismissable>` to make it dismissable. |
| `oklch-color-picker` | wc | Not shipped. See `color-wheel`. |
| `overlay` | css | `.overlay` for a scrim. |
| `popover` | css · astro | `<Popover>` — native Popover API + CSS Anchor Positioning. No JS. |
| `pull-quote` | css | `.pull-quote`. Note the type role `quote` is separate. |
| `reveal` | css | `.reveal` — scroll-driven, no JS. Hosts the `interpolate-size` that `<details>` animation needs. |
| `scroll-based` | css | Scroll-timeline driven; no JS. |
| `scroll-target` | css | `.scroll-target-group` for `:target-current` highlighting. |
| `separator` | css | `.separator`, optionally with text or an ornament. |
| `sitenav` | css · bricks | `.sitenav` with `--bp-*` and a drawer direction. `<details>` + Invoker Commands, no JS. |
| `split` | css · bricks | `.split` plus a ratio class. Pure CSS; `md-split-1-2` for the responsive form. |
| `split-link` | css · bricks | `.split-link` — a link plus a disclosure toggle. No JS. |
| `split-panel` | css · wc · bricks | `<wc-split-panel>` with two children. Unenhanced they simply stack. |
| `stack` | css | `.stack` for overlapping cards. |
| `status` | css | `.status` with a role variant. |
| `sticky` | css | `.sticky-header` etc. Pure CSS. |
| `subgrid` | css · astro | `<Subgrid>` — emits `<ul class="subgrid" role="list">`; author `<li class="card subgrid-card">` items yourself, so tranches align across the set. |
| `svg` | css | `.svg-*` helpers for inline SVG. |
| `table` | css | `.table` inside `.table-wrapper`. See `entries` for the responsive-to-table pattern. |
| `tabs` | css | Generated pattern only; no structural partial and no component yet. |
| `tag` | css | `.tag` — an editable/dismissable label. Its group is `label`, not `tag`. |
| `text-effects` | css | `.typing`, `.text-highlight`, … CSS animation only. |
| `theme-editor` | css · wc | `<wc-theme-editor manifest="…">`. TOOLING, not a page pattern — the one deliberate tier-2 exception, quarantined in its own opt-in bundle. |
| `tooltip` | css | `.tooltip-trigger` — CSS only, anchor-positioned. |
| `tree` | css · wc · astro | `<Tree items={…} />` — it emits `<wc-tree>` itself, so do NOT add your own wrapper. |
| `typography-config` | wc | Not shipped. See `color-wheel`. |

## Web components

Shipped as feature-detected, deferred ES-module bundles. `elements.js` carries the
registered set; `<wc-consent>` and `<wc-theme-editor>` ship separately, the
first so a site needing consent does not download a rendering framework, the second because it
is tooling and opt-in per consumer.

| Tag | Pattern | Ships in | What JS adds over the fallback |
| --- | --- | --- | --- |
| `<wc-cards>` | `card` | `elements.js` | whole-card click that keeps the card text selectable |
| `<wc-carousel>` | `carousel` | `elements.js` | cloned slides for a seamless loop, autoplay, snap nav |
| `<wc-color-scheme-toggle>` | `color-scheme-toggle` | `elements.js` | segmented light/dark/system control; persists the choice (consent-gated) |
| `<wc-color-wheel>` | `color-wheel` | `(none — editor-v2 track, not yet bundled)` | hue/chroma wheel input |
| `<wc-consent>` | `consent` | `@getvitops/core/consent` | the permission gate itself — activates `type="text/plain"` tags on grant |
| `<wc-copy>` | `copy` | `elements.js` | clipboard write plus success feedback |
| `<wc-dismissable>` | `dismissable` | `elements.js` | fade-out + removal, optional auto-dismiss |
| `<wc-entries>` | `entries` | `elements.js` | parses heading + `<dl>` pairs into a table above a breakpoint |
| `<wc-icon-picker>` | `icon-picker` | `(none — editor-v2 track, not yet bundled)` | browses the semantic icon map for the configured set |
| `<wc-image-compare>` | `image-compare` | `elements.js` | drag handle revealing the before/after image |
| `<wc-marquee>` | `marquee` | `elements.js` | fills the track with enough copies to scroll seamlessly |
| `<wc-multi-field>` | `multi-field` | `elements.js` | add/remove repeating field rows |
| `<wc-oklch-color-picker>` | `oklch-color-picker` | `(none — editor-v2 track, not yet bundled)` | OKLCH L/C/H picker |
| `<wc-split-panel>` | `split-panel` | `elements.js` | draggable divider between two panels |
| `<wc-theme-editor>` | `theme-editor` | `@getvitops/core/editor` | live `:root` token overrides, export as CSS or a config patch |
| `<wc-tree>` | `tree` | `elements.js` | filter, expand/collapse all, hash deep-linking |
| `<wc-typography-config>` | `typography-config` | `(none — editor-v2 track, not yet bundled)` | type role editor |

`<wc-color-wheel>`, `<wc-icon-picker>`, `<wc-oklch-color-picker>`, `<wc-typography-config>` are **registered but in no bundle** (the editor-v2 track). The tags are inert in a consumer project — they are listed so that "the tag does nothing" is documented rather than discovered.

## Astro components

| Component | Pattern | Emits |
| --- | --- | --- |
| `@getvitops/astro/components/Cards.astro` | `card` | the `<wc-cards>` tag, fallback inside |
| `@getvitops/astro/CookieConsent.astro` | `consent` | the `<wc-consent>` tag, fallback inside |
| `@getvitops/astro/components/Details.astro` | `details` | tier-1 markup — no web component |
| `@getvitops/astro/components/Drawer.astro` | `drawer` | tier-1 markup — no web component |
| `@getvitops/astro/components/Icon.astro` | `icon` | tier-1 markup — no web component |
| `@getvitops/astro/components/NavShell.astro` | `navshell` | tier-1 markup — no web component |
| `@getvitops/astro/components/NavShellToggle.astro` | `navshell` | tier-1 markup — no web component |
| `@getvitops/astro/components/Popover.astro` | `popover` | tier-1 markup — no web component |
| `@getvitops/astro/components/Subgrid.astro` | `subgrid` | tier-1 markup — no web component |
| `@getvitops/astro/components/Tree.astro` | `tree` | the `<wc-tree>` tag, fallback inside |

## Bricks elements

Controls, defaults and seeded children for each are in [the elements reference](../bricks/elements.md).

| Element | Pattern |
| --- | --- |
| `vitops-carousel` | `carousel` |
| `vitops-centered` | `centered` |
| `vitops-color-scheme-toggle` | `color-scheme-toggle` |
| `vitops-copy-button` | `copy` |
| `vitops-dismissable` | `dismissable` |
| `vitops-entries` | `entries` |
| `vitops-icon` | `icon` |
| `vitops-image-compare` | `image-compare` |
| `vitops-multi-field` | `multi-field` |
| `vitops-sitenav` | `sitenav` |
| `vitops-split` | `split` |
| `vitops-split-link` | `split-link` |
| `vitops-split-panel` | `split-panel` |

## CSS

`patterns.items` patterns get the full token cascade — `base` declarations,
`states`, role variants and override hooks (`--p-<pattern>`, `--br-<pattern>`, `--b-<pattern>`, `--ds-<pattern>`, `--fs-<pattern>`, `--bg-<pattern>`); see
[component patterns](patterns.md). A structural partial has none of those. The class lists below
are representative, not exhaustive — [the class vocabulary](../css/classes.md) states the naming
rules that generate them all.

| Pattern | Partial | Classes | `patterns.items` |
| --- | --- | --- | --- |
| `badge` | `patterns/tag.css` | `badge`, `badge-indicator` | declared |
| `banner` | `patterns/banner.css` | `banner`, `banner__content`, `banner__action` | declared |
| `btn` | — | `btn` | declared |
| `card` | `patterns/card.css` | `card` | declared |
| `carousel` | `patterns/carousel.css` | `carousel` | declared |
| `centered` | `layout.css` | `centered`, `spotlight`, `breakout`, `fullbleed` | — |
| `cluster` | `patterns/cluster.css` | `cluster`, `cluster-between`, `cluster-start` | — |
| `code` | `patterns/code.css` | — | — |
| `color-scheme-toggle` | `patterns/icon.css` | — | — |
| `combobox` | `patterns/combobox.css` | `combobox`, `combobox__listbox`, `combobox__option` | declared |
| `comment` | `patterns/comment.css` | `comment`, `comment__author`, `comment-thread` | declared |
| `consent` | `patterns/consent.css` | `consent`, `consent__body`, `consent__options`, `consent__actions` | — |
| `copy` | `patterns/copy.css` | `copy`, `copy__button`, `copy__icon`, `copy__tooltip` | — |
| `cta` | — | `cta`, `cta-danger` | declared |
| `details` | `patterns/details.css` | `details`, `details-trigger`, `details-icon` | declared |
| `dialog` | `patterns/dialog.css` | `dialog__header`, `dialog__body`, `dialog__footer` | declared |
| `dismissable` | `patterns/banner.css` | `banner__close`, `notification__close` | — |
| `drawer` | `patterns/drawer.css` | `drawer`, `drawer--start`, `drawer--end` | declared |
| `dropdown` | `patterns/dropdown.css` | `dropdown--show-on-hover`, `dropdown-menu` | declared |
| `entries` | `patterns/table.css` | `entries__table`, `entries__scroll`, `entries__nav` | — |
| `forms` | `patterns/forms.css` | `form-group`, `input-group`, `fieldset`, `custom-check` | declared |
| `grouped` | `patterns/grouped.css` | `group`, `group-inline`, `bordered` | — |
| `horizontal-scroll` | `patterns/horizontal-scroll.css` | `horizontal-scroll` | — |
| `icon` | `patterns/icon.css` | `icon`, `icon-button`, `icon-mask` | — |
| `icon-picker` | `patterns/icon.css` | — | — |
| `image-compare` | `patterns/splitter.css` | `image-compare`, `image-compare__before`, `image-compare__handle` | — |
| `lightbox` | `patterns/lightbox.css` | `lightbox`, `lightbox-dialog__content` | declared |
| `link` | `patterns/anchor-link.css` | `link`, `skip-link`, `stretched-link`, `raised` | declared |
| `list` | `patterns/list.css` | `facet-list`, `filtered-list` | declared |
| `marquee` | `patterns/marquee.css` | `marquee`, `marquee__content`, `marquee__item` | — |
| `masonry` | `patterns/masonry.css` | `masonry`, `masonry__item` | — |
| `media` | `patterns/media.css` | `media`, `media__figure`, `tile` | — |
| `multi-field` | `patterns/forms.css` | `form-group`, `input-group`, `fieldset` | — |
| `nav` | `patterns/nav.css` | `menu`, `navbar`, `nav-collapse`, `drawer-nav` | declared |
| `navbar` | `patterns/navbar.css` | `navbar`, `navbar--sticky`, `nav-items` | — |
| `navshell` | `patterns/navshell.css` | `navshell`, `navshell__bar`, `navshell__panel`, `navshell-toggle` | — |
| `notification` | `patterns/notification.css` | `notification`, `notification__title`, `notification__actions` | declared |
| `overlay` | `patterns/overlay.css` | `overlay` | — |
| `popover` | `patterns/popover.css` | `popover`, `popover-trigger`, `popover-anchor` | declared |
| `pull-quote` | `patterns/pull-quote.css` | `pull-quote`, `pull-quote__attribution` | declared |
| `reveal` | `patterns/reveal.css` | `reveal`, `reveal-fade`, `reveal-h` | — |
| `scroll-based` | `patterns/scroll-based.css` | `parallax`, `scroll-progress`, `scroll-spy` | — |
| `scroll-target` | `patterns/scroll-target.css` | `scroll-target-group`, `toc-sidebar` | — |
| `separator` | `patterns/separator.css` | `separator`, `separator__text`, `separator__ornament` | — |
| `sitenav` | `patterns/sitenav.css` | `sitenav`, `sitenav__link`, `sitenav--drawer-start` | — |
| `split` | `layout.css` | `split`, `split-1-2`, `split-reverse` | — |
| `split-link` | `patterns/split-link.css` | `split-link`, `split-link__toggle`, `split-link__panel` | — |
| `split-panel` | `patterns/splitter.css` | `splitter`, `splitter__panel`, `splitter__handle` | — |
| `stack` | `patterns/stack.css` | `stack`, `stack__card` | — |
| `status` | `patterns/tag.css` | `status`, `status-dot--pulse` | declared |
| `sticky` | `patterns/sticky.css` | `sticky`, `sticky-header`, `sticky-nav` | — |
| `subgrid` | `patterns/subgrid.css` | `subgrid`, `subgrid-card`, `pricing-grid` | — |
| `svg` | `patterns/svg.css` | `svg-container`, `svg-shape`, `svg-animated` | — |
| `table` | `patterns/table.css` | `table`, `table-wrapper` | declared |
| `tabs` | — | `tabs` | declared |
| `tag` | `patterns/tag.css` | `tag`, `tag__remove`, `tag__icon`, `tag-list` | declared |
| `text-effects` | `patterns/text-effects.css` | `typing`, `text-highlight`, `text-gradient-animate`, `text-stagger` | — |
| `theme-editor` | `patterns/theme-editor.css` | `ed-panel`, `ed-launch`, `ed-input` | — |
| `tooltip` | `patterns/tooltip.css` | `tooltip-trigger` | declared |
| `tree` | `patterns/tree.css` | `tree`, `tree__item`, `tree__content`, `tree__toggle`, `tree__label` | declared |
