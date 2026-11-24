# @getvitops/config

## 9.0.0-alpha.11

## 9.0.0-alpha.10

## 9.0.0-alpha.9

## 9.0.0-alpha.8

### Minor Changes

- c66bda9: Sitemap `<lastmod>` on EmDash sites (all formats — no CSS change).

  EmDash dates every CMS entry in its own `/sitemap.xml`, but cannot list `src/pages` routes and offers no way to add them; the only escape (a hand-written `sitemap.xml` route) discards its dates. Hybrid sites were left with undated pages and `search notify` advice (`gitLastmod()` in the `sitemap` option) that did nothing under EmDash.

  - **`vitops({ sitemap })` now works with `emdash()` registered** (it used to warn and skip). A build writes `public/pages-sitemap.xml` for the `src/pages` routes only, dated from git, and writes **nothing** when there are none. New `sitemap.exclude` option for a page that only renders a CMS entry. A file without the generated marker is never replaced. CI needs full history (`fetch-depth: 0`); the shared `site-deploy-emdash.yml` now does this.
  - **`seo.indexing.sitemapUrl` accepts a list.** Unset, `search notify` discovers `sitemap-index.xml` (Astro), `sitemap.xml` (EmDash) and `pages-sitemap.xml` and uses the ones that exist and hold a `<url>`; an explicit value turns discovery off. Previously an EmDash site with no `sitemapUrl` derived `sitemap-index.xml`, which EmDash does not serve.
  - **`search notify` output lists every sitemap** with why it is there (`required for non-EmDash content (src/pages)`), submits each to Search Console, and names up to three URLs missing a `<lastmod>`. `vitops robots` emits one `Sitemap:` line per listed URL.
  - Migration: none required. `@getvitops/emdash`, `@getvitops/core`, `@getvitops/vite`: No consumer-facing change in this package.

- c38ce48: Scroll-aware chrome (new CSS: all formats).

  - **Scroll states (BREAKING for `site.chrome.masthead`).** `masthead.states` describes the bar as a partial look per scroll state — `atStart`, `atEnd`, `scrollingToEnd`, `scrollingToStart`, later wins — with `layout`, `height`, `inset`, `surface`, `elevation` (or `false`) and `hidden`, and every change animates. That makes a full-width banner at the top that floats once scrolled, a bar hidden until first scroll (a hero fills the viewport), and hide-on-scroll all the same feature. A state that hides the bar at the start, or changes size or layout, implies `position: fixed`; the bar never hides while focused or a menu is open; Firefox (no `scroll-state()`) keeps the settled look. The vocabulary is shared (`SCROLL_STATES` / `scrollStateQuery()` from `@getvitops/config`; the custom-property hooks are `--<pattern>-<state>-<prop>`), and the page container is now named `page`.
    - **Migration** (`resolveMasthead` throws naming each): `behavior: "reveal-on-scroll"` → `states.atStart.hidden: true`; `behavior: "hide-on-scroll"` → `states.scrollingToEnd.hidden: true`; `surface: "transparent-until-scrolled"` → the settled `surface` plus `states.atStart.surface: "transparent"`; `elevation.onScroll` → `states.atStart.elevation: false`. The old `.masthead--hide-on-scroll` / `--transparent-until-scrolled` / `--shadow-on-scroll` / `--border-on-scroll` classes remain in the CSS as aliases for hand-written markup; `<Masthead>` no longer emits them.
  - **`.scroll-edges`, `<ScrollEdges>`** (new `scroll-edges.css`): a horizontal strip that fades at an edge while there is more to scroll that way, using the same `at-start` / `at-end` states on the inline axis. Both fades show where `scroll-state()` is unsupported.
  - **`<BackToTop>`, `site.chrome.backToTop`** (rendered by `<SiteFooter config={site}>`) and **`<ScrollCue>`** (`.back-to-top`, `.scroll-cue`, new `scroll-button.css`). Plain `#anchor` links; hidden by `scroll-state()` queries, always shown where unsupported.
  - **`<Toc headings>`** and a scrollspy fallback: `polyfills.js` now loads a small IntersectionObserver (`scroll-target-group` polyfill) that sets `.is-current` and `aria-current="location"` where `:target-current` is missing. New polyfill name `scroll-target-group` is valid in `vitops({ polyfills: { disable } })`.
  - **`vitops_hero`** gains `scrollCue` and `scrollCueLabel` fields.

## 9.0.0-alpha.7

## 9.0.0-alpha.6

### Minor Changes

- 8b823d5: **Added `site.accessibility`: the accessibility target a site is held to.** `{ standard: 'wcag20' | 'wcag21' | 'wcag22', level: 'none' | 'A' | 'AA' | 'AAA', acceptedRisk?: string }`. It records a decision, not a conformance claim; `acceptedRisk` is free text (who accepted a lower target, when, why) printed in the audit header.

  - **WCAG 2 contrast ratio is now checked beside APCA** (`contrastRatio()` in `@getvitops/utils/color`; 4.5:1 for text, 3:1 for icons and boundaries). APCA is not the legal test: AODA is WCAG 2.0 AA, which is a ratio, and a palette can pass APCA and miss 4.5:1. At `level: 'AA'` or `'AAA'` a ratio miss **fails the build**; at `A`, `none`, or with no `site.accessibility` it is a build warning. APCA failures still fail the build in every case, and `acknowledgeContrast` still applies to APCA only. **Migration:** a site that sets `AA` and has a palette under 4.5:1 will now fail `generate`; fix the palette, or record a lower `level` with `acceptedRisk`.
  - **`vitops audit` reads `site.accessibility`** (`--input`, default `site.json`, optional): axe tags follow the standard and level, and `level: 'none'` reports violations without failing the run (performance budgets still apply). It now also writes `report.html`. **The report is an artifact, never site content**: it lists every violation, so keep it under `.vitops/audit/` and out of the build output.
  - **New scaffolds and `vitops init --site` default to `wcag21` / `AA`.** Existing sites are unchanged until they add the field.

  Affects all formats equally (no CSS change). No consumer-facing change in `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`.

- 59d2f23: The brand step also edits named shadows (`shadows`, box and drop) and layout widths and region spacing (`layout.widths`, `layout.regionSpace`), as a new `brand.shape` projection. A shadow stored as a bare string shows in its Box shadow field. No consumer-facing change in the other packages.
- dbc4dda: **Added: `@getvitops/config/forms`, the field layer for editing a `site.json` in a form.** Pure and Worker-safe (no zod, no Node builtin, no import from the rest of the toolchain): every function takes the JSON Schema (`config.schema.json`) as an argument, so a host that cannot load the generator still gets the same field choice, grouping and validation as one that can.

  - **Projections.** `PROJECTIONS` are named, ordered groups of config paths (`organization.identity`, `site.accessibility`, `brand.basics`, …) and `ONBOARDING_STEPS` arranges them into the sequence a new client fills in. `resolveProjection()` and `describeField()` turn a path into a descriptor (label, required, the widget derived from the schema node: text, email, date, radio or select for an enum, switch, locale map, lines, keyed map, fieldset) so the decision is made once, from the schema that validates the value. Labels live in `FIELD_META`, not the schema; a field with none gets a humanised key.
  - **Validation.** `validateAgainstSchema()` and `validateField()` are a JSON Schema walker for exactly the keywords the config schema uses (including `prefixItems`, `minLength`, `minItems` and `oneOf`, which the portal's copy of this walker did not know). `unhandledKeywords()` is the tripwire.
  - **Form codec.** `formToConfig()` and the name builders (`scalarName`, `locName`, `mapKeyName`, …) are the flat `name=value` wire format a no-JS form posts, moved here from the portal so the renderer and the parser import the same names. An empty number field now writes nothing; the portal's copy wrote `0`.
  - **`pickSchema()`, `stepStatus()`.** The first narrows the schema to the paths a form edits, so a required field elsewhere is not reported against it; the second derives which onboarding steps a draft has finished (complete, incomplete, invalid, empty), so no progress is stored.
  - **`renderInlineMarkdown`** moved here from `@getvitops/generator`, which re-exports it, so nothing that imports it changed.

  Three drift guards in `@getvitops/generator`: every projected path must exist in the schema; every top-level `organization` / `site` key must be projected or listed in `UNPROJECTED` with a reason; and the validator must implement every keyword the schema uses. A fourth walks the built `@getvitops/generator/config` import graph and fails on a Node builtin, lightningcss or tailwind, since the portal runs it on a Worker (a static check, not a workerd run).

  No CSS changed, so no format is affected. `@getvitops/generator`: the tests and the re-export only. `core`, `utils`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.

- a5754c1: The brand step edits fonts. A map of plain strings (`designSystem…fonts`, `typography.families`) now renders a value field per row (it showed only the key before), named `…$map.N.$value` and read back by `formToConfig`. A new `combobox` widget (`FieldMeta.suggestions`) renders a `<wc-combobox>` over an `<input list>`, so font stacks come with suggestions and still accept free text, with the native datalist as the no-JS fallback. A row copied by `<wc-multifield>` after its combobox upgraded gets a clean one of its own. No consumer-facing change in `@getvitops/generator` or `@getvitops/core` beyond that.
- e12086a: **Added a high-contrast layer and a toggle for it.** WCAG 2 AA is the floor; this is the route above it, and the G174 route for a brand palette that cannot reach it.

  - **A third appearance axis (css and tailwind formats; Bricks supplies its own colour tokens, so there is nothing to re-point there).** `generate()` now emits a layer that answers `@media (prefers-contrast: more)`, `:root[data-contrast="more"]` and the `.contrast-toggle` checkbox. It is not a `themes` entry: like dark mode it re-points the role tokens, so it composes with light, dark and the OS-preference block. Text walks to 7:1, borders collapse onto the icon token, solids walk until `text-on-<role>` clears 7:1, and `--surface-glass` becomes opaque. `data-contrast="standard"` opts a visitor out of the media query. The layer itself must clear the baseline bars (4.5:1 text, 3:1 non-text) or `generate` fails; missing 7:1 only warns.
  - **`site.accessibility.contrastToggle: true`** declares that the site ships the toggle. A baseline contrast miss then **warns instead of failing**, but only for a role whose high-contrast layer conforms. Default `false`.
  - **`<ContrastToggle />`** (`@getvitops/astro/components/ContrastToggle.astro`) emits `<wc-contrast-toggle>` around a plain `<label class="contrast-toggle"><input type="checkbox">`. The checkbox works with no JavaScript; the element adds starting checked under `prefers-contrast: more` and remembering the choice behind the `preferences` consent category. `core/css/global.css` also gives the layer a 3px outline and drops `backdrop-filter`.
  - **`<Head contrast />`** restores a remembered choice before first paint. Opt-in, and a separate inline script from the colour-scheme one on purpose: changing that script would change its hash and break the dark-mode bootstrap on every site that pins it in a CSP. A site with a hash-pinned policy adds `inline: { contrast: true }` to `contentSecurityPolicy()`.

  - **`vitops audit` runs a second axe pass when `contrastToggle` is set** (`@getvitops/utils/audit`, the CLI): with `data-contrast="more"` on `<html>`. A contrast violation that clears is reported as "conforming only with the high-contrast layer on" and does not fail the page; a page with **no `.contrast-toggle`** fails (`toggle-missing`), and a contrast violation that survives the layer fails, because the layer is then not a conforming alternative.
  - **Two pattern fixes the audit found.** `code` filled itself with a _border_ token (`border-neutral`), which the high-contrast layer turned dark under dark text (2.07:1); it now uses `bg-neutral-x-muted` (a slightly lighter chip in every format). `.comment__date` faded its text with `opacity: 0.7` (3.9:1); it now uses `text-neutral-muted`. **All formats.**
  - **Forced-colors sweep.** Floating surfaces (`dialog.dialog`, `.drawer`, `.tooltip`, `.notification`, `.consent`, `.combobox__listbox`, any open `[popover]`) get a 1px system-colour `outline` under `forced-colors: active`, so one that rests on a `box-shadow` (a consumer's `b: none`, or a bare popover) no longer vanishes. The `.switch` track and thumb get system colours, since the muted track and white thumb flattened to the same canvas and the thumb's shadow was dropped. **All formats.**

  Pattern CSS (`contrast-toggle.css`) reaches **all formats**; the token layer it switches reaches **css and tailwind only**, so the toggle is inert under `bricks`.

  No consumer-facing change in `@getvitops/vite`.

- a9d00c9: Two fixes to the config form. **Saving no longer resurrects or loses fields.** `mergeOwned` (the portal's merge) moves into `@getvitops/config/forms`, with `ownedFromProjections`: a submission replaces only the paths its projections own, a value the form dropped (cleared, or a row removed) is removed from the result, and fields a projection never shows (a palette hue's `anchors`, a role's `solid`) are kept. `<wc-config-form>` gains `merged(base)` and an `owned` attribute (or `ownedItems` property), and `<ConfigForm projections={[…]}>` wires them. `/configure` used a plain deep merge, which could not delete anything. **A select built from another map's keys stays current.** A colour role's hue select is re-read from the palette as hues are added or removed (`data-options-from` on the select, `optionsFrom` on the descriptor), keeping the current choice. Affects the web-component bundle in all formats; no CSS or markup class changes. Other fixed-group packages: no consumer-facing change.
- 798a04a: Config forms: rows you can add and remove, and a colour picker on brand colours.

  - **`<wc-multifield>`** replaces `<wc-multi-field>` (**breaking: rename `wc-multi-field` to `wc-multifield`**; the Bricks element key `vitops-multi-field`, the `--multi-field-gap` property and the `multi-field-*` events are unchanged). It is now light DOM and Lit-free, so the framework's form CSS applies and the controls are native: the authored inputs are the no-JS fallback and submit with the form. Kept from the old element: `min`, `max`, `protect-defaults`, Clear, `add-label` / `clear-label` / `delete-label`, `type`, `placeholder`, `name` (`name[]`). New: it repeats a whole fieldset too, with each row an open `<details>` titled by its key, a polite announcement of changes, and a row unfolds when a blocked submit is about it. The slots `add-label` / `clear-label` / `delete-label` and the `::part`s are gone (shadow DOM); use the attributes and the `.multifield__*` classes. `renderProjectionHtml` wraps every keyed map in it, so rows are now `<details class="field__row">` with the fields in `.field__row-body` where they were `<fieldset class="field__row">`. Forms CSS: **all formats**.
  - **`<wc-color-field>`** (`@getvitops/core/color-field`, new): a colour text input with the theme editor's OKLCH picker offered beside it. The text input is still the fallback and the only submitted control; the picker (~40 KB gzipped) is fetched only when it is first opened. `<ConfigForm colorPicker>` loads it. Forms CSS: **all formats**.
  - `verify-bundle-size` now counts the chunks an entry imports statically (Lit is shared between `elements.js` and the picker), so `elements.js` is measured as the page downloads it; its ceiling moves from 33,000 to 33,600 B for that reason.

  No consumer-facing change in `@getvitops/cli` and `@getvitops/vite`.

- 1f1a3dd: **The generator's contrast contract is now the WCAG 2 contrast ratio and nothing else. APCA is removed.** APCA is perceptually better but is no longer on the W3C standards track, so no law (AODA is WCAG 2.0 AA) or conformance claim is tested with it. Two things were wrong with the old arrangement: a palette could pass APCA and miss 4.5:1, and the ratio only failed the build when `site.accessibility.level` was `AA` or `AAA`.

  **Breaking:**

  - **Bars.** Text, including `text-<role>-muted` on every plane of its role, must reach **4.5:1**; icons and a surface role's `border-<role>-bold` **3:1**; `text-on-<role>` **4.5:1** on its solid. There is no separate "secondary text" tier any more.
  - **Unset is AA.** A site with no `site.accessibility` (or no `level`) now **fails the build** on a ratio miss. Only an explicit `level: 'A'` or `'none'` downgrades it to a warning. **Migration:** fix the palette, or set `level` and record why in `acceptedRisk`.
  - **`colors.roles.<role>.acknowledgeContrast` is now in ratio points, not Lc.** `1` used to mean one Lc point; it now means 1.0 of ratio (e.g. `0.1` excuses 4.4:1 against 4.5:1). `vitops lint --fix` cannot convert it, because the two scales have no fixed mapping: re-measure the pairing and set a new value.
  - **`contrastLc()` is removed from `@getvitops/utils/color`.** Use `contrastRatio()`. `pickOn()` now picks the near-white or near-black with the higher ratio, so a mid-tone solid can choose a different `text-on-<role>` than before.
  - **Token changes that follow from the ratio.** Surface roles' light `text-muted` moved from step 700 to 800 (it sat at about 4.4:1 on the `bg-x-muted` well in some hues). The starter config from `defaultConfig()`/`vitops init` sets `solid: 700` on `info` and `danger` (their step 600 was 4.35:1 and 4.40:1 under white text), and this repo's example `neutral` role does the same. A config that pins a role's solid at a step under 4.5:1 will now fail `generate`.
  - `validateColorContract()` (the EmDash editor's save gate) now honours each role's `solid` option and judges the same ratio contract as a build.

  **Affects all formats** (css, bricks, tailwind): the step changes alter emitted token values; the layers and class vocabulary are unchanged.

  No consumer-facing change in `@getvitops/cli`, `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`. `@getvitops/config` only updates the `site.accessibility.level` description. `@getvitops/skills` updates `vitops-accessibility` to describe the new behaviour.

### Patch Changes

- a95a4fc: **Added: tabs, breadcrumbs, combobox, format and range.** Each is tier 1 or a tier-2 element whose fallback is real and complete, and each has an Astro wrapper.

  - **`<Breadcrumbs>`** (CSS + Astro, no JS): `<nav aria-label="Breadcrumb" class="breadcrumbs"><ol>`, the last item `aria-current="page"` and never a link, and the `BreadcrumbList` JSON-LD from the same items (`schema={false}` to omit). CSS: **all formats**.
  - **`<Tabs>` / `<wc-tabs>`**: headed `<section>`s that are all readable with no JS; with it, a WAI-ARIA tablist (arrows on the axis `orientation` names, Home/End, automatic activation, wrapping), URL-fragment deep links including to something inside a panel, `hash` to write the fragment, `tabs-change`. The heading it turns into a tab label is hidden so the name isn't announced twice. EmDash: new `vitops_tabs` block. CSS: **all formats**. This replaces the "generated pattern only" `tabs` entry: the `tabs` config pattern still supplies the `panel` group tokens, now consumed by `patterns/tabs.css`.
  - **`<Combobox>` / `<wc-combobox>`**: `<input list>` + `<datalist>` with no JS; with it, an ARIA 1.2 combobox (`aria-activedescendant`, Down/Up wrap, Enter chooses without submitting, Escape closes then clears, a live result count). A value that matches no option is kept: it suggests, it does not constrain. Replaces the CSS-only shell; `combobox.css` now opens on `:not([hidden])` so Escape can close it. CSS: **all formats**.
  - **`<Format>` / `<wc-format>`**: a real `<time datetime>` / `<data value>` with the text already in it; with JS, a locale-aware relative time, date, number, percentage or currency read from the machine value, kept current at the next minute/hour boundary and paused while the tab is hidden. Anything it can't format is left as written. No CSS.
  - **`<Range>` / `<wc-range>`**: one or two native range inputs (two submit as two fields) with no JS; with it, one track, thumbs that can't cross, the filled span and an `<output>`. A single slider needs no element: `forms.css` already themes `input[type='range']`. CSS: **all formats**.

  `elements.js` grows from 28.1 KB to 31.8 KB gzipped for these four elements; the size budget moves to 33 KB.

  **Fixed:** `<wc-image-compare position="25">` was ignored on first render (see the earlier entry).

  **Not built:** dialog and a `role="menu"` dropdown. A dropdown is the native Popover API plus anchor positioning (`.dropdown--show-on-hover` for hover), which is how it is built today, so nothing was added.

  `@getvitops/utils`, `cli`, `vite`, `config` and `create` — no consumer-facing change in these packages.

- 333880e: **Fixed: a form field is only marked required when everything above it is.** `site.domains.canonical` is required _within_ `domains`, and `site.crm.provider` within `crm`, but both blocks are optional, so a form that put the native `required` attribute on them forced a custom domain and a CRM onto every site. `FieldDescriptor.required` (`@getvitops/config/forms`) now uses `isUnconditionallyRequired`: the field is required by its parent and every ancestor is required by its own. Validation is unchanged; the schema still requires `canonical` once `domains` exists.

  **CSS, all formats** (`stepper.css`): a `.stepper__actions` row honours the `hidden` attribute, and a `<wc-stepper>` section the element has put away stays hidden whatever display its own classes set (`.rhythm` would otherwise out-rank the attribute).

  The docs site gains a `/configure` page that builds a `site.json` step by step with `<Stepper>` and `<ConfigForm>` (no package change). `config`: the required fix. `core`: the CSS above. `utils`, `generator`, `cli`, `vite`, `astro`: no consumer-facing change in these packages.

- d380b78: **Added: the `vitops_tree` block, and landing pages in the emdash template.**

  - **`vitops_tree`** (`@getvitops/emdash`): an expandable outline for a file tree, a site map or nested sections. Block fields can't nest, so the editor types an indented outline (one node per line, indent to nest, `| badge` for a chip) and the block builds the `<Tree />` from it. Only plain label, badge and a derived id reach the tree: it never sets `descriptionHtml`, which `<Tree />` renders as raw HTML, so markup typed into the outline is shown as text. Capped at 500 nodes and six levels. The `tree` manifest entry no longer carries an `emdashExempt` reason.
  - **Landing pages** (`@getvitops/create`, emdash template): new scaffolds ship a `landings` collection whose `layout` is a `blocks` field of `vitops_section`, the `vitops_section` block type in `seed/seed.json`, and `src/pages/landings/[slug].astro` (prerendered, like `pages`). Create a landing in the admin and stack sections, each holding any Vitops block. No sample landing is seeded. `templates.test.ts` fails if the seeded block type drifts from `vitopsBlockTypes()`.

  ### Migration

  A seed is applied once, at a site's first boot, so an existing site gets none of this automatically. Either run `vitops emdash schema apply --from <a site that has it> --to <your site>` for the collection, add `...vitopsBlockTypes()` to the seed's `blockTypes` (a new environment only), or add the collection by hand with `emdash schema create landings` and a `blocks` field allowing `vitops_section`, and copy `src/pages/landings/[slug].astro`. Block types are not replayed by `schema apply` (they are reported); add `vitops_section` from the admin or the seed.

  `@getvitops/generator`, `core`, `astro`, `utils`, `cli`, `vite` and `config` — no consumer-facing change in these packages. No CSS changed, so no format is affected.

- 6763587: **EmDash environments: promotion rehearses on a throwaway copy of production, and syncing prod into dev no longer wipes dev.** Dev is a long-lived staging site (collections and fields are developed there, and content is edited there), but the old `refresh-dev` dropped every table in it, weekly if scheduled, and a promote and a staging session could overwrite each other. Three databases now have one job each: prod (content truth), dev (staging, never wiped blind) and `<db>-rehearse-<run id>` (a copy of prod, one promote run).

  ### Added
  - **`vitops emdash db copy|snapshot|guard-dev|mark-synced|rehearsal|rewrite-config`** (`@getvitops/cli`, over `@getvitops/utils/hosting`). The copy is a four-file dump, so it works on a database with a search index (the old `wrangler d1 export` failed on any FTS5 table), and it stops before the first write if D1 would reject a statement as too big. A target must be named `*-dev` or `*-rehearse-<digits>` and may never be production's id.
  - **`vitops emdash schema diff|apply|export`** (`@getvitops/utils/emdash-schema`). Replays one instance's collections and fields onto another over the REST API with the full field definition (options, validation, widget), additions only. A field defined differently, a target-only item and a block type are reported, never changed. `diff --check` exits 1 on drift. Tokens: `EMDASH_TOKEN_FROM`, `EMDASH_TOKEN_TO`, `EMDASH_TOKEN`.
  - **`site-sync-dev.yml`** (reusable): refuses when dev content changed since the last sync (`force` discards it; the first run needs it), snapshots dev to an artifact, captures dev's schema, resets dev from prod, redeploys so core migrations run, replays dev's schema, and stamps a sync marker. `mode: report` only reports drift.
  - **`site-promote.yml` `rehearse: true`**: builds dev's code, copies prod into a throwaway database, runs `emdash migrate` against it, puts a dev-vs-prod schema diff in the PR body, and deletes the database. It never touches the dev site.
  - **`site-deploy-emdash.yml` `schema-from-url` / `schema-to-url`** (production only, off by default): applies the additive schema diff after the migrations and before the deploy, behind the `production` approval.

  ### Breaking
  - **`@getvitops/create`: the emdash template's `refresh-dev.yml` and `scripts/refresh-dev.mjs` are replaced by `sync-dev.yml`.** The weekly run now only _reports_ drift and never resets dev. `promote.yml` rehearses by default (`rehearse` input, opt out per run). Existing sites keep their own workflow files. Migration: bump `@getvitops/cli` first (the workflows call `vitops emdash db|schema`), copy `sync-dev.yml` and `promote.yml` from the template, delete `refresh-dev.yml` and `scripts/refresh-dev.mjs`, and add the repo secrets `EMDASH_TOKEN_DEV` and `EMDASH_TOKEN_PROD` (admin → Settings → API Tokens) and the dev and production URLs in those two files. Without the tokens a sync resets dev without replaying its schema (`skip-schema: true` says so) and promote shows no schema diff.
  - **`site-refresh-dev.yml` is now a deprecated alias** for the guarded sync (`skip-schema: true`). Its first run refuses until `force: true`, because a dev site with no sync marker can't be told from work in progress.

  Not built: deploying a Worker Preview during rehearsal and replaying the schema there (it needs per-site preview infrastructure the templates don't carry), replaying block types, and a content merge. Untested here: the GitHub Actions workflows themselves (no `actionlint` or runner available; YAML parses and the planners, executors and template wiring are unit-tested), and `emdash migrate --status` output parsing for the fingerprint. Verify with the checklist in AGENTS.md's CI/CD section before moving the `v1` tag.

  Formats: no CSS changed, so none are affected. `@getvitops/core`, `generator`, `vite`, `astro`, `config` and `skills` — no consumer-facing change in these packages.

- 1e5edfc: **Added: the Google Business Profile API approval is now a step in `SETUP.html`.** Google reviews come only from the Business Profile API, which rejects every call from a Google Cloud project Google has not approved, whatever the credential. The approval is a one-time request that takes days to weeks, is per Google Cloud project rather than per site or client, and cannot be done in code, so it is a checklist step (`connections.gbp`) to file at kickoff instead of being discovered as a `403` when the reviews block is built. The setup skill, in both templates, lists it as a hard stop: an agent reports it as a blocker with that lead time and does not tick the step until `vitops reviews --check` stops answering 403. No code or config changed.

  `@getvitops/utils`, `generator`, `core`, `cli`, `vite`, `astro` and `config` — no consumer-facing change in these packages.

- 0e525b8: **Added: location and service pages.** One `organization.locations` or `organization.services` entry becomes a page with the right JSON-LD, so local SEO is a few lines per site instead of hand-written markup.

  - **`<LocationPage location defaultLocale>`** (`@getvitops/astro/components/LocationPage.astro`): the name, description, `<address>` (phone and email as `tel:` / `mailto:` links), an opening-hours table (`Monday – Friday`, `9:00 AM – 5:00 PM`, localised, with a "Closed" row for a dated closure), photos and the `LocalBusiness` JSON-LD, with a slot for your own copy and a `photos` slot to swap in `<Carousel>` / `<Gallery>`. A plain-string photo renders as decorative (`alt=""`); give it `{ src, alt }` to describe it. Visible words come from `labels`.
  - **`<ServicePage service defaultLocale providerName>`**: the name, description, priced offers and the `Service` JSON-LD naming the provider.
  - **`serviceGraph()`** and `<Service>` (`@getvitops/utils/schema`, `@getvitops/astro/schemas/Service.astro`), the missing JSON-LD builder, in the style of `localBusinessGraph`.
  - **`resolveSlug`, `locationToLocalBusiness`, `serviceToGraph`** (`@getvitops/astro/schemas/graph-adapters.ts`): pure adapters over the structural shapes a plain `import site from './site.json'` has (a weekday is checked at runtime, not trusted to the type). `listings` is never emitted.
  - **`GBP_CATEGORY_TYPES` / `localBusinessTypeForCategory()`** (`@getvitops/utils/schema`): a Google Business Profile category id to a `LocalBusiness` subtype, for seeding a location's `type`. Incomplete by design and **not yet verified against Google's category list** (that needs the Business Information API access request); an unknown id returns `undefined`.

  Routing is not scaffolded: a `getStaticPaths()` over an empty record is dead weight on every site without locations. The idiom is in `LocationPage.astro`'s docblock and works on EmDash sites too, since a concrete `locations/[slug].astro` wins over the catch-all. One path per location, not per locale. No CSS changed, so no format is affected.

  **Also: the container render tests now run in CI.** `@getvitops/astro` and `@getvitops/emdash` render `.astro` components through Astro's container API in their own vitest configs, which the root `vp test run` excludes; nothing ran them, so they could have broken unnoticed. CI has a "Container render tests" step, and `@getvitops/astro` gets the `test:container` script its docblock always named. The note that its `container.test.ts` throws was stale: it passes.

  `@getvitops/generator`, `core`, `cli`, `vite` and `config` — no consumer-facing change in these packages.

- 82774d1: **Added: `@getvitops/utils/forms`, a renderer that turns config fields into a complete no-JavaScript HTML form.** `renderProjectionHtml()`, `renderProjectionSection()` and `renderStepHtml()` take the descriptors `@getvitops/config/forms` produces and write the markup once, for every host: an Astro page (`set:html`), an EmDash admin route, a Worker. Every field is a `<wc-field>` around a label that nests its control; help text and the error are pre-linked with `aria-describedby`, so a page re-rendered after a failed POST is already right with scripting off. The form posts the names `formToConfig` parses, and a round trip of every onboarding step against the real schema is a test.

  - **Worker-safe, and light.** No Node builtin and no parse5: the pure node-tree renderer (`nodesToHtml`, `styleList`, `toHtml`) moved out of `html.ts` into `html-render.ts`, which `html.ts` re-exports, so no import changed. A test fails if the forms entry reaches parse5 or the zod-carrying config root.
  - **Safe by construction.** Everything goes through `nodesToHtml`, so text is escaped and tag and attribute names are validated. Attribute values additionally have `&` escaped, so what a visitor typed (`AT&T`, `&copy`) comes back out exactly. A `notice` takes plain text (escaped) or nodes; schema descriptions are rendered as nodes, never spliced in as HTML.
  - **Switches start from the schema default.** An unset `default: true` field would otherwise render unchecked and be saved as an explicit `false`. `FieldDescriptor.default` carries it.
  - **Known shape changes on an unedited save** (inherent to the wire format, documented in the tests): with several languages configured a bare string becomes `{ <default locale>: … }`, and an unset switch is saved as `false`.

  **Changed in `@getvitops/config/forms`.** `formToConfig` parses a keyed-map row with itself, so a row may hold `$loc`, `$lines`, `$bool`, `$num` and a nested `$map`, to any depth (it handled only `$bool`/`$num` before). The validator no longer shows a visitor a regular expression: a `format` and a `pattern` that both fail report one sentence ("Must be an email address."), and a bare pattern reports "Isn't in the expected format."

  **CSS, all formats** (`forms.css`): `.field__group`, `.field__row`, `.field__option`, `.field__notice`, `.field-section` and `.field-section__intro`, at zero specificity where they style an element. `@getvitops/generator`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.

- 0f5c3cc: **Added: `<wc-config-form>` and `<ConfigForm>`, live feedback over a config form that already works.** Wrap a form written by `renderProjectionHtml` (`@getvitops/utils/forms`) and, with scripting on, the config schema validates as you type and each message appears in its `<wc-field>`; a keyed map (locations, services, ad platforms) gains a row as its blank one is used; and `value` is the config document the form describes (`formToConfig`), with an optional `output` element filled on every change and a `config-change` event.

  - **Messages appear when they are due.** A field's message shows once the visitor has left it, or a submit has been attempted: never while they are still reading the form. Row fields are matched to their schema path through the row's key control, so an error on `gutters`'s price lands on that row.
  - **A submit with errors is cancelled** and the first invalid field is focused, unless the element has `novalidate` (the server decides). A clean submit is untouched, so a plain `<form method="post">` still posts the names the server parses.
  - **Its own bundle, `@getvitops/core/config-form`** (3.6 KB gzipped, Lit-free, a plain `HTMLElement`), not part of `elements.js`: it carries the validator and the form codec, which a page with no config form should not download. It enhances `<wc-field>` without importing it, so the two load in either order. `<ConfigForm id schema paths output>` (`@getvitops/astro/components/ConfigForm.astro`) emits the element, embeds the schema narrowed to `paths` (`pickSchema`), and loads the bundle.
  - **`verify:bundle-size`** gains a 4,000 B ceiling for `config-form.js`.

  **CSS, all formats** (`forms.css`): `wc-config-form` is `display: block` while un-upgraded, so the tag does not form an inline box around a block `<form>`.

  `@getvitops/generator`: a `config-form` entry in `TIERS`. `config`, `utils`, `cli` and `vite` — no consumer-facing change in these packages.

- fdbec9c: **Added: `<wc-field>` and `<Field>`, a labelled control with help text and an error.** The fallback is a label that **nests** its control, so with no JavaScript it is a labelled control and needs no `id`/`for` pair (one field can appear twice on a page without a collision). The element only adds what the platform can't do alone:

  - `aria-describedby` from the control to its help text and, while one shows, its error; `aria-invalid` with it.
  - An inline message in a polite live region, shown once the visitor leaves the control or a submit reports it (`:user-invalid`'s timing, so an empty required field is not an error on arrival). The browser's own bubble and focus-the-first-invalid still happen; the message is in addition.
  - `setError(message)` / `clearError()` for a host that validates against something richer than HTML constraints. It goes through `setCustomValidity`, so the form's own `reportValidity()` blocks submit; typing drops it and the host asserts it again if it still applies.
  - A `maxlength` counter, and a `field-change` event (`{ name, value, valid }`).

  It is deliberately **not form-associated**: the native control it wraps already submits, validates and takes focus, and `delegatesFocus` is a shadow-root option where this is light DOM. `<Field label help error optional>` (`@getvitops/astro/components/Field.astro`) emits the element itself, with a server-rendered `error` kept until the value is edited.

  **CSS, all formats** (`forms.css`): `.field`, `.field__control`, `.field__label`, `.field__help`, `.field__error`, `.field__counter`, `.field__optional`, at zero specificity, sharing `.form-group`'s tokens. `.field__control > input` and `> textarea` now take the same base control border, radius and padding as `.form-group > input`. A label that wraps a checkbox or radio lays out on one line.

  `@getvitops/generator`: a `field` entry in `TIERS`. `config`, `utils`, `cli`, `vite` — no consumer-facing change in these packages.

- 53683a2: **Added: a stepper, in three forms.** `.stepper` is the progress list for a sequence of steps; `<StepperNav>` renders it for a flow where each step is its own page; `<wc-stepper>` / `<Stepper>` shows one long form a step at a time.

  - **`.stepper`** (`stepper.css`): an `<ol>` of links, the number a CSS counter. The current step is `aria-current="step"`; `--complete` and `--invalid` on the item change the marker's glyph (a tick, a bang), so no state is colour alone. A forced-colors pass keeps the current marker filled. Distinct from `.steps`, the static "what happens next" list.
  - **`<StepperNav steps current status hrefFor>`** (`@getvitops/astro/components/StepperNav.astro`): the same list for a multi-page flow, driven by the server (`status` is what `allStepStatuses` returns). No JS at all; a step with no URL is a `<span>`, not a dead link.
  - **`<wc-stepper>` and `<Stepper steps hash>`** (`@getvitops/astro/components/Stepper.astro`): with no JS a complete long form (headed `<section data-step>`s inside one `<form>`, `#anchor` links), every section visible. With JS one section shows, with Back and Next. Next and a forward nav link validate the steps they pass and stop at the first invalid one, so a required field cannot be skipped; going back is free. A submit the browser blocks on a hidden step shows that step; Enter moves on rather than submitting early; focus moves to the new step's heading; the URL fragment selects a step (`hash` writes it). Fires `stepper-change`.
  - **Its own bundle, `@getvitops/core/stepper`** (Lit-free, ~1 KB gzipped, `verify:bundle-size` ceiling 2,000 B), not part of `elements.js`, which is at 99% of its budget. It loads in either order with `<wc-config-form>` and `<wc-field>`.

  **CSS, all formats** (`stepper.css`; `wc-stepper` is `display: block` while un-upgraded). `@getvitops/generator`: a `stepper` entry in `TIERS`. `config`, `utils`, `cli` and `vite`: no consumer-facing change in these packages.

## 8.3.0-alpha.5

### Minor Changes

- bb61a35: **Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

  - **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
  - **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
  - The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
  - `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
  - `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
  - `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

  `@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.

- 4d94c8b: **Added: `site.chrome` — a configurable masthead and nav behaviour.** Non-breaking.

  - `site.chrome.masthead` (new `@getvitops/config` schema): `position` (`static|sticky|fixed`), `behavior` (`always|hide-on-scroll`), `surface` (`solid|glass|transparent|transparent-until-scrolled`), `tone` (a `colors.roles` key), `layout` (`full|inset|floating`), `width`, `elevation` (`shadow`, `border`, `onScroll`), `height` and `inset`. `height` and `inset` take fluid lengths (`calc()`, `clamp()`, `min()`, `max()`, with `cqi`/`vw`/… units), checked against a closed grammar because they are written into CSS. `validateConfig` rejects a `tone` or `shadow` the design system does not define (only when the default theme states them directly, not via `extends`).
  - `site.chrome.nav`: `compact` (`drawer|dropdown`), `drawerSide`, `breakpoint`/`mobileBreakpoint`/`megaBreakpoint`, `depth`, `megaDepth`.
  - `<Masthead config={site}>` (`@getvitops/astro`, slots `brand`/default/`actions`) and `resolveMasthead()` / `resolveNavOptions()`. A prop overrides one field per layout. The key is `chrome`/`masthead` on purpose: `<header>` is valid in any section and `banner` already means the announcement bar and the landmark role.
  - `<SiteNav>` gains `compact="dropdown"` (a columnar panel anchored under the toggle), `drawerSide` (previously hardcoded to the end edge in Astro), `megaDepth` and `megaPanel`. `.sitenav--mega` now styles second-level items as column headings and has an optional featured column.
  - `@getvitops/emdash`: `VitopsMegaPanel` fills that column from the widget area `mega-<item url slug>` (or a `mega-area:<name>` class on the menu item). No area means no column.
  - `@getvitops/create` (emdash template): the layout renders through `<Masthead>`; `site.json` ships a sticky glass masthead with a shadow once scrolled. The hand-written `.navbar { block-size: 64px }` is gone (use `masthead.height`).
  - CSS (`patterns/masthead.css`, `patterns/sitenav.css`): **all formats**, including tailwind, where the patterns are inlined into `@layer components`. Hide-on-scroll and the `*-on-scroll` states are `scroll-state()` container queries that only subtract from a settled (solid, elevated, visible) bar, so a browser without them (Firefox today) shows that bar rather than a transparent one. A sticky or fixed masthead sets `--header-offset` / `--top-offset` so anchors land below it.
  - `@getvitops/generator`: new `TIERS.masthead`; `TIERS.sitenav` documents the new props.

### Patch Changes

- 785b8b3: Docs only: the `site.ads.google.conversionLabel` field descriptions and `vitops ads` now state which Google Ads category each conversion action needs (`call` → Phone call lead, `email` → Contact, `form` → Submit lead form). The category is set on the action in Google Ads, not by the tag, so a wrong one reports under the wrong goal with no code-side signal. `vitopsFormConversion()`'s docblock also warns against firing a form conversion from a success-page query parameter. No behaviour change.

## 8.3.0-alpha.4

## 8.3.0-alpha.3

## 8.3.0-alpha.2

## 8.3.0-alpha.1

## 8.3.0-alpha.0

## 8.2.0

### Minor Changes

- 89265af: **New package: `@getvitops/config`** — the site-config provider blocks (`site.crm`, `site.ads`,
  `site.reviews`, `site.seo.indexing`, `site.searchConsole`, `site.notifications`, `site.tracking`,
  `site.security`, `site.deployment`) as zod schemas and inferred types, with the closed provider lists
  (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`) on a zod-free `./providers` entry. It joins the
  `fixed` group.

  Why: `@getvitops/utils` holds the provider code but could not import its configuration types — the schema
  lived in `@getvitops/generator`, a layer above — so it kept a hand-copied mirror beside each module,
  an adapter converting into it, and a test holding the copy to the schema. The mirrors are gone.

  - **`@getvitops/generator`**: `AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`, `AdProvider` and
    `CrmProviderConfig` are re-exported unchanged. No import path changes.
  - **`@getvitops/utils`**: the config types in `./crm`, `./ads`, `./indexing`, `./onboarding`, `./reviews`,
    `./tracking` and `./notify` (`CrmConfig`, `HubSpotConfig`, `BiginConfig`, `JobberConfig`,
    `IndexNowConfig`, `SearchConsoleConfig`, `ReviewsConfig`, `ReviewLocationConfig`, `TrackingConfig`,
    `NotificationsConfig`, `EmailChannelConfig`, `DomainSetup`, `AdPropertySetup`) are now inferred from the
    schema. Same names, same fields, but **optional fields now follow zod's inference**, so a hand-written
    object literal typed against them may need `| undefined` handled. `AdPropertySetup` gains the fields the
    schema always had (`conversionActionId`, `reporting`).
  - **`@getvitops/astro`**: `GetvitopsAdProperty` and `GetvitopsTrackingOptions` are aliases of the schema
    types. `toCrmConfig()` and `toGoogleAdsConfig()` are **deprecated** — they returned their argument's
    field unchanged; pass `config.site.crm` / `config.site.ads?.google` directly.
  - **`@getvitops/cli`**: `vitops ads` now passes `conversionActionId` and `reporting` through to the planner;
    it previously copied a hand-picked subset of the block and dropped them.

  Formats reached: none — no CSS change.

- 7fd5f8f: **`site.seo` is now the single source of site-level SEO defaults** (ADR-0002). Until now `site.seo`
  declared `titleTemplate`, verification tokens, `openGraph` and `twitter` that nothing read, while
  `<Seo />` took a second, differently-shaped vocabulary through `vitops({ seo })` that no other stack
  could see.

  - `SeoSchema` moves to `@getvitops/config` and gains what only the integration had: `siteName`,
    `defaultTitle`, `defaultDescription`, `openGraph.localeAlternates` and `openGraph.image` as
    `{ src, alt, width, height, type }`. Text fields are localisable.
  - `@getvitops/astro` exports `resolveSeoDefaults(config, { locale, env })`. The integration reads
    `site.seo` from the site config it already loads; `siteName` falls back to `organization.name`, and
    the environment's `robots` wins over `site.seo.robots`, the same fact `vitops robots` and
    `search notify` read.
  - `vitops({ seo })` keeps working unchanged and is now an **override** merged over the config, field by
    field (`openGraph` and `twitter` merge key by key).
  - **Removed from the config schema** (nothing read them): `descriptionTemplate` → use
    `defaultDescription`; `openGraph.siteName`/`title`/`description` and
    `twitter.title`/`description`/`image` → set per page on `<Seo />`, or the site-wide values above.
    A config that still carries one now fails `vitops validate` with an unrecognised-key error.
  - `openGraph.type` is now `website | article | profile`.
