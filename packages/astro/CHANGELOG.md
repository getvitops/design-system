# @getvitops/astro

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
- Updated dependencies [b115993]
  - @getvitops/generator@3.0.0
  - @getvitops/utils@3.0.0
  - @getvitops/core@3.0.0
  - @getvitops/vite@3.0.0

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

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/generator@2.1.0
  - @getvitops/utils@2.1.0
  - @getvitops/vite@2.1.0
  - @getvitops/core@2.1.0

## 2.0.0

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

- feae1a3: `<Seo />`: `titleTemplate` now applies to `<title>` only — `og:title` and `twitter:title` get the
  untemplated page title.

  A social card is self-contained and already shows `og:site_name` and the domain, so the templated
  value put the brand on screen twice: `og:title="Installation · Acme"` sitting directly above
  `og:site_name="Acme"`. `<title>` keeps the suffix, because a browser tab or a search result has
  nothing else to disambiguate it.

  ```html
  <!-- before -->
  <title>Installation · Acme</title>
  <meta property="og:title" content="Installation · Acme" />
  <meta property="og:site_name" content="Acme" />

  <!-- after -->
  <title>Installation · Acme</title>
  <meta property="og:title" content="Installation" />
  <meta property="og:site_name" content="Acme" />
  ```

  Adds an `ogTitle` prop for pages that want a genuinely different social headline, and exposes the
  resolved value as `socialTitle` on `resolveSeo()`'s return. Nothing changes for sites that don't set
  `titleTemplate` — the two values are identical there.

### Patch Changes

- bf453b0: Fixed: a site on `css.format: 'css'` failed to build because of Tailwind.

  `getvitops()` loads `@tailwindcss/vite` lazily, so a project that never sets `css.format:
'tailwind'` should never touch it. But the specifier was a literal, which makes it statically
  analysable — so the bundler **followed** the import regardless of the branch ever running, down
  through `@tailwindcss/node` to `@tailwindcss/oxide`'s native `.node` binding, which it cannot parse.
  The build died on `[UNLOADABLE_DEPENDENCY] … stream did not contain valid UTF-8`, naming a package
  the project does not use and never asked for.

  The specifier now goes through a constant with `/* @vite-ignore */`, matching how the other
  optional peers in that file (`astro-icon`, `astro-iconset`) were already loaded. Optional has to
  mean optional to the bundler too.

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
- Updated dependencies [bf453b0]
  - @getvitops/generator@2.0.0
  - @getvitops/core@2.0.0
  - @getvitops/vite@2.0.0
  - @getvitops/utils@2.0.0

## 1.0.0

### Minor Changes

- fd1a35b: Add `<Seo />` — page metadata for non-EmDash sites: `<title>`, description, canonical, Open Graph,
  Twitter cards, robots, `article:*`, `hreflang` and verification tokens.

  Site-level defaults go in the integration; pages pass only what differs.

  ```js
  // astro.config.mjs
  vitops({
    seo: {
      siteName: 'Acme',
      titleTemplate: '%s · Acme',
      defaultDescription: 'We make the thing.',
      openGraph: {
        locale: 'en_CA',
        image: { url: '/og.png', alt: 'Acme', width: 1200, height: 630 },
      },
      twitter: { site: '@acme' },
    },
  });
  ```

  ```astro
  ---
  import Seo from '@getvitops/astro/Seo.astro';
  ---
  <Seo title={title} description={description} image={cover} />
  ```

  **`<Seo />` owns `<title>` and `<meta name="description">` — remove them from your layout when you
  adopt it.** It already computes the resolved title for `og:title`/`twitter:title`, and emitting those
  in one place while the layout emits `<title>` in another is how the two drift apart. `<Head />` is
  unaffected and still handles favicons, theme-color and the web-component runtime; use both.

  Notable behaviour:
  - `titleTemplate` is skipped when a page's title already equals `siteName`, so a homepage titled
    "Acme" emits `Acme` rather than `Acme · Acme`. It never applies to `defaultTitle`.
  - Canonical, `og:url` and relative `og:image` values need the `site` astro.config option. Without it
    they're omitted rather than derived from the request URL — a canonical built from a dev or preview
    origin can de-index you — and the integration warns at build time. Absolute image URLs still work.
  - `robots` is omitted unless it says something; `index, follow` is what crawlers already assume. Use
    `noindex`/`nofollow`/`noarchive`/`nocache`/`robotsExtras` per page, `robots` for a full override, or
    `seo.robots` site-wide.
  - `twitter:card` upgrades to `summary_large_image` whenever an image resolves.
  - `hreflang` alternates are explicit only — pass `alternates`, including the current page. Nothing is
    inferred from a locale list.
  - No JSON-LD. The `./schemas/*` components take entity data and compose alongside it.

  **On an EmDash site use `<EmDashHead>` instead** — it emits the same tags from the CMS, and rendering
  both duplicates every one of them. The integration warns if `seo` is configured alongside `emdash()`.

  The merge logic ships as the pure `resolveSeo(defaults, props, ctx)` if you need to drive it yourself.

- 20252c2: Add an opt-in `sitemap` option to `getvitops()`, and link the result from `<Head />`.

  `sitemap: true` registers the official `@astrojs/sitemap` for you; pass an object to configure it
  (`filter`, `customPages`, `changefreq`, `priority`, `i18n`, `entryLimit`, `filenameBase`,
  `serialize`, …). `<Head />` gains a matching `<link rel="sitemap">`.

  ```js
  getvitops({ sitemap: true });
  getvitops({ sitemap: { filter: (page) => !page.includes('/draft/') } });
  ```

  `@astrojs/sitemap` is an **optional peer** — install it yourself (`pnpm add -D @astrojs/sitemap`) and
  the build fails with a message saying so if you don't, rather than silently emitting nothing. The
  option also needs the `site` astro.config option, since a sitemap lists absolute URLs; without it the
  option warns and skips. Note `@astrojs/sitemap` enumerates **prerendered** routes only, so on an
  `output: 'server'` site you'll want `export const prerender = true` on the pages you want indexed, or
  `sitemap.customPages`.

  **On an EmDash site, leave it off** — EmDash serves its own database-driven `/sitemap.xml`, which also
  covers on-demand pages a static sitemap can't. The option detects `emdash()` and skips with a warning.
  If you want both, add `sitemap()` to your own `integrations` array; getvitops detects that too and
  leaves yours in charge, which is also how you reach the few `@astrojs/sitemap` options this
  integration doesn't mirror.

  Also fixes the `virtual:getvitops/head` type declaration, which was missing the `editor` field that
  `<Head />` already reads — a type error in consumer projects that don't set `skipLibCheck`.

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

### Patch Changes

- bb92a14: Docs: import the Astro integration as `vitops`, and document the fourth output format.

  Every example now reads `import vitops from '@getvitops/astro'` and calls `vitops({ … })`,
  including the scaffolded `emdash` template. The default export is unchanged, so this is a
  naming convention in the docs rather than an API change — existing configs that bind it as
  `getvitops` keep working.

  The `@getvitops/generator` and `@getvitops/cli` docs also describe the `design` format, which
  was shipped without a mention in either package's output table: `--format design` writes a
  single `DESIGN.md` and no CSS, so a run that composes it with a stylesheet wants its own
  `--out` (the brief conventionally sits at a repo root, the stylesheet does not).

- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [eeb059f]
  - @getvitops/generator@1.0.0
  - @getvitops/vite@1.0.0
  - @getvitops/utils@1.0.0
  - @getvitops/core@1.0.0

## 0.9.0

### Minor Changes

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

- **`tailwindcss` and `@tailwindcss/vite` are now optional peer dependencies, not dependencies.**

  Only `css.format: 'tailwind'` ever used them, but every consumer installed them — including
  `'css'` and `'bricks'` projects that never touch Tailwind. The integration now loads
  `@tailwindcss/vite` lazily inside that branch and throws a directive error if it is missing.

  **Migration:** if you use `css.format: 'tailwind'` (the default), add both to your
  `devDependencies` — `pnpm add -D tailwindcss @tailwindcss/vite`. Most Tailwind projects already
  have them. Everyone else can drop them.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [c949cae]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@0.9.0
  - @getvitops/core@0.9.0
  - @getvitops/vite@0.9.0
  - @getvitops/utils@0.9.0

## 0.8.0

### Minor Changes

- a334049: Make the semantic icon mapping reachable, and fail the build on unresolvable names.

  `generateIconInclude()` — declare the semantic icon names a site needs plus which sets to draw
  them from, get back the `include` map that keeps the bundle to just those glyphs — already existed
  but was unreachable: it lived in `@getvitops/core/src/utils/`, which the package doesn't export.
  It has moved to `@getvitops/utils` (a build-time concern, in the build-time utilities package),
  which `@getvitops/astro` re-exports wholesale. So from `astro.config.mjs`:

  ```js
  import { generateIconInclude } from '@getvitops/astro';
  import icon from 'astro-icon';

  integrations: [
    icon({
      include: generateIconInclude({
        ui: 'fa7-solid',
        brand: 'simple-icons',
        semantic: ['menu', 'close', 'search', 'github'],
      }),
    }),
  ];
  // → { "fa7-solid": ["bars","xmark","magnifying-glass"], "simple-icons": ["github"] }
  ```

  Swapping `ui` to `'lucide'` yields `{ lucide: ["menu","x","search"] }` from the same declaration —
  which is the point: the semantic names are what your markup commits to, and the set is a config
  choice. The output shape is the `include` both `astro-icon` and `astro-iconset` accept, so the
  mapping doesn't tie you to either.

  **Unresolvable names are now a build error.** Previously they were skipped silently, so swapping
  sets appeared to succeed and the gaps surfaced as missing glyphs in production. The error names
  every offender; an unknown set name throws too, listing the known sets.

  Also fixes `@getvitops/create`'s emdash template, which pinned `@getvitops/astro: ^0.4.0` — a range
  that stopped resolving when astro joined the fixed group at 0.7.0, so scaffolded projects were
  stuck on the old line.

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

- aa2863d: Persist the colour scheme across navigations, and drop the UA body margin.

  **The colour scheme now sticks.** `<color-scheme-toggle>` records the explicit choice in
  `localStorage` (`vitops-color-scheme`) and restores it on load. Previously every navigation reset
  to System — the component defaulted to `system` on each page and its `disconnectedCallback` even
  deleted the attribute on unmount, so the scheme was per-page state rather than a user preference.
  Choosing System clears the key, so a visitor can go back to following their OS.

  `<Head />` from `@getvitops/astro` now also emits a tiny synchronous script that applies the stored
  value **before first paint**. Without it the persisted choice would still work, but every page
  would render light and flip once the deferred element bundle upgraded. A test asserts the storage
  key stays in step between the two (they can't share an import: core exports only prebuilt bundles,
  and the Head script must be a literal in the emitted HTML).

  **`body { margin: 0 }`** is now part of the framework. The UA's 8px margin offset every full-bleed
  surface — sticky headers and `bg-*` bands rendered inset with a sliver of canvas around them, since
  the framework owns page gutters through `.centered`'s `--gutter`. This is the only UA reset the
  framework makes; it deliberately still ships no general reset (no global `box-sizing` change),
  which would silently reflow existing layouts.

  **Migration:** if you were compensating for the body margin with a negative offset or your own
  `body { margin: 0 }`, you can drop it. Sites relying on the 8px inset will need to add their own
  padding.

- Updated dependencies
  - @getvitops/core@0.8.0
  - @getvitops/generator@0.8.0
  - @getvitops/vite@0.8.0
  - @getvitops/utils@0.8.0

## 0.7.0

### Minor Changes

- 44de07f: Split the button pattern into two tiers named by intent: `.cta` (persuasion) and `.btn`
  (affordance).

  **Breaking: a bare `<button>` is no longer a filled brand-primary button.** It now renders as a
  quiet interactive control — geometry, cursor, subtle hover, focus ring — with no fill, no
  `font-weight: 600`, and no shadow.

  **Migration:** add `class="cta"` to any button that should stay prominent. Submit buttons, hero
  actions, and anything driving a conversion are the usual candidates; dialog closes, toolbar
  buttons, icon buttons and toggles should keep the new default. If you want the old behaviour
  globally, set `patterns.items.btn` in your `design-system.json` back to the previous filled base.

  New in this release:
  - **`.cta`** — filled, bolder, roomier, lifts on hover. It is a class, not an element rule, so it
    finally works on `<a>` — which is what a call to action usually is, since it navigates. Role
    variants: `.cta-{success,danger,warning,info}`.
  - **`.btn`** — the affordance tier. Emitted as one zero-specificity `:where(button, .btn)` rule, so
    a bare `<button>` gets it with no class, `.btn` carries it to any other tag, and any explicit
    class (including `.cta`, or a component's own class) overrides it without `!important`.
  - **`:where(a, .link)`** — the link pattern now pairs its element with a class the same way.
  - A pattern may now set **both `element` and `class`**, emitting one combined
    `:where(<element>, .<class>)` rule. This is the general mechanism behind the above.
  - A pattern may declare **`fill: true|false`** to state whether states and role variants drive
    `background-color` (plus `on-solid` text) or `color`, instead of relying on the previous
    inference from the pattern's name and base declarations. Existing configs are unaffected — the
    old inference is still the fallback.

  **Breaking: `chip` is retired as vocabulary.** The two small-label patterns are now split by
  behaviour, not size: **`badge`** is a _static_ label (status, count, category) and **`tag`** is an
  _editable and/or dismissable_ one (e.g. entries in a filter list).
  - `.chip-list` → **`.tag-list`**, and its `--*-chip-list` / `--chip-list-focus-color` tokens →
    `--*-tag-list` / `--tag-list-focus-color`.
  - `.chip-list__chip` and `.chip-list__chip-remove` are **removed**. A tag list is a list of tags, so
    its items are now the existing `.tag` / `.tag__remove` — which also means they pick up tag role
    variants. **Migration:** replace `<span class="chip-list__chip">x <button
class="chip-list__chip-remove">` with `<span class="tag">x <button class="tag__remove">`. Note the
    items change appearance: `.tag` is outlined (border + neutral text) where the old chip was filled
    with `--color-surface-muted`.
  - The `radii.chip` primitive is **removed** from the example config; it was only ever an alias of
    `--br-tag`. Consumers who set `--br-chip` should use `--br-tag`.

  **Pattern geometry now resolves through the group alias layer.** Every grouped pattern already
  emitted `--<prop>-<name>-group` aliases (e.g. `--br-btn-group: var(--br-control)`), but most
  patterns bypassed them and hard-coded `var(--br-control, …)` into the rule. `btn`, `cta`, `badge`,
  `tag`, `card` and `status` now reference the alias and restate only their deviations via
  `overrides`, so the whole chain — `--p-btn` → `--p-btn-group` → `--p-control` → `--p-default` — is
  live CSS custom properties, inspectable and editable in the browser. Computed values are unchanged.

  Also fixed:
  - Role variants on element patterns were emitted at specificity 0-1-1 (`button.danger`), which
    outranked any plain class. They now emit as `:where(button, .btn).danger, .btn-danger` — both at
    class specificity, and reachable from a non-`<button>` host.
  - The `link` pattern declared `default_role: "brand-primary"` while hard-coding a `ui-primary` base
    colour, so hovering shifted hue instead of intensifying. Its `default_role` is now `ui-primary`.
  - `@getvitops/astro`'s `FormRenderer` defaulted its submit button to `class="btn btn-primary"`, a
    class that never existed and a role that is not emitted; it now defaults to `.cta`.
  - The Tailwind bundle is no longer assembled during `css` / `bricks` builds, where it was computed
    and discarded (it also read every framework partial off disk).

### Patch Changes

- @getvitops/core@0.7.0
- @getvitops/generator@0.7.0
- @getvitops/utils@0.7.0
- @getvitops/vite@0.7.0

## 0.4.2

### Patch Changes

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
  - @getvitops/vite@0.6.0
  - @getvitops/core@0.6.0
  - @getvitops/utils@0.6.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.5.0
  - @getvitops/vite@0.5.0
  - @getvitops/core@0.5.0
  - @getvitops/utils@0.5.0

## 0.4.0

### Minor Changes

- 54a06e9: Add `css.inject` option to `getvitops()` (default `true`). Set `inject: false` to stop the global `page-ssr` stylesheet injection and import the generated CSS from your site layout instead — needed when other integrations add routes that must not inherit the design system (e.g. EmDash's `/_emdash/admin`, which the auto-injected CSS was bleeding into).

## 0.3.1

### Patch Changes

- d7e6491: Extract schema.org JSON-LD graph builders (articleGraph/organizationGraph/breadcrumbGraph/faqGraph) into @getvitops/utils so platform hooks (e.g. the new @getvitops/emdash plugin's future page:metadata contributions) can share them; the corresponding schemas/\*.astro become thin wrappers. Also removes Layout.astro's import of the deleted Polyfills.astro.
- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0
  - @getvitops/core@0.4.0
  - @getvitops/generator@0.4.0
  - @getvitops/vite@0.4.0

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

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/core@0.3.0
  - @getvitops/generator@0.3.0
  - @getvitops/vite@0.3.0

## 0.2.0

### Minor Changes

- 4d89eca: Add Schema.org / JSON-LD structured-data components, exported at `@getvitops/astro/schemas/*`
  (`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
  `Breadcrumb`, `JobPosting`, and more) — each emits a typed `<script type="application/ld+json">`
  block at SSR time with no runtime JS. `Head.astro` moved to `src/components/` (the public
  `@getvitops/astro/Head.astro` import is unchanged).

## 0.1.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/vite@0.2.1
  - @getvitops/core@0.2.1
  - @getvitops/utils@0.2.1
