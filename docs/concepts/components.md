---
type: "Design Concept"
title: "Vitops components — which tier provides a pattern, and what to write"
description: "Every UI pattern across the three tiers (CSS classes, wc-* web components, and the platform wrappers: Astro components, Bricks elements and EmDash blocks): which tiers provide it, which call to make, and how the tiers compose."
resource: "design-system.json"
tags: [components, web-components, astro, bricks, emdash, tiers, design-system]
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
   fallback inside it**. Three platforms:
   - **Astro components** (`@getvitops/astro`)
   - **Bricks elements** (WordPress / Bricks Builder)
   - **EmDash blocks** (`@getvitops/emdash`) — Portable Text blocks an editor inserts;
     each is an adapter over the pattern's Astro component

**Astro, Bricks and EmDash are the same tier**, not tiers 3, 4 and 5. They are siblings chosen
by which platform you are on — neither outranks the others. (An EmDash site is an Astro site,
so it uses the Astro components directly in templates and the blocks inside editor content.)
The tables below give them separate columns because they are separate packages, not separate
levels.

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
| `badge` | css · emdash | `.badge` — a STATIC label. Use `tag` if it is dismissable or editable. |
| `banner` | css · emdash | `.banner`; wrap in `<wc-dismissable>` for a close button that works. |
| `breadcrumbs` | css · astro | `<Breadcrumbs items={[{ label, href }, …, { label }]} />`. The last item is the current page (`aria-current`, never a link). Emits the `BreadcrumbList` JSON-LD from the same items unless `schema={false}`. Hand-written: `<nav aria-label="Breadcrumb" class="breadcrumbs"><ol><li>…`. No JS. |
| `btn` | css · emdash | `<button>` gets it with no class; `.btn` carries it to other tags. `fill: false`, so states drive `color`. |
| `callout` | css · emdash | `.callout.tone` with a `.callout__body` and `.callout__actions`. A call-to-action band that stays on the page — NOT `banner`, which is a dismissible announcement. |
| `card` | css · wc · astro · emdash | `<Cards>` — it emits `<wc-cards>` itself, so do NOT add your own wrapper. `<Subgrid>` is the same grid without the click enhancement. |
| `carousel` | css · wc · astro · bricks · emdash | `<Carousel slides={…} label="…" />` — it emits `<wc-carousel>` itself, so do NOT add your own wrapper. `.carousel` is the shell and `.carousel__track` the scroller; add `loop` for the cloned infinite strip (`autoplay` implies it). |
| `centered` | css · bricks | `.centered` as a track grid. Children land in `measure` — give it a track child to lay out inside. |
| `cluster` | css | `.cluster` plus an alignment variant. |
| `code` | css | Element selectors on `pre`/`code`; no class needed. |
| `color-scheme-toggle` | css · wc · bricks | `<wc-color-scheme-toggle></wc-color-scheme-toggle>`. Renamed from `<color-scheme-toggle>` in 4.0. Shadow DOM, so it is absent rather than broken without JS. |
| `color-wheel` | wc | Not shipped. Registered but absent from every bundle, so the tag is inert in a consumer project. |
| `combobox` | css · wc · astro | `<Combobox name inputId options={[…]} />` with your own `<label for>`. With no JS it is an `<input list>` + `<datalist>`: native autocomplete. What is typed is what is submitted, so it suggests and does not constrain; use `<select>` for a closed set. Do NOT wrap it in `<wc-combobox>`: it emits its own. By hand: `<wc-combobox class="combobox"><input class="combobox__input" list="x"><datalist id="x">…</datalist></wc-combobox>`. |
| `comment` | css | `.comment` inside `.comment-thread`. |
| `config-form` | wc · astro | `<ConfigForm id schema paths output><form method="post">…</form></ConfigForm>`, with the fields from `renderStepHtml` / `renderProjectionHtml` (`@getvitops/utils/forms`). With no JS it is a plain form posting the names `formToConfig` parses and the server validates. Its own Lit-free bundle (`@getvitops/core/config-form`): the validator and the form codec. Do NOT wrap it in `<wc-config-form>`: it emits its own. `paths` narrows the schema to the fields shown; `novalidate` lets the server decide a submit. |
| `consent` | css · wc · astro | `<CookieConsent />`. Its own Lit-free bundle so a site needing consent does not download a rendering framework. |
| `copy` | css · wc · bricks · emdash | `<wc-copy>` around the content and a `[data-copy]` button. |
| `counter` | css · wc · astro · emdash | `<Counter value="94%" />` — it emits `<wc-counter>` itself, so do NOT add your own wrapper. The final value is parsed from the fallback text, never passed separately. |
| `cta` | css · emdash | `.cta` on any element — usually `<a>`, since a CTA navigates. Filled, with role variants. |
| `details` | css · astro · emdash | `<Details>` — or hand-write `<details>`. No JS at either tier; `::details-content` animates in CSS. |
| `dialog` | css | Native `<dialog>` plus the `.dialog__*` parts. No JS beyond `showModal()`. |
| `dismissable` | css · wc · bricks · emdash | `<wc-dismissable>` around any banner/notification containing a `[data-dismiss]` control. |
| `drawer` | css · astro | `<Drawer>` — `<dialog class="drawer">` plus an Invoker Commands trigger. No JS. |
| `dropdown` | css | Not a component: a dropdown is the native Popover API plus anchor positioning. A trigger with `popovertarget`, a `[popover]` panel, and `anchor-name` / `position-anchor` (`<Popover anchorName positionArea>` sets them). Add `.dropdown--show-on-hover` to the wrapper to reveal on hover as well as click. The `.dropdown-trigger` / `.dropdown-menu` / `.dropdown-icon` helpers live in `patterns/nav.css`. |
| `embed` | css · emdash | `.embed` around an `<iframe class="embed__frame" data-consent="marketing" data-consent-src="…">` with NO `src`, and a `.embed__placeholder`. The consent runtime assigns the address after the grant; the placeholder holds a real link. Never give the iframe a live `src`. |
| `entries` | css · wc · astro · bricks · emdash | `<Entries entries={[{ heading, pairs: [{ term, value }] }]} />` — it emits `<wc-entries>` itself, so do NOT add your own wrapper. By hand: `<wc-entries>` around `<h3>` + `<dl>` pairs. The tier-2 exemplar: semantic pairs with no JS, a table with it. |
| `field` | css · wc · astro | `<Field label help error optional><input name … /></Field>`: the label nests the control, so no `id`/`for` is needed. With no JS it is a labelled control and a server `error` is already under it. It is not form-associated: the native control still submits, validates and takes focus. Do NOT wrap it in `<wc-field>`: it emits its own. By hand: `<wc-field class="field"><label class="field__control"><span class="field__label">Name</span><input name="n"></label><small class="field__help">…</small></wc-field>`. Use `.form-group` for a field whose label and control are siblings. |
| `format` | wc · astro | `<Format type="relative" value="2026-11-03T14:05:00Z">November 3, 2026</Format>`: the slot is the no-JS text, and `title` keeps it after upgrade. `type` is `relative`, `date`, `datetime`, `time`, `number`, `percent` or `currency` (needs `currency="CAD"`). Anything it cannot format is left as written. Do NOT wrap it in `<wc-format>`: it emits its own. By hand: `<wc-format type="relative"><time datetime="…">text</time></wc-format>`. |
| `forms` | css | Wrap text controls in `.form-group` or `.input-group` — a bare `<input>` gets browser defaults. |
| `gallery` | css · wc · astro · emdash | `<Gallery images={…} label="…" />` — it emits `<wc-gallery>` wrapping a `<Carousel />` (which emits its own `<wc-carousel>`) itself, so do NOT add your own wrapper around either. Each thumbnail is a plain `<a href="#slide-id">` into the carousel's own `<li id="slide-id">` inside a single `<dialog class="lightbox-dialog">` (see `lightbox`), so it is a working modal lightbox — WITH prev/next — before any script runs. Stepping between images is the carousel's job, not the gallery's. |
| `grouped` | css | `.group-inline` / `.group-block` to join adjacent controls. |
| `horizontal-scroll` | css | `.horizontal-scroll` for a snap strip. |
| `icon` | css · astro · bricks | `<Icon name="menu" />`. Names are semantic and resolve per configured set; a name containing `:` passes through. |
| `icon-picker` | css · wc | Not shipped. See `color-wheel`. |
| `image-compare` | css · wc · bricks · emdash | `<wc-image-compare>` with two images. Both are visible without JS. |
| `lightbox` | css | The single `<dialog class="lightbox-dialog">` a gallery opens — it wraps ONE `.carousel` (`lightbox-dialog__track`) of every image, not one dialog per image. Use `gallery` for the thumbnail grid that drives it — `<Gallery />` emits both, and the carousel inside already owns prev/next/dots/keys/swipe. |
| `link` | css · emdash | `<a>` gets it at zero specificity; `.link` for other tags. `.stretched-link` makes one link cover its positioned ancestor (whole-card click, no JS — but the card text stops being selectable); `.raised` lifts content back above that overlay. |
| `list` | css | `.facet-list` / `.filtered-list`. |
| `location-pages` | astro | `<LocationPage location={…} defaultLocale>` and `<ServicePage service={…} defaultLocale providerName>`: one `organization.locations` / `organization.services` entry as a page (name, address, hours table, photos, offers) plus its `LocalBusiness` / `Service` JSON-LD, with a slot for your own copy. Nothing scaffolds the route: write `src/pages/locations/[slug].astro` with `getStaticPaths()` over the record and `resolveSlug()` from `@getvitops/astro/schemas/graph-adapters.ts` (the idiom is in LocationPage's docblock). The key of the record, not the `slug`, is the entry's identity. |
| `logos` | css · emdash | `<ul class="logos">` of `.logos__item` images (alt text = the name), or `.logos__name` text when there is no image. A still grid; `marquee` is the scrolling version. |
| `marquee` | css · wc · astro · emdash | `<Marquee>` around one `.marquee__content`, or `<wc-marquee>` by hand. Scrolls via CSS alone; JS only removes the seam. |
| `masonry` | css | `.masonry` — CSS columns based. |
| `masthead` | css · astro | `<Masthead config={site}>` from `site.chrome.masthead` (position `static\|sticky\|fixed`, behavior `always\|hide-on-scroll`, surface `solid\|glass\|transparent\|transparent-until-scrolled`, layout `full\|inset\|floating`, `inset` and `height` lengths — fluid ones like `clamp(3.5rem, 8cqi, 4.5rem)` are fine — elevation shadow/border, `onScroll`); a prop overrides one field for a layout. Slots `brand`, default (the `<SiteNav>`), `actions`. Pure CSS — hide-on-scroll and the *-on-scroll states are `scroll-state()` queries that only subtract from a settled bar, so a browser without them (Firefox today) shows a visible, solid, elevated one. It never takes `role="banner"`: a body-level `<header>` already is the landmark, and `.banner` means the announcement bar. |
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
| `range` | css · wc · astro | A single slider needs no element: a bare `<input type="range">` is themed by `forms.css` (accent-color). For its value shown, or for two thumbs, use `<Range name label min max value output />` or `<Range names labels values />`: with no JS those are native range inputs (two submit as two fields). Every input needs a label. Do NOT wrap it in `<wc-range>`: it emits its own. |
| `reveal` | css | `.reveal` — scroll-driven, no JS. Hosts the `interpolate-size` that `<details>` animation needs. |
| `review` | css · astro · emdash | `<ReviewCard review={…} />` — one card, from `vitops reviews`' `.vitops/reviews.json` cache. Put several inside `<Carousel>` slides or `<Marquee>` items; there is no group component and no `wc-review`. In EmDash, `vitops_reviews` is that whole row: it reads the cache as a build-time import (`virtual:getvitops/reviews`, served by `vitops()`; empty when the file is absent), picks reviews with `selectReviews()`, and lays them out as a grid, carousel or marquee. A new review appears after `vitops reviews` is re-run, committed and the site rebuilt. |
| `scroll-based` | css | Scroll-timeline driven; no JS. |
| `scroll-target` | css | `.scroll-target-group` for `:target-current` highlighting. |
| `section` | css · emdash | `.section.region` > `.centered` > `.section__inner` holding `.section__head` (kicker, heading, sub) and `.section__body`. `.section--split` puts the head beside the body when wide. In EmDash it is a block TYPE (`vitops_section`) with a Portable Text body that accepts any other block — see `vitopsBlockTypes()`. |
| `separator` | css | `.separator`, optionally with text or an ornament. |
| `sitenav` | css · astro · bricks · emdash | `.sitenav` with `--bp-*` and a drawer direction. `<details>` + Invoker Commands, no JS. In Astro: `<SiteNav {...await loadNavMenus(getMenu)} />` renders EmDash menu `primary` (the default: dropdowns from `md`, drawer below) and, if they exist, `primary-mobile` (depth-1 nav below `md`) and `primary-mega` (mega panels from `xl`) — adding the menu in the admin is the whole change. An item's `titleAttr` is its description. Per-site behaviour lives in `site.chrome.nav` — `<SiteNav {...nav} {...resolveNavOptions(site)} />` sets `compact` (`drawer` \| `dropdown`: an anchored, columnar panel under the toggle), `drawerSide`, the breakpoints and depths. For a mega panel's featured column pass `megaPanel={VitopsMegaPanel}` (`@getvitops/emdash/astro`): it renders the widget area `mega-<item slug>` (or the item's `mega-area:<name>` class) and nothing when there is none. `<SiteFooter sitemap legal name>` renders `footer-sitemap` + `footer-legal` + the copyright line. For a menu inside page content (a site map, a section's links, footer-style columns) use `.navlist` — plain nested lists, `--inline` / `--columns` — or, in EmDash, the `vitops_nav` block (menu, layout `list\|inline\|columns\|sitenav`, depth 1–3, heading, tone). Name each `<nav>` uniquely: the header is `Primary` and the footer `Site map` / `Legal`, and the block never reuses those. |
| `split` | css · bricks · emdash | `.split` plus a ratio class. Pure CSS; `md-split-1-2` for the responsive form. |
| `split-link` | css · bricks | `.split-link` — a link plus a disclosure toggle. No JS. |
| `split-panel` | css · wc · bricks | `<wc-split-panel>` with two children. Unenhanced they simply stack. |
| `stack` | css | `.stack` for overlapping cards. |
| `stats` | css · emdash | `<ul class="stats">` of `.stats__item`, each figure a `<Counter>`. `.stats--tiles` adds `.stats__group` and `.stats__delta`; `data-state="up\|down"` colours the delta through the success/danger roles. |
| `status` | css | `.status` with a role variant. |
| `steps` | css · emdash | `<ol class="steps tone">` of `<li class="steps__item">` each holding a `.steps__body` with a real heading. The number is a CSS counter and the connector line a pseudo-element; `.steps--row` runs it sideways when wide; `.steps--cards` puts each step in a card and `.steps--animated` draws the connector on scroll. The marker size and card geometry are the `steps` entry of `patterns.items` (`--steps-marker-size`, the `content` group tokens). |
| `sticky` | css | `.sticky-header` etc. Pure CSS. |
| `subgrid` | css · astro · emdash | `<Subgrid>` — emits `<ul class="subgrid" role="list">`; author `<li class="card subgrid-card">` items yourself, so tranches align across the set. |
| `svg` | css | `.svg-*` helpers for inline SVG. |
| `table` | css | `.table` inside `.table-wrapper`. See `entries` for the responsive-to-table pattern. |
| `tabs` | css · wc · astro · emdash | `<Tabs items={[{ label, body }]} />`, or `<Tabs>` around your own `<section><h3>…</h3>…</section>` panels. With no JS every panel is readable under its heading. `orientation="vertical"` runs the list down the side; `hash` writes the selected panel into the URL; `selected` sets the first tab. Do NOT wrap it in `<wc-tabs>`: it emits its own. By hand: `<wc-tabs class="tabs">` around `<section>`s that each open with a heading. |
| `tag` | css | `.tag` — an editable/dismissable label. Its group is `label`, not `tag`. |
| `text-effects` | css | `.typing`, `.text-highlight`, … CSS animation only. |
| `theme-editor` | css · wc | `<wc-theme-editor manifest="…">`. TOOLING, not a page pattern — the one deliberate tier-2 exception, quarantined in its own opt-in bundle. |
| `tone` | css | Add `.tone` and set `--tone-bg` / `--tone-fg` / `--tone-border` / `--tone-solid` / `--tone-on-solid` as custom properties — never a class built from a value, which Tailwind cannot see. `@getvitops/emdash`'s `resolveTone(tone, color)` writes them: role, then semantic fallbacks, then `neutral`, or a palette `color` escape hatch. `.accent` colours a run inside a heading. |
| `tooltip` | css | `.tooltip-trigger` — CSS only, anchor-positioned. |
| `tree` | css · wc · astro · emdash | `<Tree items={…} />` — it emits `<wc-tree>` itself, so do NOT add your own wrapper. In EmDash, `vitops_tree` takes an indented outline (one node per line, indent to nest, `\| badge` for a chip) and builds the tree from it; it never sets `descriptionHtml`. |
| `turnstile` | css · wc · emdash | `<wc-turnstile sitekey="…">` inside a `<form>`, around a paragraph saying the spam check needs JavaScript. Pair it with `createConversionRoute({ turnstile })`; the `vitops_form` block does both. |
| `typography-config` | wc | Not shipped. See `color-wheel`. |
| `widget-area` | css · emdash | Editor-managed regions: `<VitopsWidgetArea name="footer-columns" />` (`@getvitops/emdash/astro`) renders an area from Widgets in the admin — titled groups, a menu as a labelled `<nav>`, content as Portable Text. In a page, the `vitops_widgetArea` block places one. An area holding a `core:*` component widget falls back to EmDash's own renderer, and an area cannot hold another. Prerendered pages show an edit after the next deploy. |

## Web components

Shipped as feature-detected, deferred ES-module bundles. `elements.js` carries the
registered set; `<wc-consent>` and `<wc-theme-editor>` ship separately, the
first so a site needing consent does not download a rendering framework, the second because it
is tooling and opt-in per consumer.

| Tag | Pattern | Ships in | What JS adds over the fallback |
| --- | --- | --- | --- |
| `<wc-cards>` | `card` | `elements.js` | whole-card click that keeps the card text selectable |
| `<wc-carousel>` | `carousel` | `elements.js` | opt-in cloned loop, autoplay, and real prev/next + dot controls where `::scroll-button()`/`::scroll-marker` are missing |
| `<wc-color-scheme-toggle>` | `color-scheme-toggle` | `elements.js` | segmented light/dark/system control; persists the choice (consent-gated) |
| `<wc-color-wheel>` | `color-wheel` | `(none — editor-v2 track, not yet bundled)` | hue/chroma wheel input |
| `<wc-combobox>` | `combobox` | `elements.js` | a filtered ARIA 1.2 listbox (aria-activedescendant, arrow/Enter/Escape keys, a live result count) in place of the browser datalist popup |
| `<wc-config-form>` | `config-form` | `@getvitops/core/config-form` | validates the form against a JSON Schema as you type and shows each message in its `<wc-field>`, stops a submit that has errors, adds a row to a keyed map as the blank one is used, and exposes the config document the form describes |
| `<wc-consent>` | `consent` | `@getvitops/core/consent` | the permission gate itself — activates `type="text/plain"` tags on grant |
| `<wc-copy>` | `copy` | `elements.js` | clipboard write plus success feedback |
| `<wc-counter>` | `counter` | `elements.js` | animates from a start value to the value already in the fallback text, on intersection |
| `<wc-dismissable>` | `dismissable` | `elements.js` | fade-out + removal, optional auto-dismiss |
| `<wc-entries>` | `entries` | `elements.js` | parses heading + `<dl>` pairs into a table above a breakpoint |
| `<wc-field>` | `field` | `elements.js` | links the help text and the error to the control with `aria-describedby`, writes validation messages under the field once the control is left or a submit reports it, accepts `setError()` from a host that validates against a schema, and adds a `maxlength` counter |
| `<wc-format>` | `format` | `elements.js` | replaces the authored text with a locale-aware relative time, date, number, percentage or currency read from the machine value, and keeps a relative time current |
| `<wc-gallery>` | `gallery` | `elements.js` | a real `showModal()` open, neighbour preload and the thumbnail→full-image view-transition morph |
| `<wc-icon-picker>` | `icon-picker` | `(none — editor-v2 track, not yet bundled)` | browses the semantic icon map for the configured set |
| `<wc-image-compare>` | `image-compare` | `elements.js` | drag handle revealing the before/after image |
| `<wc-marquee>` | `marquee` | `elements.js` | fills the track with enough copies to scroll seamlessly |
| `<wc-multi-field>` | `multi-field` | `elements.js` | add/remove repeating field rows |
| `<wc-oklch-color-picker>` | `oklch-color-picker` | `(none — editor-v2 track, not yet bundled)` | OKLCH L/C/H picker |
| `<wc-range>` | `range` | `elements.js` | overlays two native range inputs on one track with thumbs that cannot cross and a filled span between them, and keeps an `<output>` current |
| `<wc-split-panel>` | `split-panel` | `elements.js` | draggable divider between two panels |
| `<wc-tabs>` | `tabs` | `elements.js` | a WAI-ARIA tablist (arrow/Home/End keys, automatic activation, roving tabindex) built from the headings, one panel shown at a time, URL-fragment deep links |
| `<wc-theme-editor>` | `theme-editor` | `@getvitops/core/editor` | live `:root` token overrides, export as CSS or a config patch |
| `<wc-tree>` | `tree` | `elements.js` | WAI-ARIA tree semantics, roving-tabindex keyboard navigation, filter, expand/collapse all, hash deep-linking |
| `<wc-turnstile>` | `turnstile` | `elements.js` | loads Cloudflare Turnstile on first interaction with the form and holds a submit until its token arrives |
| `<wc-typography-config>` | `typography-config` | `(none — editor-v2 track, not yet bundled)` | type role editor |

`<wc-color-wheel>`, `<wc-icon-picker>`, `<wc-oklch-color-picker>`, `<wc-typography-config>` are **registered but in no bundle** (the editor-v2 track). The tags are inert in a consumer project — they are listed so that "the tag does nothing" is documented rather than discovered.

## Astro components

| Component | Pattern | Emits |
| --- | --- | --- |
| `@getvitops/astro/components/Breadcrumbs.astro` | `breadcrumbs` | tier-1 markup — no web component |
| `@getvitops/astro/components/Cards.astro` | `card` | the `<wc-cards>` tag, fallback inside |
| `@getvitops/astro/components/Carousel.astro` | `carousel` | the `<wc-carousel>` tag, fallback inside |
| `@getvitops/astro/components/Combobox.astro` | `combobox` | the `<wc-combobox>` tag, fallback inside |
| `@getvitops/astro/components/ConfigForm.astro` | `config-form` | the `<wc-config-form>` tag, fallback inside |
| `@getvitops/astro/CookieConsent.astro` | `consent` | the `<wc-consent>` tag, fallback inside |
| `@getvitops/astro/components/Counter.astro` | `counter` | the `<wc-counter>` tag, fallback inside |
| `@getvitops/astro/components/Details.astro` | `details` | tier-1 markup — no web component |
| `@getvitops/astro/components/Drawer.astro` | `drawer` | tier-1 markup — no web component |
| `@getvitops/astro/components/Entries.astro` | `entries` | the `<wc-entries>` tag, fallback inside |
| `@getvitops/astro/components/Field.astro` | `field` | the `<wc-field>` tag, fallback inside |
| `@getvitops/astro/components/Format.astro` | `format` | the `<wc-format>` tag, fallback inside |
| `@getvitops/astro/components/Gallery.astro` | `gallery` | the `<wc-gallery>` tag, fallback inside |
| `@getvitops/astro/components/Icon.astro` | `icon` | tier-1 markup — no web component |
| `@getvitops/astro/components/LocationPage.astro` | `location-pages` | tier-1 markup — no web component |
| `@getvitops/astro/components/ServicePage.astro` | `location-pages` | tier-1 markup — no web component |
| `@getvitops/astro/components/Marquee.astro` | `marquee` | the `<wc-marquee>` tag, fallback inside |
| `@getvitops/astro/components/Masthead.astro` | `masthead` | tier-1 markup — no web component |
| `@getvitops/astro/components/NavShell.astro` | `navshell` | tier-1 markup — no web component |
| `@getvitops/astro/components/NavShellToggle.astro` | `navshell` | tier-1 markup — no web component |
| `@getvitops/astro/components/Popover.astro` | `popover` | tier-1 markup — no web component |
| `@getvitops/astro/components/Range.astro` | `range` | the `<wc-range>` tag, fallback inside |
| `@getvitops/astro/components/ReviewCard.astro` | `review` | tier-1 markup — no web component |
| `@getvitops/astro/components/SiteNav.astro` | `sitenav` | tier-1 markup — no web component |
| `@getvitops/astro/components/SiteFooter.astro` | `sitenav` | tier-1 markup — no web component |
| `@getvitops/astro/components/Subgrid.astro` | `subgrid` | tier-1 markup — no web component |
| `@getvitops/astro/components/Tabs.astro` | `tabs` | the `<wc-tabs>` tag, fallback inside |
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

## EmDash blocks

Portable Text block `_type`s from `@getvitops/emdash`. Repeating patterns are
repeater fields. A Portable Text block cannot contain other blocks, so a pattern that must hold
them is a schema-level block TYPE with a Portable Text body instead — `vitops_section`,
from `vitopsBlockTypes()`. Its body accepts every `vitops_*` block below.

| Block | Pattern | Renders via |
| --- | --- | --- |
| `vitops_badges` | `badge` | tier-1 markup |
| `vitops_banner` | `banner` | tier-1 markup |
| `vitops_actionLink` | `btn` | tier-1 markup |
| `vitops_callout` | `callout` | tier-1 markup |
| `vitops_cards` | `card` | `<Cards />` |
| `vitops_carousel` | `carousel` | `<Carousel />` |
| `vitops_copyButton` | `copy` | tier-1 markup |
| `vitops_stats` | `counter` | `<Counter />` |
| `vitops_actionLink` | `cta` | tier-1 markup |
| `vitops_details` | `details` | `<Details />` |
| `vitops_accordion` | `details` | `<Details />` |
| `vitops_banner` | `dismissable` | tier-1 markup |
| `vitops_embed` | `embed` | tier-1 markup |
| `vitops_entries` | `entries` | `<Entries />` |
| `vitops_gallery` | `gallery` | `<Gallery />` |
| `vitops_imageCompare` | `image-compare` | tier-1 markup |
| `vitops_actionLink` | `link` | tier-1 markup |
| `vitops_logos` | `logos` | tier-1 markup |
| `vitops_marquee` | `marquee` | `<Marquee />` |
| `vitops_reviews` | `review` | `<ReviewCard />` |
| `vitops_section` | `section` | tier-1 markup |
| `vitops_nav` | `sitenav` | `<SiteNav />`, `<SiteFooter />` |
| `vitops_hero` | `split` | tier-1 markup |
| `vitops_stats` | `stats` | tier-1 markup |
| `vitops_steps` | `steps` | tier-1 markup |
| `vitops_pricing` | `subgrid` | `<Subgrid />` |
| `vitops_tabs` | `tabs` | `<Tabs />` |
| `vitops_tree` | `tree` | `<Tree />` |
| `vitops_form` | `turnstile` | tier-1 markup |
| `vitops_widgetArea` | `widget-area` | tier-1 markup |

### Web components with no block, on purpose

Every shipped `wc-*` element either has a block above or a stated reason here
(`emdashExempt` in the manifest, enforced by `tiers.test.ts`):

- `wc-color-scheme-toggle` — site chrome (header/footer), not page content; belongs in the nav/layout
- `wc-combobox` — a form control, composed inside a form (vitops_form) rather than placed as page content
- `wc-config-form` — configuration tooling for a site owner, not page content a visitor reads or an editor places
- `wc-consent` — site chrome: the layout renders `<CookieConsent />` once; an editor-placed copy would duplicate the gate
- `wc-field` — a form control wrapper, composed inside a form (vitops_form) rather than placed as page content
- `wc-format` — inline text formatting, used inside other content rather than placed as a block of its own
- `wc-multi-field` — repeats rows a visitor adds at submit time (several phone numbers, guests); `vitops_form` has a fixed, editor-defined field list and no such field type
- `wc-range` — a form control, composed inside a form (vitops_form) rather than placed as page content
- `wc-split-panel` — app UI (resizable panes), not editorial content; an editor does not drag-resize a published page
- `wc-theme-editor` — tooling, not content; it is mounted in the EmDash admin by `designSystemEditor`, never in a page

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
| `breadcrumbs` | `patterns/breadcrumbs.css` | `breadcrumbs` | — |
| `btn` | — | `btn` | declared |
| `callout` | `patterns/callout.css` | `callout`, `callout__body`, `callout__title`, `callout__text`, `callout__actions`, `callout--center` | — |
| `card` | `patterns/card.css` | `card`, `card__title` | declared |
| `carousel` | `patterns/carousel.css` | `carousel`, `carousel__track`, `carousel__slide`, `carousel__media`, `carousel__hint` | declared |
| `centered` | `layout.css` | `centered`, `spotlight`, `breakout`, `fullbleed` | — |
| `cluster` | `patterns/cluster.css` | `cluster`, `cluster-between`, `cluster-start` | — |
| `code` | `patterns/code.css` | — | — |
| `color-scheme-toggle` | `patterns/icon.css` | — | — |
| `combobox` | `patterns/combobox.css` | `combobox`, `combobox__input`, `combobox__listbox`, `combobox__option`, `combobox__empty` | declared |
| `comment` | `patterns/comment.css` | `comment`, `comment__author`, `comment-thread` | declared |
| `consent` | `patterns/consent.css` | `consent`, `consent__body`, `consent__options`, `consent__actions` | — |
| `copy` | `patterns/copy.css` | `copy`, `copy__button`, `copy__icon`, `copy__tooltip` | — |
| `counter` | `patterns/counter.css` | `counter`, `counter__value`, `counter__presentation` | — |
| `cta` | — | `cta`, `cta-danger` | declared |
| `details` | `patterns/details.css` | `details`, `details-trigger`, `details-icon` | declared |
| `dialog` | `patterns/dialog.css` | `dialog__header`, `dialog__body`, `dialog__footer` | declared |
| `dismissable` | `patterns/banner.css` | `banner__close`, `notification__close` | — |
| `drawer` | `patterns/drawer.css` | `drawer`, `drawer--start`, `drawer--end` | declared |
| `dropdown` | `patterns/dropdown.css` | `dropdown--show-on-hover` | declared |
| `embed` | `patterns/embed.css` | `embed`, `embed__frame`, `embed__placeholder` | — |
| `entries` | `patterns/table.css` | `entries__table`, `entries__scroll`, `entries__nav` | — |
| `field` | `patterns/forms.css` | `field`, `field__control`, `field__label`, `field__help`, `field__error`, `field__counter` | — |
| `forms` | `patterns/forms.css` | `form-group`, `input-group`, `fieldset`, `custom-check` | declared |
| `gallery` | `patterns/gallery.css` | `gallery`, `gallery__item`, `gallery__trigger`, `gallery__thumb` | declared |
| `grouped` | `patterns/grouped.css` | `group`, `group-inline`, `bordered` | — |
| `horizontal-scroll` | `patterns/horizontal-scroll.css` | `horizontal-scroll` | — |
| `icon` | `patterns/icon.css` | `icon`, `icon-button`, `icon-mask` | — |
| `icon-picker` | `patterns/icon.css` | — | — |
| `image-compare` | `patterns/splitter.css` | `image-compare`, `image-compare__before`, `image-compare__handle` | — |
| `lightbox` | `patterns/lightbox.css` | `lightbox-dialog`, `lightbox-dialog__track`, `lightbox-dialog__close` | declared |
| `link` | `patterns/anchor-link.css` | `link`, `skip-link`, `stretched-link`, `raised` | declared |
| `list` | `patterns/list.css` | `facet-list`, `filtered-list` | declared |
| `logos` | `patterns/logos.css` | `logos`, `logos__item`, `logos__name`, `logos--grayscale` | — |
| `marquee` | `patterns/marquee.css` | `marquee`, `marquee__content`, `marquee__item` | — |
| `masonry` | `patterns/masonry.css` | `masonry`, `masonry__item` | — |
| `masthead` | `patterns/masthead.css` | `masthead`, `masthead--sticky`, `masthead--glass`, `masthead--floating` | — |
| `media` | `patterns/media.css` | `media`, `media__figure`, `tile` | — |
| `multi-field` | `patterns/forms.css` | `form-group`, `input-group`, `fieldset` | — |
| `nav` | `patterns/nav.css` | `menu`, `navbar`, `nav-collapse`, `drawer-nav`, `dropdown-trigger`, `dropdown-menu`, `dropdown-icon` | declared |
| `navbar` | `patterns/navbar.css` | `navbar`, `navbar--sticky`, `nav-items` | — |
| `navshell` | `patterns/navshell.css` | `navshell`, `navshell__bar`, `navshell__panel`, `navshell-toggle` | — |
| `notification` | `patterns/notification.css` | `notification`, `notification__title`, `notification__actions` | declared |
| `overlay` | `patterns/overlay.css` | `overlay` | — |
| `popover` | `patterns/popover.css` | `popover`, `popover-trigger`, `popover-anchor` | declared |
| `pull-quote` | `patterns/pull-quote.css` | `pull-quote`, `pull-quote__attribution` | declared |
| `range` | `patterns/range.css` | `range`, `range--dual`, `range__track` | — |
| `reveal` | `patterns/reveal.css` | `reveal`, `reveal-fade`, `reveal-h` | — |
| `review` | `patterns/review.css` | `review`, `review__stars`, `review__body`, `review__reply`, `review__source` | declared |
| `scroll-based` | `patterns/scroll-based.css` | `parallax`, `scroll-progress`, `scroll-spy` | — |
| `scroll-target` | `patterns/scroll-target.css` | `scroll-target-group`, `toc-sidebar` | — |
| `section` | `patterns/section.css` | `section`, `section__head`, `section__kicker`, `section__title`, `section__sub`, `section__body`, `section--split`, `section--center`, `block-anchor` | — |
| `separator` | `patterns/separator.css` | `separator`, `separator__text`, `separator__ornament` | — |
| `sitenav` | `patterns/sitenav.css` | `sitenav`, `sitenav__link`, `sitenav--drawer-start`, `sitenav--panel-dropdown`, `sitenav--mega`, `navlist`, `navlist--columns` | — |
| `split` | `layout.css` | `split`, `split-1-2`, `split-reverse` | — |
| `split-link` | `patterns/split-link.css` | `split-link`, `split-link__toggle`, `split-link__panel` | — |
| `split-panel` | `patterns/splitter.css` | `splitter`, `splitter__panel`, `splitter__handle` | — |
| `stack` | `patterns/stack.css` | `stack`, `stack__card` | — |
| `stats` | `patterns/stats.css` | `stats`, `stats__item`, `stats__figure`, `stats__label`, `stats__group`, `stats__delta`, `stats--tiles` | — |
| `status` | `patterns/tag.css` | `status`, `status-dot--pulse` | declared |
| `steps` | `patterns/steps.css` | `steps`, `steps__item`, `steps__body`, `steps__title`, `steps__text`, `steps--row`, `steps--cards`, `steps--animated` | declared |
| `sticky` | `patterns/sticky.css` | `sticky`, `sticky-header`, `sticky-nav` | — |
| `subgrid` | `patterns/subgrid.css` | `subgrid`, `subgrid-card`, `pricing-grid` | — |
| `svg` | `patterns/svg.css` | `svg-container`, `svg-shape`, `svg-animated` | — |
| `table` | `patterns/table.css` | `table`, `table-wrapper` | declared |
| `tabs` | `patterns/tabs.css` | `tabs`, `tabs__list`, `tabs__tab`, `tabs__panel`, `tabs--vertical` | declared |
| `tag` | `patterns/tag.css` | `tag`, `tag__remove`, `tag__icon`, `tag-list` | declared |
| `text-effects` | `patterns/text-effects.css` | `typing`, `text-highlight`, `text-gradient-animate`, `text-stagger` | — |
| `theme-editor` | `patterns/theme-editor.css` | `ed-panel`, `ed-launch`, `ed-input` | — |
| `tone` | `patterns/tone.css` | `tone`, `tone--solid`, `accent` | — |
| `tooltip` | `patterns/tooltip.css` | `tooltip-trigger` | declared |
| `tree` | `patterns/tree.css` | `tree`, `tree__item`, `tree__content`, `tree__summary`, `tree__toggle`, `tree__label` | declared |
| `turnstile` | `patterns/forms.css` | `form-group` | — |
| `widget-area` | `patterns/widget-area.css` | `widget-area`, `widget__title`, `widget__menu` | — |
