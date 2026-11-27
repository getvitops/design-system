# Three tiers, chosen by whether a pattern needs JavaScript

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

Three tiers, chosen by **whether a pattern actually needs JavaScript**:

1. **CSS framework** (`@getvitops/core` `css/`) — every pattern expressible in pure HTML/CSS.
   Variable-driven utility + component classes, built on modern platform features (Anchor
   Positioning, Popover, Invoker Commands, `<details>`, subgrid, container queries, scroll-driven
   animations). Reach for these before anything else.

2. **Web components** (`@getvitops/core` `src/web-components/`, `<wc-*>`, Lit) — **only** for patterns
   that genuinely benefit from **progressive enhancement**, and they must **SSR**:
   - The slotted/light-DOM markup is the **fallback**, and it must be **accessible and usable on its
     own with no JS** (semantic HTML). The component never renders from empty.
   - On registration it **parses that fallback and augments it** in place. Use light DOM
     (`createRenderRoot() → this`) so the framework CSS applies to both the fallback and the enhanced
     result.
   - Exemplar: **`WCEntries`** — with no JS it renders semantic `<h3>` + `<dl>` pairs; with JS on a
     wide container it parses them into a table. (Others: carousel, image-compare, wc-multifield, …)
   - **`<wc-tree>` is the one element that discards slotted nodes rather than only hiding or
     appending alongside them** — the one deliberate exception to "augments... in place" above. On
     upgrade it unwraps every branch's `<details>`/`<summary>` entirely (see that element's own
     docblock for why: the alternative, an ARIA-attribute overlay left on top of the native
     structure, was tried first and rejected for the permanent duplicate role it left behind). A
     consumer script holding a reference to the original `<details>`/`<summary>` — including via
     `getElementById`, captured before upgrade — loses it; `tree-toggle` (mirroring the existing
     `tree-filter` event) is the replacement surface. Named here as a deliberate exception, not a
     silent divergence — same treatment as `<wc-consent>` and `<wc-theme-editor>` below.
   - **Four elements render into a shadow root** — `<wc-image-compare>`, `<wc-split-panel>`,
     `<wc-color-scheme-toggle>` and `<wc-copy>` — named exceptions to "use light DOM", not silent ones. The rule that separates
     them from the rest: light DOM where there is **author markup to parse and augment**; a shadow
     root where the element **renders all of its own UI** and the light DOM is only a slot, so
     encapsulation protects the generated controls and nothing needs the framework CSS to reach
     in. `<wc-color-scheme-toggle>` is the pure case: it has no slotted content at all, its host is
     `display: none` until it upgrades (absent rather than broken with no JS), and the page itself
     follows `prefers-color-scheme` meanwhile. `<wc-copy>` builds its button and live status region
     itself; the only light-DOM content is the text being copied, which stays visible and
     selectable with no JS. Both state this as `@fallback partial`. `WCCopy.dom.test.ts` asserts
     the live region sits beside the button in the same shadow root, because an `aria-live` node
     cannot be referenced across a shadow boundary. Converting either to light DOM would touch
     shipped, tested components for nothing a client can see; don't do it to tidy the rule. A
     **new** element that parses author markup does not get to join this list.
   - **`<wc-image-compare>`'s reason, specifically:** `DragController` finds its handle through `renderRoot`,
     and the divider's stacking and clip live in the element's own `static styles`. The fallback
     promise is unaffected, because the two images are the **light-DOM** children (`slot="before"` /
     `slot="after"`), which upgrading never touches: with no JS they are two readable images.
     `WCImageCompare.dom.test.ts` asserts that, and the keyboard/ARIA contract. Converting it to
     light DOM is possible but buys nothing a client can see; don't do it to tidy the rule.
   - **`<wc-split-panel>`'s reason is the same:** it uses `DragController` through `renderRoot` and
     draws its own divider; the two panes are slotted light-DOM children, so with no JS they are
     two readable blocks.
   - Shipped as feature-detected, deferred ES-module bundles
     (`@getvitops/core/{polyfills,elements,deferred}`); polyfills load **only** when a native feature
     is missing (see `Polyfills.astro`).
   - **`<wc-consent>` is the one element outside `elements.js`** (`@getvitops/core/consent`), and it
     still meets the tier-2 bar. It ships in its own Lit-free bundle for two reasons pulling the same
     way: consent is a legal requirement, so a site needing it must not be made to download a
     rendering framework; and the same module gates every third-party tag on the page, so it has to
     be free to load ahead of the deferred Lit bundle rather than behind it. Its fallback markup
     ships `hidden` — with no JS the gate never runs, no gated tag loads and no non-essential cookie
     is set, so there is genuinely nothing to consent to. That fallback isn't empty, it's _moot_.

   **`<wc-config-form>` is the second element outside `elements.js`** (`@getvitops/core/config-form`,
   ~3.6 KB gzipped, Lit-free, a plain `HTMLElement`), for the reason `<wc-consent>` has its own bundle:
   it carries what a page with no config form should not download (the JSON Schema validator and the
   `formToConfig` codec, bundled from `@getvitops/config/forms`). It meets the tier-2 bar: the form it
   wraps is a complete `<form method="post">` (`renderProjectionHtml`, `@getvitops/utils/forms`) that
   posts the names `formToConfig` parses with scripting off, and the server validates. The element only
   adds feedback while typing, a new row for a keyed map as the blank one is used, and `value`. It
   enhances `<wc-field>` (in `elements.js`) without importing it, so the two load in either order. It
   cancels a submit that has errors unless it has `novalidate`.

   **`<wc-multifield>` is in `elements.js`** (a plain `HTMLElement`, light DOM, Lit-free; it replaced
   the earlier shadow-DOM `<wc-multi-field>` spike, keeping its `min`/`max`/`protect-defaults`, Clear,
   label attributes and `multi-field-*` events). It repeats a field (each child is an entry) or a
   fieldset: `renderProjectionHtml` wraps every keyed map in it, each row an open
   `<details class="field__row">` titled by its key, the last one blank (`data-blank`). The fallback is
   the markup itself: native named controls, so with no JS fill in the blank row to add an entry and
   empty a row's key to drop it (a row with no key is not sent). On upgrade the blank row becomes a
   template and Add / Remove (and Clear) appear; a new row is a scrubbed copy at the next free index
   (indices are a rendering detail, so gaps after a delete are fine). `<wc-config-form>` stops adding
   blank rows itself once `wc-multifield[data-ready]` holds the row. The shared copy-and-scrub is
   `utils/repeat.ts`.

   **`<wc-color-field>` is the fourth element outside `elements.js`** (`@getvitops/core/color-field`,
   <1 KB gzipped). It wraps a colour text input (`data-widget="color"`, which is the fallback and the
   only submitted control) and offers the theme editor's `<wc-oklch-color-picker>` in a `<details>`.
   **The picker is a dynamic import, fetched when the details is first opened**: it is a Lit element
   over a colour-science library, ~40 KB gzipped, which a visitor who types a hex must not pay for. That
   split is also why Lit sits in a shared chunk (`chunks/BaseElement.js`); `verify-bundle-size`
   counts an entry's static chunks for that reason. `<ConfigForm colorPicker>` loads it.

   **`<wc-stepper>` is the third element outside `elements.js`** (`@getvitops/core/stepper`, ~1 KB
   gzipped, Lit-free), for budget rather than weight: `elements.js` sits at 99% of its ceiling, and a
   plain `HTMLElement` needs nothing from it. The fallback is a complete long form (headed
   `<section data-step>`s inside one `<form>`, `#anchor` links); the element shows one at a time and
   stops a forward move at the first invalid step. Its silent validity check is `validity.valid`, not
   `checkValidity()`, because that fires `invalid`, which the element itself listens for to reveal a
   hidden step.

   **How elements reach a page.** `elements.js` no longer bundles the elements. Each of the 21
   registered ones is its own entry, `dist/elements/<tag>.js`, generated from one table,
   `packages/core/src/js/element-tags.ts` (tag, source file, `dependencies`), which the build, the
   loader and `element-tags.test.ts` all read. Two entries use them. **`loader.js`** (default in
   `<Head />`, `componentLoading: 'auto'`) scans the document for undefined owned `wc-*` tags,
   imports just those modules, then each class's `static dependencies` (`wc-gallery` →
   `wc-carousel`: the lightbox is server-rendered markup around a carousel, not created at
   runtime), and keeps a `MutationObserver` for tags that arrive later. Late upgrade is not a new
   failure mode because the pre-upgrade state is the tier-2 no-JS fallback. Tags it does not own
   (`wc-consent`, which must load ahead of what it gates, and a site's own `wc-*`) are ignored, so
   nothing 404s. **`elements.js`** (`componentLoading: 'eager'`, and what the Bricks theme enqueues,
   since a builder re-renders markup constantly) loads every element at once, with no observer.
   Neither imports an element statically, which is what keeps each element's module self-contained;
   a page using one Lit element pays ~11 KB gzipped (Lit and `BaseElement`, shared) plus its own
   code, where it used to pay ~38 KB. The build also emits `elements/manifest.json`, and the Astro
   integration uses it to add `modulepreload` hints to **prerendered** pages for the elements each
   uses (loader, element, then Lit is otherwise a three-hop waterfall). The shared-chunk folder is
   `chunks/` (it was `polyfills/`, named for the first things that landed there). Add an element:
   an entry in `element-tags.ts`, a `static dependencies` if it hands off to another, and a
   `TIERS` row; the tests fail until all three agree.

   **Every element states its no-JS standing with a `@fallback` tag in its docblock:**
   `@fallback full <what it is>` (complete and usable with no JS, given its fallback markup),
   `partial` (works, degraded: say how) or `none` (a canvas or tooling control with no meaning
   without JS: stated, not excused; `wc-oklch-color-picker` is one, and `<wc-color-field>` is its
   text-input counterpart). Not `@requires`, which JSDoc already uses for modules. `TierWc.fallback`
   carries the same value into `components.md` and the docs table, and `tiers.test.ts` fails when an
   element lacks the tag or the two disagree.

   **Not registered in `elements.js`:** `WCOklchColorPicker` (`<wc-color-field>` imports it on first
   open) and `WCColorWheel` (with `utils/color-harmony.ts`: pick harmony colours by strategy, kept
   for the design-edit surface). `WCIconPicker` and `WCTypography` were deleted as unused.

   **Foundational components, built:** field, combobox, tabs, breadcrumbs, format and range (the slider).
   Each follows the tier-2 rule: the fallback is real and complete (`<input list>` + `<datalist>`; headed
   `<section>`s; a labelled `<ol>`; a `<time>`/`<data>` with the text already in it; one or two native
   range inputs), and the element only builds over it. `wc-tabs` hides each heading it turns into a tab
   label (the tab already names the panel; leaving it would announce the text twice). `wc-combobox`
   keeps what is typed even when it matches no option — it suggests, it does not constrain.
   `wc-range` coordinates two native inputs rather than replacing them, so form submission, validation
   and keyboard stay the browser's.

   **`<wc-notifications>` is in `elements.js`** (plain `HTMLElement`, light DOM, Lit-free): the one
   labelled `popover="manual"` region a page's notifications stack in, one per page in the same place.
   Its fallback is the slot: a server-rendered `.notification` with `role="status"` is an inline
   message with no JS and is adopted into the stack on upgrade. It never takes focus, pauses its
   countdown on hover and focus, holds notifications back while a modal dialog is open, and announces
   through `ariaNotify()` or the shared live region in `utils/announcer.ts`; the rules are in its
   docblock.

   **`<wc-field>` wraps a native control and is deliberately NOT form-associated.** The control it
   wraps already submits with its form, validates, takes focus and is in the accessibility tree; a
   form-associated host around it would submit twice or add nothing, and `delegatesFocus` is a
   shadow-root option where this is light DOM. Its fallback is a label that **nests** the control (no
   `id`/`for` to invent, so a generator can emit one field twice on a page). What it adds is what the
   platform can't do alone: `aria-describedby` to the help text and the error, an inline message in a
   polite live region once the control is left or a submit reports it (`:user-invalid`'s timing, and
   the native bubble still appears), `setError()` for a host validating against a schema (via
   `setCustomValidity`, so `reportValidity()` blocks submit; typing clears it), and a `maxlength`
   counter. Form association belongs on a composite with no single native input (a keyed map, a
   locale field); that is a separate element, and not built.

   **Foundational components not built yet** (`packages/core/src/js/elements.ts` used to carry this
   as a TODO docblock; moved here so it's a backlog, not a comment):
   - **Not a gap — Dropdown.** A dropdown is not a component: it is the native Popover API plus
     anchor positioning, which is how downstream apps already build them (`.dropdown--show-on-hover`
     in `patterns/dropdown.css` is the hover variant; `<Popover>` sets the anchor). Navigation
     menus follow the WAI-ARIA disclosure pattern, not `role="menu"`. A roving-tabindex menu
     component is an explicit later decision, not backlog.
   - **Markdown** — render/enhance markdown content client-side. Library unchosen.
   - **OTP** — segmented one-time-passcode input: auto-advance between digits, paste-splitting a
     full code across them. Fallback is a plain `<input>`.
   - **QR** — QR code generation/display.

   **Element display.** An unregistered custom element is `display: inline`, and most of these wrap
   block content, so before upgrade (or with `elements.js` absent entirely) the tag would form an
   inline box around a block child — and, where the upgraded `:host` declares a different display,
   registering would shift the layout. Each pattern's partial now declares `display` for its element
   inside `:where()`, matched to the content it wraps and to its upgraded `:host`: `block` for
   `wc-config-form`, `wc-color-field`, `wc-stepper`, `wc-entries`, `wc-image-compare`, `wc-split-panel`, `wc-multifield`, `wc-dismissable` (which
   animates its own box, so `display: contents` is out), `wc-marquee`, `wc-tabs` and `wc-range`;
   `inline-flex` (column) for `wc-combobox` and `inline-flex` for `wc-copy`; `flex` (column) for
   `wc-field`, matching `.form-group`.
   **`<wc-turnstile>`** (in `elements.js`) loads Cloudflare Turnstile on the first interaction with
   its `<form>`, so a visitor who only reads the page makes no request to `challenges.cloudflare.com`.
   Turnstile is treated as category `necessary` (it protects the form being submitted) and is
   therefore **not** behind the consent gate; it is a `wc-*` rather than an inline script because
   loading a third-party script on interaction is behaviour. Its slotted fallback says the spam
   check needs JavaScript; whether a token-less submit is accepted is `createConversionRoute`'s
   `turnstile.required`, not the element's. It declares `display: block` in `forms.css`.

   **`wc-counter` and `wc-format` are deliberately left `inline`**: `wc-counter` wraps one inline
   `.counter__value` `<span>` (its docblock's example) and `wc-format` one inline `<time>`/`<data>`,
   so the default display is already right for what they hold. `wc-format` has no stylesheet at all.
   `wc-color-scheme-toggle` and `wc-consent` manage their own visibility. A new element must declare
   its display in its pattern's partial — an element used inline would regress under a blanket
   `display: block`, so match the declaration to the content it wraps.

3. **Platform wrappers** (`@getvitops/astro` components; future `@getvitops/bricks`) — thin
   **authoring conveniences (DX)** for the pure-HTML/CSS patterns: they render the correct
   markup/classes so authors don't hand-write boilerplate, and they **must not require runtime JS**.
   - e.g. `Subgrid.astro` just emits `<ul class="grid"><li class="grid-rows-subgrid">…</li></ul>` from
     slotted children; `Popover.astro` uses the native Popover API + Anchor Positioning;
     `Nav`/`Details`/`Drawer` compose `<details>` + Invoker Commands (`command`/`commandfor`) — all
     no-JS. Renderers like `NodeRenderer` turn a data model into that markup at SSR time. (A
     `FormRenderer` once lived beside it as part of a broader site-model layer — `Nav`/`Submenu`/
     `Template`/`ContentInfo`/`SEO`/`Layout` — deleted 2026-07-27 for binding to a `#site-config`
     specifier defined nowhere; see `packages/astro/AGENTS.md`'s "no site-model layer" section for
     the rules a rebuild would have to follow. `site.templates` entries of type `form` currently
     have no renderer — their only consumer is the legal PII inventory, `legal/derive.ts`.)
   - **The rule:** if a wrapper would need runtime JS, it's the wrong tier — build a **web component**
     (tier 2) instead, and have the wrapper emit its `<wc-*>` tag with the accessible fallback inside.
     A feature-detected polyfill for a native CSS/HTML feature is fine; application/behaviour JS is not.

**The one deliberate exception: `<wc-theme-editor>`** (`@getvitops/core/editor`). It is _tooling_, not
a page pattern — a live editor has no accessible no-JS fallback to enhance, so it fails the tier-2 bar
on purpose. It is quarantined instead of excused: its own bundle entry (`src/js/editor.ts` →
`dist/editor.js`), never registered in `elements.js`, opt-in per consumer
(`vitops({ editor: true })`), and carrying no Lit, so a production page that doesn't ask for it
pays nothing. Don't use it as precedent for putting behaviour JS in a `<wc-*>` element.

### The tier manifest, and its two opposite projections

**`TIERS` (`packages/generator/src/tiers.ts`) is the single source for which tiers provide each
pattern** — CSS partial + representative classes, `wc-*` tag + which bundle it ships in, Astro
component(s), Bricks element, and one `use` line saying what to write. `tierPatterns(tier)`
projects one tier; every renderer goes through it so the surfaces can't disagree about membership.

**Authored, not derived, and drift-guarded instead** (`tiers.test.ts`). Naming convention carries
most of it and breaks where it matters — `splitter.css` hosts two components, `tag.css` serves
three config patterns, `layout.css` provides `.split` and `.centered` — so a derivation needs an
exceptions table longer than the rule, and a rename silently drops a link. The guards make omission
a **build failure**: every hand-written partial, `customElements.define`, exported Astro component
and Bricks element must be accounted for, `registered` must match what `js/elements.ts` imports,
and every Astro specifier must be a real export of `@getvitops/astro` (that one caught
`components/../CookieConsent.astro` — right basename, not importable).

**The two projections are deliberately opposite shapes, and that is the whole design:**

| Audience | Shape                             | Where                                               |
| -------- | --------------------------------- | --------------------------------------------------- |
| agents   | **one** doc, every tier together  | `concepts/components.md` → `vitops docs components` |
| humans   | **four** pages, one per _surface_ | `site/src/pages/components/`                        |

**Four pages, three tiers**, and the difference is load-bearing. `Tier` is a projection axis with
four keys (`css` `wc` `astro` `bricks`) because there are four tables to render; that is not four
levels. Astro and Bricks are both **tier 3** — platform wrappers that generate HTML from the
classes and elements of tiers 1 and 2, siblings chosen by platform, never ranked against each
other, and no project uses both. Anything that renders a tier _number_ must map them to the same
one: the docsite derived it from array position and so published Astro as tier 3 and Bricks as
tier 4, implying a rank and a fourth level to climb to. `TIER_LEVEL` in
`site/src/components/tiers.ts` is now that mapping.

An agent arrives knowing the _pattern_ it needs and must be told which tiers offer it **and how
they compose** — so splitting it would let an agent read the Astro page, learn `<Tree />` exists,
and never learn it must not wrap it in `<wc-tree>`. A human arrives knowing their _stack_ and wants
one tier's list, so the cross-tier rules live in that section's overview prose instead. Because
both render from `TIERS`, neither can drift. `concepts/components.md` is therefore in
`sync-reference.mjs`'s `RENDERED_ELSEWHERE`, not `PAGES` — carrying it as markdown too would
publish a fifth page saying the same thing in a worse shape.

Note `css.generated` is a fact about **this repo's reference config**, not a consumer's, so the
docs check each config-authored pattern against the config being rendered and say when one is
absent — naming classes a consumer's build emits nothing for is worse than omitting the row.
