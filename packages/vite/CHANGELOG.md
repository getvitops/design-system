# @getvitops/vite

## 9.0.0-alpha.8

### Patch Changes

- Updated dependencies [c66bda9]
- Updated dependencies [0414685]
- Updated dependencies [c38ce48]
  - @getvitops/utils@9.0.0-alpha.8
  - @getvitops/generator@9.0.0-alpha.8

## 9.0.0-alpha.7

### Patch Changes

- Updated dependencies [7d5efa0]
- Updated dependencies [d34ac50]
- Updated dependencies [16a63d0]
  - @getvitops/generator@9.0.0-alpha.7
  - @getvitops/utils@9.0.0-alpha.7

## 9.0.0-alpha.6

### Minor Changes

- 798a04a: Config forms: rows you can add and remove, and a colour picker on brand colours.

  - **`<wc-multifield>`** replaces `<wc-multi-field>` (**breaking: rename `wc-multi-field` to `wc-multifield`**; the Bricks element key `vitops-multi-field`, the `--multi-field-gap` property and the `multi-field-*` events are unchanged). It is now light DOM and Lit-free, so the framework's form CSS applies and the controls are native: the authored inputs are the no-JS fallback and submit with the form. Kept from the old element: `min`, `max`, `protect-defaults`, Clear, `add-label` / `clear-label` / `delete-label`, `type`, `placeholder`, `name` (`name[]`). New: it repeats a whole fieldset too, with each row an open `<details>` titled by its key, a polite announcement of changes, and a row unfolds when a blocked submit is about it. The slots `add-label` / `clear-label` / `delete-label` and the `::part`s are gone (shadow DOM); use the attributes and the `.multifield__*` classes. `renderProjectionHtml` wraps every keyed map in it, so rows are now `<details class="field__row">` with the fields in `.field__row-body` where they were `<fieldset class="field__row">`. Forms CSS: **all formats**.
  - **`<wc-color-field>`** (`@getvitops/core/color-field`, new): a colour text input with the theme editor's OKLCH picker offered beside it. The text input is still the fallback and the only submitted control; the picker (~40 KB gzipped) is fetched only when it is first opened. `<ConfigForm colorPicker>` loads it. Forms CSS: **all formats**.
  - `verify-bundle-size` now counts the chunks an entry imports statically (Lit is shared between `elements.js` and the picker), so `elements.js` is measured as the page downloads it; its ceiling moves from 33,000 to 33,600 B for that reason.

  No consumer-facing change in `@getvitops/cli` and `@getvitops/vite`.

### Patch Changes

- 8b823d5: **Added `site.accessibility`: the accessibility target a site is held to.** `{ standard: 'wcag20' | 'wcag21' | 'wcag22', level: 'none' | 'A' | 'AA' | 'AAA', acceptedRisk?: string }`. It records a decision, not a conformance claim; `acceptedRisk` is free text (who accepted a lower target, when, why) printed in the audit header.

  - **WCAG 2 contrast ratio is now checked beside APCA** (`contrastRatio()` in `@getvitops/utils/color`; 4.5:1 for text, 3:1 for icons and boundaries). APCA is not the legal test: AODA is WCAG 2.0 AA, which is a ratio, and a palette can pass APCA and miss 4.5:1. At `level: 'AA'` or `'AAA'` a ratio miss **fails the build**; at `A`, `none`, or with no `site.accessibility` it is a build warning. APCA failures still fail the build in every case, and `acknowledgeContrast` still applies to APCA only. **Migration:** a site that sets `AA` and has a palette under 4.5:1 will now fail `generate`; fix the palette, or record a lower `level` with `acceptedRisk`.
  - **`vitops audit` reads `site.accessibility`** (`--input`, default `site.json`, optional): axe tags follow the standard and level, and `level: 'none'` reports violations without failing the run (performance budgets still apply). It now also writes `report.html`. **The report is an artifact, never site content**: it lists every violation, so keep it under `.vitops/audit/` and out of the build output.
  - **New scaffolds and `vitops init --site` default to `wcag21` / `AA`.** Existing sites are unchanged until they add the field.

  Affects all formats equally (no CSS change). No consumer-facing change in `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`.

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

- Updated dependencies [19f9a53]
- Updated dependencies [8b823d5]
- Updated dependencies [a95a4fc]
- Updated dependencies [dbc4dda]
- Updated dependencies [333880e]
- Updated dependencies [237a9fd]
- Updated dependencies [0a3a01f]
- Updated dependencies [d380b78]
- Updated dependencies [6763587]
- Updated dependencies [8d00032]
- Updated dependencies [a5754c1]
- Updated dependencies [1e5edfc]
- Updated dependencies [37ea039]
- Updated dependencies [e12086a]
- Updated dependencies [0b7e7f1]
- Updated dependencies [0e525b8]
- Updated dependencies [a9d00c9]
- Updated dependencies [50ea0f6]
- Updated dependencies [82774d1]
- Updated dependencies [0f5c3cc]
- Updated dependencies [fdbec9c]
- Updated dependencies [798a04a]
- Updated dependencies [53683a2]
- Updated dependencies [1f1a3dd]
  - @getvitops/generator@9.0.0-alpha.6
  - @getvitops/utils@9.0.0-alpha.6

## 8.3.0-alpha.5

### Patch Changes

- Updated dependencies [785b8b3]
- Updated dependencies [bb61a35]
- Updated dependencies [4d94c8b]
  - @getvitops/utils@8.3.0-alpha.5
  - @getvitops/generator@8.3.0-alpha.5

## 8.3.0-alpha.4

### Patch Changes

- Updated dependencies [99e66a2]
- Updated dependencies [00a9d86]
- Updated dependencies [d64fb20]
- Updated dependencies [322dd6a]
- Updated dependencies [322dd6a]
  - @getvitops/generator@8.3.0-alpha.4
  - @getvitops/utils@8.3.0-alpha.4

## 8.3.0-alpha.3

### Patch Changes

- @getvitops/generator@8.3.0-alpha.3
- @getvitops/utils@8.3.0-alpha.3

## 8.3.0-alpha.2

### Patch Changes

- Updated dependencies [0a47856]
- Updated dependencies [0a47856]
  - @getvitops/generator@8.3.0-alpha.2
  - @getvitops/utils@8.3.0-alpha.2

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

- Updated dependencies [24c568b]
  - @getvitops/generator@8.3.0-alpha.1
  - @getvitops/utils@8.3.0-alpha.1

## 8.3.0-alpha.0

### Minor Changes

- 06d6112: Fix the EmDash `/design-system` admin page erroring on a tailwind site. It fetches `/vitops/design-manifest.json`, which the `tailwind` format never emitted and the integration only mirrored under `editor: true` (which also loads `editor.js` on every public page).

  - **generator** (`tailwind` format only): `design-manifest.json` is now emitted alongside `tailwind.css`. No change to the CSS.
  - **astro**: new `vitops({ editorManifest: true })` writes everything an outside host needs into `public/vitops/` (`design-manifest.json`, `editor.js`, a standalone `editor.css`, and `design-system-editor.html`) without loading the editor on public pages. `editor: true` still loads it from `<Head />`.
  - **vite**: `editorManifestDir` also writes `vitops/editor.css`, from a throwaway `css`-format pass on tailwind sites.
  - **emdash**: the `/design-system` admin page was unstyled and overflowed the admin, because the editor borrows the framework CSS and the admin never loads it. It now embeds `/vitops/design-system-editor.html` in an iframe, so the design system can't leak into the admin's styles. **Requires `editorManifest: true`** in `vitops({ … })`.
  - **create**: the EmDash template sets `editorManifest: true`. Existing sites: add it to `vitops({ … })` in `astro.config.mjs`.

  No consumer-facing change in the other toolchain packages.

### Patch Changes

- Updated dependencies [93d2067]
- Updated dependencies [161c7f3]
- Updated dependencies [175d16e]
- Updated dependencies [83d6f3c]
- Updated dependencies [892b204]
- Updated dependencies [06d6112]
- Updated dependencies [6297337]
- Updated dependencies [55061e2]
- Updated dependencies [b47df4d]
  - @getvitops/generator@8.3.0-alpha.0
  - @getvitops/utils@8.3.0-alpha.0

## 8.2.0

### Patch Changes

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

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [89265af]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [1a8231d]
- Updated dependencies [779d22e]
- Updated dependencies [0574388]
- Updated dependencies [8d8aad7]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
- Updated dependencies [7f4f50e]
- Updated dependencies [7fd5f8f]
- Updated dependencies [ceb8310]
  - @getvitops/generator@8.2.0
  - @getvitops/utils@8.2.0

## 8.2.0-alpha.0

### Patch Changes

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

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
  - @getvitops/generator@8.2.0-alpha.0
  - @getvitops/utils@8.2.0-alpha.0

## 8.1.0

### Patch Changes

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

- Updated dependencies
  - @getvitops/generator@8.1.0
  - @getvitops/utils@8.1.0

## 8.0.1

### Patch Changes

- @getvitops/generator@8.0.1
- @getvitops/utils@8.0.1

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

### Minor Changes

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

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [a84839b]
  - @getvitops/generator@8.0.0
  - @getvitops/utils@8.0.0

## 7.0.0

### Patch Changes

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

- Updated dependencies [c0c092b]
- Updated dependencies
- Updated dependencies [aad43b7]
- Updated dependencies [2b50f9e]
- Updated dependencies [a6a8b39]
- Updated dependencies [7b391b3]
- Updated dependencies [eb9ac79]
  - @getvitops/utils@7.0.0
  - @getvitops/generator@7.0.0

## 6.0.0

**No consumer-facing change in this package.** The major is the toolchain's shared version, bumped
in lockstep for the carousel rework in `@getvitops/core` / `generator` / `astro`. The plugin's
options, watch behaviour and dev-server endpoints are unchanged.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@6.0.0
  - @getvitops/utils@6.0.0

## 5.0.0

> **No consumer-facing change in this package.** `@getvitops/vite` has no source changes in 5.0.0 —
> it is majored because `core` / `generator` / `utils` / `cli` / `astro` / `vite` share one version
> and are only supported in matching sets. The notes below are the toolchain's, reproduced in every
> member's changelog; the behaviour they describe lives in `@getvitops/generator`. Upgrading this
> package needs no code edit of yours, but the generator changes it runs **do** apply — a config
> with a dangling `var(--…)` will now fail your build through this plugin.

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

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@5.0.0
  - @getvitops/utils@5.0.0

## 4.1.0

### Patch Changes

- Updated dependencies [2c890c0]
- Updated dependencies [e764090]
  - @getvitops/generator@4.1.0
  - @getvitops/utils@4.1.0

## 4.0.0

### Patch Changes

- Updated dependencies [14813fa]
- Updated dependencies [c6b99e7]
- Updated dependencies [c6b99e7]
- Updated dependencies [f7bc0a0]
- Updated dependencies [ceed51f]
- Updated dependencies [14813fa]
- Updated dependencies [14813fa]
  - @getvitops/generator@4.0.0
  - @getvitops/utils@4.0.0

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

### Patch Changes

- Updated dependencies [6e68ace]
- Updated dependencies [b115993]
  - @getvitops/generator@3.0.0
  - @getvitops/utils@3.0.0

## 2.1.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/generator@2.1.0
  - @getvitops/utils@2.1.0

## 2.0.0

### Minor Changes

- bf453b0: Anywhere the toolchain takes a config, that file may now be a `design-system.json` **or** the larger
  site config that embeds one.

  If you keep your tokens inside a `company.json` / `site.json`, you had to maintain a second file for
  the tooling's sake — or duplicate your whole token set, because a site config must carry a complete
  `designSystem`. Now you point the same option at the file you already have:

  ```js
  // astro.config.mjs
  getvitops({ css: { input: 'company.json', format: 'css' } });
  ```

  ```
  vitops generate --input company.json --format css --out dist
  vitops lint --input company.json --src src
  ```

  The design system is taken from `designSystem.themes[theme]` with its `extends` chain resolved —
  `defaultTheme`, else `default`, else whatever `--theme` / the `theme` option names. Nothing changes
  for a plain `design-system.json`; the two are told apart by shape, not by filename, so you can call
  the file anything.

  **A site config also supplies the site-level facts generation reads**, so the path is declared once
  rather than per option:
  - `designSystem.defaultColorScheme: "system"` — emits the `prefers-color-scheme` block, which is
    what makes `<color-scheme-toggle>`'s System position do anything.
  - `legal.*.enabled` — renders the documents. `legal: {}` is now the whole declaration; `legal.input`
    is optional.
  - `icons.sprite` — builds `icons.svg`.
  - `fonts` — `fonts: true` reads the families from it.

  Each of those is already gated on a field in that config, so nothing new appears unless the config
  asks for it. An explicit `site` option still wins when the two are genuinely different files.

  Also:
  - **`vitops validate` routes on the file's shape.** Pointed at a site config it used to report a
    single `unrecognized_keys` for `designSystem` and nothing about the file's actual contents — a
    wrong answer that reads like a right one. It now validates a site config as one, including the
    cross-field integrity JSON Schema can't express, and checks every theme resolves to a complete
    design system (`validateSite` only checked that the `extends` chain resolved, not what it resolved
    to).
  - **`generate()` gained `theme` and `siteEnv`.** The A/B variant for `siteEnv` is applied before the
    theme is selected, so a variant can override tokens.
  - **The theme editor's Save to source follows the design system into a site config.** Its patch is
    design-system-relative, so the dev server merges into that subtree and writes only the surrounding
    file whole. It locates the subtree in the raw on-disk object rather than the normalised one, so an
    author who wrote either `designSystem` shorthand still gets their own keys edited.

- bf453b0: **Breaking (site config):** `designSystem` is now an object, and the toggle's "System" position works.

  `<color-scheme-toggle>` has always shipped three segments, and "System" did nothing. It removes the
  theme attribute, and with no `prefers-color-scheme` block in the generated CSS the page fell straight
  through to light on every machine — so a third of the control was inert, and a no-JS page could never
  follow the OS at all.

  The fix is a second, opt-in copy of the dark delta under
  `@media (prefers-color-scheme: dark)`, scoped to "no explicit choice has been made". An explicit
  light choice still wins over a dark OS. It costs **+303 B gzipped** on the colour layer — the block
  repeats only the tokens whose dark value differs, and two identical runs of text compress to almost
  nothing. It is opt-in because switching it on visibly flips an existing site dark for dark-OS
  visitors.

  Turning it on is a site-level fact, which needed somewhere to live:

  ```jsonc
  "designSystem": {
    "themes": { "default": { … }, "elegant": { "extends": "default", … } },
    "defaultTheme": "default",
    "defaultColorScheme": "system"   // 'light' | 'dark' | 'system'
  }
  ```

  **What changed.** `designSystem` was a bare map of themeName → design system, so _every_ key was a
  theme name and there was nowhere to put a system-wide field without it colliding with a theme of that
  name. The map moves under `themes`, and `defaultTheme` + `defaultColorScheme` move inside the block.
  `respectSystemPreference` is gone — `defaultColorScheme: "system"` says the same thing, and the two
  were always read together, so the incoherent combination is no longer expressible.

  **Migration is automatic at runtime.** `resolveSiteConfig` accepts all three spellings — the
  canonical shape, a bare theme map (the old schema), and a bare design system written inline. But
  `site.schema.json` is published to a stable URL, so an editor pinned to `$schema` will flag the old
  shape; update it when convenient.

  One behavioural change worth knowing: shorthand normalisation now runs **before** the A/B variant
  merge, not after. Previously an `abTesting` override's key path depended on which shorthand the base
  config happened to use, so the same patch landed in different places in two otherwise-equivalent
  configs. Overrides now always address `designSystem.themes.<name>`.

  Also: `getvitops({ site: { input } })` gives the Astro integration one place to name the site config
  — `legal`, `fonts` and the colour scheme all read from it — and `css.systemColorScheme` sets the
  appearance directly for consumers who have no site config.

  Light/dark remains **derived**, not a theme: `functionalRole()` builds both appearances from one ramp,
  which is what lets the contrast contract check both at build time and what gives every consumer a
  working dark mode without authoring one. `themes` is for authored variants.

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

### Patch Changes

- Updated dependencies [4756788]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [04a51d8]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
  - @getvitops/generator@2.0.0
  - @getvitops/utils@2.0.0

## 1.0.0

### Minor Changes

- bb92a14: Generate legal documents from your site config

  `vitops legal` renders a privacy policy, terms of service and cookie notice from a site
  config, in markdown, HTML or EmDash Portable Text:

  ```sh
  vitops legal --out ./content                 # every enabled document, as markdown
  vitops legal --doc privacy --format html     # one document, as an HTML fragment
  ```

  The documents are **derived from your config**, not filled into a form. The analytics
  provider they name is the one whose ID you set; the personal information they list is what
  your configured forms actually collect; the countries they name come from the providers you
  use. So a provider swap updates the policy on the next build, and the fix for a wrong policy
  is a corrected config — hand-editing the output is overwritten.

  Enable documents under `legal`, which gains the facts the prose asserts:

  ```jsonc
  {
    "legal": {
      "jurisdiction": "ca", // only 'ca' (PIPEDA) ships today
      "privacyPolicy": {
        "enabled": true,
        "lastUpdated": "2026-08-01",
        "retention": "24 months after our last contact with you",
        // Third parties the config cannot imply. Analytics, Turnstile and your
        // deploy platform are detected automatically — list only the rest.
        "processors": [
          {
            "name": "Stripe",
            "purpose": "payment processing",
            "country": "the United States",
          },
        ],
      },
      "termsOfService": { "enabled": true },
      "cookieConsent": {
        "enabled": true,
        "type": "opt-in",
        "categories": ["Essential", "Analytics"],
      },
    },
  }
  ```

  Delivery, by stack:
  - **Any stack** — `vitops legal`. No integration code; prints to stdout without `--out`.
  - **WordPress/Bricks** — `vitops generate --site <path>` also writes `dist/legal/*.html`, and
    the theme loader now registers `[vitops_legal doc="privacy"]` to render one in a page. The
    document updates on the next deploy with no action in WordPress.
  - **Astro** — `getvitops({ legal: { input: 'site.json', out: 'src/content/legal' } })` writes
    markdown into a content collection and re-renders when the site config changes. It needs a
    `css` config (that is what registers the Vite plugin); without one, use the CLI.
  - **EmDash** — `--format portable-text`, pasted into the admin.

  Also new on the public API: `generateLegal()`, `renderMarkdown()`, `renderNodes()`,
  `derivePolicyVars()`, `parseMarkdown()` / `toHtmlFragment()` / `toPortableText()`, and
  `resolvePrivacyContact()`.

  Two things to know before you publish anything this produces:
  - **It is not legal advice.** Every document opens with a review banner saying so. The
    bundled terms-of-service prose in particular is generic website boilerplate and
    deliberately does not cover sales, refunds, subscriptions, accounts or user-generated
    content — a site doing any of those needs clauses drafted for it.
  - **It is only as true as your config.** A policy asserting things your site does not do is
    worse than no policy. Check that the config describes reality before you ship the output.

  `validateSite` now rejects a config that enables a privacy policy without a contact for
  privacy requests or a `domains.canonical`, since both are interpolated into sentences that
  would otherwise render blank.

### Patch Changes

- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [eeb059f]
  - @getvitops/generator@1.0.0
  - @getvitops/utils@1.0.0

## 0.9.0

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies [c949cae]
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@0.9.0
  - @getvitops/utils@0.9.0

## 0.8.0

### Minor Changes

- **New: `<wc-theme-editor>`, a live theme editor you can ship with your site.**

  Tune the whole design system in the browser — palette, semantic roles, type roles, spacing, layout,
  pattern geometry, radii, shadows — with no rebuild. Edits are layered as `:root` custom-property
  overrides, persist to localStorage, and export as CSS or as a `design-system.json` patch. It follows
  your site's colour scheme and drives the same `data-theme` + storage key as `<color-scheme-toggle>`,
  so the two no longer fight.

  It ships as a **separate, opt-in bundle** (`@getvitops/core/editor`, ~13 kB, no Lit) and is never
  registered in `elements.js`: a page that doesn't ask for it pays nothing.

  ```js
  // astro.config.mjs
  getvitops({
    css: { input: 'design-system.json', format: 'css', out: 'src/styles' },
    editor: true,
  });
  ```

  ```html
  <!-- anywhere in your layout -->
  <wc-theme-editor></wc-theme-editor>
  ```

  `editor: true` copies `editor.js` into `public/vitops/`, loads it from `<Head />`, and mirrors
  `design-manifest.json` to `/vitops/design-manifest.json` (override with the `manifest` attribute).
  Outside Astro, load the bundle yourself and point `manifest` at the file.

  **Save straight back to your config, in dev.** `@getvitops/vite` now serves a dev-only
  `/__vitops/design-system` endpoint: the editor POSTs its patch, the plugin deep-merges it into your
  `design-system.json`, validates the _merged_ result, writes it back preserving the file's formatting,
  then regenerates and reloads. The endpoint exists only under `vite dev` — on a static deploy the
  editor detects its absence and hides the button, while everything else still works.

  **Added:** `colors.roleTokens` in `design-manifest.json` — the functional token set (bg / border /
  solid / on-solid / text / emphasis stops) precomputed per hue, in `default` and `surface` variants for
  both appearances. Re-pointing a role at another hue needs these: `solid` is chosen by scanning the hue
  and `on-solid` is a computed contrast value, so neither is derivable by a browser client.

  **Removed:** the dead `interaction` block from `design-manifest.json` — a hardcoded
  `{duration, easing}` literal with no schema key, no reverse-index entry, and no corresponding CSS
  variable. Nothing could have consumed it meaningfully. The real animation knobs are
  `--animation-duration-*` / `--custom-ease-*`.

  **Fixed:** a `[popover]` reset in `popover.css` was stripping the background, padding and border from
  any pattern used as a popover. It is imported after `drawer.css`, so at equal specificity it beat
  `.drawer` — and `dialog` (0-0-1) too — leaving a `.drawer[popover]` transparent and unpadded despite
  drawer.css documenting popover as supported. The reset now sits in `:where()` at zero specificity, so
  it still overrides the UA stylesheet but any pattern class takes its surface back. Open/closed
  behaviour is unchanged.

  **Added:** `input[type="range"]` and `input[type="color"]` now have baseline styling in `forms.css`
  (accent colour from `--ui-primary-solid`; the colour swatch picks up the control border and radius).

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.8.0
  - @getvitops/utils@0.8.0

## 0.7.0

### Patch Changes

- @getvitops/generator@0.7.0
- @getvitops/utils@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
  - @getvitops/utils@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.5.0
  - @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0
  - @getvitops/generator@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/generator@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/utils@0.2.1

## 0.2.0

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.2.0
  - @getvitops/utils@0.2.0
