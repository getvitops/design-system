# @getvitops/utils

## 9.0.0-alpha.11

### Patch Changes

- @getvitops/config@9.0.0-alpha.11

## 9.0.0-alpha.10

### Patch Changes

- @getvitops/config@9.0.0-alpha.10

## 9.0.0-alpha.9

### Minor Changes

- 200a4a7: **New: `@getvitops/utils/contact-form`**, the pure decisions behind a form that posts to `createConversionRoute()` (which fields become controls, and under what submitted names: a field labelled "Phone" submits as `tel`, because the route drops a field named `phone`, its tel-click payload, and a filled `website`/`honeypot`/`_honeypot` makes it answer success and deliver nothing). Worker-safe, and it exports `DEFAULT_CONTACT_ROWS` (name, email, phone, message). It moved out of `@getvitops/emdash`'s `vitops_form` block so `<ContactForm>` and the block share one implementation. **`@getvitops/emdash`:** no behaviour change; the block and `formTemplateFromBlock` now import it from utils (a hard dependency already). Other fixed-group packages: no consumer-facing change.

### Patch Changes

- @getvitops/config@9.0.0-alpha.9

## 9.0.0-alpha.8

### Minor Changes

- c66bda9: Sitemap `<lastmod>` on EmDash sites (all formats — no CSS change).

  EmDash dates every CMS entry in its own `/sitemap.xml`, but cannot list `src/pages` routes and offers no way to add them; the only escape (a hand-written `sitemap.xml` route) discards its dates. Hybrid sites were left with undated pages and `search notify` advice (`gitLastmod()` in the `sitemap` option) that did nothing under EmDash.

  - **`vitops({ sitemap })` now works with `emdash()` registered** (it used to warn and skip). A build writes `public/pages-sitemap.xml` for the `src/pages` routes only, dated from git, and writes **nothing** when there are none. New `sitemap.exclude` option for a page that only renders a CMS entry. A file without the generated marker is never replaced. CI needs full history (`fetch-depth: 0`); the shared `site-deploy-emdash.yml` now does this.
  - **`seo.indexing.sitemapUrl` accepts a list.** Unset, `search notify` discovers `sitemap-index.xml` (Astro), `sitemap.xml` (EmDash) and `pages-sitemap.xml` and uses the ones that exist and hold a `<url>`; an explicit value turns discovery off. Previously an EmDash site with no `sitemapUrl` derived `sitemap-index.xml`, which EmDash does not serve.
  - **`search notify` output lists every sitemap** with why it is there (`required for non-EmDash content (src/pages)`), submits each to Search Console, and names up to three URLs missing a `<lastmod>`. `vitops robots` emits one `Sitemap:` line per listed URL.
  - Migration: none required. `@getvitops/emdash`, `@getvitops/core`, `@getvitops/vite`: No consumer-facing change in this package.

### Patch Changes

- Updated dependencies [c66bda9]
- Updated dependencies [c38ce48]
  - @getvitops/config@9.0.0-alpha.8

## 9.0.0-alpha.7

### Patch Changes

- @getvitops/config@9.0.0-alpha.7

## 9.0.0-alpha.6

### Major Changes

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

### Minor Changes

- 8b823d5: **Added `site.accessibility`: the accessibility target a site is held to.** `{ standard: 'wcag20' | 'wcag21' | 'wcag22', level: 'none' | 'A' | 'AA' | 'AAA', acceptedRisk?: string }`. It records a decision, not a conformance claim; `acceptedRisk` is free text (who accepted a lower target, when, why) printed in the audit header.

  - **WCAG 2 contrast ratio is now checked beside APCA** (`contrastRatio()` in `@getvitops/utils/color`; 4.5:1 for text, 3:1 for icons and boundaries). APCA is not the legal test: AODA is WCAG 2.0 AA, which is a ratio, and a palette can pass APCA and miss 4.5:1. At `level: 'AA'` or `'AAA'` a ratio miss **fails the build**; at `A`, `none`, or with no `site.accessibility` it is a build warning. APCA failures still fail the build in every case, and `acknowledgeContrast` still applies to APCA only. **Migration:** a site that sets `AA` and has a palette under 4.5:1 will now fail `generate`; fix the palette, or record a lower `level` with `acceptedRisk`.
  - **`vitops audit` reads `site.accessibility`** (`--input`, default `site.json`, optional): axe tags follow the standard and level, and `level: 'none'` reports violations without failing the run (performance budgets still apply). It now also writes `report.html`. **The report is an artifact, never site content**: it lists every violation, so keep it under `.vitops/audit/` and out of the build output.
  - **New scaffolds and `vitops init --site` default to `wcag21` / `AA`.** Existing sites are unchanged until they add the field.

  Affects all formats equally (no CSS change). No consumer-facing change in `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`.

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

- 798a04a: Config forms: rows you can add and remove, and a colour picker on brand colours.

  - **`<wc-multifield>`** replaces `<wc-multi-field>` (**breaking: rename `wc-multi-field` to `wc-multifield`**; the Bricks element key `vitops-multi-field`, the `--multi-field-gap` property and the `multi-field-*` events are unchanged). It is now light DOM and Lit-free, so the framework's form CSS applies and the controls are native: the authored inputs are the no-JS fallback and submit with the form. Kept from the old element: `min`, `max`, `protect-defaults`, Clear, `add-label` / `clear-label` / `delete-label`, `type`, `placeholder`, `name` (`name[]`). New: it repeats a whole fieldset too, with each row an open `<details>` titled by its key, a polite announcement of changes, and a row unfolds when a blocked submit is about it. The slots `add-label` / `clear-label` / `delete-label` and the `::part`s are gone (shadow DOM); use the attributes and the `.multifield__*` classes. `renderProjectionHtml` wraps every keyed map in it, so rows are now `<details class="field__row">` with the fields in `.field__row-body` where they were `<fieldset class="field__row">`. Forms CSS: **all formats**.
  - **`<wc-color-field>`** (`@getvitops/core/color-field`, new): a colour text input with the theme editor's OKLCH picker offered beside it. The text input is still the fallback and the only submitted control; the picker (~40 KB gzipped) is fetched only when it is first opened. `<ConfigForm colorPicker>` loads it. Forms CSS: **all formats**.
  - `verify-bundle-size` now counts the chunks an entry imports statically (Lit is shared between `elements.js` and the picker), so `elements.js` is measured as the page downloads it; its ceiling moves from 33,000 to 33,600 B for that reason.

  No consumer-facing change in `@getvitops/cli` and `@getvitops/vite`.

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

- dbc4dda: **Added: `@getvitops/config/forms`, the field layer for editing a `site.json` in a form.** Pure and Worker-safe (no zod, no Node builtin, no import from the rest of the toolchain): every function takes the JSON Schema (`config.schema.json`) as an argument, so a host that cannot load the generator still gets the same field choice, grouping and validation as one that can.

  - **Projections.** `PROJECTIONS` are named, ordered groups of config paths (`organization.identity`, `site.accessibility`, `brand.basics`, …) and `ONBOARDING_STEPS` arranges them into the sequence a new client fills in. `resolveProjection()` and `describeField()` turn a path into a descriptor (label, required, the widget derived from the schema node: text, email, date, radio or select for an enum, switch, locale map, lines, keyed map, fieldset) so the decision is made once, from the schema that validates the value. Labels live in `FIELD_META`, not the schema; a field with none gets a humanised key.
  - **Validation.** `validateAgainstSchema()` and `validateField()` are a JSON Schema walker for exactly the keywords the config schema uses (including `prefixItems`, `minLength`, `minItems` and `oneOf`, which the portal's copy of this walker did not know). `unhandledKeywords()` is the tripwire.
  - **Form codec.** `formToConfig()` and the name builders (`scalarName`, `locName`, `mapKeyName`, …) are the flat `name=value` wire format a no-JS form posts, moved here from the portal so the renderer and the parser import the same names. An empty number field now writes nothing; the portal's copy wrote `0`.
  - **`pickSchema()`, `stepStatus()`.** The first narrows the schema to the paths a form edits, so a required field elsewhere is not reported against it; the second derives which onboarding steps a draft has finished (complete, incomplete, invalid, empty), so no progress is stored.
  - **`renderInlineMarkdown`** moved here from `@getvitops/generator`, which re-exports it, so nothing that imports it changed.

  Three drift guards in `@getvitops/generator`: every projected path must exist in the schema; every top-level `organization` / `site` key must be projected or listed in `UNPROJECTED` with a reason; and the validator must implement every keyword the schema uses. A fourth walks the built `@getvitops/generator/config` import graph and fails on a Node builtin, lightningcss or tailwind, since the portal runs it on a Worker (a static check, not a workerd run).

  No CSS changed, so no format is affected. `@getvitops/generator`: the tests and the re-export only. `core`, `utils`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.

- 333880e: **Fixed: a form field is only marked required when everything above it is.** `site.domains.canonical` is required _within_ `domains`, and `site.crm.provider` within `crm`, but both blocks are optional, so a form that put the native `required` attribute on them forced a custom domain and a CRM onto every site. `FieldDescriptor.required` (`@getvitops/config/forms`) now uses `isUnconditionallyRequired`: the field is required by its parent and every ancestor is required by its own. Validation is unchanged; the schema still requires `canonical` once `domains` exists.

  **CSS, all formats** (`stepper.css`): a `.stepper__actions` row honours the `hidden` attribute, and a `<wc-stepper>` section the element has put away stays hidden whatever display its own classes set (`.rhythm` would otherwise out-rank the attribute).

  The docs site gains a `/configure` page that builds a `site.json` step by step with `<Stepper>` and `<ConfigForm>` (no package change). `config`: the required fix. `core`: the CSS above. `utils`, `generator`, `cli`, `vite`, `astro`: no consumer-facing change in these packages.

- 237a9fd: **Fixed: `<wc-image-compare position="25">` was ignored on first render.** The slider always started at 50 unless `position` changed a second time, because the constructor's own `_offset` assignment defeated the guard that applied the attribute. It now starts where the attribute says. JS only; no CSS changed, so no format is affected.

  **Hardened: `nodesToHtml` refuses elements that run code or change parsing** (`script`, `style`, `iframe`, `frame`, `object`, `embed`, `template`, `base`, `meta`, `link`, `portal`) at any depth and in any case, and escapes a quote in an object-form `style` value so it cannot close the attribute. Only authored legal text and `NodeRenderer` data go through it today, so no shipped output changes; a tree that did contain one of those tags now throws instead of rendering it.

  Added DOM tests for `<wc-consent>` and `<wc-image-compare>`; `<wc-image-compare>` is now named in AGENTS.md as the element that renders into a shadow root.

  `@getvitops/generator`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.

- 0a3a01f: **Docs: a dropdown is the Popover API plus anchor positioning, not a component.** The `dropdown` entry in the component manifest now says so and gives the recipe (`popovertarget` trigger, `[popover]` panel, `anchor-name` / `position-anchor`, `.dropdown--show-on-hover` for hover reveal). `dropdown-trigger`, `dropdown-menu` and `dropdown-icon` are now listed under the `nav` entry, where their CSS lives (`patterns/nav.css`), instead of `dropdown-menu` being attributed to `dropdown.css`. No CSS changed in any format, and nothing was removed or renamed.

  `@getvitops/core`, `utils`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.

- d380b78: **Added: the `vitops_tree` block, and landing pages in the emdash template.**

  - **`vitops_tree`** (`@getvitops/emdash`): an expandable outline for a file tree, a site map or nested sections. Block fields can't nest, so the editor types an indented outline (one node per line, indent to nest, `| badge` for a chip) and the block builds the `<Tree />` from it. Only plain label, badge and a derived id reach the tree: it never sets `descriptionHtml`, which `<Tree />` renders as raw HTML, so markup typed into the outline is shown as text. Capped at 500 nodes and six levels. The `tree` manifest entry no longer carries an `emdashExempt` reason.
  - **Landing pages** (`@getvitops/create`, emdash template): new scaffolds ship a `landings` collection whose `layout` is a `blocks` field of `vitops_section`, the `vitops_section` block type in `seed/seed.json`, and `src/pages/landings/[slug].astro` (prerendered, like `pages`). Create a landing in the admin and stack sections, each holding any Vitops block. No sample landing is seeded. `templates.test.ts` fails if the seeded block type drifts from `vitopsBlockTypes()`.

  ### Migration

  A seed is applied once, at a site's first boot, so an existing site gets none of this automatically. Either run `vitops emdash schema apply --from <a site that has it> --to <your site>` for the collection, add `...vitopsBlockTypes()` to the seed's `blockTypes` (a new environment only), or add the collection by hand with `emdash schema create landings` and a `blocks` field allowing `vitops_section`, and copy `src/pages/landings/[slug].astro`. Block types are not replayed by `schema apply` (they are reported); add `vitops_section` from the admin or the seed.

  `@getvitops/generator`, `core`, `astro`, `utils`, `cli`, `vite` and `config` — no consumer-facing change in these packages. No CSS changed, so no format is affected.

- 1e5edfc: **Added: the Google Business Profile API approval is now a step in `SETUP.html`.** Google reviews come only from the Business Profile API, which rejects every call from a Google Cloud project Google has not approved, whatever the credential. The approval is a one-time request that takes days to weeks, is per Google Cloud project rather than per site or client, and cannot be done in code, so it is a checklist step (`connections.gbp`) to file at kickoff instead of being discovered as a `403` when the reviews block is built. The setup skill, in both templates, lists it as a hard stop: an agent reports it as a blocker with that lead time and does not tick the step until `vitops reviews --check` stops answering 403. No code or config changed.

  `@getvitops/utils`, `generator`, `core`, `cli`, `vite`, `astro` and `config` — no consumer-facing change in these packages.

- a9d00c9: Two fixes to the config form. **Saving no longer resurrects or loses fields.** `mergeOwned` (the portal's merge) moves into `@getvitops/config/forms`, with `ownedFromProjections`: a submission replaces only the paths its projections own, a value the form dropped (cleared, or a row removed) is removed from the result, and fields a projection never shows (a palette hue's `anchors`, a role's `solid`) are kept. `<wc-config-form>` gains `merged(base)` and an `owned` attribute (or `ownedItems` property), and `<ConfigForm projections={[…]}>` wires them. `/configure` used a plain deep merge, which could not delete anything. **A select built from another map's keys stays current.** A colour role's hue select is re-read from the palette as hues are added or removed (`data-options-from` on the select, `optionsFrom` on the descriptor), keeping the current choice. Affects the web-component bundle in all formats; no CSS or markup class changes. Other fixed-group packages: no consumer-facing change.
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

- Updated dependencies [8b823d5]
- Updated dependencies [59d2f23]
- Updated dependencies [a95a4fc]
- Updated dependencies [dbc4dda]
- Updated dependencies [333880e]
- Updated dependencies [d380b78]
- Updated dependencies [6763587]
- Updated dependencies [a5754c1]
- Updated dependencies [1e5edfc]
- Updated dependencies [e12086a]
- Updated dependencies [0e525b8]
- Updated dependencies [a9d00c9]
- Updated dependencies [82774d1]
- Updated dependencies [0f5c3cc]
- Updated dependencies [fdbec9c]
- Updated dependencies [798a04a]
- Updated dependencies [53683a2]
- Updated dependencies [1f1a3dd]
  - @getvitops/config@9.0.0-alpha.6

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

### Patch Changes

- 785b8b3: Docs only: the `site.ads.google.conversionLabel` field descriptions and `vitops ads` now state which Google Ads category each conversion action needs (`call` → Phone call lead, `email` → Contact, `form` → Submit lead form). The category is set on the action in Google Ads, not by the tag, so a wrong one reports under the wrong goal with no code-side signal. `vitopsFormConversion()`'s docblock also warns against firing a form conversion from a success-page query parameter. No behaviour change.
- Updated dependencies [785b8b3]
- Updated dependencies [bb61a35]
- Updated dependencies [4d94c8b]
  - @getvitops/config@8.3.0-alpha.5

## 8.3.0-alpha.4

### Patch Changes

- 00a9d86: - **`vitops audit` lets the page settle before axe reads colours.** At `load` Chromium can still be running the CSS transitions every pattern declares, so axe measured a filled button mid-way from its unstyled colour and reported ten `color-contrast` failures no visitor sees. The audit now waits (up to 2 s) for CSS transitions to finish first.
  - `.carousel__hint` reads `text-surface-muted` instead of `x-muted` (the placeholder tier the contrast contract exempts), and its scroll-driven fade ends hidden instead of at 0.2 opacity (`--carousel-hint-dimmed` now defaults to 0): a hint parked at 20% was still text to an audit (1.34:1). all formats.
  - The templates' `button` pattern becomes the toolkit's `btn` affordance (`fill: false`, transparent, text colour inherited), as `defaultSiteConfig()` already shipped: the old filled entry lost its white text to the new `link` pattern on `<a class="btn">` (dark green on green, 1.36:1). A filled call to action is `.cta`.
  - The templates move the `info` and `danger` solids to step 700. Their step-600 solids (sky, rose) clear the generator's APCA bar for `text-on-<role>` (Lc 60) but not WCAG AA's 4.5:1 that axe and Lighthouse apply (4.2:1 and 4.4:1), so a `.cta-info` or a CTA inside an `info` callout failed the audit. Step 700 reads at 6.4:1 and 6.8:1 with the recomputed text. The APCA/WCAG gap in the contract itself is logged in TODO.md.
  - @getvitops/config@8.3.0-alpha.4

## 8.3.0-alpha.3

### Patch Changes

- @getvitops/config@8.3.0-alpha.3

## 8.3.0-alpha.2

### Minor Changes

- 0a47856: Build correctness and gaps from the second upstream round.

  - **`@getvitops/emdash`: fixes a circular import that emptied the plugin block map in the static build.** `Section.astro` and `WidgetArea.astro` imported `emdash/ui` statically, which imports `virtual:emdash/block-components`, which is `@getvitops/emdash/astro` again. Depending on import order, every `vitops_*` block inside a section body was dropped from prerendered pages with only a `PortableText [components.type] is missing …` warning. Both now import it lazily, and a test fails if any renderer imports `emdash/ui` statically. No code change needed in sites.
  - **`@getvitops/cli`: `vitops emdash build`** runs `astro build` and then `check-prerender`, and fails when the build reports a block type with no component (reported once per type). The template's `build`, `deploy` and `deploy:dev` scripts use it; existing sites replace `astro build && vitops emdash check-prerender` with `vitops emdash build`. `check-prerender` also warns (fails with `--strict`) on a page without exactly one `<h1>`.
  - **`@getvitops/emdash`: `vitops_hero` and `vitops_section` heading level** accepts `h1`–`h6` and `p` (a heading that is styled but not in the outline). The hero defaults to `h1`; set the level to `2` on a page whose layout already renders an `h1` (the template's seed does).
  - **`@getvitops/emdash`: `vitops_logos`** shows an entry's name as text (`.logos__name`) when it has no image. `@getvitops/core` adds the rule (all formats).
  - **`@getvitops/emdash`: an empty content widget** (no text, no blocks) no longer renders its title, and an area whose widgets are all empty renders nothing.
  - **`@getvitops/create`:** the template's `pages` collection gets `urlPattern: "/{slug}"` (the sitemap listed `/pages/<slug>`, which 404s; existing sites change it under Content Types), and `.gitignore` ignores only `src/styles/tailwind.css` and `tokens.json`, so site CSS kept in `src/styles/` is committed.
  - **`@getvitops/emdash`: per-item colour.** The rows of `vitops_cards`, `vitops_stats`, `vitops_steps` and the hero's `cards` take their own `tone` / `color` (blank inherits the block's), so one block can hold a pine item and an amber one. Hero cards also take an `eyebrow` and a button (`ctaLabel` / `ctaHref`; with a button the card is no longer a stretched link).
  - **`@getvitops/generator` / `@getvitops/emdash`: solid fills read.** The generator emits `--color-<hue>-<step>-on` for every step of every hue, the foreground for a fill at that step picked by the same APCA rule as `text-on-<role>` (css and tailwind formats, a plain `:root`, not `@theme`). A block fill chosen by `color` (hue and step) uses it instead of a fixed white..
  - **`@getvitops/core`: `.counter__value.sr-only`** hides itself, so a build that never emitted the `.sr-only` utility no longer shows a counting figure twice (all formats).
  - **`@getvitops/astro` / `@getvitops/core`: `SiteFooter` groups.** A top-level item of the `footer-sitemap` menu with children becomes a column (its label is the heading, its children the links, one level only); childless items stay in the flat list. Each column is a named `<nav>`.
  - **`@getvitops/astro`: planned links and header buttons.** A menu item with `draft` in its CSS classes stays in the menu but is not rendered (at every level, in the header and the footer). `<SiteNav>` has an `actions` slot for header buttons that are not menu items, and an item with `cta` in its CSS classes renders as a button.
  - **`@getvitops/cli`: `check-prerender` warnings** (fail with `--strict`): links to pages the build did not produce, a form with no delivery address (no `site.notifications.email`, location `email` or `site.crm`), and form fields missing from every `site.templates` form entry (the generated privacy policy reads those). It reads `./site.json`, or `--site=<path>`. `vitops setup … --dry-run` is accepted as `--dry`.
  - **`@getvitops/emdash` / `@getvitops/astro`: "tick any number" form field** (`vitops_form` field kind `checkboxes`): a fieldset of checkboxes sharing one name. The conversion route joins repeated values (`IT, Marketing`) instead of keeping the last. The "required" toggle is not applied to the group (HTML cannot require one of several).
  - **`@getvitops/core`: size hooks.** `.steps__title`, `.stats__figure` and `.card__title` read `--steps-title-size` (default one step below `heading`), `--stats-figure-size` and `--card-title-size`, set on the block through its `style` field. They set the `--heading-fs` / `--display-fs` properties the type-role utilities already read, so no extra class or prop is needed (all formats).
  - **`@getvitops/create`:** the template's `site.json` lists its contact form under `site.templates`, so the privacy policy inventory and the new check agree.
  - **`@getvitops/emdash`: `theme` on every block, on widget areas and on your own markup.** A `theme` select (`<role>` tinted, `<role>:solid` filled, populated from the site's roles by a new `themes/list` route) is a common field on every `vitops_*` block, applied to the block's own root with the role's computed readable text. `<VitopsWidgetArea theme="…">` takes the same, and `themeAttrs('surface')` gives `{ class, style }` for a layout `<body>`. `vitops_section`'s existing `theme` now goes through the same path.
  - **`@getvitops/cli` / `@getvitops/emdash`: pages with a dropped block fail the build.** `vitops_section` and widget areas emit an invisible `<template data-vitops-unrendered="…">` for any body block with no renderer, and `check-prerender` fails the page naming the types (nested bodies only; `vitops emdash build` also scans the build log, which covers top-level bodies). A regression test imports the plugin entry first with a mock of the real virtual module, so the old import cycle fails it.
  - **`@getvitops/emdash`: `formTemplateFromBlock(block)`** turns a saved `vitops_form` value into a `site.templates` form entry (names as submitted, a `checkboxes` field as a `checkbox` with options), to paste into `site.json` so the generated privacy policy lists what the form collects. The build cannot read the CMS database, so this is run by hand; `check-prerender` warns when fields are missing.
  - **`@getvitops/utils`: `hasFormDelivery`** (`@getvitops/utils/notify`): the one test for "has this form anywhere to go", used by `check-prerender`.
  - **`@getvitops/emdash`:** a `color` hue tint now flips with the colour scheme (`light-dark()`); hero option cards sit at `h2` under an `h1` hero; menu items also accept `hidden: true` (same as the `draft` class); `vitops docs blocks` documents `theme`, the per-row colours, the `--<role>-fs` type-size hook and the form checks.
  - **`@getvitops/create`:** the template redirects `/home` to `/`, and the guides use `vp exec` instead of `vpx`.

### Patch Changes

- @getvitops/config@8.3.0-alpha.2

## 8.3.0-alpha.1

### Minor Changes

- 24c568b: Escape hatches on every block, a section theme, widget areas, a badges block, Tailwind scanning of package renderers, and a sturdier `vitops audit`.

  **@getvitops/emdash**

  - Every `vitops.*` block and `vitops_section` gains three fields: `anchor` (rendered as the `id`, so `#contact` works), `className` (`class_name` on the section type: block-type slugs are lowercase) and `style`. `style` takes CSS custom properties only (`--p-card: 2rem`); any other declaration, and any value containing `url(`, `@`, `{`, `}` or a backslash, is dropped. With the `tailwind` format a class typed in the CMS only works if the site already uses it. They are applied to the block's own outermost element (the grid `<ul>` for `vitops.cards`), never an extra wrapper, so a block's markup is the same whether or not an editor fills them in.
  - `vitops_section` gains a `theme` select: a role, or `<role>:solid`, with readable text chosen by the generator's contrast rules. It overrides `tone`/`color`/`solid`, which stay for existing content. Other site roles still go through `tone`.
  - New `vitops.badges` block (a row of `.badge` or `.tag` labels, each with an optional tone, icon and link) and `vitops.widgetArea` block, plus `<VitopsWidgetArea name level />` from `@getvitops/emdash/astro`. A widget area is content defined once under Widgets and shown wherever it is placed. An area cannot hold another area, and an area containing a `core:*` component widget is rendered by EmDash's own renderer.
  - Existing sites: re-run the block-type seed only on a new database; on an existing one add the `theme`, `anchor`, `className` and `style` fields to the `vitops_section` block type in the admin.

  **@getvitops/create**: the emdash template seeds `announcement` and `pre-footer` widget areas, renders them in `Layout.astro`, and documents when to use a Section, a block or a widget area. Sites scaffolded earlier add the two `<VitopsWidgetArea>` lines and the `widgetAreas` seed entries by hand.

  **@getvitops/generator / astro / vite** (`tailwind` format only): the Astro integration now adds `@source` lines for `@getvitops/astro` and `@getvitops/emdash`, because Tailwind v4 does not scan `node_modules`; utilities used only by their renderers (`font-display`, `font-caption`, `font-footnote`) were never emitted and the page silently rendered at body size. New `sources` option on `generate()` and the Vite plugin. A site's `src/package-classes.txt` workaround can be deleted. css and bricks: no change.

  **@getvitops/cli**: `vitops emdash check-prerender` now also warns when a page uses a type-role class (`font-display`, …) the built CSS has no rule for; `--strict` makes it fail. `vitops audit` checks for its optional packages and a Chromium binary before starting the preview server (so a failed run no longer leaves port 4398 busy), stops the server on Ctrl+C and termination, and takes its page list from the built sitemap, then the menus; the guessed defaults (`/privacy`, `/contact`, …) are used only when neither exists.

  **@getvitops/utils**: the audit helpers behind the above (`preflight`, `fetchSitemapPaths`, `sitemapLocs`, `pathsFromSitemapLocs`).

  **@getvitops/core** (all formats): new `.block-anchor` rule gives an anchored block `scroll-margin-top: var(--header-offset, 5rem)`; set `--header-offset` to a sticky header's height. New `widget-area.css` partial. No other consumer-facing change.

  The other fixed-group packages: no consumer-facing change beyond the above.

  **Also fixed in the emdash template** (`site.json`): it defined only the `display`, `heading` and `body` type roles while the blocks use `title`, `eyebrow`, `lead`, `caption` and `footnote`, so those rendered at body size with no rule behind them. The roles are added with the reference design system's specs. A site scaffolded earlier adds the same five entries under `designSystem.themes.default.typography.roles`; `vitops emdash check-prerender` now names any that are missing.

### Patch Changes

- @getvitops/config@8.3.0-alpha.1

## 8.3.0-alpha.0

### Minor Changes

- 161c7f3: A contact form that works end to end: `vitops setup turnstile`, `<wc-turnstile>`, the `vitops.form` EmDash block, and the route the emdash template ships to receive it.

  **CSS, all formats** (no existing class changes): `forms.css` gains `.form-notice--target:not(:target)` (a message revealed only when the URL fragment names it, which is how a prerendered page shows a no-JS form's result) and `:where(wc-turnstile) { display: block }`.

  **`@getvitops/core`:** new `<wc-turnstile sitekey="…">` in `elements.js`. It loads Cloudflare Turnstile on the first interaction with its form (no request to `challenges.cloudflare.com` for a visitor who only reads the page), holds an early submit until the token arrives, and leaves its slotted no-JS explanation in place until JS takes over. Turnstile is category `necessary`, so it is not behind the consent banner.

  **`@getvitops/utils` / `@getvitops/cli`:** new `@getvitops/utils/turnstile` and `vitops setup turnstile [--dry] [--check] [--no-write] [--no-secret]`. It plans from the site's hostnames, creates a managed widget unless one already covers them (an existing widget is adopted, never edited, rotated or deleted), writes the public key to `site.security.turnstile.siteKey`, and pipes the one-time secret to `wrangler secret put VITOPS_TURNSTILE_SECRET` without writing it to any file. Needs `CLOUDFLARE_API_TOKEN` with **Account > Turnstile > Edit** and `CLOUDFLARE_ACCOUNT_ID`.

  **`@getvitops/astro`:** `virtual:getvitops/head` gains `turnstileSiteKey` (read from `site.security.turnstile.siteKey`) so blocks can render the widget. No other change.

  **`@getvitops/generator`:** `TIERS` gains a `turnstile` entry (wc-turnstile, claimed by `vitops.form`); `wc-multi-field`'s `emdashExempt` reason is reworded now the form block exists.

  **`@getvitops/emdash`:** new `vitops.form` block: a field repeater (text, email, phone, long text, choose one, tick box), required flags, help text, success/error messages, optional Turnstile. It renders a semantic `<form method="post">` that works with no JavaScript, with a honeypot named per `createConversionRoute`'s defaults. A field named `phone` submits as `tel`, because the route reserves `phone` and `event`.

  **`@getvitops/create`:** the emdash template ships `src/pages/api/track.ts` (`prerender = false`, `createConversionRoute()`), a seeded contact form, and `challenges.cloudflare.com` in both templates' Report-Only CSP (`script-src`, `frame-src`). The route refuses a post with nowhere to deliver and fails closed when a site key exists without `VITOPS_TURNSTILE_SECRET`. SETUP.html gains the Turnstile step. Existing sites: copy the route and the CSP change, then run `vitops setup turnstile`.

- 175d16e: **Added: `vitops.reviews` and `vitops.nav` EmDash blocks.** Non-breaking.

  - **`vitops.reviews`** renders Google reviews from the committed `.vitops/reviews.json` cache (`vitops reviews`) as a grid, carousel or marquee of `<ReviewCard>`. Fields: location key, layout, columns, limit, lowest rating, order, featured ids, reviewer photos (off by default), tone/colour. Which reviews show is `selectReviews()`, the one shared decision. Review JSON-LD is not offered (Google treats self-marked-up reviews as ineligible for rich results). A new review reaches the page after `vitops reviews` is re-run, committed and the site rebuilt, not when an editor saves; with no cache file the block renders nothing (a note in `astro dev`).
  - **`vitops.nav`** renders a named EmDash menu inside page content (site map, section links, footer-style columns), never the header. Fields: menu (picked from the site's menus via a new `menus/list` plugin route, with `footer-sitemap`/`footer-legal`/`primary` as the static fallback), accessible name, visible heading and level, layout `list | inline | columns | sitenav`, depth 1-3, tone/colour. It is a `<nav>` with a name that is never `Primary`, `Site map` or `Legal` (the layout's landmarks), `aria-current="page"`, no runtime JS; a missing or empty menu renders nothing.
  - `@getvitops/astro`: **`virtual:getvitops/reviews`**, served by `vitops()`, is `.vitops/reviews.json` as a build-time import (an empty cache when absent or unreadable), because a Worker cannot read the file. `<ReviewCard>` now renders the review's source link (`.review__source`, `rel="nofollow noopener noreferrer"`), which the pattern already styled. **Fix:** `src/json-ld.ts` was missing from the published `files`, so any consumer importing `<ReviewCard>` (which composes `schemas/Review.astro`) failed to build with an unresolved import. `@getvitops/emdash` now needs this version of `@getvitops/astro` for the `vitops.reviews` block.
  - `@getvitops/utils`: new Worker-safe subpath **`@getvitops/utils/reviews/select`** (`selectReviews` and the review types, no `node:fs`). `selectReviews` now takes only the display fields (`featured`, `minRating`, `limit`, `sort`), so a caller with no configured `locationId` can use it; existing calls are unchanged.
  - `@getvitops/core`: new `.navlist` pattern in `patterns/sitenav.css` (`.navlist`, `__item`, `__link`, `__label`, `__sub`, `--inline`, `--columns`). **All formats** (css, bricks, tailwind). No existing class changes.
  - `@getvitops/generator`: `TIERS.review` lists `vitops.reviews` and `TIERS.sitenav` lists `vitops.nav` (and `.navlist`), so `vitops docs components` and the docsite show them.

- 83d6f3c: Theming escape hatches, so a real palette builds without raw ramp steps. All additive; existing configs build unchanged.

  - **Dark-only sites.** `designSystem.defaultColorScheme: "dark"` (accepted by the schema before, but ignored) now makes the dark tokens the `:root` appearance with `color-scheme: dark`, emits no light block or `data-theme` flip, and skips light-mode contrast checks. Reaches css, bricks and tailwind formats. Do not ship `<wc-color-scheme-toggle>` on such a site.
  - **Role solid step and foreground.** `colors.roles.<role>` may be `{ hue, kind?, solid?, foreground? }`. `solid: 400` starts the solid family at step 400 (bold and x-bold walk one and two rungs darker); `foreground: "dark" | "light"` pins `text-on-<role>`. The APCA check (Lc 60) still runs on the pair emitted. The string shorthand is unchanged. All formats. The live editor's `roleTokens` still assume the default 600 family when re-pointing a role.
  - **Split shadows.** `shadows.<name>` may be `{ box?, drop? }`: `box` (spread, inset, layers) is `--shadow-<name>`; `drop` is `--shadow-<name>-drop` and feeds `.drop-shadow-<name>` and the `shadow:` state shortcut. The string form is unchanged. css/bricks emit `.drop-shadow-*`; tailwind emits the `-drop` token only.
  - **Layout tokens.** New optional `layout` block (`widths.{measure,breakout,spotlight,nav}`, `regionSpace.{min,preferred,max}`) emitted as `--width-*` / `--region-space*` on `:root` in css, bricks and tailwind formats, and exposed in `design-manifest.json` (`layout`, `reverseIndex`). Keys you omit keep the framework defaults.
  - **`acknowledgeOffLadder: true`** on a palette hue silences that hue's off-ladder anchor warnings.
  - **Typography:** `transform` and `decoration` are now accepted as aliases of `text-transform` and `text-decoration` (canonical wins when both are present) instead of warning and being dropped.
  - **Docs strings** (`authoring.md`, JSON Schema hovers) state the Lc 60 muted-text requirement against the page plane and give a type-scale recipe for marketing headings.
  - `@getvitops/utils`: `pickOn` takes an optional `prefer: 'light' | 'dark'`.

- b47df4d: **Added: `vitops audit` — Lighthouse + axe budgets over a built site.** Non-breaking, opt-in.

  `vitops audit [--build] [--url <base>] [--pages /a,/b] [--warn] [--out <dir>]` serves the existing build with `astro preview` on a dedicated port (4398; it aborts rather than attach to something else already there), audits `/` plus `/privacy`, `/terms`, `/cookies`, `/contact` and every link in `seed/seed.json`'s `primary*`/`footer*` menus, and skips any route that 404s (a 404 on `/` fails the run). Per page it runs axe (tags wcag2a, wcag2aa, wcag21a, wcag21aa) and Lighthouse on the same Chromium. Default budgets: LCP < 2500 ms, CLS < 0.1, TBT < 200 ms (the INP proxy), no serious or critical axe violations; override with `--lcp`, `--cls`, `--tbt`, `--impact`. Writes `report.json`, `report.md` and `pages/<page>.{json,md}` to `.vitops/audit/`; exits non-zero on failure unless `--warn`. Every report states that a pass is **not** AODA certification and lists the manual checks.

  `playwright`, `@axe-core/playwright` and `lighthouse` are **optional peer dependencies** of `@getvitops/utils`, loaded lazily — nothing is installed or loaded unless you run the command, and a missing one fails with the install command. Pure planner and report rendering are `@getvitops/utils/audit` (new subpath).

  CI: the reusable `site-ci.yml` gains opt-in `run-audit` (default `false`) and `audit-args` inputs; callers pinned to `@v1` that pass neither are unaffected.

### Patch Changes

- @getvitops/config@8.3.0-alpha.0

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

- 0574388: Add `site.crm` — push form submissions into HubSpot, Zoho Bigin, or Jobber.

  Client sites need form submissions to land in the client's CRM. The options available before this
  — a HubSpot/Bigin/Jobber iframe or JS embed — fail on three counts: the markup can't be
  white-labelled against this design system, nothing can operate on the submission before it leaves
  the page, and the submission never touched `createConversionRoute()`, so `_ac` ad-click attribution
  was lost and no conversion notification was planned.

  This adds one server-side path for all three CRMs, hung off the conversion route that already
  exists. `createConversionRoute()` gets a new `crm` option (`{ config, credentials, fetch?,
  timeoutMs? }`); credentials arrive as a function of `locals`, exactly like the existing `binding`
  option, and are never config. A failed CRM write never fails the request and is folded into the
  notification email's new "Delivery" section, so a broken CRM token is never silent.

  New `@getvitops/utils/crm` subpath: `deliverToCrm()`, `mapSubmission()`, `deriveLastName()` (Bigin
  requires a last name; this derives one from an explicit field, a full name, or an email address,
  refusing rather than fabricating one), `submitToHubSpot()`, `submitToBigin()`, `submitToJobber()`.
  `identifySubmitter()` was promoted out of `notify`'s private name-guessing cascade into
  `@getvitops/utils/tracking`, since the CRM mapper needed the whole identity (first/last name,
  email, phone, company), not just a display name.

  Jobber is GraphQL, not REST, and answers `200 OK` for failures — a rejected `clientCreate` returns
  `userErrors[]`, a malformed request returns top-level `errors[]`. `submitToJobber()` classifies on
  the response body, not just the status. Its refresh tokens also rotate by default: **Refresh Token
  Rotation must be turned off** in the app's Developer Center settings, since a Worker reading a
  static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one — a rotated token is detected at
  exchange time and reported with the fix, rather than surfacing an hour later as an opaque 401.
  Attribution and unmapped extra fields render into a best-effort note by default (works on every
  Jobber plan); a resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true`
  is set once its lookup query has been verified against a live account (defaults `false` pending
  that verification — see `jobber.ts`'s docblock).

  New `site.crm` config block (`provider`, `hubspot`/`bigin`/`jobber`, `fieldMap`, `trackingFields`)
  and two CLI commands: `vitops crm check` (fetches the live HubSpot property list or Bigin field
  list and reports every mapped name that doesn't exist there — HubSpot rejects an unknown field
  outright, Bigin silently drops it; Jobber has nothing live to check yet, since its mapped values
  currently render as note text) and `vitops crm setup` (creates missing HubSpot properties; Bigin
  and Jobber have no such API, so both always print a manual reminder).

  The generated privacy policy now names HubSpot, Zoho Bigin, or Jobber when `site.crm` configures
  one. Bigin gets the same cross-border-transfer derivation Matomo Cloud already gets: a
  `dataCenter: 'ca'` asserts no transfer outside Canada, any other data centre does. Jobber's
  operator (Octopusapp Inc. d/b/a Jobber) is Canadian, but its own privacy policy names the United
  States as a processing location too, so the policy always asserts a cross-border transfer for
  Jobber regardless of config — a Canadian operator is not read as Canadian-only storage.

  Credentials: `VITOPS_HUBSPOT_ACCESS_TOKEN` for HubSpot; `VITOPS_ZOHO_CLIENT_ID` /
  `VITOPS_ZOHO_CLIENT_SECRET` / `VITOPS_ZOHO_REFRESH_TOKEN` for Bigin; `VITOPS_JOBBER_CLIENT_ID` /
  `VITOPS_JOBBER_CLIENT_SECRET` / `VITOPS_JOBBER_REFRESH_TOKEN` for Jobber. Never config.

  No consumer-facing change in `@getvitops/astro` beyond the new `crm` route option and a build
  warning when `site.crm` is configured with no route answering `TRACKING_ENDPOINT` — CSS/Bricks/
  tailwind outputs are unaffected.

- c3c1bcb: **New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
  designSystemEditor: { config } })` (`config` is your `site.json`, e.g. `import config from
  './site.json' with { type: 'json' }`) adds a `/design-system` admin page mounting
  `<wc-theme-editor>` — the same live token editor `@getvitops/vite`'s dev server has always
  offered, now usable by the client directly, no dev server required. An edit is visible
  site-wide immediately (a runtime `:root` override, served via a new plugin API route and
  `page:fragments`) and — once `site.deployment.repo`/`branch` and a `VITOPS_GITHUB_TOKEN`
  secret are set (see the scaffold's `SETUP.html`) — auto-commits to your `dev` branch, so it
  reaches the git-tracked `site.json` through your repo's normal review path rather than
  becoming a second, unreviewed source of truth. Until that's configured, the live half still
  works; only the auto-commit half is skipped (and says so in the admin page). The save route
  runs the exact same accessibility (APCA contrast) gate `generate()` enforces at build time,
  synchronously, before persisting — nothing non-compliant ever goes live even momentarily.

  Requires `@astrojs/react` + `react` + `react-dom` (already scaffold dependencies, for
  EmDash's own admin) and `@getvitops/core` (added as a new scaffold dependency this release).
  Declares two new plugin capabilities when enabled: `network:request` (for the GitHub
  auto-commit) and `hooks.page-fragments:register` (for the live override) — reviewed once at
  plugin-install time.

  **Breaking for `@getvitops/emdash`**: `vitopsEmdash()`'s `hooks.page-fragments:register`
  capability is now also granted whenever `designSystemEditor` is set, independent of the
  existing `scripts: 'fragments'` option (which governs something unrelated — web-component
  script delivery). No change if you don't use `designSystemEditor`.

  Also new, supporting the above:

  - `@getvitops/generator`: `validateColorContract()` and `buildReverseIndex()` (both
    `/tokens` subpath, Worker-safe) — the monotonicity/contrast gate and the
    `design-manifest.json` reverse-index, each extracted from `generate()`'s `build()` into
    standalone, non-throwing functions. `patchToOverrideCss()` turns a design-system patch
    into the `:root` override `<style>` block. `designSystemPath`/`getAt`/`setAt`/
    `mergePatch`/`formatConfig` moved from `@getvitops/vite` into `@getvitops/generator/config`
    (re-exported from `@getvitops/vite` unchanged) — one "patch a config file's design-system
    subtree" implementation shared by the dev endpoint and the new plugin route. New
    `site.deployment.repo`/`branch` config fields.
  - `@getvitops/utils`: new `/git` subpath — `commitFile()`, a Worker-safe (fetch-only)
    wrapper over GitHub's Contents API.
  - `@getvitops/core`: `<wc-theme-editor>` gains a `save-endpoint` attribute (default
    unchanged — `/__vitops/design-system`) so the same element can target the new plugin
    route instead of the dev-only Vite endpoint.

- 0574388: Add `vitops email setup|check` — connect `site.notifications.email.from` to whether its domain is
  actually onboarded onto an outbound email provider.

  Before this, nothing checked that. `EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no
  build or deploy-time warning — the failure mode is silent and production-only.

  `vitops email setup [domain]` onboards a sending domain (currently Cloudflare Email Sending only)
  and polls DNS until its SPF/DKIM/DMARC records resolve or a timeout is reached; `vitops email
  check` is the non-blocking deploy guard both `@getvitops/create` templates' `deploy`/`deploy:dev`
  scripts now run first (`--strict` makes it a real gate; opt out per-site with
  `site.notifications.email.verifySender: false`, or globally with `--skip` /
  `VITOPS_SKIP_EMAIL_CHECK`).

  Two things worth knowing before running it:

  - **The onboarded entity is an exact name, and it is usually a subdomain**
    (`send.yourdomain.com`), never the apex your `from` address names. When the exact domain isn't
    onboarded but a sibling in the same zone already is, the command reports that as the fix — send
    from the onboarded subdomain — rather than silently trying to onboard the apex, which rewrites
    `_dmarc.<domain>` and can tighten DMARC policy on every other mail your domain sends.
  - Candidates come from `site.notifications.email.from` (or its derived `noreply@<domains
    .canonical>` default) first; a best-effort scan of `--src` only supplements it, and never guesses
    at a computed `from` value.

  New `@getvitops/utils/email` subpath and `site.notifications.email.verifySender` config field.
  Needs `CLOUDFLARE_API_TOKEN` with an Email Sending scope in addition to the `Zone:Read` other
  commands already use.

- 8d8aad7: **New: server-side Google Ads offline conversion upload.** Set
  `site.ads.google.reporting: "server"` and a matching
  `conversionActionId` (a numeric id or full
  `customers/…/conversionActions/…` resource name — **not** the same value
  as `conversionLabel`, which is the opaque label the web tag uses and
  which the Ads API's upload endpoint doesn't accept) and
  `createConversionRoute`'s new `googleAdsOffline` option uploads the
  conversion via `ConversionUploadService.UploadClickConversions` instead
  of relying on the visitor's browser to fire `gtag.js`. An action with no
  matching `conversionActionId` keeps firing client-side regardless of
  `reporting`, so turning it on before the id is filled in never silently
  drops a conversion. `@getvitops/astro/routes` exports a matching
  `toGoogleAdsConfig(config)` adapter, alongside `toCrmConfig`.

  Structurally typed against Google's documented REST shape, not verified
  against a live Ads account — no developer-token/MCC access exists
  anywhere in this toolchain's own setup to test against. Wrapped so a
  wrong guess degrades to a stated failure reason (folded into the
  conversion email's "Delivery" section, same as a failed CRM write) rather
  than breaking, the same caveat `@getvitops/utils/crm`'s Jobber executor
  already carries for its own unverified surfaces.

  `vitops ads lint` now flags a `reporting: "server"` property whose
  configured actions have no matching `conversionActionId` — not a
  failure, since that action keeps firing client-side, but worth surfacing
  rather than leaving someone to wonder why nothing changed.

  Not built: `vitops ads provision` (upserting conversion actions via
  `ConversionActionService` and printing back both the label and the
  resource id) — same credential blocker, and deliberately left unscoped
  until there's a live account to verify the request/response shape
  against.

- 0574388: Fire a Google Ads conversion on a tel:/mailto: click, and fix a rate-limit bug on the conversion
  route that could silently drop one of the two.

  `site.ads.google.conversionLabel` used to be accepted by the config schema and typed all the way
  through to the rendered tag, but nothing actually read it — no `gtag('event', 'conversion', …)`
  was ever emitted. When set, the click tracker `<Tracking />` inlines now fires the conversion at
  the moment a visitor taps a `tel:` or `mailto:` link, using the `AW-…/label` target Google Ads
  expects. A `conversionLabel` that can't safely land inside the inline bootstrap script (the same
  check `pixelId`/`accountId` already get) is dropped with a warning rather than firing something
  malformed — the ad tag itself still loads.

  Also: `createConversionRoute()`'s rate limiter previously keyed on IP address alone, so a call
  beacon and an email-click beacon from the same visitor, seconds apart, competed for one window —
  the second could 429 and vanish with no error anywhere. It's now keyed on IP _and_ event type, so
  distinct conversion types never starve each other; repeats of the same type are still throttled
  exactly as before.

  No config changes — a site with `site.ads.google.conversionLabel` already set picks this up
  automatically on the next build.

- 0574388: Track `mailto:` link clicks as conversions, alongside the existing `tel:` link tracking.

  Before this, the capture script only beaconed `tel:` clicks; a `mailto:` link on the same page was
  invisible to attribution — a visitor who emailed the business instead of calling generated no
  conversion event at all. `<Tracking />`'s inlined script now listens for both, sending `{ event:
  'email', email }` via `navigator.sendBeacon` the same way it already sends `{ event: 'call', phone
  }`.

  `ConversionEvent['type']` gains an `'email'` member alongside `'form'`/`'call'`, with a new
  `email` field. `createConversionRoute()` handles it exactly like a call: no honeypot, Turnstile or
  CRM checks (there are no form fields to validate or map), a 204 response, and a notification email
  subject reading `[Email Click] Visitor emailing ...`.

  No config changes and no new options — a site with `<Tracking />` already mounted picks this up
  automatically the next time it rebuilds.

- dde3df3: **`site.ads.google.conversionLabel` now accepts a per-action map** —
  `{ call?, email?, form? }` — instead of one bare string shared by every
  interaction. A bare string still works (back-compat, treated as `call`), but a
  call and an email click used to report as the **same** Google Ads conversion
  action, indistinguishable in the account; each action now gets its own
  `send_to` target.

  **New: `vitopsFormConversion(formEl)`**, exposed as `window.vitopsFormConversion`
  by `<Tracking />`'s capture script — call it from your own fetch-based form
  submit handler once the POST to `createConversionRoute()` succeeds, to fire the
  `form` Google Ads conversion action client-side (mirroring the existing
  tel:/mailto: click handler, which now fires `call`/`email` instead of sharing
  one label). Idempotent per form element. There's deliberately no server-side
  equivalent for a no-JS `<form method="post">` submission — that's a full-page
  redirect with no script to fire from, and a real server-side Google Ads
  conversion needs the Ads API's click-conversion upload (developer token + MCC
  access), tracked separately in the vNext backlog.

  **Fixed: the conversion route's rate limiter no longer trusts the client's
  raw `event` field.** It used to key on whatever string a client sent
  (`` `${ip}:${body.event}` ``), so varying that value on every request let a
  form submission dodge the per-IP rate limit entirely — only `'call'`/`'email'`
  were ever recognized, and anything else got its own fresh bucket. The key now
  uses the server's own classification (`call` | `email` | `form`), closing that
  bypass without changing the existing call-vs-email-don't-compete behavior.

  **New: `site.notifications.actionUrl`** — an optional action-link template
  added to the conversion-notification email as an "Actions" section.
  `{clickId}` is replaced with the ad click ID captured on `_ac` (gclid, fbclid,
  etc.); the section is omitted when the event has no click ID to interpolate,
  rather than emailing a broken link.

- 7f4f50e: `@getvitops/utils/url` exports `safeHref()` (a Worker-safe scheme allowlist: http, https, mailto, tel and relative), shared by the EmDash blocks and the Astro components. It now also guards the EmDash image-compare block, the review avatar and the cookie-notice policy link. `nodesToHtml`/`toHtml` throw on invalid tag or attribute names and on `on*` event-handler attributes, and drop `href`/`src`-style values that fail `safeHref`. EmDash cards link text now names the card for screen readers.
- ceb8310: **`@getvitops/utils/notify` is Worker-safe again.** It re-exports the Google Ads offline-conversion
  upload, which reached `google/token.ts` and its `node:crypto` import, so the subpath could not load in
  a bare Worker. The service-account JWT is now signed with Web Crypto (`crypto.subtle`, RS256) — same
  token, same PKCS#8 key Google issues, no Node builtin. A new `worker-safe.test.ts` walks each Worker
  subpath's import graph and fails on any `node:` specifier.

  **Breaking, narrow:** `@getvitops/utils/ads` no longer re-exports `createApexTxt`, `findZoneId` and
  `listApexTxt`. Import them from `@getvitops/utils/onboarding`, where they were always defined. The
  re-export tied the ad-platform capability table (imported by the generator and by Worker code) to the
  Cloudflare network executors. `vitops` itself already imported them from `onboarding`.

  Other packages in the `fixed` group: No consumer-facing change in this package.

### Patch Changes

- 0574388: Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
  both projects' GA releases.

  **Breaking for `@getvitops/emdash` consumers on EmDash 0.x**: the peer range no longer admits
  `emdash@0.31.x`/`@emdash-cms/cloudflare@0.31.x`. Upgrade `emdash` and `@emdash-cms/cloudflare` to
  `^1.0.1` first — nothing in `@getvitops/emdash`'s own plugin surface (`admin.portableTextBlocks`,
  the `hooks.page-fragments:register` capability, `definePlugin()`) changed against EmDash 1.0, so no
  code here needed to change, only the declared range.

  The `emdash` scaffold template (`vp create @getvitops:emdash`) picks up several fixes alongside
  the version bump:

  - `tailwindcss`/`@tailwindcss/vite` are now real dependencies — the template selected
    `css.format: 'tailwind'` without installing either, which threw on build.
  - `site.json` now sets `site.icons.sprite: true` plus the full `semantic` list the
    `vitops.actionLink` block's icon picker offers — previously its sprite icons pointed at a file
    the build never generated.
  - `astro.config.mjs` sets `migrations: { runtime: 'check', dev: 'auto' }`, and
    `site-deploy-emdash.yml` runs EmDash 1.0's documented `build → status → apply → deploy → check`
    migration sequence explicitly, rather than relying solely on first-request auto-migration. This
    needs a new GitHub Environment variable, `EMDASH_TARGET_FINGERPRINT` (one per environment),
    which only a human can set — run `emdash migrate --status` against the real deployed database,
    review the printed identity, then `gh variable set EMDASH_TARGET_FINGERPRINT --env <env> --body
    <value>`. Deploys fail clearly on the migration-apply step until it's set.
  - `lint.options.typeAware`/`typeCheck` in the template's own `vite.config.ts` are commented out,
    not deleted: vite-plus 1.0 only honours that option in a project's actual root config, and hard
    errors on it in a nested one (which this file is, sitting inside the `design-system` monorepo).
    Uncomment it once scaffolded into its own repo.

  No config schema changes. `@getvitops/generator` also switches from the `zod/mini` subpath import
  to the standalone `@zod/mini` package (zod 4.5+; same API) and fixes `validateConfig()` silently
  losing the offending key name on an `unrecognized_keys` error (e.g. a typo'd `site.ads` platform
  now names the bad key instead of reporting a bare "Invalid input").

  Also fixed: `vp check`'s `tsconfig-error` for `packages/create/templates/emdash/tsconfig.json`
  (`extends: "astro/tsconfigs/strict"`, unresolvable from inside this monorepo since the template
  has no `node_modules` of its own — a pre-existing, structural gap, newly surfaced as a hard error
  by oxlint 1.85's deeper config discovery, and blocking on every commit since this repo's pre-commit
  hook runs `vp check --fix`). Fixed with a new `scripts/link-template-deps.mjs`, wired as the root
  `postinstall` script: symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into the template's own
  `node_modules/` (resolved fresh from sibling packages that already depend on them for real, not a
  hardcoded `.pnpm` hash) and writes a minimal `astro:content` ambient shim at `.astro/types.d.ts`
  (the same path `astro sync` would generate for real). Both are gitignored and only ever exist
  inside this monorepo's copy of the template — a real scaffold installs its own real copies instead.
  Considered and rejected first: inlining astro's strict preset (drift risk against astro's own
  evolving default) and making the template a real pnpm workspace member (would change how its
  `@getvitops/*: "latest"` deps resolve locally, which `templates.test.ts` exists to protect).

  **Known gap, not fixed here**: `packages/astro/src/components/container.test.ts` (the
  `AstroContainer`-based render tests) fails to even load under vite-plus 1.0's Vite 8 — direct
  `.astro` imports in a Vitest file need the Astro Vite plugin registered, which nothing in this
  repo's test config actually does (Astro's own docs call for `getViteConfig()`, which doesn't
  compose with vite-plus's own `defineConfig`). A type-level shim
  (`packages/astro/src/components/astro-modules.d.ts`) fixes `vp check`'s type-aware pass, but the
  runtime `vp test` failure for this one file is still open.

- Updated dependencies [89265af]
- Updated dependencies [7fd5f8f]
  - @getvitops/config@8.2.0

## 8.2.0-alpha.0

### Minor Changes

- 0574388: Add `site.crm` — push form submissions into HubSpot, Zoho Bigin, or Jobber.

  Client sites need form submissions to land in the client's CRM. The options available before this
  — a HubSpot/Bigin/Jobber iframe or JS embed — fail on three counts: the markup can't be
  white-labelled against this design system, nothing can operate on the submission before it leaves
  the page, and the submission never touched `createConversionRoute()`, so `_ac` ad-click attribution
  was lost and no conversion notification was planned.

  This adds one server-side path for all three CRMs, hung off the conversion route that already
  exists. `createConversionRoute()` gets a new `crm` option (`{ config, credentials, fetch?,
  timeoutMs? }`); credentials arrive as a function of `locals`, exactly like the existing `binding`
  option, and are never config. A failed CRM write never fails the request and is folded into the
  notification email's new "Delivery" section, so a broken CRM token is never silent.

  New `@getvitops/utils/crm` subpath: `deliverToCrm()`, `mapSubmission()`, `deriveLastName()` (Bigin
  requires a last name; this derives one from an explicit field, a full name, or an email address,
  refusing rather than fabricating one), `submitToHubSpot()`, `submitToBigin()`, `submitToJobber()`.
  `identifySubmitter()` was promoted out of `notify`'s private name-guessing cascade into
  `@getvitops/utils/tracking`, since the CRM mapper needed the whole identity (first/last name,
  email, phone, company), not just a display name.

  Jobber is GraphQL, not REST, and answers `200 OK` for failures — a rejected `clientCreate` returns
  `userErrors[]`, a malformed request returns top-level `errors[]`. `submitToJobber()` classifies on
  the response body, not just the status. Its refresh tokens also rotate by default: **Refresh Token
  Rotation must be turned off** in the app's Developer Center settings, since a Worker reading a
  static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one — a rotated token is detected at
  exchange time and reported with the fix, rather than surfacing an hour later as an opaque 401.
  Attribution and unmapped extra fields render into a best-effort note by default (works on every
  Jobber plan); a resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true`
  is set once its lookup query has been verified against a live account (defaults `false` pending
  that verification — see `jobber.ts`'s docblock).

  New `site.crm` config block (`provider`, `hubspot`/`bigin`/`jobber`, `fieldMap`, `trackingFields`)
  and two CLI commands: `vitops crm check` (fetches the live HubSpot property list or Bigin field
  list and reports every mapped name that doesn't exist there — HubSpot rejects an unknown field
  outright, Bigin silently drops it; Jobber has nothing live to check yet, since its mapped values
  currently render as note text) and `vitops crm setup` (creates missing HubSpot properties; Bigin
  and Jobber have no such API, so both always print a manual reminder).

  The generated privacy policy now names HubSpot, Zoho Bigin, or Jobber when `site.crm` configures
  one. Bigin gets the same cross-border-transfer derivation Matomo Cloud already gets: a
  `dataCenter: 'ca'` asserts no transfer outside Canada, any other data centre does. Jobber's
  operator (Octopusapp Inc. d/b/a Jobber) is Canadian, but its own privacy policy names the United
  States as a processing location too, so the policy always asserts a cross-border transfer for
  Jobber regardless of config — a Canadian operator is not read as Canadian-only storage.

  Credentials: `VITOPS_HUBSPOT_ACCESS_TOKEN` for HubSpot; `VITOPS_ZOHO_CLIENT_ID` /
  `VITOPS_ZOHO_CLIENT_SECRET` / `VITOPS_ZOHO_REFRESH_TOKEN` for Bigin; `VITOPS_JOBBER_CLIENT_ID` /
  `VITOPS_JOBBER_CLIENT_SECRET` / `VITOPS_JOBBER_REFRESH_TOKEN` for Jobber. Never config.

  No consumer-facing change in `@getvitops/astro` beyond the new `crm` route option and a build
  warning when `site.crm` is configured with no route answering `TRACKING_ENDPOINT` — CSS/Bricks/
  tailwind outputs are unaffected.

- c3c1bcb: **New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
  designSystemEditor: { config } })` (`config` is your `site.json`, e.g. `import config from
  './site.json' with { type: 'json' }`) adds a `/design-system` admin page mounting
  `<wc-theme-editor>` — the same live token editor `@getvitops/vite`'s dev server has always
  offered, now usable by the client directly, no dev server required. An edit is visible
  site-wide immediately (a runtime `:root` override, served via a new plugin API route and
  `page:fragments`) and — once `site.deployment.repo`/`branch` and a `VITOPS_GITHUB_TOKEN`
  secret are set (see the scaffold's `SETUP.html`) — auto-commits to your `dev` branch, so it
  reaches the git-tracked `site.json` through your repo's normal review path rather than
  becoming a second, unreviewed source of truth. Until that's configured, the live half still
  works; only the auto-commit half is skipped (and says so in the admin page). The save route
  runs the exact same accessibility (APCA contrast) gate `generate()` enforces at build time,
  synchronously, before persisting — nothing non-compliant ever goes live even momentarily.

  Requires `@astrojs/react` + `react` + `react-dom` (already scaffold dependencies, for
  EmDash's own admin) and `@getvitops/core` (added as a new scaffold dependency this release).
  Declares two new plugin capabilities when enabled: `network:request` (for the GitHub
  auto-commit) and `hooks.page-fragments:register` (for the live override) — reviewed once at
  plugin-install time.

  **Breaking for `@getvitops/emdash`**: `vitopsEmdash()`'s `hooks.page-fragments:register`
  capability is now also granted whenever `designSystemEditor` is set, independent of the
  existing `scripts: 'fragments'` option (which governs something unrelated — web-component
  script delivery). No change if you don't use `designSystemEditor`.

  Also new, supporting the above:
  - `@getvitops/generator`: `validateColorContract()` and `buildReverseIndex()` (both
    `/tokens` subpath, Worker-safe) — the monotonicity/contrast gate and the
    `design-manifest.json` reverse-index, each extracted from `generate()`'s `build()` into
    standalone, non-throwing functions. `patchToOverrideCss()` turns a design-system patch
    into the `:root` override `<style>` block. `designSystemPath`/`getAt`/`setAt`/
    `mergePatch`/`formatConfig` moved from `@getvitops/vite` into `@getvitops/generator/config`
    (re-exported from `@getvitops/vite` unchanged) — one "patch a config file's design-system
    subtree" implementation shared by the dev endpoint and the new plugin route. New
    `site.deployment.repo`/`branch` config fields.
  - `@getvitops/utils`: new `/git` subpath — `commitFile()`, a Worker-safe (fetch-only)
    wrapper over GitHub's Contents API.
  - `@getvitops/core`: `<wc-theme-editor>` gains a `save-endpoint` attribute (default
    unchanged — `/__vitops/design-system`) so the same element can target the new plugin
    route instead of the dev-only Vite endpoint.

- 0574388: Add `vitops email setup|check` — connect `site.notifications.email.from` to whether its domain is
  actually onboarded onto an outbound email provider.

  Before this, nothing checked that. `EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no
  build or deploy-time warning — the failure mode is silent and production-only.

  `vitops email setup [domain]` onboards a sending domain (currently Cloudflare Email Sending only)
  and polls DNS until its SPF/DKIM/DMARC records resolve or a timeout is reached; `vitops email
  check` is the non-blocking deploy guard both `@getvitops/create` templates' `deploy`/`deploy:dev`
  scripts now run first (`--strict` makes it a real gate; opt out per-site with
  `site.notifications.email.verifySender: false`, or globally with `--skip` /
  `VITOPS_SKIP_EMAIL_CHECK`).

  Two things worth knowing before running it:
  - **The onboarded entity is an exact name, and it is usually a subdomain**
    (`send.yourdomain.com`), never the apex your `from` address names. When the exact domain isn't
    onboarded but a sibling in the same zone already is, the command reports that as the fix — send
    from the onboarded subdomain — rather than silently trying to onboard the apex, which rewrites
    `_dmarc.<domain>` and can tighten DMARC policy on every other mail your domain sends.
  - Candidates come from `site.notifications.email.from` (or its derived `noreply@<domains
    .canonical>` default) first; a best-effort scan of `--src` only supplements it, and never guesses
    at a computed `from` value.

  New `@getvitops/utils/email` subpath and `site.notifications.email.verifySender` config field.
  Needs `CLOUDFLARE_API_TOKEN` with an Email Sending scope in addition to the `Zone:Read` other
  commands already use.

- 0574388: Fire a Google Ads conversion on a tel:/mailto: click, and fix a rate-limit bug on the conversion
  route that could silently drop one of the two.

  `site.ads.google.conversionLabel` used to be accepted by the config schema and typed all the way
  through to the rendered tag, but nothing actually read it — no `gtag('event', 'conversion', …)`
  was ever emitted. When set, the click tracker `<Tracking />` inlines now fires the conversion at
  the moment a visitor taps a `tel:` or `mailto:` link, using the `AW-…/label` target Google Ads
  expects. A `conversionLabel` that can't safely land inside the inline bootstrap script (the same
  check `pixelId`/`accountId` already get) is dropped with a warning rather than firing something
  malformed — the ad tag itself still loads.

  Also: `createConversionRoute()`'s rate limiter previously keyed on IP address alone, so a call
  beacon and an email-click beacon from the same visitor, seconds apart, competed for one window —
  the second could 429 and vanish with no error anywhere. It's now keyed on IP _and_ event type, so
  distinct conversion types never starve each other; repeats of the same type are still throttled
  exactly as before.

  No config changes — a site with `site.ads.google.conversionLabel` already set picks this up
  automatically on the next build.

- 0574388: Track `mailto:` link clicks as conversions, alongside the existing `tel:` link tracking.

  Before this, the capture script only beaconed `tel:` clicks; a `mailto:` link on the same page was
  invisible to attribution — a visitor who emailed the business instead of calling generated no
  conversion event at all. `<Tracking />`'s inlined script now listens for both, sending `{ event:
  'email', email }` via `navigator.sendBeacon` the same way it already sends `{ event: 'call', phone
  }`.

  `ConversionEvent['type']` gains an `'email'` member alongside `'form'`/`'call'`, with a new
  `email` field. `createConversionRoute()` handles it exactly like a call: no honeypot, Turnstile or
  CRM checks (there are no form fields to validate or map), a 204 response, and a notification email
  subject reading `[Email Click] Visitor emailing ...`.

  No config changes and no new options — a site with `<Tracking />` already mounted picks this up
  automatically the next time it rebuilds.

- dde3df3: **`site.ads.google.conversionLabel` now accepts a per-action map** —
  `{ call?, email?, form? }` — instead of one bare string shared by every
  interaction. A bare string still works (back-compat, treated as `call`), but a
  call and an email click used to report as the **same** Google Ads conversion
  action, indistinguishable in the account; each action now gets its own
  `send_to` target.

  **New: `vitopsFormConversion(formEl)`**, exposed as `window.vitopsFormConversion`
  by `<Tracking />`'s capture script — call it from your own fetch-based form
  submit handler once the POST to `createConversionRoute()` succeeds, to fire the
  `form` Google Ads conversion action client-side (mirroring the existing
  tel:/mailto: click handler, which now fires `call`/`email` instead of sharing
  one label). Idempotent per form element. There's deliberately no server-side
  equivalent for a no-JS `<form method="post">` submission — that's a full-page
  redirect with no script to fire from, and a real server-side Google Ads
  conversion needs the Ads API's click-conversion upload (developer token + MCC
  access), tracked separately in the vNext backlog.

  **Fixed: the conversion route's rate limiter no longer trusts the client's
  raw `event` field.** It used to key on whatever string a client sent
  (`` `${ip}:${body.event}` ``), so varying that value on every request let a
  form submission dodge the per-IP rate limit entirely — only `'call'`/`'email'`
  were ever recognized, and anything else got its own fresh bucket. The key now
  uses the server's own classification (`call` | `email` | `form`), closing that
  bypass without changing the existing call-vs-email-don't-compete behavior.

  **New: `site.notifications.actionUrl`** — an optional action-link template
  added to the conversion-notification email as an "Actions" section.
  `{clickId}` is replaced with the ad click ID captured on `_ac` (gclid, fbclid,
  etc.); the section is omitted when the event has no click ID to interpolate,
  rather than emailing a broken link.

### Patch Changes

- 0574388: Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
  both projects' GA releases.

  **Breaking for `@getvitops/emdash` consumers on EmDash 0.x**: the peer range no longer admits
  `emdash@0.31.x`/`@emdash-cms/cloudflare@0.31.x`. Upgrade `emdash` and `@emdash-cms/cloudflare` to
  `^1.0.1` first — nothing in `@getvitops/emdash`'s own plugin surface (`admin.portableTextBlocks`,
  the `hooks.page-fragments:register` capability, `definePlugin()`) changed against EmDash 1.0, so no
  code here needed to change, only the declared range.

  The `emdash` scaffold template (`vp create @getvitops:emdash`) picks up several fixes alongside
  the version bump:
  - `tailwindcss`/`@tailwindcss/vite` are now real dependencies — the template selected
    `css.format: 'tailwind'` without installing either, which threw on build.
  - `site.json` now sets `site.icons.sprite: true` plus the full `semantic` list the
    `vitops.actionLink` block's icon picker offers — previously its sprite icons pointed at a file
    the build never generated.
  - `astro.config.mjs` sets `migrations: { runtime: 'check', dev: 'auto' }`, and
    `site-deploy-emdash.yml` runs EmDash 1.0's documented `build → status → apply → deploy → check`
    migration sequence explicitly, rather than relying solely on first-request auto-migration. This
    needs a new GitHub Environment variable, `EMDASH_TARGET_FINGERPRINT` (one per environment),
    which only a human can set — run `emdash migrate --status` against the real deployed database,
    review the printed identity, then `gh variable set EMDASH_TARGET_FINGERPRINT --env <env> --body
    <value>`. Deploys fail clearly on the migration-apply step until it's set.
  - `lint.options.typeAware`/`typeCheck` in the template's own `vite.config.ts` are commented out,
    not deleted: vite-plus 1.0 only honours that option in a project's actual root config, and hard
    errors on it in a nested one (which this file is, sitting inside the `design-system` monorepo).
    Uncomment it once scaffolded into its own repo.

  No config schema changes. `@getvitops/generator` also switches from the `zod/mini` subpath import
  to the standalone `@zod/mini` package (zod 4.5+; same API) and fixes `validateConfig()` silently
  losing the offending key name on an `unrecognized_keys` error (e.g. a typo'd `site.ads` platform
  now names the bad key instead of reporting a bare "Invalid input").

  Also fixed: `vp check`'s `tsconfig-error` for `packages/create/templates/emdash/tsconfig.json`
  (`extends: "astro/tsconfigs/strict"`, unresolvable from inside this monorepo since the template
  has no `node_modules` of its own — a pre-existing, structural gap, newly surfaced as a hard error
  by oxlint 1.85's deeper config discovery, and blocking on every commit since this repo's pre-commit
  hook runs `vp check --fix`). Fixed with a new `scripts/link-template-deps.mjs`, wired as the root
  `postinstall` script: symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into the template's own
  `node_modules/` (resolved fresh from sibling packages that already depend on them for real, not a
  hardcoded `.pnpm` hash) and writes a minimal `astro:content` ambient shim at `.astro/types.d.ts`
  (the same path `astro sync` would generate for real). Both are gitignored and only ever exist
  inside this monorepo's copy of the template — a real scaffold installs its own real copies instead.
  Considered and rejected first: inlining astro's strict preset (drift risk against astro's own
  evolving default) and making the template a real pnpm workspace member (would change how its
  `@getvitops/*: "latest"` deps resolve locally, which `templates.test.ts` exists to protect).

  **Known gap, not fixed here**: `packages/astro/src/components/container.test.ts` (the
  `AstroContainer`-based render tests) fails to even load under vite-plus 1.0's Vite 8 — direct
  `.astro` imports in a Vitest file need the Astro Vite plugin registered, which nothing in this
  repo's test config actually does (Astro's own docs call for `getViteConfig()`, which doesn't
  compose with vite-plus's own `defineConfig`). A type-level shim
  (`packages/astro/src/components/astro-modules.d.ts`) fixes `vp check`'s type-aware pass, but the
  runtime `vp test` failure for this one file is still open.

## 8.1.0

### Minor Changes

- **Added — `vitops init --site` and `vitops setup`, the scripted client-onboarding path.**

  `vitops init --site [--name] [--url]` scaffolds a starter `site.json` (the umbrella `Config`,
  embedding a starter design system at `designSystem.themes.default`) instead of a bare
  `design-system.json` — exported as `defaultSiteConfig()` from `@getvitops/generator`, alongside a
  new `CONFIG_SCHEMA_LOCAL_PATH` and an optional `$schema` field on `ConfigSchema` so a scaffolded
  config gets editor autocomplete the same way `design-system.json` already does.

  `vitops setup <repo|hosting|domain|search|ads|all>` (new `@getvitops/utils/hosting` subpath: a
  pure planner + `wrangler`/`gh`-shelling executors, following the same idempotent
  plan/observe/apply split as `onboarding`/`ads`) automates GitHub repo + branch policy and
  Cloudflare dev D1/R2 + repo secrets, and plans/checks the workers.dev-vs-custom-domain
  consistency without ever applying the cutover itself — see AGENTS.md's new "Client onboarding"
  section for the full design rationale. `search`/`ads` forward to the existing `search setup`/
  `ads setup` subcommands rather than reimplementing them.

  No consumer-facing change in `@getvitops/vite` or `@getvitops/astro` in this release — bumped
  only because they are in the `fixed` release group with `generator`/`utils`/`cli`.
  `@getvitops/core` does have a real fix in this release; see the separate `banner-hidden-fix`
  changeset.

## 8.0.1

## 8.0.0

### Major Changes

- Rebuild the lightbox on one dialog + the existing carousel, fixing the flicker on
  prev/next and the stutter on open.

  **Breaking (`css`/`bricks` and `tailwind` formats — `.lightbox-dialog`'s markup
  contract changed):**
  - `<Gallery />` now emits ONE `<dialog class="lightbox-dialog">` per gallery,
    wrapping a `<Carousel />`, instead of one dialog per image. A `.gallery__trigger`
    is now a plain `<a href="#slide-id">`, not a `command="show-modal"` button.
  - `.lightbox-dialog__content` / `__image` / `__nav` / `__nav-button` /
    `__caption` are gone. The dialog's child is `.lightbox-dialog__track` (a
    `.carousel`) — prev/next, dots, arrow keys and swipe are the carousel's,
    reused rather than reimplemented. `.lightbox-dialog__close` is unchanged.
  - `<wc-gallery>` no longer builds nav buttons or steps between images — the
    nested `<wc-carousel>` does. It fires `gallery-open` (unchanged shape) and
    re-emits the carousel's own stepping as `gallery-change`.
  - `packages/core/src/web-components/utils/gallery.ts` dropped `keyToAction` and
    `swipeAction` (the carousel's own key/swipe handling covers both now).
    `stepIndex`/`preloadTargets` are unchanged.

  **Why:** stepping used to close one `<dialog>` and open another, which made
  `animation.css`'s top-layer driver play a full exit-then-entry transition on
  every step — visible as a flicker on prev/next, by construction, not a bug to
  tune away. Opening also awaited the full image's `decode()` before starting the
  view-transition morph, so the dialog visibly stalled on a slow network. One
  dialog containing one carousel makes the first failure mode unrepresentable
  (stepping is a scroll, not a close/open pair) and removes the wait for the
  second (the morph starts immediately, painting the thumbnail as a CSS
  background placeholder until the full image arrives).

  **Also improved, not just fixed:** the no-JS fallback is no longer a _stripped_
  lightbox — it's a genuine one. Each trigger is ordinary fragment navigation
  (`:has(:target)` in `lightbox.css` reveals the dialog), which needs no Invoker
  Commands polyfill in any engine, and it now has working prev/next with no
  JavaScript at all — the previous per-dialog fallback had no way to express that.

  **Migration:** a consumer using `<Gallery />` needs no changes — the component's
  props are unchanged. Anyone who hand-authored `.lightbox-dialog` markup (per
  `docs/concepts/patterns.md` / `docs/css/classes.md`) must move to the new single-
  dialog-wrapping-a-carousel shape; see `patterns.astro`'s "Gallery, hand-authored"
  demo for the reference markup. `<wc-gallery>` consumers listening for
  `gallery-change` keep the same event shape (`{ index, total }`).

- a84839b: **Breaking — schema.org JSON-LD graph builders moved to `@getvitops/utils/schema`.**

  `articleGraph`, `breadcrumbGraph`, `faqGraph`, `itemListGraph`, `localBusinessGraph` and
  `organizationGraph` (plus their option/type exports) are no longer exported from the bare
  `@getvitops/utils` entry point. Import them from `@getvitops/utils/schema` instead:

  ```diff
  -import { articleGraph } from '@getvitops/utils';
  +import { articleGraph } from '@getvitops/utils/schema';
  ```

  The bare entry point pulls in `sharp`/`png-to-ico` for favicon generation — exactly what a
  server-rendered page must not carry into its Worker bundle when it renders a `<Article />`/
  `<Organization />`/etc. schema component under `output: 'server'`. This is the same split
  `notify`/`tracking`/`security` already made, for the same reason.

  `@getvitops/astro`'s own `<Article />`/`<Organization />`/`<Breadcrumb />`/`<FAQ />`/
  `<LocalBusiness />`/`<Carousel />` schema components already import from the new subpath as of
  this release, so a consumer using only those needs no change — only a consumer importing these
  builders directly from `@getvitops/utils`.

### Minor Changes

- Add Google Business Profile reviews: fetch, cache, render.
  - **`vitops reviews`** (new CLI command) fetches a client's GBP reviews (legacy v4 API — the only
    one that has them) and writes them to `.vitops/reviews.json`, meant to be committed so a build
    never needs a live Google credential. `--dry` prints the plan; `--check` diffs against the cache
    without writing. Requires the same `VITOPS_GOOGLE_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN` (or
    ADC login) `search setup` uses, scoped to `business.manage` — **and the calling GCP project must
    be allowlisted by Google first**, a separate one-time approval from every other Google API here.
  - **`site.reviews`** (config): which `organization.locations` to fetch, and per-location
    `featured`/`minRating`/`sort`/`limit` selection. `schema` (JSON-LD) and `avatars` both default to
    **off** — see the migration notes below.
  - **`@getvitops/utils/reviews`** (new subpath): the pure plan/select/merge functions plus the GBP
    fetcher and cache reader/writer, mirroring `./indexing`'s pure/IO split.
  - **`<ReviewCard>`** (new Astro component, `@getvitops/astro`): one review card from a cache entry.
    No web component — nothing here needs progressive enhancement. Composes the existing
    `schemas/Review.astro` for JSON-LD only when both `schema` and `itemReviewed` are passed.
  - **`<Marquee>`** (new Astro component): the tier-3 wrapper `wc-marquee`/`marquee.css` was missing.
  - **`.review` pattern** (`css`/`bricks` and `tailwind` formats): a new config-generated
    `patterns.items.review` entry plus `packages/core/css/patterns/review.css` for the structural
    parts (rating, identity, body, reply, source link). Two new semantic icon names, `star` and
    `star-half`, across every icon set.

  **Migration:** no breaking change. A site adding `site.reviews` should read the "Google reviews"
  section in AGENTS.md before enabling `schema` — Google's structured-data policy treats a business
  marking up reviews of itself as ineligible for review rich results and risks a manual action, which
  is why it defaults off.

- Repo-wide simplification pass: de-boilerplate the CLI, dedupe shared cache/plan
  primitives in `@getvitops/utils`, drop dead code, and tighten dependency hygiene.

  No breaking changes. (`vitops icons`'s `--site` flag was briefly going to be renamed to
  `--input` for consistency with the other `Config`-anchored commands — deferred rather than
  spending a major bump on a rename with no other breaking change riding along; it stays
  `--site` for now.)

  **Fixed:**
  - `@getvitops/core`'s 12 runtime deps (`lit`, both `@oddbird` polyfills, both
    `@webcomponents` packages, `colorjs.io`, etc.) were listed as `dependencies` despite
    being bundled into `dist/elements.js`/`dist/polyfills.js`/`dist/deferred.js` — a
    consumer installed them twice for nothing. Moved to `devDependencies`; no change to
    what ships.
  - Deleted `old-css-lib/` (59 files), superseded by `packages/core/css/` since the
    in-memory bundling change — no consumer-facing effect, it was not part of any
    published output.
  - Deleted a dead Astro module (`packages/astro/src/scripts/deferred.ts`) that had
    silently diverged from `packages/core/src/js/deferred.ts` and had zero importers.

  **No consumer-facing change in `@getvitops/vite`** beyond the fixed-group version bump —
  task-graph and caching fixes internal to this repo's own build.

  Everything else (the `cli.ts` file split into `commands/{search,ads}.ts`, shared
  `json-store.ts`/`plan-format.ts` helpers in `@getvitops/utils`, a `.github/actions/setup`
  composite action, restatement-comment cleanup) is internal refactoring with no change to
  any published API, CLI flag, or generated output.

## 7.0.0

### Minor Changes

- c0c092b: `vitops search` now works from a `gcloud` login, and attributes API usage per site.

  **Being logged in is enough.** With no `VITOPS_GOOGLE_*` set, an Application Default Credentials
  login is used — the credential `gcloud auth application-default login` already wrote. It needs the
  Search Console scopes, which are not in the default ADC set:

  ```
  gcloud auth application-default login \
    --scopes=openid,https://www.googleapis.com/auth/siteverification,\
  https://www.googleapis.com/auth/webmasters,https://www.googleapis.com/auth/cloud-platform
  ```

  Explicit `VITOPS_GOOGLE_*` vars still win. Ambient credentials are only a fallback, because a stale
  local login silently overriding a deliberate CI secret is the worst available precedence.

  Beyond convenience, this removes a documented footgun: an OAuth client you create yourself sits in
  _Testing_ publishing status, where Google **expires the refresh token after 7 days**. The Cloud SDK
  client is published, so an ADC credential doesn't rot between onboarding runs.

  **New: `site.google.project`** — the Google Cloud project API usage is attributed to, sent as
  `x-goog-user-project`. One project per site is what keeps each site's usage and billing separate,
  and it is the same field Maps or anything else will read later, rather than a `quotaProject` here
  and a `mapsProject` there.

  It is **required for a user credential and wrong for a service account**, which is why it is not
  sent unconditionally. A user credential authenticates through a shared OAuth client that owns no
  project, so Google refuses the call outright — measured: `403 "requires a quota project, which is
  not set by default"`. A service account already belongs to a project, and pointing it at a
  different one would newly require `serviceusage.services.use` there, turning a working CI
  credential into a 403 for no benefit.

  Using it needs both APIs (`searchconsole.googleapis.com`, `siteverification.googleapis.com`)
  enabled on that project, and `serviceusage.services.use` for the identity — one grant per site,
  which suits an agency administering many sites from one admin identity.

  An ADC credential with no `site.google.project` is now **refused before any request is made**,
  naming the file the credential came from and the project gcloud recorded with it:

  ```
  ✖ this Google credential comes from ~/.config/gcloud/application_default_credentials.json,
    which authenticates through a shared OAuth client that owns no project — so it needs
    "site.google.project" in site.json to say which project the API usage belongs to.
    gcloud recorded "acme-web" as the quota project for that login, so that is probably the value.
  ```

  That is the mistake waiting for the _second_ site: the command gets copied from whatever
  onboarded the first one, the field is left out, and Google's own answer names neither the config
  field nor the credential.

  **Fixed: an ADC file in `GOOGLE_APPLICATION_CREDENTIALS` no longer hard-exits.** That variable is
  Google's own convention _and_ where gcloud writes ADC, so the same variable carries two kinds of
  credential. Parsing an `authorized_user` file as a service account failed with `service account
  JSON is missing client_email or private_key` — while holding a credential the command already knew
  how to use. It is now discriminated on `type`, the field Google's own libraries switch on.

  **Also fixed — `search setup --dry` and `--check` are not offline.** The docs implied otherwise. The
  state gather runs before the planner, so both read from Cloudflare and Google and both need
  credentials. They still create and change nothing; `notify --dry` remains genuinely request-free.

  New in `@getvitops/utils/indexing`: `parseAdcUser`, `adcQuotaProject`, `adcCredentialsPath` (pure,
  so what is decidable is asserted without a filesystem), plus `googleHeaders` and the `GoogleAuth` /
  `GoogleAuthLike` types. The seven exported Google request functions now take a token **or** a
  `{ token, quotaProject }` — a bare string still works everywhere, so nothing needs changing.

- **Added — `utils`.** `itemListGraph()`, a pure schema.org `ItemList` JSON-LD builder — a sibling
  of `breadcrumbGraph()`/`localBusinessGraph()`. Extracted from `@getvitops/astro`'s `<Carousel />`
  so any consumer can build a valid `ItemList` (Google's "all-in-one page" carousel format:
  `ListItem.item` carrying `@type`/`name`/`url`) for content that isn't one of the six Google
  carousel rich-result types (`Article`/`Recipe`/`Movie`/`Course`/`Restaurant`/`Product`) — the
  entity type is no longer constrained to that set.

  **Changed — `astro`.** `<Carousel />`'s `CarouselItem['type']` now accepts any string, not just
  the six carousel rich-result types — non-breaking, the union only widens. It's a thin wrapper
  over `itemListGraph()` now; behaviour for existing callers is unchanged.

  No consumer-facing change in this release outside `utils` and `astro` — `generator`, `cli` and
  `vite` still ship in this release only because the six share one version.

  **Fixed — `core` (`css`/`bricks`/`tailwind` build output, all formats).** The CSS and HTML
  authored inside Lit's `css`/`html` tagged templates in `<wc-*>` component sources previously
  survived JS minification verbatim — a JS minifier treats a template literal's cooked text as
  opaque, so `elements.js` shipped ~690 lines of indented, unminified CSS (and the equivalent in
  HTML) inside an otherwise-minified 886-line file. Two source-level build transforms now collapse
  both before bundling: `postcss` + `postcss-lit` + `cssnano` for `css` templates, `minify-html-literals`
  (`conservativeCollapse: true`, so whitespace between inline elements in light-DOM components never
  collapses to zero) for `html` templates. `elements.js` drops from 886 lines / ~101 KB to 49 lines /
  ~96 KB. A second build step deduplicates the 17 `@license` comment blocks (only 6 are textually
  distinct) down to one verbatim copy of each — required by BSD-3/MIT/Apache-2.0's notice-retention
  terms either way, just no longer repeated once per source file that carries it. No API change;
  build-time only, and none of the added tooling (`postcss`, `postcss-lit`, `cssnano`,
  `minify-html-literals`) is a runtime or published dependency.

- 2b50f9e: Extract the LocalBusiness JSON-LD builder out of `<LocalBusiness />` into a reusable
  `localBusinessGraph()`, and add the location fields listing platforms (GBP, Bing Places, Apple
  Business Connect) actually need.

  **Added — `@getvitops/utils`.** `localBusinessGraph(options)` (+ its `LocalBusinessGraphOptions`,
  `OpeningHoursSpecification` and `SpecialHoursSpecification` types) is now exported from
  `@getvitops/utils`, alongside the existing `organizationGraph`/`articleGraph`/`breadcrumbGraph`/
  `faqGraph` builders — same module, same shape, usable anywhere a JSON-LD graph is built outside an
  Astro component.

  **Added — `authoring`/`config` (`@getvitops/generator`).** Four new `organization.locations.<slug>`
  fields: `hoursSpecial` (dated deviations from the recurring `hours` — holiday hours, a one-off
  closure), `photos` (`ImageRefSchema[]` → JSON-LD `image`), `sameAs` (this location's own listing
  URLs, distinct from `organization.sameAs`, which is the company overall), and `listings` (external
  listing ids keyed by platform — `google` | `bing` | `apple` — not consumed by the generator today;
  recorded so a future listings-sync command has a stable id to match against).

  **Changed — `astro`.** `<LocalBusiness />`'s `Props` type is now `LocalBusinessGraphOptions`
  (re-exported, not redefined) rather than a local interface that had drifted from what the builder
  actually accepted. No markup or prop-name change for an existing consumer.

## 6.0.0

**No consumer-facing change in this package.** The major is the toolchain's shared version, bumped
in lockstep for the carousel rework in `@getvitops/core` / `generator` / `astro`. Nothing exported
here changed, and no code that imports `@getvitops/utils` needs editing.

## 5.0.0

### Major Changes

- **Dangling token references are now a build failure.** `validate()` resolves every `var(--…)` a
  config authors — in `patterns.defaults` / `radii` / `groups` / `items.*.{base,overrides,states}`,
  `typography.roles` and `shadows` — against the tokens that config actually emits. A reference to a
  token that does not exist used to validate, generate, minify and ship, then resolve to nothing in
  the browser: one downstream config shipped a `.cta` whose `color` fell back to `inherit` on a brand
  fill (unreadable text on every filled button), and two of its four dead references had been dead for
  several releases with nothing ever reporting them.

  The check is deliberately anchored to the namespaces the generator owns — `--color-*`, `--shadow-*`,
  `--z-tier-*`, `--surface-glass`, `--overlay` — the same discipline `vitops lint` follows. A pattern
  may legitimately reference a framework token from `@getvitops/core` or a hook of your own, and
  enumerating "every valid token" would make those false positives. A reference carrying a fallback
  (`var(--x, 0.25rem)`) is never flagged: that is you saying what happens when the token is absent.
  Errors name the config path and suggest the nearest token that does exist.

  Two related diagnostics ship with it:
  - **Pre-1.0 colour-grammar references are reported as one rename table**, not as a dozen separate
    "no such token" errors — the shape the 3.0 flat-config detector uses, applied to the 1.0 colour
    change. It is built from your own role names, and it says to apply the renames _simultaneously_,
    because several of them rotate (`--surface-bg` → `--color-bg-surface-muted`,
    `--surface-bg-bold` → `--color-bg-surface`) and sequential replacement compounds them.
  - **A surface-shaped role declared chromatic now warns.** A bare hue string is shorthand for
    `kind: "chromatic"`, which emits no bare `--color-bg-<role>` and no `.bg-<role>` — so writing
    `"surface": "ink"` silently removed `--color-bg-surface` and the 36 references the framework's own
    CSS makes to it. Relatedly, `--surface-glass`, `--overlay` and `.glass` are no longer emitted when
    `surface` is chromatic: they read `--color-bg-surface`, so emitting them pointed at nothing.

  **`vitops lint --fix` is now the migration tool.** It reads `var(--…)` out of CSS and `<style>`
  blocks (not just `class` attributes) and rewrites pre-1.0 token references in a **single pass**, so
  the rotating renames cannot compound. Nothing else is rewritten — every other finding it reports is
  a judgement call. Run it after a major bump.

  **`--help` works on every subcommand.** `vitops lint --help` used to exit non-zero with
  `Unknown option '--help'`; every leaf subcommand parsed its own argv strictly and none declared the
  option. It is now answered before dispatch, so no command can forget it, and a drift guard fails the
  build if a command has no documented options. (`validate`'s options were genuinely undocumented and
  now are.)

  **The Astro integration reads `site.tracking` and `site.legal.cookieConsent`.** These drive the
  generated cookie notice, while `vitops({ consent, tracking })` drove the runtime — two hand-synced
  declarations of the same fact with nothing comparing them, so a site could ship a notice naming
  categories its banner never offered, or disclosing an `_ac` cookie no capture script ever wrote, and
  the build was clean. The config blocks are now defaults (as `css` / `fonts` / `favicon` / `ads`
  already were) and a genuine contradiction — `true` against `false` on the same fact — **fails the
  build**, naming both sides. An absent option is not a contradiction; it just takes the config's
  value.

  Also fixed, each from a downstream report:
  - **`@getvitops/astro/tracking`** re-exports `@getvitops/utils/tracking` (plus `TRACKING_ENDPOINT`),
    so the documented conversion flow works with one install. Under strict pnpm app code cannot
    resolve a transitive dependency, and the obvious workaround — importing the same symbols from the
    package index — is the one that drags the integration's Node builtins toward a Worker bundle. This
    entry and `./routes` are both clean.
  - **`createConversionRoute`'s example was broken on every supported Astro.** It read the binding off
    `locals.runtime.env`, removed in Astro v6, while the package peers on `>= 7` — and because the
    throw precedes the response, Astro re-reads the request and reports a misleading "Body has already
    been used". It also called a `toNotifyContext()` helper that does not exist. The example now uses
    `import { env } from 'cloudflare:workers'` and a plain `NotifyContext`.
  - **`/api/track` is exported as `TRACKING_ENDPOINT`**, and the integration warns at build when
    tracking is on and no route answers it. It was a bare literal inside the inlined capture script:
    name the route file anything else and every `tel:` beacon 404s, conversions vanish, and nothing
    errors anywhere.
  - **`describeEvent` no longer reports "from Unknown"** for forms that don't have a field literally
    named `name`. It now falls back through `first_name`/`last_name`, `full_name`, and finally the
    email address.
  - **`sendEmail` takes `timeoutMs` (default 10s).** `binding.send()` had no deadline, so one hung
    attempt hung the request that produced it — indefinitely, in the one module otherwise built on
    always saying why. A timeout is retried, like any other transient failure.
  - **`vitops search notify` warns when the sitemap's URLs aren't on the configured origin.** A 404
    fails loudly; a well-formed sitemap belonging to someone else did not — a route collision served a
    valid document listing another site's pages and the run reported a healthy submission. Surfaces at
    `--dry`.
  - **`require()` warns when the page has no `<wc-consent>`.** The demand can never be granted, so
    whatever waited on it never runs — silently. Hit by rendering `<Tracking />` on pages where
    `<CookieConsent />` wasn't.
  - **`vitops agents` no longer writes a path it guessed.** It used to warn and then write "tokens
    live in `design-system.json`" into a project whose tokens are in `company.json`, with the four
    emitted `vitops generate` commands hard-coded to match — copy-paste-broken in exactly the projects
    that most need the block to be right. It now finds the config by shape, interpolates the resolved
    path into every emitted command, and fails rather than guessing when there is nothing to name.
  - **`vitops search setup --dry` and `vitops ads setup --dry` run without credentials.** A dry run
    that mutates nothing should not demand the token to mutate; with none set it plans from scratch
    and says so. (`--check` still needs them — drift is a comparison against live state.) Both now
    also mention that the Cloudflare token needs `Zone:Read` alongside `Zone:DNS:Edit` — the
    zone-by-name lookup uses it, and its absence read as "the zone isn't in this account".
  - **`vitops legal` names the files it wrote and flags new ones.** Enabling `cookieConsent` silently
    produced a `cookie-notice` document that then needs a page, a route, a link and a `policyUrl`; the
    command said only "3 files". The review reminder is also printed on the stdout path, where it was
    missing entirely.
  - **`vitops init` writes a versioned `$schema`** — `./node_modules/@getvitops/generator/schema.json`,
    following wrangler — instead of an unpinned unpkg URL that resolved to whatever was newest, so an
    editor validated a pinned project against a schema it wasn't built with.
  - **`favicon.backgroundColor` and `favicon.name` are described accurately.** `backgroundColor` is
    not manifest-only: it fills the opaque `apple-touch-icon.png` and `icon-mask.png`, which are
    written whether or not a manifest is. `name` documents that it and `themeColor` **together** are
    what make a site installable. The missing-background warning now also fires for a dark opaque mark,
    not only a transparent source — `apple-touch-icon` insets the logo and fills the surround either
    way.

## 4.1.0

### Minor Changes

- 2c890c0: Link a site to its ad properties: `site.ads`, `vitops ads`, and `<Ads />`.

  `vitops search` covers the whole Search Console relationship. Nothing covered the equivalent one
  with ad platforms, and a site's ad accounts had nowhere to live — so a Meta pixel pasted into a
  template was invisible to the rest of the toolchain. It set `_fbp` on a site whose generated cookie
  notice never mentioned it, whose consent gate never cleared it on revoke, and — for LinkedIn and
  Pinterest — whose attribution never captured the click ID at all, so every conversion from those
  platforms arrived indistinguishable from organic traffic.

  **New `site.ads` block**, keyed by platform (`google`, `meta`, `linkedin`, `reddit`, `tiktok`,
  `microsoft`, `pinterest`, `snapchat`):

  ```jsonc
  {
    "site": {
      "ads": {
        "meta": { "pixelId": "123456789", "domainVerification": "abc123" },
        "google": {
          "accountId": "123-456-7890",
          "pixelId": "AW-987654321",
          "conversionLabel": "xyz",
        },
      },
    },
  }
  ```

  **`vitops ads setup`** ensures each platform's domain-verification DNS record. Only four platforms
  verify a domain at all — Meta, TikTok, Pinterest and Snapchat, by apex DNS TXT — and that record is
  the one thing created for you (in Cloudflare, via `CLOUDFLARE_API_TOKEN`; created only, never edited
  or deleted). Google Ads, LinkedIn, Reddit and Microsoft Ads have no domain verification: linking
  there is the tag and the account id, and the run says so rather than skipping in silence. No
  platform Marketing API is called — Meta's needs a system-user token and Google's an approved
  developer token with your own account on the line — so the final "Verify" click is surfaced as a
  reminder. `--dry` prints the plan, `--check` reports drift and exits non-zero.

  **It asks for what the config is missing.** A verification token does not exist until someone
  fetches it from the platform UI, so a first run prompts for it, naming the exact UI path, folds the
  answer into the plan and writes it to your config. The token is not a secret — it is published in
  DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key.
  Prompting requires a TTY: with `--dry`, `--check`, `--no-prompt`, or in CI, you get a named error
  instead and the run never hangs. `--no-write` keeps the answer out of the config.

  **`vitops ads tags`** prints each pixel as an inert, consent-gated `<script>` — `type="text/plain"`
  with the library URL on `data-src`, so an undecided visitor's page issues no third-party request.
  For Bricks, WordPress, Eleventy: any stack without the Astro integration.

  **`vitops ads lint`** reports the gaps that are invisible at runtime: a click ID the platform stamps
  that attribution does not capture, a pixel while `site.tracking` is off, a property with no tag id.

  **`<Ads />` in `@getvitops/astro`**, a sibling of `<Analytics />` rather than part of it — ad
  properties come from the site config, state their own consent category (`marketing` by default,
  rather than being derived), and switch per environment on their own
  (`environments.<env>.ads`, defaulting to `analytics`, then true, so a preview deployment can send
  pageviews without firing conversion pixels). Both components now render through one `<GatedTags />`,
  so the inert markup has a single implementation.

  **Your cookie notice now discloses every configured pixel** — name, cookies and opt-out — from the
  same table that writes `data-consent-cookies`, so the notice and the revoke cannot disagree. If you
  add `site.ads` to a config whose privacy policy or cookie notice you have already published,
  re-generate and re-read them.

  `li_fat_id` (LinkedIn) and `epik` (Pinterest) join the click-ID capture vocabulary; a site running
  either platform starts attributing conversions it previously recorded as organic.

## 4.0.0

### Major Changes

- f7bc0a0: Add `vitops search setup` — onboard domains into Google Search Console as domain properties.

  **Breaking:** the `vitops indexing` command has been renamed to **`vitops search notify`**. There is
  no alias — update any scripts or CI that call `vitops indexing` to `vitops search notify` (same flags,
  same behaviour).

  **New: `vitops search setup`.** For each domain in a site config's new `site.searchConsole` block
  (a record keyed by bare hostname), it:
  - ensures the apex verification TXT record in Cloudflare,
  - verifies ownership via the Site Verification API (DNS_TXT), retried with exponential backoff while
    DNS propagates — a still-unverified domain is reported **PENDING**, not failed,
  - adds the `sc-domain:` property via the Search Console API,
  - adds any `delegatedOwners` to the verified Site Verification web resource.

  It is idempotent (a re-run of an onboarded domain is a no-op), supports `--check` (report drift, exit
  non-zero, mutate nothing) and `--dry` (print the plan, change nothing), and `--domain <name>` to
  scope to one entry. DNS records are only ever created, never edited or deleted.

  Credentials come from the environment, never the config: `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit`
  token) and a Google **user OAuth refresh token** as `VITOPS_GOOGLE_CLIENT_ID` /
  `VITOPS_GOOGLE_CLIENT_SECRET` / `VITOPS_GOOGLE_REFRESH_TOKEN` (scoped to `siteverification` +
  `webmasters`). Granting a Google Group **Full-User** access has no Search Console API and is surfaced
  as a reminder in the summary rather than automated.

- ceed51f: `vitops search notify` now accepts either Google credential, so most sites need only one.

  The two halves of `vitops search` each demanded a different, unrelated Google setup — five environment variables between them. `search setup` requires a user OAuth credential (verifying a site makes the caller an **owner** of the property, and that should be a person, not a project robot), while `search notify` accepted only a service account. Search Console does not care which identity calls it, so a consumer who had already run `search setup` was being made to create a second credential for the other half of the same command.

  `search notify` now takes whichever you have, preferring the service account when both are set — it runs on every deploy, in CI, and a service account does not expire, whereas a refresh token can be revoked and expires after 7 days for an OAuth client still in _Testing_ publishing status. `search setup` is unchanged and still requires user OAuth.

  **Breaking — two renamed exports.** Both did the same job under the same name from different subpaths, which forced an alias at every call site:
  - `@getvitops/utils/indexing`: `getAccessToken` → **`serviceAccountToken`**
  - `@getvitops/utils/onboarding`: `getAccessToken` → **`refreshTokenGrant`**

  New: `googleAccessToken(credential)` from `@getvitops/utils/indexing` takes a `GoogleCredential` union and is what both wrappers now call. If you were importing either `getAccessToken`, switch to the specific name, or to `googleAccessToken` if you want to accept either identity.

  Internally the exchange is now one function. The two grants send different form bodies; everything after that — endpoint, content-type, error handling, `access_token` extraction — was duplicated verbatim in two modules. The service-account JWT signing had no test at all, because it was only reachable over the network; it now does, including the literal-`\n`-in-a-PEM case that secret stores produce.

### Minor Changes

- c6b99e7: Ad-click attribution and conversion notifications ship as part of the toolchain.

  A visitor arriving on an ad carries a click ID in the URL; `<Tracking />` captures it into a first-party `_ac` cookie, and when that visitor later submits a form or taps a `tel:` link, the conversion handler reads the cookie back and notifies whoever the config says. Previously this was per-site code.

  **Added — `@getvitops/utils/tracking`.** The attribution vocabulary and cookie, as pure functions over a cookie _string_ so the browser capture and the server-side handler share one implementation: `parseTrackingCookie`, `serializeTrackingCookie`, `mergeTracking`, `identifyPlatform`, `getPrimaryClickId`, plus the click-ID/UTM tables. No DOM, no network, no clock — every function that needs "now" takes it as an argument, so it runs unchanged in a Worker.

  **Added — `@getvitops/utils/notify`.** Conversion notifications, split the way `indexing/` is: `plan.ts` decides everything purely (which channels fire, who they reach, and **why anything is skipped**), `render.ts` turns the event into prose, `email.ts` executes and decides nothing. A misconfigured site can therefore be told exactly why no notification will arrive — a silently unsent one is indistinguishable from no conversion.

  The `ConversionEvent` is the abstraction: the event is the _fact_, and how it reads is the channel's business.

  **Added — the `email` channel, via Cloudflare Email Sending.** Uses the current structured binding (`env.EMAIL.send({ to, from, subject, html, text })`), not the legacy `EmailMessage` + hand-built MIME path. The binding is **passed in, never imported**, so `@getvitops/utils` takes no Cloudflare dependency and the sender is testable with a stub. Retries only the transient error codes; a configuration fault like `E_SENDER_NOT_VERIFIED` is surfaced verbatim rather than collapsed into "send failed". With no binding it prints the notification — the dev path.

  Remember to onboard the sending domain (`wrangler email sending enable <domain>`) and add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc`, or every send fails.

  **Added — `<Tracking />` and `createConversionRoute()`** in `@getvitops/astro` (`@getvitops/astro/Tracking.astro`, `@getvitops/astro/routes`). The route factory handles both the `tel:` beacon and a form POST; validation and business rules stay the consumer's, because every site's form differs. A failed notification never fails the request — the visitor has already submitted, and refusing them because our mail didn't go out turns a lost notification into a lost conversion.

  **Added — `site.tracking` and a widened `site.notifications`.** `notifications.email` now accepts a full channel object as well as a bare address (which still means what it did). `tracking` gains `category`.

  **Fixed — the capture script now asks for consent instead of only reading it.** It previously checked `granted('marketing')` passively, which under the demand-driven banner is a permanent no-op: nothing else on a page demands `marketing`, so the banner never offered it, so it was never granted, so `_ac` was never written — silently, on every site with the gate enabled. It now calls `require()`, which is what raises the banner, and only when the URL actually carried a click ID or UTM. A visitor arriving organically has nothing to attribute and is never asked.

  The integration adds `marketing` to the offered categories when tracking is on, so the banner has a row for the category the script will demand, and warns when tracking is enabled with `consent` off.

  **Fixed — revoking consent now clears `_ac`.** The marker `<Tracking />` emits carries `data-consent-cookies`, which the consent runtime's cleanup reads. There was no cleanup path for this cookie before.

  **Fixed — the cookie notice discloses `_ac`.** It is first-party, so no provider table would ever name it, and a site running attribution alongside a cookieless analytics provider was previously described as setting no cookies at all.

## 3.0.0

### Major Changes

- 6e68ace: **Breaking:** the site config is now a three-section `Config` — `designSystem`,
  `organization`, `site`.

  The flat `SiteConfig` held the company (`organization`, `contact`, `locations`) and the
  deployment (`analytics`, `environments`, `seo`, `legal`) as peers, so no single noun
  described it, and a second site sharing the same company had no way to say so. The three
  sections split those apart: several sites can now carry one `organization` and differ only
  in `site`.

  **Migrating.** `designSystem` stays at the root, and the fields already under
  `organization` stay where they are. Everything else moves into one of two sections:
  - → `site`: `defaultLocale`, `locales`, `domains`, `dns`, `cloudflare`, `environments`,
    `abTesting`, `fonts`, `tags`, `postTypes`, `galleries`, `testimonials`, `templates`,
    `navigation`, `seo`, `analytics`, `notifications`, `tracking`, `security`, `legal`,
    `icons`, `favicon`, `deployment`
  - → `organization`: `contact`, `primaryLocation`, `locations`, `services`, `links`

  You do not have to work this out from the list: `vitops validate` detects a pre-3.0 flat
  config and prints every move by name, rather than reporting a dozen unknown keys.

  ```jsonc
  {
    "designSystem": {
      "themes": {
        "default": {/* … */},
      },
    },
    "organization": {
      "name": "Acme",
      "contact": "hq",
      "locations": {
        "hq": {/* … */},
      },
    },
    "site": {
      "defaultLocale": "en",
      "domains": {/* … */},
      "analytics": {/* … */},
    },
  }
  ```

  **Renamed exports** (`@getvitops/generator`): `SiteConfigSchema` → `ConfigSchema`,
  `SiteConfig` → `Config`, `validateSite` → `validateConfig`, `resolveSiteConfig` →
  `resolveConfig`, `isSiteConfig` → `isConfig`, `siteJsonSchema` → `configJsonSchema`,
  `SITE_SCHEMA_URL` → `CONFIG_SCHEMA_URL`, `SiteValidationResult` →
  `ConfigValidationResult`. `ResolvedInput.site` is now `ResolvedInput.config`. New:
  `OrganizationConfig` and `SiteSection` for the two sections.

  **Renamed schema file:** `@getvitops/generator/site.schema.json` →
  `@getvitops/generator/config.schema.json`. Update the `$schema` key in your config.

  Option names are unchanged — `vitops({ site: { input } })`, the Vite plugin's `site`,
  and `generate({ site })` still point at the config file.

  **The Astro integration is now `vitops()`, not `getvitops()`.** It is a default export,
  so the name is yours and nothing breaks on upgrade, but every example now reads
  `import vitops from '@getvitops/astro'` — matching the Vite plugin, which has always been
  `vitops`. The `@getvitops/*` package scope and the internal `virtual:getvitops/*` module
  ids are unchanged; neither is an import name.

  **Added:** a generated config authoring reference — `vitops docs config`, `docs/config.md`
  in the OKF bundle, and _Config reference_ on the docs site. It is walked from the published
  JSON Schema by the same helper that renders the `design-system.json` reference, so it
  cannot describe a field validation does not accept.

## 2.1.0

### Minor Changes

- 20e518e: Add `vitops indexing` — tell search engines about a deploy, instead of opening Search Console by hand.

  Configure it in your site config under `seo.indexing`, then run it after deploying:

  ```jsonc
  "seo": {
    "indexing": {
      "indexNow": { "key": "…" },
      "searchConsole": { "siteUrl": "sc-domain:acme.ca" },
      "priorityUrls": ["https://acme.ca/", "https://acme.ca/services"]
    }
  }
  ```

  ```
  vitops indexing --dry     # print the plan, make no requests
  vitops indexing           # submit
  vitops indexing --check   # a day or two later: did Google actually index them?
  ```

  It reads your sitemap, diffs it against the previous run, and submits only what changed —
  pinging **IndexNow** and re-submitting your sitemap through the **Search Console API**.
  `--check` inspects `priorityUrls` and exits non-zero on a page Google hasn't indexed, so a
  scheduled CI job can catch a page that quietly fell out of the index.

  **Be clear-eyed about what this can do.** Google exposes no API that requests indexing — the
  button in Search Console isn't available anywhere, URL Inspection is read-only, and the sitemap
  ping endpoint was removed in 2023. IndexNow reaches Bing, Yandex, Naver, Seznam and Yep; Google
  doesn't participate. So this automates every sanctioned step and then verifies the outcome; it
  does not make Google re-index on demand, and nothing can. Google's Indexing API is deliberately
  not wired: it's scoped to job postings and livestreams, and using it for ordinary pages violates
  its terms.

  Also new, and worth wiring at the same time — **`gitLastmod()` for real sitemap dates**:

  ```js
  import vitops, { gitLastmod } from '@getvitops/astro';
  vitops({ sitemap: { serialize: await gitLastmod() } });
  ```

  `@astrojs/sitemap` emits no `<lastmod>` by default, which means a crawler is told your pages
  exist but never that one changed — and it's what lets `vitops indexing` submit a handful of URLs instead
  of all of them. `gitLastmod()` derives each date from the source file's last commit, and leaves a
  page alone rather than guessing (dynamic routes, ambiguous slugs, shallow clones): an inaccurate
  `lastmod` is worse than none, because Google stops trusting the field site-wide.

  Requires `fetch-depth: 0` in CI — the default shallow clone has no history to read, and it warns
  when that's the case.

  **Credentials.** IndexNow's key is public by design (it's served at `/<key>.txt` as the ownership
  proof), so it lives in your config, and the Astro integration writes the file into `public/` for
  you — `vitops indexing --new-key` generates one, `--write-key <dir>` writes it for non-Astro stacks.
  Search Console needs a service account in `VITOPS_GSC_SERVICE_ACCOUNT` or
  `GOOGLE_APPLICATION_CREDENTIALS`, added as an owner of the property; it's never read from the
  config file.

  Persist `.vitops/` between runs (a CI cache) — that's the changed-URL state, and without it every
  run submits everything.

  An environment whose `robots` policy says `noindex` is refused outright, so pointing this at
  staging can't publish it to a search engine.

- 9bf975a: Add `vitops media` — encode raw video into web-ready outputs, instead of hand-rolling an ffmpeg
  script per project.

  Keep unprocessed video in a `raw/` directory and run:

  ```
  vitops media --raw raw --out src/assets/processed
  ```

  Each source becomes three files: **VP9/WebM**, an **H.264/MP4** fallback, and a **JPG poster**.
  Import them like any other asset, so your bundler content-hashes them:

  ```astro
  ---
  import hero from '../assets/processed/hero.webm';
  import poster from '../assets/processed/hero.jpg';
  ---

  <video poster={poster.src} autoplay muted loop playsinline>
    <source src={hero} type="video/webm" />
  </video>
  ```

  In Astro it's an integration option — `vitops({ css, media: { raw: 'raw', out: 'src/assets/processed' } })`
  — and it runs in the same pass that generates your CSS. `@getvitops/vite` gains a matching `media`
  option, and `@getvitops/utils/media` exports `processMedia()` for anything else.

  Defaults: capped at 1920px wide, CRF 32, audio dropped (the common case is a muted autoplay loop),
  poster from frame 0. All of them are flags. `--dry` prints exactly what a run would do.

  **Runs are cached**, on source content plus encode settings, in `.vitops/media-manifest.json` — a
  24 MB clip that took 88 seconds the first time takes 0.14 seconds the second. A missing output
  re-encodes; a corrupt manifest re-encodes everything. Neither ever reads as "already done", because
  that failure is silent and no rebuild would fix it.

  **Commit the outputs and the manifest.** A fresh CI clone has neither and would re-encode from
  scratch; committing both means CI never needs ffmpeg. It also keeps your history clean — ffmpeg
  output isn't byte-reproducible across versions, so a CI re-encode would rewrite every video on any
  toolchain bump. Use `--force` when you mean to re-encode.

  **`ffmpeg` is an external tool, not an npm dependency** — install it yourself (`brew install
  ffmpeg`, `apt install ffmpeg`, `winget install Gyan.FFmpeg`). The command fails without it rather
  than skipping: a page referencing a video that was never encoded is broken, not degraded.

  Two defaults worth knowing about. The MP4 exists because older iOS and the in-app webviews inside
  social apps still don't decode VP9, and it's written with `+faststart` — without which a browser
  downloads the whole file before showing frame one. And a poster taken from frame 0 is often black
  on a clip that fades in; that's `--poster-time`, not a bug.

## 2.0.0

### Minor Changes

- 04a51d8: Icons: one semantic vocabulary across icon sets, with the bundle derived from your source.

  Name icons by meaning — `<Icon name="menu" />` resolves to `fa7-solid:bars`, `ph:list` or
  `lucide:menu` depending on the set you configure, so swapping sets is a config edit rather than a
  find-and-replace. A name containing `:` still passes through untouched, which is the escape hatch
  for a set-specific glyph.

  **New `icons` option on `getvitops()`.** Configures the sets once per site and, under
  `output: 'server'`, derives astro-icon's `include` map by scanning your source — the list most
  projects end up maintaining by hand. On a static build no `include` is passed at all, because
  astro-icon is already zero-config there and a list could only drop a glyph the scan couldn't see.
  Names you declare that don't resolve fail the build; names only the scan found just warn; names
  computed at runtime are reported with file and line so you can declare them.

  **New `<Icon />` component**, and a real fix with it: `Popover`, `Details` and `Drawer` imported
  `astro-icon/components` at module scope, so the _optional_ peer was resolved whether or not an icon
  ever rendered — hard-failing anyone who hadn't installed it. Engines now load dynamically. The
  per-component `iconResolver` prop still works but is deprecated in favour of the integration option.

  **New SVG sprite** (`icons.sprite: true` in your site config) for consumers that can't run an icon
  integration — Bricks/WordPress, EmDash renderers, plain HTML. `<use href="…/icons.svg#ph--list">`,
  no JavaScript and no icon-API request. Every semantic name also gets a set-independent `icon-<name>`
  alias, so sprite markup survives an icon-set change. WordPress gets `vitops_icon()`, a
  `[vitops_icon]` shortcode and a **Vitops → Icon** Bricks element.

  **New `vitops icons`** command: reports which icons your source uses, which names couldn't be
  resolved, and which are computed at runtime; `--sprite` builds the sprite, `--json` for CI.

  **Renamed, and completed to all four directions.** Chevrons and arrows are the
  one family whose _meaning is_ its direction, and that direction is physical, not
  logical — a chevron in a details marker points down in every writing mode. So they
  are named for where they point: `expand-more`/`expand-less` →
  `chevron-down`/`chevron-up`, and `arrow-forward`/`arrow-back` →
  `arrow-right`/`arrow-left`. `chevron-left`/`chevron-right` keep their names.
  `arrow-up`/`arrow-down` are new, so both families now cover all four directions.
  `lightning` is new.

  If you passed any of the old names to `<Icon />`, `resolveIcon` or an `icons`
  config, update them. They fail loudly rather than silently: an unresolvable
  declared name throws, and `vitops icons` reports scanned ones.

  **Fixed three Font Awesome mappings that named no real glyph** and so rendered an
  empty box: `login`/`logout` were mapped to `login`/`logout` (Font Awesome calls
  them `right-to-bracket`/`right-from-bracket`) and `backup` to `backup`
  (`cloud-arrow-up`). Every value in all four UI sets is now checked against the
  installed collection.

  **Phosphor (`ph`) joins the semantic map**, with all 83 names verified against the real icon set.
  Phosphor keeps every weight in one collection and varies the name (`list`, `list-bold`), unlike Font
  Awesome's per-weight collections, so `resolveIcon` and `generateIconInclude` gained a `weight`
  option for sets shaped that way.

  Fixes: `site.icons` was a closed object, so any icon collection not in its hand-written key list was
  silently dropped during validation — your config passed and the icons never bundled. It accepts any
  collection name now.

- bf453b0: Maskable favicons are now opaque, so they stop rendering as a logo in a black box.

  `icon-mask.png` is declared `purpose: "maskable"` and `apple-touch-icon.png` is linked on every
  page. Both sit a deliberately-inset logo on a larger canvas — that inset **is** the maskable safe
  zone and was always correct — but the canvas was filled with `alpha: 0`. From any transparent
  source that left 36% of `icon-mask.png` and 40% of `apple-touch-icon.png` transparent, on two files
  whose entire contract is full bleed: the OS crops them to its own shape and composites the rest onto
  whatever it likes, usually black. iOS discards alpha on the apple-touch-icon outright.

  `backgroundColor` was already the obvious input for this and already plumbed — as far as the web
  manifest, and no further. So the raster and the manifest disagreed about the very colour meant to
  sit behind the icon.

  Now:
  - those two outputs are composited onto `backgroundColor`, defaulting to `#ffffff` — the same
    default the manifest's `background_color` already used;
  - `favicon.svg`, `icon-{16,32,192,512}.png` and `favicon.ico` keep the source's transparency, since
    none of them is maskable;
  - a transparent source with no `backgroundColor` set now warns, rather than silently inheriting
    white — a dark logo would lose against it;
  - `icon-192`/`icon-512` declare `purpose: "any"` explicitly. Omitting it was legal (unset means
    "any"), but with a maskable present and nothing claiming "any", some launchers picked the maskable
    — the one with the safe-zone inset — for slots that wanted a plain icon.

  `vitops favicon` gained `--background <hex>`; it previously had no way to set this at all.
  `getvitops({ favicon })` and the Vite plugin now forward the option they were already accepting.

- bf453b0: A chroma-0 seed now produces an actual neutral instead of a pink one.

  Beyond a ramp's outermost authored colour, chroma decays towards a small endpoint value (0.008
  light / 0.015 dark) so the near-white and near-black ends keep a whisper of the hue. That was
  written as a lerp _target_, and the interpolation factor reaches exactly 1 at steps 50 and 950 for
  every anchor position — so the endpoints were those constants **unconditionally**. Seeds at chroma
  0.001, 0.002, 0.05 and 0.2 all produced a byte-identical `#f5f9fe` at step 50.

  There was therefore no seed that yielded a plain neutral, and chroma 0 was the worst case: a true
  achromatic colour has no hue (colorjs returns NaN), which collapses to 0 — red — so asking for grey
  gave you `#fdf6f8`, a pink. A brand wanting plain white with grey panels had to discover `anchors`
  to get there.

  The endpoint is now a **ceiling** rather than a target, so a seed below it keeps its own chroma:

  | seed chroma | step 50 before | step 50 after |
  | ----------- | -------------- | ------------- |
  | 0           | `#fdf6f8` 🩷   | `#f8f8f8`     |
  | 0.001       | `#f5f9fe`      | `#f8f8f9`     |
  | 0.003       | `#f5f9fe`      | `#f7f8fa`     |
  | 0.05        | `#f5f9fe`      | `#f5f9fe`     |

  `seed: "#808080"` now gives a real grey ramp — `#f8f8f8` / `#eee` / `#808080` / `#2b2b2b` / `#181818`.

  **No existing palette moves.** The ceiling only binds below itself, and every ordinary brand hue
  sits above it; the repo's own `tokens.json` is byte-identical across this change.

## 1.0.0

### Major Changes

- bb92a14: **The colour system is rebuilt on a target-prefixed grammar and a shared lightness ladder.**
  This is a breaking change to every colour token and utility class.

  ## Why

  Two axes shared one class namespace — functional _planes_ (`--<role>-bg-muted`) and
  appearance-relative _stops_ (`--color-<role>-muted`) — arbitrated by a "plane wins" rule. The
  result was not a scale. On the shipped palette, light mode:

  | class                              | resolved to  | step                                          |
  | ---------------------------------- | ------------ | --------------------------------------------- |
  | `bg-ui-accent-x-muted`             | stop         | 100                                           |
  | `bg-ui-accent-muted`               | plane        | 100 — identical, so `x-muted` was a dead rung |
  | `bg-ui-accent`                     | plane        | 50 — _lighter_ than both its "muted" rungs    |
  | `border-ui-accent-muted` / `-bold` | stop / plane | 300 / 300 — identical                         |
  | `text-ui-accent-bold`              | stop         | 700 — _lighter_ than `text-…-muted` (800)     |

  Every family was non-monotonic, two had duplicate rungs, and `--color-<role>-muted` was
  unreachable through any `bg-` class.

  ## The new grammar

  ```
  --color-<target>-<role>[-<variant>]        target ∈ bg | text | icon | border
  ```

  The target is **inside** the name, so `bg-danger-muted` and `text-danger-muted` are different
  tokens and there is nothing left to arbitrate. **The class name is the token name minus
  `--color-`** — one vocabulary instead of two.

  Variants are ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and the
  tables are sparse: only cells that hold their contrast target exist.

  ## Role kinds

  `colors.roles` values may now be `{ hue, kind }` as well as a bare hue string:

  ```jsonc
  "roles": {
    "danger":  "rust",                             // shorthand => chromatic
    "surface": { "hue": "navy", "kind": "surface" }
  }
  ```

  - **`surface`** — a page/panel colour: `bg-<role>` is the card, `bg-<role>-muted` the page
    behind it, `bg-<role>-x-muted` a well, `bg-<role>-bold` the inverse surface. Full text scale.
  - **`chromatic`** (default) — a signal colour: tints (`bg-<role>-x-muted`/`-muted`) and solids
    (`bg-<role>-solid[-bold|-x-bold]`), with **no bare `bg-<role>`** — say how loud you mean.
    `text-on-<role>` is the guaranteed foreground for the solid family.

  ## Palette generation

  Every ramp now sits on one **fixed lightness ladder** (50 → L 0.98 … 950 → L 0.21); only chroma
  and hue vary. That is what makes a step mean the same lightness in every hue. Previously each
  seed transposed the curve, so relative luminance at step 300 ranged from 0.253 to 0.384 across
  the shipped palette — the same variant read differently depending on the role.

  Authored colours are still reproduced **exactly**. A `seed`, an `anchors` entry or a `tones`
  value is pinned verbatim at its nearest step; every other step takes the ladder. Snapping brand
  colours to the ladder was measured and rejected: 11 of 18 real brand hexes moved beyond a
  just-noticeable difference (worst ΔE-OK 0.050 — Facebook's `#1877F2` → `#0067e1`) and six left
  sRGB gamut. Deviation is now bounded and local to pinned steps, and warns past ~0.03 L.

  Two tones that claim the same step now **error** instead of one silently overwriting the other;
  the record form (`tones: { "600": "…", "700": "…" }`) is how you resolve it.

  ## New
  - **`icon-<role>`** — a non-text tier, so a glyph may run more vivid than text. `icon` is now a
    default utility family alongside `bg`/`text`/`border`.
  - **`--color-border-focus`** — the focus-ring tone, taken from `ui-primary`'s solid.
  - **Contrast is enforced at build time**, not only in tests: text ≥ APCA Lc 75 on its primary
    background, ≥ 60 on secondary planes, icons and surface boundaries ≥ 45, both appearances.
    A violation now fails `generate`. Chromatic text is checked against the _surface_ planes it
    actually sits on, not only its own tints. `text-<role>-x-muted` (placeholder) and `-xx-muted`
    (disabled) are explicitly exempt; nothing else is.

  ## Migrating

  Rename `--<role>-<suffix>` → `--color-<target>-<role>[-<variant>]`, and the same for classes:

  | before                                  | after                                                            |
  | --------------------------------------- | ---------------------------------------------------------------- |
  | `--<role>-bg` / `bg-<role>` (chromatic) | `--color-bg-<role>-x-muted` / `bg-<role>-x-muted`                |
  | `--<role>-bg-muted`                     | `--color-bg-<role>-muted`                                        |
  | `--<role>-solid` / `-solid-bold`        | `--color-bg-<role>-solid` / `-solid-bold`                        |
  | `--<role>-on-solid` / `text-on-<role>`  | `--color-text-on-<role>` (class unchanged)                       |
  | `--<role>-text` / `-text-muted`         | `--color-text-<role>` / `-muted`                                 |
  | `--<role>-border` / `-border-bold`      | `--color-border-<role>` / `-bold`                                |
  | `--color-<role>-muted` (stop)           | judge by use: `--color-bg-<role>-muted` or `--color-text-<role>` |

  **`surface` background names rotate**, value-preserving: what was `--surface-bg` (the page) is
  now `--color-bg-surface-muted`; what was `--surface-bg-bold` (raised) is now
  `--color-bg-surface`. Elevation is expressed by which token you reach for — page `bg-muted`,
  card `bg` — rather than a raised/sunken pair, which is what lets a future surfaces axis flatten
  it without touching markup.

  `vitops lint` reports role classes that no longer resolve, and now derives its suggestions from
  what the generator actually emits rather than a hand-maintained list.

## 0.9.0

## 0.8.0

## 0.7.0

## 0.6.0

## 0.5.0

## 0.4.0

### Minor Changes

- d7e6491: Extract schema.org JSON-LD graph builders (articleGraph/organizationGraph/breadcrumbGraph/faqGraph) into @getvitops/utils so platform hooks (e.g. the new @getvitops/emdash plugin's future page:metadata contributions) can share them; the corresponding schemas/\*.astro become thin wrappers. Also removes Layout.astro's import of the deleted Polyfills.astro.

## 0.3.0

### Minor Changes

- Extract the framework-agnostic content model + HTML helpers into `@getvitops/utils`
  (new `content`/`html` exports: `Elmnt`/`Link`/`ContentNode` types + guards, `t`,
  `partAttrs`, `parseRenderedSlots`, `toHtml`, `nodesToHtml`, `styleList`, …), and ship
  the generic Astro component tier from `@getvitops/astro/components/*`: `Subgrid`,
  `Cards`, `NodeRenderer`, `WebComponentLoader`, plus `Popover`/`Details`/`Drawer`
  (the latter three use `astro-icon`, now declared as an optional peer). Config-bound
  chrome (Template/SEO/ContentInfo/FormRenderer/Nav/Submenu) stays internal pending the
  EmDash integration.

## 0.2.1

## 0.2.0
