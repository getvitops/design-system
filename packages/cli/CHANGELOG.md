# @getvitops/cli

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

- 14813fa: Document which tier provides each pattern — `vitops docs components`.

  The toolkit ships four tiers that compose: CSS framework classes, `<wc-*>` web components, Astro
  components, Bricks elements. Nothing said so. The class reference listed pattern names, the
  elements reference listed Bricks controls, and the fact that `tree` is _also_ a web component
  _and_ an Astro component existed only in the source layout. The cost is silent: you hand-write
  the markup a component already emits, or you wrap a component that already emits its own tag.

  `TIERS` in `@getvitops/generator` is the new manifest — per pattern, its CSS partial and
  representative classes, its `wc-*` tag and which bundle that ships in, its Astro component(s),
  its Bricks element, and one line saying what to actually write. `tierPatterns(tier)` projects one
  tier. `vitops docs components` renders all four in one document, and the reference sections it
  feeds render the same data per tier.

  It is **authored rather than derived, and drift-guarded** instead. Naming convention carries most
  of it and breaks exactly where it matters — `splitter.css` hosts two components, `tag.css` serves
  three config patterns, `anchor-link.css` provides `.link`, `layout.css` provides `.split` and
  `.centered` — so a derivation would need an exceptions table longer than the rule, and a rename
  would silently drop a link. Instead, tests fail the build when a hand-written CSS partial, a
  `customElements.define`, an exported Astro component or a Bricks element isn't accounted for.

  Four things the manifest records that cannot be inferred, each a real failure mode:
  - **Whether an Astro component wraps a web component.** `Tree` and `CookieConsent` emit the
    `<wc-*>` tag with the fallback inside; `Details`, `Drawer`, `Popover`, `NavShell` and `Subgrid`
    emit tier-1 markup with no web component at all. Reading the first group as the second gives
    `<wc-tree><Tree /></wc-tree>` — two elements on one tree, which renders and misbehaves.
  - **Where each element ships.** `elements.js` for the registered set, its own bundle for
    `<wc-consent>` and `<wc-theme-editor>`, and **no bundle at all** for the four editor-v2 tags —
    which are registered, importable-looking and inert in a consumer project. The guard checks this
    against what `js/elements.ts` imports, so it can't claim an element ships when it doesn't.
  - **Whether a pattern is config-authored.** `patterns.items` patterns get the token cascade,
    states, role variants and override hooks; a structural partial gets none of them. The docs also
    now say when a config-authored pattern is **absent from your config**, because naming its
    classes while your build emits none of them is worse than omitting it.
  - **The import specifier, verbatim.** These are published as the line to copy, so they are checked
    against `@getvitops/astro`'s `exports`. That guard immediately caught
    `@getvitops/astro/components/../CookieConsent.astro` — plausible-looking, right basename, not an
    importable path (`CookieConsent.astro` ships from the package root).

- 14813fa: Document the consent, conversion-tracking, search and legal subsystems for agents.

  `vitops docs` gains four topics — `consent`, `tracking`, `search`, `legal` — and the docs
  bundle gains the matching concept docs under `concepts/`. Until now these subsystems were
  described only by their generated config-schema field descriptions, so an agent working in a
  consumer project had no account of the rules that make them work, and every one of those rules
  fails **silently** when broken:
  - a gated tag given a live `src` instead of `type="text/plain"` fetches the third party anyway,
    so the gate becomes decorative;
  - a caller using `granted()` instead of `require()` never raises the banner, so on a site where
    nothing else demands that category the permission is never offered, never granted, and the
    write never happens;
  - an absent `window.vitopsConsent` read as "denied" rather than "this site has no gate";
  - a consent patch widened to every category records consent nobody gave;
  - a sitemap with no `<lastmod>` makes edited pages undetectable, so `search notify` looks
    healthy while never resubmitting anything;
  - a stale IndexNow key file returns `202` and is then discarded;
  - Google's Indexing API accepts ordinary URLs, discards them, and violates its own terms.

  The packaged agent skill now covers consent and conversion tracking, and its description names
  these subsystems so it is actually surfaced when they are the task.

  Also fixed: the icons concept doc still called the Astro integration `getvitops()`, renamed to
  `vitops()` in 3.0.

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

- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [bb92a14]
- Updated dependencies [eeb059f]
  - @getvitops/generator@1.0.0
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

- 58cb3d7: Fix two wrong paths in the live-editor manifest, and surface token-namespace collisions.

  **`validate()` now returns `warnings: string[]`** alongside `ok`/`data`/`errors`, for configs that
  parse and generate but won't behave as authored. `vitops validate` prints them. The field is always
  present, so existing code reading `ok`/`errors` is unaffected.

  The first warning covers a collision the flat `--<prop>-<name>` grammar allows: a `patterns.radii`
  key named after a pattern claims the same variable. The example config hits it —
  `patterns.radii.card` and the `card` pattern both want `--br-card`:

  ```
  ! patterns.radii.card collides with the "card" pattern on --br-card;
    the pattern's override hook wins — rename the radius
  ```

  **`design-manifest.json` reverse-index fixes** (affects the live editor's edit-to-config mapping):
  - Numeric colour steps mapped to `colors.palette.<hue>.seed`. The seed regenerates the whole ramp,
    so every step of a hue collapsed onto one path and editing two steps would silently keep one.
    They now map to `colors.palette.<hue>.anchors.<n>` — the schema's step → colour override.
  - `--br-<name>` resolved to `patterns.radii.<name>` even when a pattern owned the variable. Radii
    are now applied last and only where a pattern hasn't claimed it, matching what the CSS actually
    does.

### Patch Changes

- 611f340: `.cta` now defaults to the `ui-primary` role instead of `brand-primary`.

  The three tiers of one interaction family had split colour lineage: `:where(button, .btn)` and
  `:where(a, .link)` resolved to `ui-primary` while `.cta` alone used `brand-primary`. For a project
  whose brand and UI hues differ, that meant the focus ring changed colour depending on which tier
  you tabbed onto.

  Semantically the ui role is also the better fit — `brand-*` is identity, `ui-*` is the interface
  responding to you, and a CTA's prominence already comes from its fill, weight and padding rather
  than from borrowing the brand hue. Keeping brand as an explicit opt-in means a genuine brand moment
  still carries signal, and a rebrand restyles brand surfaces instead of silently restyling every
  form's submit button.

  **Migration:** none if `brand-primary` and `ui-primary` map to the same hue (the common case, and
  true of the example config). If they differ and you want the previous colour, add the new
  `.cta-brand-primary` variant — `brand-primary` has been added to `cta.roles`, so a brand-coloured
  CTA is reachable as a class rather than being unavailable.

- 46b129d: Make the dark-mode flip reachable outside Bricks.

  The dark functional-token block was emitted under `:root[data-brx-theme="dark"]` only.
  `data-brx-theme` is Bricks' own attribute — Bricks sets it, nothing else does — so on every other
  target the dark flip was unreachable. In particular the shipped `<color-scheme-toggle>` web
  component writes `documentElement.dataset.theme` (i.e. `data-theme`), so clicking "Dark" set an
  attribute no rule matched and the page stayed light.

  The block now matches `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, which fixes the
  component everywhere without changing what Bricks already does. No migration needed.

  Note this covers the _explicit_ choice only. There is still no `prefers-color-scheme` block, so the
  toggle's "System" position resolves to light. Adding one would flip every existing consumer site
  dark for dark-OS users, which is a product decision rather than a bug fix.

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
  - @getvitops/generator@0.8.0
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

- 44de07f: Shared toolchain version + changelogs that reach consumers.
  - **`@getvitops/astro` now shares the toolchain version** (`core`/`generator`/`utils`/`cli`/`vite`),
    so it moves from its own `0.4.x` line onto the group's. The number changes; the package does not —
    install it at the same version as `@getvitops/cli`. It was already being bumped on every toolchain
    release by its dependency updates, and it depends on core, generator, utils _and_ vite, so a
    separate version line cost the same churn while leaving the compatible pairing implicit. The
    lockstep is load-bearing: the generator ships a snapshot of core's CSS + web-component bundles
    while the Astro integration copies the _installed_ core's bundles, so mismatched versions can leave
    the CSS and the components disagreeing.

  - **Every package now ships its `CHANGELOG.md` in the published tarball.** npm does not include
    changelogs by default, so none of this history previously reached anyone who installed the
    packages. Per-package history now reads from `node_modules/@getvitops/<pkg>/CHANGELOG.md`;
    curated toolchain-level release notes live in the repo's root `CHANGELOG.md`.

### Patch Changes

- @getvitops/generator@0.7.0
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

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
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

### Minor Changes

- d35515e: Add `vitops agents` — writes a managed, marker-delimited block into a consumer's `AGENTS.md`
  (or `--out CLAUDE.md`) so AI coding agents can discover the CLI and the design-system class/element
  vocabulary. Idempotent (re-run to update between the `<!-- vitops:start -->`/`<!-- vitops:end -->`
  markers) and also emits the OKF docs bundle it points at (`--docs-dir`, default `.vitops/docs`).

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.2.0
  - @getvitops/utils@0.2.0
