# @getvitops/core

## 4.1.0

### Patch Changes

- Updated dependencies [2c890c0]
  - @getvitops/utils@4.1.0

## 4.0.0

### Major Changes

- c6b99e7: Consent is now demand-driven: the banner appears when something actually needs permission, not on every first visit.

  Previously, enabling the gate showed a banner to every new visitor regardless of what the site did — including sites whose only analytics provider was cookieless, where there was nothing to consent to. The build decided whether the machinery shipped and the runtime showed the banner because no cookie existed yet.

  Now those are two separate facts. The build decides what the banner _can_ ask (rows in the markup); the runtime decides what it _does_ ask. A gated tag registers its demand when it reaches its loading strategy, and `<color-scheme-toggle>` registers `preferences` when a visitor picks a scheme. A site that gates nothing never interrupts anyone.

  **Breaking — consent cookie schema (v1 → v2).** Consent is now recorded per category as granted / declined / **not yet asked**. The third state is what lets a later demand ask about a category an earlier prompt didn't cover: accepting an analytics banner no longer silently declines preferences. Every stored v1 choice is invalid and re-prompts once — a v1 cookie asserted a definite answer for categories the visitor was never shown.

  **Breaking — `ConsentApi`.**
  - `needed()` now means "something demanded a category the visitor hasn't answered", not "no cookie yet". A custom banner calling it will now stay hidden until something asks.
  - `ConsentState.decided` (a single boolean) is gone. Use `decidedFor(state, category)`, or `undecidedCategories(state)`.
  - New: `require(category)` registers a demand and reports whether it is granted; `request(category)` resolves once the visitor answers it; `demanded()` lists what has asked so far.
  - `acceptAll()` / `rejectAll()` still mean every optional category. The banner no longer routes its buttons through them — "Accept" applies to the categories on screen.

  **Breaking — `<color-scheme-toggle>` persistence.** The chosen scheme still applies immediately, but writing it to `localStorage` now waits on the `preferences` category **when the site has a consent gate**. Sites without `consent` enabled are unaffected and keep storing as before. If your site enables consent and offers a theme toggle, make sure `preferences` is among the offered categories (it is by default).

  **Changed — offered categories.** `consent.categories` defaults to `['analytics', 'preferences']` (plus `marketing` when a configured tag needs it) rather than only what analytics detection could see. An unused row is hidden markup, so offering broadly costs nothing and covers `data-consent` markup no build-time scan can find. Pass `categories` explicitly to narrow it.

  **Added — `<Head />` emits a small inline consent stub** when the gate is on. `consent.js` and `elements.js` are both deferred with no ordering between them, so without it a theme toggle could be clicked before the gate existed, read "no gate", and store. The stub answers `false` and queues, and the runtime replays the queue on load.

  **Fixed — the generated cookie notice** now discloses the stored display preference when `preferences` is offered, and no longer promises a banner "shown when you first visit", which is no longer how the banner works.

- Every custom element now carries the `wc-` prefix. **Two renames affect existing markup:**
  - `<color-scheme-toggle>` → **`<wc-color-scheme-toggle>`**
  - `<wc-multifield>` → **`<wc-multi-field>`**

  Update your templates. An unknown element name is not an error — the browser treats it as an
  inert `HTMLUnknownElement` — so a missed rename shows up as a control that renders and simply
  never works, with nothing in the console.

  `<wc-multifield>` was itself renamed in 3.0 (from `<multi-field>`), and hyphenating it now
  means the tag matches its pattern name and its Bricks element everywhere else in the toolchain;
  `3.0` shipped the inconsistency by accident.

  **Unchanged:** the Bricks element keys (`vitops-color-scheme-toggle`, `vitops-multi-field`), so
  elements already placed on a Bricks page keep working; the custom properties; and the events.

  The remaining renames are prefix-only and reach no consumer: `<color-wheel>`, `<icon-picker>`,
  `<oklch-color-picker>` and `<typography-config>` are registered but shipped in **no bundle** (the
  editor-v2 track), so those tags were already inert in a consumer project — `vitops docs components`
  now says so per element rather than leaving it to be discovered.

### Minor Changes

- 14813fa: Add `<wc-tree>`, and a schema walker that feeds it.

  `<wc-tree>` is progressive enhancement for the existing `.tree` pattern: given a nested
  `<details>` disclosure tree it adds a filter, expand-all / collapse-all, and hash deep-linking.
  It ships in `elements.js`.

  `@getvitops/astro` gains `./components/Tree.astro` and `./components/tree.ts` (its `TreeItem`
  type) to build that markup from data. As with every wrapper over a web component, `<Tree />`
  emits the `<wc-tree>` tag itself with the accessible fallback inside — so `<Tree items={…} />`
  is the whole call, and wrapping it in your own `<wc-tree>` nests two elements on one tree.

  The slotted markup is the whole content and works without it — every node readable, expandable
  and linkable — so the element only adds what CSS cannot do. Four things worth knowing:
  - **The toolbar is generated, never authored.** A search field that does nothing is worse than
    no search field, so the controls exist only once the element upgrades.
  - **Deep-linking is the non-obvious one.** A node inside a closed `<details>` has no layout box,
    so the browser's own fragment navigation finds nothing and silently stays at the top of the
    page. `<wc-tree>` opens the target's ancestors — and the target's own disclosure — then scrolls.
  - **Filtering matches a node's own label and description, never its subtree's text.** The obvious
    `textContent` implementation makes every ancestor of a hit match, so the root matches any query
    and the filter narrows nothing. That decision lives in a pure, tested module (`matchTree`)
    rather than in the DOM wiring.
  - **It initialises even when upgraded mid-insertion.** An element connected during an
    `innerHTML` write — a view-transition swap, a client-side navigation — has no children yet
    (measured: zero). Setup retries once the insertion completes, because the failure mode was
    silent: no toolbar, no filter, no deep link, no error.

  `patterns/tree.css` now supports two markup shapes: the item may be the `<details>` (the
  pattern's original contract) or an `<li class="tree__item">` wrapping one, which is what gives
  assistive tech list position and depth.

  **`.tree` indent is fixed and now fluid**, which matters for any deep tree. Three separate leaks
  compounded, each invisible in the CSS and each charging roughly one extra indent per level:
  - the rule set both `margin-inline-start` and `padding-inline-start` to `--tree-indent`;
  - `.tree { padding: var(--_p) }` applied to every nested `.tree`, not just the outermost — on all
    four sides, so it narrowed from the end as well;
  - `patterns/details.css` gives every non-summary child of a `<details>`
    `margin-inline: var(--_content-margin)`, and its `details, .details` selector takes `:is()`
    specificity under CSS nesting (**0-1-1**), so `.tree { margin: 0 }` at 0-1-0 _loses_ to it. A
    nested tree is exactly such a child.

  Measured in a browser: **41px per level against a 24px design**, so a 9-deep tree spent 382px on
  indent and left its deepest label 162px wide. Now 24px per level, 198px total, and 653px of label.
  The nested rule resets both box axes before applying the one indent it owes, and the default is
  `clamp(0.75rem, 2.5vw, 1.5rem)` — 12px on a phone, 24px on a desktop — because a tree's depth is a
  property of the data and cannot be known when the pattern is written. `--tree-indent` still
  overrides it, and the `--lines` elbow derives from the same resolved value so the two cannot
  disagree.

  **Leaf rows now align with their branch siblings.** A branch spends a toggle column on its chevron
  before its label; a leaf has none, so every leaf label sat one full column (24px, measured) to the
  inline-start of its siblings and nothing at a given depth lined up. `.tree` exposes
  `--_node-indent` (the toggle column) and `--_leaf-indent` (what a row without a toggle owes to
  reach the same label column); `.tree__content` and `.tree__desc` both read the latter rather than
  re-deriving the sum.

  `<wc-tree>` also wraps its generated filter in `.input-group`, because `forms.css` styles text
  controls as `.form-group > input` / `.input-group > input` — a bare `<input>` rendered with the
  browser's 2px inset border and square corners next to the framework's own rounded controls.

  `schemaTreeNodes(schema, { idPrefix, maxDepth, prune })` is new in `@getvitops/generator`: it walks
  a JSON Schema — the same walk behind the `authoring.md` / `config.md` references — and returns tree
  **data**, not markup, so each medium renders it (markdown for agents, an accessible `<details>`
  tree for a site). Field ids are dotted config paths (`site.analytics.clarityId`), so any field can
  be linked to directly.

  `prune` exists for a specific hazard. The project config declares `designSystem.themes` as a
  looser shape than `DesignSystemSchema`, because the full one is applied separately by
  `resolveTheme` — so its embedded copy is an **approximation**, and measurably missing the
  descriptions for `colors`, `colors.palette`, `colors.roles` and `colors.utilities`. Anything
  rendering that copy as the token reference would silently document the colour system less well
  than the toolchain already does; `prune` lets a caller stop at the wrapper and render `jsonSchema`
  alongside instead.

  `renderInlineMarkdown()` is exported for schema description text. It **lifts code spans out before
  applying emphasis**, and that ordering is load-bearing rather than tidy: `colors.utilities`
  describes its families as `` `bg-*` ``, `` `text-*` ``, `` `border-*` `` — literal asterisk
  _wildcards_. Run emphasis over the raw string and the `*` closing `bg-*` pairs with the one
  closing `text-*`, italicising the text between two unrelated utilities and eating both asterisks,
  leaving prose that names families which don't exist. It also now renders single-asterisk emphasis,
  which the schema does use (`*presentation*`, `*domain properties*`) and which previously printed
  the asterisks literally.

  Also fixed: `config.md` claimed "Only the wrapper is listed here" under `designSystem` and then
  emitted the entire token schema anyway — `themes.<name>` _is_ a design system, so the walk
  descended into it. It now stops at the wrapper and delegates to `authoring.md` as it always said
  it did.

### Patch Changes

- 14813fa: Fix `<wc-entries>`, `<wc-carousel>` and `<wc-marquee>` silently failing to enhance when inserted
  dynamically.

  All three parse their slotted markup in `connectedCallback` and return early when they find
  nothing. That is fine when `elements.js` loads as a deferred module, because the document is
  fully parsed before any definition registers. But an element upgraded _during_ insertion is
  connected **before its children exist** — verified: an `innerHTML` write runs
  `connectedCallback` with zero children.

  So on an Astro view-transition swap, a client-side navigation, an `innerHTML` write or a cloned
  template, `<wc-entries>` never built its table, `<wc-carousel>` never cloned its slides or
  started autoplay, and `<wc-marquee>` never took over from the CSS-only path. Nothing errored;
  the un-enhanced fallback just stayed on screen, which is why this went unnoticed.

  Initialisation is now expressed as a function that reports whether it found its markup, and is
  retried once the insertion completes (`initFromLightDom`). Setup is guarded so a retry after a
  genuinely empty state can't double-apply — an `<wc-entries>` building its table twice would
  have been the obvious way to fix this badly.

  `<wc-tree>` uses the same helper. If you write a light-DOM component, use it too; the hazard is
  documented in `web-components/utils/upgrade.ts`.

- a9d7916: Fix `sitenav` shipping its drawer geometry into its navbar state.

  A `.sitenav` carrying both a drawer-direction modifier and a breakpoint promotion rendered its navbar one full panel-width toward the inline-end at and above the promotion width — off the page, with a horizontal scrollbar and anything laid out after the panel pushed out of view. Reported downstream against `sitenav--bp-lg sitenav--drawer-end`; it affected every `--bp-*` value and both drawer directions.

  One cause, three symptoms. `@container` contributes no specificity, so when the four per-breakpoint blocks were consolidated into a single style query in 3.0.0, the wide-state reset lost the `.sitenav--bp-*` class that had been winning it the tie. Every narrow-state rule with a heavier selector then won _inside the wide state_:
  - `.sitenav--drawer-end .sitenav__panel` (0,2,0) beat the navbar's `translate: none` (0,1,0) — the reported bug.
  - The mobile accordion's `.sitenav__item--branch > .sitenav__submenu { overflow: hidden }` (0,2,0) beat the dropdown's `overflow: visible`, which **clipped away every third-level megamenu** at width. Its `padding-inline-start: 1rem` leaked in the same way.
  - The wide block's counter-rule for depth caps beat the base `.sitenav__submenu { display: flex }`, so a `sitenav__item--desktop-branch` dropdown lost its column direction and gap.

  The drawer and the navbar are now mutually exclusive branches of the same style query — `@container style(--_sitenav-wide: 0)` alongside the existing `: 1` — so there is no cascade contest to lose rather than a contest that is currently being won. A new test in core asserts the invariant across every two-state pattern.

  **Two visible changes at width, both intended:** dropdown padding is now symmetric `0.5rem` (it was `1rem` on the inline-start side only), and depth-capped dropdowns regain their `0.25rem` gap.

  Also fixed in the same pattern: `.sitenav__panel` never undid the UA `[popover]` sheet's `margin: auto` and `height: fit-content`, so `inset-block: 0` bought nothing and the drawer rendered as a content-height card floating in the vertical centre instead of filling the edge. It is now a full-height drawer, and the auto margins no longer absorb free space when a promoted `.sitenav` is stretched rather than content-sized.

  Note the narrow state now also depends on `@container style()` (Chrome 111 / Safari 18 / Firefox 128), which the wide state already required. On an older engine the sitenav degrades to a popover holding an expanded link list — usable and accessible, but neither drawer nor navbar.

- Updated dependencies [c6b99e7]
- Updated dependencies [f7bc0a0]
- Updated dependencies [ceed51f]
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
        "default": {
          /* … */
        },
      },
    },
    "organization": {
      "name": "Acme",
      "contact": "hq",
      "locations": {
        "hq": {
          /* … */
        },
      },
    },
    "site": {
      "defaultLocale": "en",
      "domains": {
        /* … */
      },
      "analytics": {
        /* … */
      },
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

- b115993: Nav shells, a top-layer animation driver, and a pile of fixes to things that never worked

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

### Patch Changes

- Updated dependencies [6e68ace]
  - @getvitops/utils@3.0.0

## 2.1.0

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/utils@2.1.0

## 2.0.0

### Major Changes

- bf453b0: The framework now ships a border-box reset.

  ```css
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  ```

  **This is a behavioural change for the `css` and `bricks` formats.** If your project does not
  already set border-box — Tailwind's preflight does, as does normalize and almost every modern base
  stylesheet — elements with padding or a border now measure their declared width inclusive of it, so
  some boxes will come out narrower than before. The `tailwind` format is unaffected: preflight
  already did this.

  The framework used to refuse this on the grounds that a global reset silently reflows consumer
  layouts, and that reasoning was sound when nothing was layered. Two things changed:
  - **It is layered.** The rule lives in `vitops.base`, the lowest of the three framework layers, so
    it loses to any unlayered consumer CSS. The opt-out is one rule in your own stylesheet:
    `*, *::before, *::after { box-sizing: content-box }`.
  - **Patterns are only correct under it.** `.split`'s ratio is a flex basis, which sizes the border
    box; under content-box a padded column came out wider than its sibling by exactly its padding.
    Stating the assumption once beats every pattern re-asserting it and the ones that forget being
    quietly wrong.

- bf453b0: Utilities now beat patterns, in every format. Cascade layers are assigned by what a rule **is**,
  not by which file it happens to live in.

  `vitops.base → vitops.components → vitops.utilities` has existed for a while, and its whole purpose
  is to let `class="card bg-danger-muted"` work without `!important`. But the layer was chosen per
  **partial**, and `layout.css` was one file holding both the structural patterns (`.rhythm`,
  `.centered`, `.split`) and roughly three quarters of the framework's utilities (`.m-*`, `.flex-*`,
  `.items-*`, `.justify-*`, `.text-*`, `.split-<a>-<b>`, track placement). Unmapped, it defaulted to
  `vitops.components` — so all of those utilities were shelved _below_ the patterns they are meant to
  override, and quietly did nothing. `utilities.css` had the mirror-image problem: it held the
  `.reveal` component family, which therefore outranked every pattern _and_ the display utilities.

  Both are now split — `layout.css` / `layout-utilities.css`, and `patterns/reveal.css` — and the
  classification is asserted across formats by a shared `LAYER_CONTRACT`, so the two halves cannot
  drift apart again.

  **What visibly changes.** Each of these was silent before and now takes effect. That is the point,
  but if you wrote one of these combinations and never noticed it did nothing, you will see a change:

  | markup                                   | before                                     | after                  |
  | ---------------------------------------- | ------------------------------------------ | ---------------------- |
  | `class="table text-center"`              | `.table { text-align: start }` won         | `.text-center` wins    |
  | `class="banner items-start"`             | `.banner`'s centring won                   | the utility wins       |
  | `class="cluster-between justify-center"` | `.cluster-between` won                     | `.justify-center` wins |
  | `class="icon justify-start"`             | `.icon { justify-content: center }` won    | `.justify-start` wins  |
  | `class="combobox flex-row"`              | `.combobox { flex-direction: column }` won | `.flex-row` wins       |
  | `class="media items-center"`             | `.media { align-items: flex-start }` won   | `.items-center` wins   |
  | `<details>` first content child + `m-0`  | `details.css`'s `> summary + *` margin won | `.m-0` wins            |
  | `class="split flex-col"`                 | worked, but on source order                | works by layer         |

  The reveal family moves the other way, having been mis-shelved as a utility: `class="reveal hidden"`
  and `class="reveal-fade block"` used to keep the reveal's own `display` and now lose to the display
  utility. The duplicate `details::details-content` rules in `utilities.css` are deleted —
  `patterns/details.css` was always the owner, and its selector is a superset — so the collapsed
  content box is now `overflow: hidden` rather than `clip`.

  **Removed: the bare `<bp>-split` classes** (`sm-split`, `md-split`, `lg-split`, `xl-split`).
  `.split` is a pattern now, and `@utility` cannot live in a cascade layer — measured against
  tailwindcss@4.3.3, it throws inside `@layer` _and_ inside a file imported with `layer(…)`, and a
  `@custom-variant` can't reach a components-layer class either — so `@md:split` became impossible and
  the css/bricks counterpart had to go with it. Use `md-flex-row` for "become a row at md"; it says
  the same thing in every format. The one thing lost is resetting a bare ratio back to equal at a
  breakpoint, which had no usages; apply the ratio at the breakpoint instead.

  **Also fixed, in the tailwind format only** — three divergences found while auditing the layers:
  - `body` was emitted with `container-type` but not `container-name: body`, so the
    `@container body (…)` queries in the scroll/TOC patterns never matched: `.toc-layout` and
    `.toc-sidebar` were stuck in their narrow layout.
  - `grid-auto` was missing the `:is(ul, ol) > li + li` margin reset, so a `<ul class="grid-auto">`
    inside `.rhythm` got a stray top margin on every item but the first.
  - **`.sticky` was being deleted outright.** `sticky` is a Tailwind utility name, and the strip that
    defers those to Tailwind matched a rule's leading class — taking `patterns/sticky.css` with it,
    including `--sticky-offset`, the z-index wiring and every `.sticky--bottom` / `--inline-start` /
    `--inline-end` variant. Components whose names collide with Tailwind utilities are now allowlisted.

  **Migration.** If a layout utility on a patterned element now "suddenly works" and you preferred the
  old result, remove the utility — it was never doing anything. To keep a pattern winning over the
  framework's utilities, write the declaration in your own stylesheet: unlayered CSS still beats all
  three framework layers.

### Minor Changes

- 4756788: Add `<Analytics />` and a general-purpose consent gate.

  `getvitops({ analytics })` configures Google Analytics 4, Microsoft Clarity, Matomo and Plausible;
  `<Analytics />` emits their tags. Nothing touches the critical path — `strategy` defaults to `'idle'`,
  which loads every tag after `load` on an idle callback (`'async'` and `'interaction'` are the other
  options), and no `preconnect` is emitted, since warming a third-party connection during parse is the
  cost `idle` exists to avoid.

  `getvitops({ consent })` adds the gate: `@getvitops/core/consent`, a 2.3 KB gzipped Lit-free bundle,
  plus `<CookieConsent />`.

  ```js
  vitops({
    analytics: { googleAnalytics: 'G-XXXXXXXXXX', plausible: 'acme.com' },
    consent: { policyUrl: '/legal/cookies' },
  });
  ```

  **Consent is not an analytics feature.** The gate is general — mark anything
  `data-consent="<category>"` and it waits on the same choice, so A/B assignment, personalisation and
  third-party embeds use it too, and a site can enable the banner with no analytics at all. Categories
  are `necessary` / `analytics` / `marketing` / `preferences`, and `window.vitopsConsent` plus a
  `vitops:consent` event on `document` are how your own code reads the answer.

  **Which category a provider needs is derived, not declared.** It follows from whether that provider
  sets cookies, which follows from its own config: Matomo runs cookieless by default (`disableCookies`)
  and so needs no banner; `cookies: true` opts in and moves it behind `analytics`. You can't mark
  Google Analytics `necessary` to skip the banner — but you can pick a genuinely cookieless provider.

  Gated tags render as `<script type="text/plain">` with the URL on `data-src`, so an undecided or
  declining visitor's page issues **no third-party request at all**. For Google Analytics that is basic
  consent mode rather than Consent Mode v2 advanced: nothing reaches Google until the visitor accepts.
  Clarity additionally receives `clarity('consentv2', …)`, because Microsoft enforces the signal
  separately for EEA/UK/CH traffic. Nothing is stored until a choice is made — the banner can't be the
  thing that needs consent — and revoking clears the provider's cookies and reloads, because an
  already-executing tracker can't be unloaded any other way.

  The banner is shown in the top layer via `popover="manual"`, like `.tooltip`: a plain fixed banner
  resolves against the nearest containing block, and `body { container-type: inline-size }` — ordinary
  in a framework whose breakpoints are container queries — would otherwise trap it mid-page.

  **The site config gained `analytics.clarityId` and `analytics.matomo`**, so `vitops legal` discloses
  them. Clarity and Matomo join the processor table with their real cookie names, cookieless Matomo
  asserts positively that it sets none, and a Clarity site's privacy policy now describes session
  replay rather than filing it under page-view analytics. Configure `legal` alongside `analytics` and
  the Astro integration cross-checks the two, naming any provider you'd otherwise run without
  disclosing; it also warns when a cookie-setting provider has no `consent` gate.

  Existing configs are unaffected — both options are off unless provided. One behaviour change if you
  use the ad-conversion tracking script: `packages/astro/src/scripts/tracking.ts` now waits for
  `marketing` consent before writing its 90-day `_ac` click-ID cookie, when the gate is present. With
  no gate on the page it behaves exactly as before.

- bf453b0: Animation families that never actually animated, and a driver that fired before you could see it.

  Each of these looked correct in source and failed somewhere else — in the bundler, in hit-testing,
  or in the difference between a time-based and a progress-based timeline. Nothing here needs a
  markup change.

  **Changed: entrances are now timed off the element's midpoint.** Every driver used to key off a
  fraction of the element's _own height_, which meant the same class behaved differently on a 4rem
  card and a full-bleed section — and on small elements it was over before they appeared
  (`entry 20%` is about 17px of scroll for a 5.5rem tile). Motion now starts once the element's
  **midpoint is 10% of the viewport in**, and a one-shot entrance completes at **25%**. This applies
  to `animate-view` and to the `.is-active` observer that drives `animate-trigger` and the
  `active-<fx>` transition variants, so everything on a page starts at the same moment on screen.

  The pivot is `entry 50%` — the one point that means "midpoint on the viewport edge" for an element
  of any height — plus a viewport length. Shift the window with `--anim-start` / `--anim-end`, or
  replace it with `--anim-range`. `--stagger-range-step` is now a viewport length (`5vh`) to match.

  **Fixed: every journey ran on a truncated range.** The generator emitted `animation-range: entry
exit`; lightningcss parsed the end of that shorthand as `exit 0%` rather than the spec's `exit
100%`, so the bundle shipped `entry exit 0%`. Journeys reach their `100%` keyframe — the hidden
  `from` state — as the element hits the top of the viewport, which is to say they faded out while
  still fully on screen. Journeys now run `entry calc(50% + 10vh) → exit 100%`: they start on the same
  midpoint pivot as everything else and keep the full entry → hold → exit arc, so the hold sits in the
  middle of the crossing. `animation-effects.test.ts` asserts on the **bundled** css, because the
  emitter was right the whole time.

  **Fixed: `slide-journey` had no distance to travel.** `animations.journeys.base.slide` was `{}` in
  both `defaultConfig()` and the shipped example, so the keyframe animated `translate: 0 → 0`. It now
  declares `translate-y-from: var(--slide-distance, 2rem)` — the same var the `slide-up` effect uses,
  so one knob tunes both. If your own config has an empty `slide` base, add the same line.

  **Fixed: `reveal-*` on hover was unreachable.** A `hover-reveal-left` element rests at `clip-path:
inset(0 100% 0 0)`, and `clip-path` clips **hit-testing** as well as painting — so it had zero
  hittable area and could never receive the hover that would reveal it. The state variants now match
  the element **or its direct parent**, mirroring what `animation.css` already did for the trigger
  driver (`:is(.is-active, [data-active]) > .animate-trigger`):

  ```css
  .hover-<fx>:hover, :hover > .hover-<fx> { … }
  .focus-<fx>:focus-visible, :focus-within > .focus-<fx> { … }
  ```

  Specificity is unchanged (0-2-0), so nothing reorders. **Behaviour change:** a `hover-<fx>` element
  that is a direct child of a hovered element now flips with its parent. Wrap it in an intermediate
  element if you need the old element-only behaviour.

  **Fixed: `.stagger` did nothing on a scroll-driven timeline.** It offsets children with
  `animation-delay`, which is time-based and is ignored outright on a `view()` / `scroll()` timeline,
  so `.stagger > .animate-view` arrived all at once. It now also offsets each child's view
  `animation-range` by the same index, so one class works under both driver families — tune the
  scroll-driven step with `--stagger-range-step` (default `5vh`). Journeys declare their own range and
  opt out by construction.

  Two smaller faults found alongside it: `@supports (--x: sibling-index())` is **always true** — any
  token stream is a valid custom-property value — so the guard around `sibling-index()` guarded
  nothing in both `.stagger` and `.subgrid`'s row index, and on an engine without support the
  declaration went invalid rather than being skipped. Both now test a real property. And the CSS path
  was 1-based while the JS fallback wrote 0-based, so the two disagreed by one step wherever both ran.

  **Fixed: the pre-paint `<html>` class script was missing entirely.** `<Head />` now emits it again,
  outside the `webComponents` block since it gates stylesheet behaviour rather than the element
  runtime. It does two things `animation.css` depends on and that three other files documented as
  already shipping:
  - `no-js` → `js`, so `.animate-trigger` is paused only where JS can un-pause it;
  - `.no-scroll-timeline` when `animation-timeline: view()` is unsupported, which is what cancels
    `.animate-view` / `.animate-scroll`. Scroll-driven animations are deliberately **not** polyfilled,
    so without this flag those elements sit at their `from` keyframe — `opacity: 0`, i.e. invisible
    content — on any engine without support. It had been dropped in the move to publishable packages,
    leaving the cancel rule as dead code.

  **New: `hover-size-grow` and friends exist.** The layout effects (`size-grow`, `size-shrink`) were
  the one family with no state variants, on the grounds that `.transition` doesn't cover `height`.
  That wasn't a platform limit — `height: 0 → auto` just needs `interpolate-size: allow-keywords`,
  which the framework already sets on `:root`, and which the `layout` **keyframe** depended on
  equally. So the exclusion bought no portability; it only made `hover-size-grow` a class the docs
  advertised and the stylesheet didn't define. `.transition` now declares `height` inside an
  `@supports (interpolate-size: allow-keywords)` block, and the generator emits the full
  `hover-`/`focus-`/`active-` set for layout effects, carrying each effect's own `overflow: clip` so a
  collapsed box hides its content instead of spilling it. Where `interpolate-size` is missing, the
  height simply doesn't transition — the same degradation the keyframe path has. (For the record:
  `transition-behavior: allow-discrete` is _not_ the tool here — it only lets genuinely discrete
  properties transition, and would snap at the midpoint.)

  `.transition` switched from the `transition` shorthand to `transition-property` +
  `transition-duration` + `transition-timing-function`, so the gated block can append `height` without
  restating the list. If you override `.transition`'s timing, override the longhands.

  The generated class reference (`vitops docs classes`) was the upstream source of that mismatch — it
  listed every effect under "with the state prefixes above", including the layout ones. It now states
  which stage needs the feature gate, when each driver plays, and how `stagger` composes with both.

- bf453b0: New `gap-*` utilities over the fluid space scale, in all three formats.

  `gap-<name>`, `gap-x-<name>` (column) and `gap-y-<name>` (row), for every step of your
  `spaceScale` — `gap-2xs` … `gap-7xl` — each breakpoint-prefixable (`md-gap-l` in css/bricks,
  `@md:gap-l` in tailwind).

  There was no gap utility at all before. `vitops docs css` advertised a `g` class that was never
  emitted, so the honest answer for a css or bricks consumer was an inline `style="gap: …"`. Tailwind
  did not fill the hole either: the fluid steps are deliberately kept **out** of Tailwind's
  `--spacing-*` namespace, because named keys there shadow the size scales (`max-w-7xl` would resolve
  to `var(--spacing-7xl)` and collapse layouts), so `gap-l` was not something Tailwind could derive.
  Measured against tailwindcss@4.3.3: the emitted `@utility gap-l` is honoured, accepts variants, and
  coexists with the built-in numeric `gap-4`, which keeps Tailwind's own multiplier.

  The whole matrix is emitted rather than a plausible subset. An undefined step produces no rule and
  no error in either format, so a missing `md-gap-x-2xl` would be indistinguishable from a working
  one.

  In the css and bricks bundles these land in `vitops.utilities`, so `class="cluster gap-l"` beats
  the pattern's own gap.

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

- bf453b0: Detect JavaScript and scroll-driven timelines in CSS, so no-JS visitors stop getting invisible
  content.

  `animation.css` gated two rules on classes that had to be put on `<html>`: `no-js`, which the
  framework expected an author to write into their own markup, and `.no-scroll-timeline`, which an
  inline `<head>` snippet was supposed to set. **That snippet never shipped.** Three source comments
  described it and nothing implemented it, so on every Astro and Bricks site the `:root:not(.no-js)`
  gate matched unconditionally and `.animate-trigger` stayed `animation-play-state: paused` with no
  `IntersectionObserver` coming to release it. An entrance animation that never runs is `opacity: 0`.

  Both gates are now platform queries:

  ```css
  @media (scripting: enabled) {
    .animate-trigger {
      animation-play-state: paused;
    }
    /* …released by .is-active */
  }

  @supports not (animation-timeline: view()) {
    :where(.animate-view, .animate-scroll) {
      animation: none;
    }
  }
  ```

  Nothing to install, nothing to remember, and correct for consumers the old approach could not reach —
  a Bricks site, or anyone rendering their own `<head>`. It also fails the right way round: an engine
  that doesn't know either feature drops the block and the animation simply runs, costing an
  enhancement rather than hiding the page.

  **Nothing to do to adopt this.** Drop `class="no-js"` from your `<html>` and any script that removes
  it if you like — both are inert now, not harmful. `<Head />` no longer emits a class-flipping script.

  Support is baseline: `scripting` shipped in Firefox 113, Safari 17 and Chrome 120, all in 2023.

- bf453b0: `.split` gets a stacking convention, a reversal, and a ratio that actually holds.

  **Fixed: a padded column silently broke the ratio.** `.split > *` was `flex: 1` — a zero basis plus
  a grow factor — and `flex-grow` shares out only the _free_ space, which a child's padding is not
  part of. So a padded column came out wider than its sibling by exactly its horizontal padding, and
  `.split-1-2` quietly stopped being 1:2. Measured in Chrome: an equal `.split` 1000px wide with 40px
  of padding a side on one child resolved 540/460, and `split-1-2` resolved 387/613. The ratio is now
  a **flex basis**, which sizes the border box, so padding sits inside the share: 500/500 and 333/667.
  Nothing to change in your markup — ratios that looked slightly off now land where they read.

  Two consequences worth knowing. The basis applies only to a **two-child** split, because a ratio is
  a pair contract (only `:first-child` and `:last-child` ever carried one) and with three or more
  children a middle child would collapse to zero; those keep the previous behaviour. And the ratio
  only holds on **border-box** children — a basis sizes the border box, and under content-box the
  padding lands outside the share again, reproducing the exact defect. That is what the new global
  border-box reset is for (see its own note); `.split > *` restates it so the pattern still holds if
  you override the reset in a layer of your own.

  **Fixed: long unbreakable content stretched a column.** `.split > *` now carries
  `min-inline-size: 0`. A flex item's automatic minimum is its min-content size, so a URL, a code span
  or a `<pre>` used to push its column past its share — and every consumer re-derived `min-w-0` to
  stop it. It belongs to the pattern.

  **Stacking is now a two-class idiom, using `flex-col` you already have.**

  ```html
  <div class="split flex-col md-split-1-2 gap-l"></div>
  ```

  Stacked below 48rem, 1:2 above. What happens when there isn't room for two columns was the question
  `.split` never answered, so every project re-derived
  `flex flex-col gap-… lg-flex-row lg-items-start lg-split`. The `sm-`/`md-`/`lg-`/`xl-` ratio classes
  now assert `flex-direction: row`, which is what un-stacks the pair at the breakpoint. There is
  deliberately **no** `.split-stack`: it would be `flex-col` under a second name.

  `.flex-col` wins because `.split` is a **pattern** and every utility sits one cascade layer above
  it — see the layering note in this release. `.md-split-1-2` then wins because a breakpoint-scoped
  utility sorts after an unscoped one, which is stable in both formats. (`.split` itself now states
  `flex-direction: row`, so a host that defaults an element to `column` — Bricks' block element —
  can no longer stack it by accident, as long as that host's rule is itself layered.)

  While stacked the ratio goes inert on its own and needs no reset: a percentage flex basis resolved
  against an auto-height column container behaves as `content`. It does apply if you give the split a
  definite `block-size`, which is a ratio in the block axis — what asking for one on a fixed-height
  column means.

  **New `.split-reverse`** (breakpoint-prefixable) — swaps the two panels. It is `order` on the first
  child rather than `row-reverse`, so it reverses on **whichever axis the split is currently on**:
  bare, it swaps the columns in a row _and_ the rows in a stack; scoped to a breakpoint
  (`md-split-reverse`) it swaps only once there are two columns — put the media first in source and it
  leads on mobile while sitting on the right at width. The ratio stays attached to the source-first
  child, not to visual position.

  > **Accessibility.** Reversing puts visual order out of step with DOM order, and focus order follows
  > the DOM (WCAG 2.4.3 Focus Order) — so a keyboard user tabs through a reversed split in the order it
  > is written, not the order it is seen. Put focusable content in **only one** of the two panels. The
  > pattern declares `reading-flow: flex-visual`, which fixes this properly where it is supported;
  > support is not yet broad enough to rely on, and an unknown property is inert, so treat it as an
  > enhancement rather than a guarantee.

  **New `.flex-row-reverse` / `.flex-col-reverse`** (breakpoint-prefixable) in the `css` and `bricks`
  formats. These names were already in the list the `tailwind` format defers to Tailwind for, but
  they were never defined here — so a mirrored row was inexpressible in framework classes in the two
  formats with no fallback.

### Patch Changes

- bf453b0: Make `text-wrap` a stated decision on every type role, emit the `typography.headings` bindings in the tailwind format, and add the four `text-{wrap,nowrap,balance,pretty}` utilities.

  `text-wrap: balance` for headings and `pretty` for copy belong to the **type role**, not to a
  reset — the role already owns the property (`--<role>-tw`, editable in the live theme editor),
  and `typography.headings` projects it onto bare `h1`/`body` so unclassed markup gets it with no
  class at all. Three things stopped that working end to end.

  **Omitting `text-wrap` was never "inherit".** Like `style`, `text-transform` and
  `text-decoration`, it is emitted on every role at its identity value so that applying one role
  class over another fully resets it. So a role that left it out emitted `text-wrap: wrap` and
  **cancelled** the `pretty` it would otherwise inherit from a `body`-mapped role — captions and
  footnotes quietly opted out of the thing they most benefit from. The behaviour is unchanged
  (the reset is what makes role classes composable); what changed is that the schema description
  now says so, and the shipped configs state the value on every role rather than leaving it to
  the identity.

  `vitops init` now scaffolds `balance` on `display`/`heading` and `pretty` on `body`. If you
  already have a `design-system.json`, add `text-wrap` to each role deliberately — `balance` for
  heading-like roles, `pretty` for copy, `wrap` for short single-line labels.

  **The tailwind format dropped `typography.headings` entirely.** It emitted the
  `@utility font-<role>` half of the typography layer and none of the bare-element bindings, so a
  Tailwind consumer's `<h1>` and `<body>` carried no role styling at all — no family, no size, no
  `text-wrap` — while the css and bricks formats styled them. They are now emitted into Tailwind's
  `base` layer, which keeps `font-<role>` and the patterns able to override them.

  **This visibly changes existing tailwind sites.** Elements named in your `typography.headings`
  map start picking up their role's typography, which for most projects is the styling they were
  missing — but if you have been compensating with your own `h1`/`body` rules, they now stack.
  Your own unlayered CSS still wins; utilities layered by Tailwind will not. Either drop the
  compensating rules or remove the entry from `typography.headings`.

  **New utilities** `text-wrap`, `text-nowrap`, `text-balance`, `text-pretty` (css/bricks only —
  Tailwind ships these natively, so they are in `TW_CLASH` and the tailwind bundle drops our
  copies). They are the per-element escape hatch for markup that carries no role class, such as a
  Bricks-authored heading.

- Updated dependencies [04a51d8]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
  - @getvitops/utils@2.0.0

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

### Patch Changes

- Updated dependencies [bb92a14]
  - @getvitops/utils@1.0.0

## 0.9.0

### Minor Changes

- **The theme editor no longer dims the page it's editing.**

  The panel used `.drawer`'s scrim and `popover="auto"`, which fought the whole purpose of a live
  editor: the page you were tuning sat behind a 4px blur, and the first click on it dismissed the
  panel. It is now modeless — no scrim, and clicking through to the page keeps it open. Escape still
  closes it (wired explicitly, since `popover="manual"` doesn't provide it), as does the × button.

  **New: `.drawer--modeless`.** The same treatment is available to any drawer — a side panel you work
  _alongside_ rather than through (an inspector, a live editor, a filter rail). Pair it with
  `popover="manual"`:

  ```html
  <div class="drawer drawer--right drawer--modeless" popover="manual">…</div>
  ```

  An `auto` popover light-dismisses on the first outside click, which is exactly the interaction a
  modeless panel exists to permit — so `manual` is part of the pattern, not an afterthought. It also
  drops Escape, so give the panel a visible close control.

  **Added:** a drift guard tying `<wc-theme-editor>`'s dark-override selector to the generator's
  `DARK_SEL`. The two must match or the editor's dark-mode edits land on a rule the page never
  matches — a failure that is invisible in light mode, so nothing would have caught it.

- **Fixed: `Subgrid` and `Cards` rendered as unstyled lists, in every format.**

  `Subgrid.astro` drew its geometry with Tailwind utilities — `grid-rows-subgrid` and
  `row-span-(--row-span)`, the latter Tailwind v4's arbitrary-CSS-variable syntax. No framework CSS
  layer defines those, so under `css.format: 'css'` or `'bricks'` the component had no layout at all.

  It failed under `'tailwind'` too, which is the part worth internalising: **Tailwind v4 is JIT and
  does not scan `node_modules`**, so a class that only a shipped component references is never
  generated. A consumer had to add the package to Tailwind's `@source` by hand to get a subgrid;
  without that, cards silently laid out at `grid-row: auto` — visually plausible, quietly wrong. The
  same trap applied to `grid` in `Subgrid` and `sr-only` / `not-sr-only` in `Popover` / `Drawer`:
  those are in the generator's `TW_CLASH` list, so the framework strips its own rules for them from
  the tailwind bundle and defers to Tailwind — meaning they resolved only when the consumer's own
  templates happened to use the same class.

  The components now emit framework classes only, and the `subgrid` pattern owns the layout:
  - `Subgrid` renders `<ul class="subgrid"><li>…` and ships no `<style>` block of its own.
  - `Popover` / `Drawer` use a component-scoped `visually-hidden` instead of `sr-only`. The
    `not-sr-only` on their icons was a no-op and is gone.
  - The `subgrid` pattern absorbed the wrapped-row margin the component used to carry, so
    hand-written `.subgrid` markup gets it too, and resets list markers on `ul`/`ol`.

  **Also fixed: `Cards` discarded the `card` class and every class you put on a child.** It wrote
  `card` onto the slotted element and then serialised that element's _inner_ HTML, dropping the
  attribute it had just set. Child `class` and `style` now reach the rendered `<li>`.

  **Breaking — the subgrid custom properties are renamed.** One `--subgrid-*` vocabulary now covers
  both the pattern and the component; the old names are removed, not aliased:

  | removed                         | use                  |
  | ------------------------------- | -------------------- |
  | `--items-per-row`, `--cols`     | `--subgrid-cols`     |
  | `--rows-per-item`, `--row-span` | `--subgrid-row-span` |
  | `--row-margin`                  | `--subgrid-row-gap`  |

  `--subgrid-gap` (the grid gap) is unchanged, as are the `.subgrid-cols-*` / `.subgrid-rows-*` /
  `.subgrid-responsive` modifiers. Anything still setting an old name falls back to the pattern
  defaults — 3 columns, span 2 — so grep for them when you upgrade.

### Patch Changes

- **Fixed: `vitops init` and `vp create` scaffolded configs referencing tokens that no longer
  exist.** `defaultConfig()` and the EmDash template still pointed at `--color-surface-xl` and
  `--color-surface-xxl`, aliases from the named-step colour scale removed in 0.6. A scaffolded
  project therefore got a `card` with no background and an invalid default border colour, with
  nothing reporting it. Both now use `--surface-bg` / `--surface-bg-muted`. The EmDash template
  also dropped its `patterns.radii.card` key, which collided with the `card` pattern on
  `--br-card` — the collision `validate()` has been warning about (the `panel` group already
  supplies the same radius, so nothing changes visually).

  **Fixed: `.text-reveal` rendered invisible text.** Its gradient consumed
  `--text-reveal-color-from`/`-to` with no defaults, so unless a consumer set both, the `var()`
  substitution failed, `background` became invalid at computed-value time, and the accompanying
  `color: transparent` left the text with no way to render. Both tones now default to the
  functional text tokens.

  **Fixed: `.bordered` fell back to `currentColor`** via a reference to `--color-surface-xl`,
  which the generator never emitted. It now resolves `--surface-border`.

  **New: `validate()` warns when a required role is missing.** `colors.roles` is an open map —
  any name works and generates a full token set — but the shipped component CSS references
  `brand-primary`, `danger`, `neutral`, `surface`, `ui-primary` and `warning` with no fallback,
  so omitting one leaves those components uncoloured. This is a warning, not an error; the
  required list is re-derived from the CSS partials by a test so it cannot drift.

  `vitops docs` and `vitops agents` now surface config warnings (on stderr, so piping `docs` is
  unaffected). They previously discarded them, unlike `generate` and `validate`.

  Docs corrections, all in the generated bundle:
  - **Raw scale classes are frozen and do not remap in dark mode** — stated explicitly for the
    first time, with a migration table to the role equivalents. The dark-mode guarantee only ever
    applied to functional role tokens, and nothing said so.
  - **Roles are extensible over a required core** — the schema description and class reference
    read as a closed enumeration, which is why a consumer forked their own colour layer rather
    than adding a role.
  - **The `md:` / `@md:` / `md-` distinction** in the tailwind format: `@md:` uses the framework's
    breakpoints, `md:` works but uses Tailwind's (which differ — `sm:` is 40rem, `@sm:` is 30rem),
    and `md-` is silently inert. Plus a note that registering `--container-*` also re-points
    Tailwind's `max-w-*` scale.
  - The css and bricks bundles now carry a `/*!` banner pointing at `npx vitops docs classes`
    (the previous plain comment was stripped by the minifier, so it never reached the file).

  Contrast checking now covers **every** background plane a role emits (`bg`, `bg-muted`, and
  `bg-bold`), not just `bg` — body text on a `card` was previously unguaranteed.

- **Fixed: `<details>` disclosures never opened.**

  Every `<details>` on a page using this framework was inert in Chrome 149 — clicking a summary
  toggled the `open` attribute and nothing else happened. This affected the bare element, not just
  `.details`, so it hit the docs table-of-contents, the mobile nav, and the theme editor's sections
  alike.

  The cause was the open/close animation on `::details-content`. It used the canonical recipe
  (`block-size: 0 → auto` plus `content-visibility` under `allow-discrete`, backed by
  `interpolate-size: allow-keywords`), and that recipe deadlocks: `content-visibility` stays `hidden`,
  so the content has no layout, so `auto` resolves to `0`, so the transition has nothing to animate
  and the state never advances. The failure is total rather than cosmetic — collapsed content simply
  could not be reached.

  Bisected against a bare `<details>` with only the framework stylesheet. `transition: none` is the
  only thing that restores it; transitioning `block-size` alone, `content-visibility` alone,
  `calc-size(auto, size)`, and the `grid-template-rows: 0fr → 1fr` technique all fail identically.

  **So the transition is gone and disclosures now open instantly.** Correctness over motion. If you
  reinstate it, verify a _first click actually expands_ in a real browser — the syntax is valid and
  `@supports` reports it as supported, so a feature query proves nothing here; only the interaction
  does.

  **Also fixed: `.details--marker-start` right-aligned its label.** It mirrored the trailing marker's
  `margin-inline-start: auto` as `margin-inline-end: auto`, which pushed everything after the icon to
  the opposite edge instead of just placing the icon first.

  **Also:** `<wc-theme-editor>`'s section headers now carry a disclosure marker. The `.details`
  pattern removes the native one and expects a `.details-icon`; without it a panel of ~40 nested
  sections gave no indication anything was collapsible.
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

- @getvitops/utils@0.8.0

## 0.7.0

### Patch Changes

- @getvitops/utils@0.7.0

## 0.6.0

### Patch Changes

- @getvitops/utils@0.6.0

## 0.5.0

### Patch Changes

- @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0

## 0.2.1

### Patch Changes

- @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- Redesign the colour system: seeded OKLCH tonal scales plus functional semantic tokens
  (`bg`/`text`/`solid`/`on-solid`, `muted`/`bold`), with named-alias back-compat. Updates the
  framework CSS, the schema, and the generated docs to the new token model.

### Patch Changes

- @getvitops/utils@0.2.0
