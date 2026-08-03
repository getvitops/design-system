# @getvitops/generator

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

- bf453b0: `getvitops({ fonts })` — load webfonts through Astro's Fonts API instead of hand-rolling it.

  The design system names fonts and loads none of them, and there was no seam for the loading half —
  so the only available path was installing a `@fontsource*` package and importing its CSS, which
  renders correctly while silently giving up subsetting, preload, and the `size-adjust` /
  `ascent-override` fallback metrics. That is a CLS regression that looks like a working setup. This
  is the counterpart to `vitopsHosting()`: declare the family, let the integration wire it.

  ```js
  getvitops({
    fonts: [
      {
        name: 'League Spartan',
        provider: 'fontsource',
        cssVariable: '--font-league-spartan',
        weights: ['100 900'],
        subsets: ['latin'],
        preload: true,
      },
    ],
  });
  ```

  ```jsonc
  // design-system.json — the token points at the variable, not at a literal stack
  "fonts": { "display": "var(--font-league-spartan), sans-serif" }
  ```

  `fonts` also takes a **string**: the path to a site config, whose `fonts` array has carried exactly
  these declarations (provider / weights / subsets / preload) since it was written — nothing had ever
  read it. Or `{ input, families, siteEnv }` for both.

  `<Head />` now emits `<Font />` for each declared family, with `preload` driven by the declaration.
  That half is not optional: Astro's `fonts:` config resolves the files, but `<Font />` is what puts
  the `@font-face` on the page, so a declaration without `<Head />` in your layout loads nothing.

  Notes:
  - Independent of `css` — the wiring runs in `astro:config:setup`, not the Vite plugin.
  - Only families declared here get a `<Font />`. One from your own `astro:config` `fonts:` array or
    from another integration is left alone, because `<Font />` throws on a `cssVariable` Astro cannot
    resolve. Astro concatenates the arrays, so the three coexist; two entries claiming one variable
    is the collision that matters, and it now throws (within our set) or warns (against yours)
    instead of silently dropping a family.
  - `provider: 'adobe'` throws with instructions: `fontProviders.adobe({ id })` needs a key from the
    environment, and a JSON declaration has nowhere to hold one.
  - New exports from `@getvitops/generator`: `SiteFontSchema` and the `SiteFont` type.

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

- bf453b0: Reject palettes whose ramps don't darken from 50 to 950.

  Anchors and `tones` are the one thing allowed off the shared lightness ladder — that is the point of
  them. But nothing checked the result was still ordered, so an anchor could put a step _above_ the
  one below it. Anchoring a navy at 600 gave `600 #2c3b4e` (L 0.348) sitting above `700 #4e5c6f`
  (L 0.470): every hover from `bg-<role>-solid` to `-solid-bold` then got **lighter**, which is the
  exact class of drift the fixed ladder was introduced to eliminate.

  Nothing caught it. `ladderWarnings` compares each pinned step against _its own_ ladder rung, never
  against its neighbours — so it warned about the deviation, called the ramp "Legal", and described
  the wrong defect. And since its tolerance (0.03) is the same size as the ladder's own 50→100 gap,
  two anchors could each sit within tolerance and still invert with no warning at all. The one test
  covering monotonicity built its palette from anchor-free seeds, so it never exercised the path.

  The build now fails, in the same place and for the same reason as the contrast contract: the order
  is load-bearing (`snap` picks the nearest step by ladder lightness, the mode-stable solid family
  hard-codes 600/700/800, the dark tables re-point steps on the same assumption), and an inversion is
  always author-caused and therefore always actionable. The message names the pair, the consequence,
  and where the colour you wrote actually belongs:

  ```
  colors.palette.navy: step 700 (#4e5c6f, L 0.470) is LIGHTER than step 600 (#2c3b4e, L 0.348).
    A ramp must darken from 50 to 950 — inverted, a hover from `bg-<role>-solid` to `-solid-bold`
    gets lighter, and the dark-mode tables re-point steps assuming the order.
    #2c3b4e (pinned at 600) sits at L 0.348, nearest step 800.
  ```

  Sparse `tones` kits are compared over present steps only, and gamut-mapping noise is tolerated, so
  neither reports a false inversion. `ladderWarnings` is unchanged and still a warning.

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

- bf453b0: `validate()` now rejects what the published JSON Schema already rejected.

  Runtime validation and `schema.json` derive from the same zod schema, but they disagreed:
  `toJSONSchema` emits `additionalProperties: false` in 16 places, while a plain `z.object` _strips_
  unknown keys at runtime. An editor honouring `$schema` therefore flagged configs that
  `vitops validate` called `✓ valid` — and the keys it waved through were being silently discarded at
  generate time, which is exactly when you want to hear about them.

  The worst case was a palette hue carrying both `seed` and `tones`: it validated, and the `tones`
  were then ignored, so the authored brand colours simply never appeared.

  **This is a breaking change for configs that were already wrong.** A config with a stray or
  misspelled key now fails instead of silently dropping it. Both design systems this was tested
  against (a live client site and the vitops site itself) validate unchanged.

  Error messages got the attention too — a failed union previously reported a bare `Invalid input`
  that named neither key:

  ```
  colors.palette.brand: a hue is either seeded (`seed`, with optional `anchors`) or fixed
    (`tones`) — not both. Drop one: with both present the `tones` are ignored at generate time.
  colors.palette.brand: unknown key "anchor". A hue takes `seed` + optional `anchors`, or `tones`.
  spaceScale: unknown key "nope" — not part of the schema, so ignored at generate time.
  ```

  Note the site config (`resolveSiteConfig`) still strips unknown keys; aligning it is tracked
  separately.

### Patch Changes

- bf453b0: Fix a filled CTA's text turning dark on hover.

  `<a class="cta">` and every `.cta-<role>` variant flipped from their `text-on-<role>` foreground to
  the link colour while hovered — dark green text on a dark green button. The declaration was always
  right; it was being out-cascaded.

  Element patterns (`link`, `btn`) wrap their selector in `:where()` so any explicit class beats them
  without `!important`. But the state pseudo was appended **outside** that wrapper, and a pseudo-class
  outside `:where()` still carries weight — so `:where(a, .link):hover` was 0-1-0, exactly tying
  `.cta-brand-primary`, and won on source order because `link` is emitted after `cta`. The pseudo now
  goes inside: `:where(a:hover, .link:hover)` is a true 0-0-0 and loses to any class, which is what the
  resting rule already promised.

  This affects any element pattern layered under a class pattern — `<a class="cta">`, `<a class="badge">`,
  `<button class="cta">` — in the `css` and `bricks` formats. Nothing else about the emitted rules
  changes. If you worked around it with a hand-written `color` override on a CTA, you can drop it.

- bf453b0: Say plainly that `fonts` in `design-system.json` is stacks only and loads nothing.

  The field's description was complete and self-consistent — "raw font stacks by name, emitted as
  `--font-<name>` tokens" — and told you nothing about where the `@font-face` comes from. Following
  it literally leads to installing a `@fontsource*` package and importing its CSS in a layout, which
  renders correctly and silently gives up subsetting, preload, and the `size-adjust` /
  `ascent-override` fallback metrics: a CLS regression that looks like a working setup.

  The field is unchanged. What changed is that four surfaces now name the boundary and point at the
  fix — declare the family in Astro's `fonts:` config and point the token at its `cssVariable`:
  - the `fonts` description in the JSON Schema, and therefore `vitops docs authoring`
  - `SKILL.md`, which previously never mentioned fonts at all
  - the generated `tailwind.css` header and its `@theme` fonts comment
  - the generated `type-tokens.css` header (css format)

- bf453b0: `vitops lint` now catches hand-written CSS that re-implements a framework primitive.

  The existing linter finds classes that resolve to nothing — you named something and it isn't there.
  This is the costlier inverse, where the code **works**: a centred container written by hand, a
  two-column split behind a media query, a flex row. Nothing is broken, so nothing ever surfaces it,
  and the design system quietly stops being where those decisions live.

  Three rules to start, each requiring the combination that makes the intent unambiguous
  (`margin-inline: auto` alone is not a centred track):

  | Found                                                       | Suggested                                                                 |
  | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
  | `max-inline-size: var(--width-*)` + `margin-inline: auto`   | `.centered`, widening a child with `breakout` / `spotlight` / `fullbleed` |
  | `grid-template-columns: 1fr 2fr` inside a `min-width` query | `md-split-1-2` — or `@md:split-1-2` in the tailwind format                |
  | `display: flex` + `align-items: center`                     | `flex items-center`, or `.cluster-start`                                  |

  **Findings now carry a severity, and suggestions do not fail the command.** These are judgement
  calls, and a reuse hint that broke CI on the day it shipped would be a worse defect than the drift it
  reports. `--strict` promotes them for anyone who wants the ratchet. Everything the linter reported
  before is an `error` and still exits 1.

  `.css` files and `<style>` blocks are now read (the class linter only ever looked at markup). The
  generated stylesheet is skipped by its `GENERATED … do not edit by hand` banner rather than by path —
  the `css` format writes `styles.css` into `src/styles`, squarely inside what `--src` scans, and
  linting it made the framework report `.split` as reinventing `.split`.

  Two other gaps closed:
  - **The format-spelling check ran in one direction only.** `md-split-1-2` in a tailwind project was
    caught; `@md:split-1-2` in a css/bricks project was not, because variant stripping removed the
    `@md:` regardless of format and left a bare class that matched nothing. The same silent no-op, in
    the other direction, unreported. Stripping is format-aware now.
  - **`grid-auto` and the whole `m-*` rhythm family were missing from the tailwind format entirely** —
    not dropped via `TW_CLASH`, just never re-emitted when `layout.css` is skipped and a subset
    re-emitted in its place. Unlike the `<bp>-` classes they have no Tailwind equivalent, and unlike a
    misspelt class the linter cannot flag them, because they aren't anchored to your config. They emit
    as `@utility` definitions now, keyed to the same `--rhythm-*` variables as the css format.

  Run against this repo's own docs site, the rules found one real instance on the first pass; it is
  fixed in the same change.

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

- bf453b0: Warn on unrecognised `typography.roles` keys, and stop the schema documenting two that never worked.

  The role key set is closed, and an unrecognised key is **dropped** — the role still renders, just
  without the declaration you asked for. The schema description made that worse in two directions at
  once: it advertised `transform` and `decoration`, when the generator only accepts `text-transform`
  and `text-decoration`, and it claimed unknown keys were "passed through" when they are discarded. So
  the two documented short forms were exactly the two that silently did nothing. In one case that
  shipped title-case navigation to production across two deploys.

  The behaviour is unchanged — unknown keys are still ignored, because `transform` is a real CSS
  property and emitting it would break layout rather than do nothing. What changed:
  - the generator now warns per role and key, naming the intended spelling where there is an obvious
    one (`transform` → `text-transform`, `letter-spacing` → `tracking`, `font-size` → `size`, …) and
    otherwise listing the recognised set;
  - the schema description names the real keys and says unrecognised ones are ignored, which
    propagates to `vitops docs authoring` and to editor hovers.

  Recognised keys, for reference: `family`, `size`, `weight`, `style`, `line-height`, `tracking`,
  `text-transform`, `text-decoration`, `text-wrap`, `color`.

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

### Minor Changes

- bb92a14: **Base page typography can now be bound to a type role, and the live editor's Body controls work.**

  `typography.headings` was documented as an h1…h6 map, but the key has always been used verbatim as
  a selector. Mapping `"body"` to your prose role now binds base page typography to that role:

  ```jsonc
  "typography": {
    "headings": { "body": "body", "h1": "display", "h2": "heading" }
  }
  ```

  The generator emits `body { font-family: var(--body-ff, …); line-height: var(--body-lh, …); … }`,
  so prose inherits the role and the role's tokens become the single place it is edited.
  `defaultConfig()` includes the binding; existing configs are unaffected until they add it.

  This is what made `<wc-theme-editor>`'s **Typography → Body** controls appear dead. They set
  `--body-lh` and friends on `:root`, but only `.font-body` read them — page prose was styled by
  hand-written `body { line-height: 1.55 }` rules that consumers had to write precisely _because_ the
  framework offered no binding. If you keep such a block, drop the properties the role now owns:
  restating them shadows the role's tokens, and because that CSS is typically unlayered it wins.

  **Fixed: typography edits that previewed live and were dropped on save.** The design manifest's
  `reverseIndex` only mapped hooks a role explicitly declared, while the editor renders a control for
  every hook. Editing a property the role omitted (`--body-ls`, `--body-tt`, …) updated the page and
  then silently vanished from the `design-system.json` patch. Every hook of every role is now indexed.

  **Added: `validate()` warns when a shadow value can't survive `drop-shadow()`.** A `--shadow-<name>`
  token feeds both `box-shadow` (pattern geometry) and `filter: drop-shadow(…)` (the
  `.drop-shadow-<name>` utilities and the `shadow:` state shortcut). `drop-shadow()` accepts a single
  layer of at most three lengths — a spread radius, a second comma-separated layer or `inset`
  invalidates the whole `filter`, so the utility renders **no** shadow while the token still looks
  correct everywhere it is authored. Keep shadow values in that intersection.

- bb92a14: Add a fourth output format, `design`, that emits `DESIGN.md` — the agent-facing brief in
  [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format.

  ```sh
  vitops generate --format design --out .     # DESIGN.md, and nothing else
  vitops generate --format css,design         # compose it with a stylesheet
  ```

  The file is YAML front matter carrying the tokens (`colors`, `typography`, `rounded`,
  `spacing`, `components`, cross-referenced with `{group.token}`) followed by a prose body
  carrying the rationale — colour model, fluid scales, layout vocabulary, elevation, shape
  cascade, component tiers, do's and don'ts. Every section is rendered from your config, so
  it cannot describe a system the other formats don't build. Point a coding agent, a Figma
  import, or a designer at this one file when they don't have the toolchain; `vitops docs`
  remains the richer reference for those who do.

  It is emitted with `--out .` in mind: DESIGN.md conventionally lives at a repo root beside
  `AGENTS.md`, not in a build directory.

  Three things the spec cannot express, handled the same way every time and explained in the
  emitted prose so the file is self-describing:
  - **Fluid `clamp()` sizes** → the maximum (desktop) value, since a spec `Dimension` is a
    bare number plus px/em/rem.
  - **Dark mode** → light values only, with the automatic functional flip explained. Role
    tokens are emitted as `{colors.<hue>-<step>}` references into the raw ramps rather than
    flattened hexes, so the role → ramp lineage survives the export — flattening them is
    exactly what breaks dark mode downstream.
  - **A `50%` radius** → dropped from `rounded` (it is not a `Dimension`) and named in the
    Shapes prose instead, so nothing is silently lost.

  **New:** an optional `meta` key in `design-system.json` (`{ name, description }`) supplies
  the brand name and the Overview paragraph. It affects no other format.

  **New:** `StylesheetFormat` (`Exclude<Format, 'design'>`), exported from
  `@getvitops/generator`. `@getvitops/astro`'s `css.format` now takes that narrower type —
  `design` produces no stylesheet to inject, so passing it there is a type error rather than
  a missing-file failure at build time. `vitops lint --format` is likewise restricted to the
  three CSS formats. No change for anyone already passing `tailwind`, `css` or `bricks`.

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

- eeb059f: **A pattern's fill can now be undone — flat, border-only cards.**

  `background` was the only `base` property with no per-pattern override hook. Every other one had
  `--p-card`, `--br-card`, `--b-card`, `--ds-card`; the background was hard-wired, so a flat card
  meant an inline `style="background: transparent"` rather than the documented mechanism.

  Two additions:
  - **`background` and `background-color` join `BASE_HOOK`**, both mapping to `bg`, since patterns
    author either spelling. `.card` now emits
    `background: var(--bg-card, var(--surface-bg))`. This also covers the fill the generator
    _injects_ for a `default_role` pattern, so `.cta` gets `--bg-cta`.

    Role variants (`.card-danger`) are emitted as separate rules and stay unwrapped, so tuning
    `--bg-card` adjusts the default fill without silently defeating them.

  - **`bg-transparent` and `bg-inherit` utilities** in the `css` and `bricks` formats. Neither is
    derived from the palette, so neither the generated scale nor Bricks' palette import produced
    them. The `tailwind` format deliberately emits neither — Tailwind ships both as built-ins, the
    same deferral it makes for the `TW_CLASH` names.

  ```html
  <!-- via the hook — set it anywhere, including :root for every card -->
  <div class="card" style="--bg-card: transparent; --ds-card: none">…</div>

  <!-- or compose the utility, which is what most authors will reach for -->
  <div class="card bg-transparent" style="--ds-card: none">…</div>
  ```

  There is no utility for the shadow, so `--ds-card: none` is how you drop it in every format.

  These hooks also reach the live theme editor: `--bg-card`, `--bg-btn` and `--bg-status` now
  appear in `design-manifest.json`'s reverse index, so pattern backgrounds are tunable in the
  browser alongside their geometry.

### Patch Changes

- Updated dependencies [bb92a14]
  - @getvitops/utils@1.0.0

## 0.9.0

### Minor Changes

- **The `tailwind` format now emits the full role colour vocabulary.** It previously emitted only
  the functional role utilities, so 87 classes — `bg-<role>-x-muted`, `bg-<role>-bold`,
  `bg-<role>-x-bold`, `text-<role>-bold`, `text-<role>-x-bold`,
  `border-<role>-{muted,x-muted,x-bold}`, for every role — existed in the `css` and `bricks`
  outputs and silently did nothing in `tailwind`. Nothing in the test suite built the tailwind
  format, so the divergence was invisible; it was found by a consumer who hand-forked four
  background planes into their own stylesheet to work around the absence.

  All three formats now render from one emitter (`roleColorUtilities()`), which resolves the
  plane-vs-stop namespace collision explicitly instead of relying on the CSS minifier dropping a
  shadowed rule. No class changes meaning, and the `css`/`bricks` output is unchanged.

  Also fixed in the tailwind format:
  - `colors.utilities` is now honoured. It was hardcoded to `bg`/`text`/`border`, so enabling
    `outline`/`fill`/`stroke` worked in `css`/`bricks` and was ignored here. (For raw hue scales
    it remains a floor rather than a ceiling — those are `@theme` colours, and Tailwind derives
    every colour family from them on demand.)
  - **Component container queries are no longer stripped.** The pass that drops the framework's
    pre-expanded `md-*` breakpoint utilities (Tailwind regenerates those as `@md:`) matched every
    `@container (min-width: …)` block, including component behaviour — most visibly the
    sitenav's, so `.sitenav--bp-{sm,md,lg,xl}` were removed and the nav stayed in its mobile
    layout at every width.

  New: **`vitops lint`** reports framework classes in your source that resolve to nothing — the
  failure mode where an unknown utility looks exactly like a working one. It is format-aware
  (`md-flex-row` is a real class in `css`/`bricks` and inert in `tailwind`) and only judges
  classes anchored to your own config, so it stays quiet on Tailwind's utilities and your own.

  ```
  vitops lint --format tailwind --src src
  ```

- **The `css` and `bricks` bundles now ship cascade layers, so a utility can override a pattern.**

  `class="card bg-danger-muted"` previously tinted the card in the `tailwind` format and silently
  did nothing in `css`/`bricks`: every colour utility was emitted before every pattern and both sat
  at `0-1-0`, so the pattern won on source order. The bundle now emits

  ```css
  @layer vitops.base, vitops.components, vitops.utilities;
  ```

  - `vitops.base` — the UA reset and the pure `:root` token blocks
  - `vitops.components` — the animation engine, structural layout, and every pattern
  - `vitops.utilities` — `bg-*`, `text-*`, `border-*`, `drop-shadow-*`, `font-*`, animation
    effects, and the display/`sr-only` families

  No rule changed — 1482 rules before, 1482 after — only precedence.

  **What this changes for you.** Unlayered CSS beats every cascade layer regardless of specificity,
  so your own stylesheet, an Astro scoped `<style>`, or a Bricks-authored class now overrides the
  framework with no `!important` and no specificity escalation. That is the intended override story
  and the reason to layer at all.

  **Migration — only if you ship a reset.** An unlayered reset will now beat the framework
  component rules it used to lose to; a bare `p { margin: 0 }` defeats `.rhythm`. Put it in a layer
  and declare the order **before** the stylesheet loads:

  ```html
  <style>
    @layer my.reset, vitops.base, vitops.components, vitops.utilities;
  </style>
  <link rel="stylesheet" href="/styles.css" />
  ```

  Declaring it _after_ the link makes `my.reset` a name introduced later, which sorts **last** —
  highest priority — and the reset wins anyway. That ordering rule is the one non-obvious step.

  The `tailwind` format is byte-identical. Its utilities are `@utility` definitions, which Tailwind
  already places in a layer above `components` and which are what make `hover:`/`@md:` variants
  work; wrapping them ourselves would win the cascade and lose the variants.

  Known gap: `layout.css` mixes structural rules (`.rhythm`, `.centered`) with utilities (`.m-*`,
  `.flex`, `.split-*`) in one partial, so it sits in `vitops.components` whole and its utility half
  cannot yet override a pattern. Splitting it is tracked separately.

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

- Docs now name both dark-mode attributes. The generated colour docs still described the
  dark flip as hanging off `:root[data-brx-theme="dark"]` alone, from before the selector
  also matched `:root[data-theme="dark"]` (the attribute `<color-scheme-toggle>` writes) —
  so a non-Bricks consumer reading `vitops docs color` would wire up an attribute that
  nothing matches. The selector moved into `shared.ts` as `DARK_SEL` (also exported from
  the package index) and the docs interpolate it, so the two can't drift again.
- c949cae: `vitops init` no longer scaffolds a config that warns on its own output.

  `defaultConfig()` declared `patterns.radii.card`, a key named after the `card` pattern — the exact
  collision `validate()` started reporting in 0.8.0. The primitive won `--br-card`, shadowing the
  pattern's override hook and leaving its `--br-card-group` alias unreachable, so a scaffolded project
  was warned about a config it had just been given.

  The key is dropped. This is **value-preserving**: `card` belongs to the `panel` group, which already
  carries the same `0.5rem`, so `--br-card-group` → `--br-panel` → `0.5rem` renders identically.

  **Migration:** none for existing configs — your `design-system.json` is not touched. If you copied
  the scaffold and reference `var(--br-card)` directly in hand-written CSS, note it is now an
  _override hook_ (undefined until you set it) rather than a defined primitive; read `--br-card-group`
  instead, or keep your own `radii` key under a name no pattern uses.

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

### Minor Changes

- 2cc847d: Package-resident agent skill + `vitops docs`:
  - `@getvitops/cli` now ships the `vitops-design-system` agent skill inside the package
    (`skill/SKILL.md`). `vitops agents` no longer emits a generated skill into the repo — it
    symlinks `.agents/skills/` and `.claude/skills/` entries to the installed package (logical
    `node_modules/@getvitops/cli/skill` target, surviving version bumps) and writes the
    AGENTS.md pointer block. Old generated-skill directories are migrated automatically;
    `--docs-dir` keeps the emit-files layout.
  - New `vitops docs [topic]` command prints reference docs to stdout, rendered live from the
    project's `design-system.json` (topics: classes, authoring, formats, color, scales,
    patterns, elements; `--all` concatenates).
  - `renderSkill()` removed from `@getvitops/generator` (superseded by the packaged skill).

### Patch Changes

- @getvitops/utils@0.6.0

## 0.5.0

### Minor Changes

- Ship design-system context to downstream agents:
  - JSON Schema descriptions: every `design-system.json` and site-config field now carries a
    `description` (authored in the zod schemas via `desc()`), emitted into `schema.json` /
    `site.schema.json` for editor hovers and agent consumption.
  - New generated OKF docs: `authoring.md` (field reference walked from the JSON Schema),
    `formats.md` (tailwind vs css vs bricks, including the TW_CLASH utilities Tailwind
    provides natively), and `concepts/{color,scales,patterns}.md` (seeded OKLCH colour
    system, fluid modular scales, pattern token cascade + override hooks).
  - `vitops agents` now emits a generated `vitops-design-system` agent skill into
    `.agents/skills/vitops-design-system/` (SKILL.md + the docs bundle as `references/`,
    with an idempotent `.claude/skills/` symlink) and writes a compact pointer block into
    `AGENTS.md`. Pass `--docs-dir` for the legacy docs-only layout.
  - `TW_CLASH` and `BASE_HOOK` are exported from `@getvitops/generator`.

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

- d28aae7: Fix Tailwind output: the `.centered > *` default (`grid-column: measure`) was emitted unlayered,
  which in Tailwind v4 outranks every layer — so track utilities (`.spotlight`/`.breakout`/
  `.fullbleed`) never overrode it and all `.centered` children fell back to `measure`. Emit the
  structural rules (and the animation engine + patterns) in `@layer components` so the track/spacing
  `@utility` classes (utilities layer) win.
  - @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- Redesign the colour system: seeded OKLCH tonal scales plus functional semantic tokens
  (`bg`/`text`/`solid`/`on-solid`, `muted`/`bold`), with named-alias back-compat. Updates the
  framework CSS, the schema, and the generated docs to the new token model.

### Patch Changes

- @getvitops/utils@0.2.0
