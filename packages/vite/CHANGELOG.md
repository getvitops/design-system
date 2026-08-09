# @getvitops/vite

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
