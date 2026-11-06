# @getvitops/emdash

## 2.0.0-alpha.0

### Minor Changes

- 161c7f3: A contact form that works end to end: `vitops setup turnstile`, `<wc-turnstile>`, the `vitops.form` EmDash block, and the route the emdash template ships to receive it.

  **CSS, all formats** (no existing class changes): `forms.css` gains `.form-notice--target:not(:target)` (a message revealed only when the URL fragment names it, which is how a prerendered page shows a no-JS form's result) and `:where(wc-turnstile) { display: block }`.

  **`@getvitops/core`:** new `<wc-turnstile sitekey="…">` in `elements.js`. It loads Cloudflare Turnstile on the first interaction with its form (no request to `challenges.cloudflare.com` for a visitor who only reads the page), holds an early submit until the token arrives, and leaves its slotted no-JS explanation in place until JS takes over. Turnstile is category `necessary`, so it is not behind the consent banner.

  **`@getvitops/utils` / `@getvitops/cli`:** new `@getvitops/utils/turnstile` and `vitops setup turnstile [--dry] [--check] [--no-write] [--no-secret]`. It plans from the site's hostnames, creates a managed widget unless one already covers them (an existing widget is adopted, never edited, rotated or deleted), writes the public key to `site.security.turnstile.siteKey`, and pipes the one-time secret to `wrangler secret put VITOPS_TURNSTILE_SECRET` without writing it to any file. Needs `CLOUDFLARE_API_TOKEN` with **Account > Turnstile > Edit** and `CLOUDFLARE_ACCOUNT_ID`.

  **`@getvitops/astro`:** `virtual:getvitops/head` gains `turnstileSiteKey` (read from `site.security.turnstile.siteKey`) so blocks can render the widget. No other change.

  **`@getvitops/generator`:** `TIERS` gains a `turnstile` entry (wc-turnstile, claimed by `vitops.form`); `wc-multi-field`'s `emdashExempt` reason is reworded now the form block exists.

  **`@getvitops/emdash`:** new `vitops.form` block: a field repeater (text, email, phone, long text, choose one, tick box), required flags, help text, success/error messages, optional Turnstile. It renders a semantic `<form method="post">` that works with no JavaScript, with a honeypot named per `createConversionRoute`'s defaults. A field named `phone` submits as `tel`, because the route reserves `phone` and `event`.

  **`@getvitops/create`:** the emdash template ships `src/pages/api/track.ts` (`prerender = false`, `createConversionRoute()`), a seeded contact form, and `challenges.cloudflare.com` in both templates' Report-Only CSP (`script-src`, `frame-src`). The route refuses a post with nowhere to deliver and fails closed when a site key exists without `VITOPS_TURNSTILE_SECRET`. SETUP.html gains the Turnstile step. Existing sites: copy the route and the CSP change, then run `vitops setup turnstile`.

- 1e36b83: Seven new blocks, a section block type, and a shared `tone`.

  **New Portable Text blocks:** `vitops.logos` (a still grid; `marquee` only scrolls), `vitops.steps`, `vitops.stats` (each figure is a `<Counter>`; a `tiles` style adds group, change and good/bad state), `vitops.callout` (a call-to-action band, not the dismissible `banner`), `vitops.entries` (wraps `<wc-entries>`), `vitops.pricing` (aligned plan cards) and `vitops.embed` (a video or map that loads only after consent: the iframe ships with no `src`, the address rides on `data-consent-src`, and a `title` is required).

  **New block TYPE `vitops_section`** (kicker, heading with a level, lead-in, tone, an optional heading-left `split` layout, and a Portable Text body that accepts every `vitops.*` block). It is a schema-level block type, not a Portable Text block, because Block Kit fields cannot hold rich text. Add `...vitopsBlockTypes()` to `seed.json`'s `blockTypes`, allow `vitops_section` on the collection's `blocks` field, and map it with `blockTypeComponents` from `@getvitops/emdash/astro` (`defineBlockComponents`).

  **Extended, non-breaking:** `vitops.hero` gains accent marks (`*words*` in the heading), a heading `level`, `tone`/`color` and an optional row of cards. `vitops.cards` gains a `panel` style (tone, checklist, button), a heading `level`, `tone`/`color`, and `[text](/url)` inline links in the body. **Cards fix:** the card title is now a real heading element (default `h3`, `font-heading`) instead of `<p class="font-heading">`; saved content is unchanged, but the markup and the page outline change. Set `level` to taste.

  **Shared `tone` + `color`** on every block that colours anything: a role from `site.json`, falling back through its semantic relatives to `neutral`, or a palette hue/step. Renderers emit `--tone-*` custom properties (never a class built from a value, which Tailwind cannot see). New option `vitopsEmdash({ tones })` (or the roles are read from `designSystemEditor.config`) fills each block's `tone` select with the site's own roles through a `tones/list` plugin route; with neither, the select offers the semantic names. `vitops.banner.tone` and `vitops.actionLink.role` keep their existing values.

  **Render tests:** `pnpm --filter @getvitops/emdash run test:render` renders the block adapters through Astro's container API in a separate vitest config.

- 175d16e: **Added: `vitops.reviews` and `vitops.nav` EmDash blocks.** Non-breaking.

  - **`vitops.reviews`** renders Google reviews from the committed `.vitops/reviews.json` cache (`vitops reviews`) as a grid, carousel or marquee of `<ReviewCard>`. Fields: location key, layout, columns, limit, lowest rating, order, featured ids, reviewer photos (off by default), tone/colour. Which reviews show is `selectReviews()`, the one shared decision. Review JSON-LD is not offered (Google treats self-marked-up reviews as ineligible for rich results). A new review reaches the page after `vitops reviews` is re-run, committed and the site rebuilt, not when an editor saves; with no cache file the block renders nothing (a note in `astro dev`).
  - **`vitops.nav`** renders a named EmDash menu inside page content (site map, section links, footer-style columns), never the header. Fields: menu (picked from the site's menus via a new `menus/list` plugin route, with `footer-sitemap`/`footer-legal`/`primary` as the static fallback), accessible name, visible heading and level, layout `list | inline | columns | sitenav`, depth 1-3, tone/colour. It is a `<nav>` with a name that is never `Primary`, `Site map` or `Legal` (the layout's landmarks), `aria-current="page"`, no runtime JS; a missing or empty menu renders nothing.
  - `@getvitops/astro`: **`virtual:getvitops/reviews`**, served by `vitops()`, is `.vitops/reviews.json` as a build-time import (an empty cache when absent or unreadable), because a Worker cannot read the file. `<ReviewCard>` now renders the review's source link (`.review__source`, `rel="nofollow noopener noreferrer"`), which the pattern already styled. **Fix:** `src/json-ld.ts` was missing from the published `files`, so any consumer importing `<ReviewCard>` (which composes `schemas/Review.astro`) failed to build with an unresolved import. `@getvitops/emdash` now needs this version of `@getvitops/astro` for the `vitops.reviews` block.
  - `@getvitops/utils`: new Worker-safe subpath **`@getvitops/utils/reviews/select`** (`selectReviews` and the review types, no `node:fs`). `selectReviews` now takes only the display fields (`featured`, `minRating`, `limit`, `sort`), so a caller with no configured `locationId` can use it; existing calls are unchanged.
  - `@getvitops/core`: new `.navlist` pattern in `patterns/sitenav.css` (`.navlist`, `__item`, `__link`, `__label`, `__sub`, `--inline`, `--columns`). **All formats** (css, bricks, tailwind). No existing class changes.
  - `@getvitops/generator`: `TIERS.review` lists `vitops.reviews` and `TIERS.sitenav` lists `vitops.nav` (and `.navlist`), so `vitops docs components` and the docsite show them.

- 06d6112: Fix the EmDash `/design-system` admin page erroring on a tailwind site. It fetches `/vitops/design-manifest.json`, which the `tailwind` format never emitted and the integration only mirrored under `editor: true` (which also loads `editor.js` on every public page).

  - **generator** (`tailwind` format only): `design-manifest.json` is now emitted alongside `tailwind.css`. No change to the CSS.
  - **astro**: new `vitops({ editorManifest: true })` writes everything an outside host needs into `public/vitops/` (`design-manifest.json`, `editor.js`, a standalone `editor.css`, and `design-system-editor.html`) without loading the editor on public pages. `editor: true` still loads it from `<Head />`.
  - **vite**: `editorManifestDir` also writes `vitops/editor.css`, from a throwaway `css`-format pass on tailwind sites.
  - **emdash**: the `/design-system` admin page was unstyled and overflowed the admin, because the editor borrows the framework CSS and the admin never loads it. It now embeds `/vitops/design-system-editor.html` in an iframe, so the design system can't leak into the admin's styles. **Requires `editorManifest: true`** in `vitops({ … })`.
  - **create**: the EmDash template sets `editorManifest: true`. Existing sites: add it to `vitops({ … })` in `astro.config.mjs`.

  No consumer-facing change in the other toolchain packages.

### Patch Changes

- Updated dependencies [efd4e72]
- Updated dependencies [93d2067]
- Updated dependencies [161c7f3]
- Updated dependencies [175d16e]
- Updated dependencies [83d6f3c]
- Updated dependencies [892b204]
- Updated dependencies [06d6112]
- Updated dependencies [6297337]
- Updated dependencies [224a731]
- Updated dependencies [55061e2]
- Updated dependencies [b47df4d]
  - @getvitops/astro@8.3.0-alpha.0
  - @getvitops/core@8.3.0-alpha.0
  - @getvitops/generator@8.3.0-alpha.0
  - @getvitops/utils@8.3.0-alpha.0

## 1.0.0

### Major Changes

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

### Minor Changes

- b3d9c07: `vitops docs blocks` prints every EmDash block type and its fields, so an agent can write valid Portable Text without reading the plugin source. It reads `@getvitops/emdash` from the project (and says so if it isn't installed); `@getvitops/emdash` exports `renderBlocksDoc()` for it.
- 2ef2d41: **Tested against EmDash 1.4.** `emdash` and `@emdash-cms/cloudflare` are now `^1.4.0` in the
  `emdash` template, and `@getvitops/emdash`'s peer ranges for both moved from `>=1.0.0 <2` to
  `>=1.3.0 <2` — **breaking for a site still on EmDash 1.0–1.2**: upgrade `emdash` and
  `@emdash-cms/cloudflare` together (EmDash warns at build when the two differ) before upgrading
  this package. 1.4 fixes a stored XSS in the visual-editing toolbar (an author's published content
  could run script for a signed-in editor), so an existing client site should take it promptly.

  - **`vitopsHosting()` coalesces D1 reads by default** — new `cloudflare.coalesce` option
    (default `true`, passed to `d1({ coalesce })`). With `session: 'auto'`, EmDash 1.3 stops
    preloading settings/menus/widgets for logged-out visitors unless reads are coalesced, so this
    restores one round trip instead of several. It is experimental upstream: a read and a write
    started together may run write-first, so `await` a read before a write that must not affect it.
    Set `coalesce: false` to opt out. No effect without a session.
  - **Template:** `AGENTS.md` gains an "EmDash 1.x behaviours" section (passkeys are bound to a
    hostname so use _Change domain_ at cutover; admin-authored HTML blocks run JS and conflict with
    Astro CSP; link by `entry.data.slug`, not `entry.id`; submit `/sitemap.xml`; clearing a stuck D1
    lock with `emdash migrate --take-over-lock`).
  - **Upstream behaviour changes to know about (no code change here):** `cacheHint.lastModified` is
    no longer auto-populated and pages lose the implicit `Cache-Control: no-cache`; collection
    sitemaps paginate at 2,000 entries; `entry.id` is always locale-prefixed on multilingual sites.

  No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
  `@getvitops/cli` or `@getvitops/vite`. `@getvitops/astro` has one — see the scaffold changeset.

- 1a8231d: **EmDash blocks are now a tier of the component manifest, and there are four more of them.**

  `@getvitops/emdash` adds `vitops.gallery`, `vitops.cards`, `vitops.accordion` and `vitops.marquee`
  (each a thin adapter over the matching `@getvitops/astro` component), and `vitops.carousel` now edits
  its slides as a **Slides repeater** instead of two newline-separated fields. Blocks saved before this
  keep rendering: with no `slides`, the carousel still reads `images`/`alts`, and both legacy fields stay
  in the editor, labelled as legacy. The editor's field type now admits `repeater` and `media_picker`.

  - **New `blocks` plugin option** — `vitopsEmdash({ blocks: { include, exclude, extra } })`. `include` is
    an allowlist, `exclude` drops blocks, `extra` adds the site's own **editor** definitions (the site
    supplies their renderers via `<PortableText components={{ type }}>`, the same route that overrides a
    `vitops.*` renderer). An unknown name or a colliding `type` throws at plugin construction.
  - Link and image URLs in blocks with a scheme other than `http`, `https`, `mailto` or `tel` are
    dropped (see the security entry).

  `@getvitops/generator`: `TierEntry` gains an optional `emdash: string[]` (block `_type`s) and `Tier`
  gains `'emdash'`, so `tierPatterns('emdash')` projects it. **Breaking only for code that exhaustively
  switches on `Tier` or builds a `Record<Tier, …>`** — add an `emdash` case. The agent doc
  `vitops docs components` gains an "EmDash blocks" table and the docsite a `components/emdash` page. The
  guard that every block and every `emdash` entry agree lives in `@getvitops/emdash`'s `blocks.test.ts`,
  because the generator cannot import the plugin.

  `@getvitops/create`: the EmDash template's agent guidance explains the blocks, their limits (a block
  cannot contain blocks; `vitops.*` blocks do not render inside EmDash's built-in `columns`) and the
  `blocks` option.

  Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
  in this package.

- 779d22e: Add a `vitops.hero` EmDash block (eyebrow, heading, text, two links, optional image; centered or split layout) built on the `.centered`/`.split` layout primitives. The EmDash template's home page now seeds one of each of hero, cards, accordion and marquee. `@getvitops/generator`: the `split` pattern lists the new block in `TIERS`.

### Patch Changes

- 734ab60: EmDash gallery and carousel blocks now derive their element id from the block's `_key`, so two blocks with the same label on one page no longer open each other's dialog. `<wc-entries>` column navigation now honours `prefers-reduced-motion`.
- 7f4f50e: `@getvitops/utils/url` exports `safeHref()` (a Worker-safe scheme allowlist: http, https, mailto, tel and relative), shared by the EmDash blocks and the Astro components. It now also guards the EmDash image-compare block, the review avatar and the cookie-notice policy link. `nodesToHtml`/`toHtml` throw on invalid tag or attribute names and on `on*` event-handler attributes, and drop `href`/`src`-style values that fail `safeHref`. EmDash cards link text now names the card for screen readers.
- e5bc937: **Security: JSON-LD can no longer break out of its `<script>` tag.** All 24 `schemas/*.astro`
  components inlined `JSON.stringify(jsonLd)` as-is, so a review, FAQ answer or forum post containing
  `</script><script>…` ran as script on the page. They now go through `jsonLdScript()`, which escapes
  `<`, `>`, `&`, U+2028 and U+2029 (still valid JSON — consumers and search engines parse the same
  document). Sites rendering any user-supplied text through a schema component should upgrade promptly.

  **`createConversionRoute()` hardening** — behaviour changes:

  - The body-size cap is now enforced on the stream itself, not only on `Content-Length`; a chunked
    request with no header is refused with 413 once it passes `maxBodyBytes`.
  - **Breaking for non-Cloudflare hosts:** `X-Forwarded-For` is no longer used as the rate-limit key by
    default, since off Cloudflare a client can set it freely and mint a new bucket per request. Pass
    `trustForwardedFor: true` when running behind a proxy that overwrites it. Without
    `CF-Connecting-IP` or that opt-in there is no IP and rate limiting is skipped. No change on
    Cloudflare Workers.

  `@getvitops/emdash`: the link/button block (`vitops.actionLink`) drops hrefs with a scheme other
  than `http`, `https`, `mailto` or `tel` (e.g. `javascript:`, `data:`) and renders nothing for them.

  Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing
  change in this package.

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

## 1.0.0-alpha.0

### Major Changes

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

### Patch Changes

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [2a0a559]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
- Updated dependencies [0f8c018]
- Updated dependencies [3bbb8c3]
  - @getvitops/generator@8.2.0-alpha.0
  - @getvitops/astro@8.2.0-alpha.0
  - @getvitops/utils@8.2.0-alpha.0
  - @getvitops/core@8.2.0-alpha.0

## 0.3.10

### Patch Changes

- Updated dependencies
  - @getvitops/utils@8.1.0

## 0.3.9

### Patch Changes

- @getvitops/utils@8.0.1

## 0.3.8

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [a84839b]
  - @getvitops/utils@8.0.0

## 0.3.7

### Patch Changes

- Updated dependencies [c0c092b]
- Updated dependencies
- Updated dependencies [2b50f9e]
  - @getvitops/utils@7.0.0

## 0.3.6

**The `vitops.carousel` block now renders `@getvitops/astro`'s `<Carousel />`** instead of emitting
`<wc-carousel>` markup of its own — one implementation, so the block cannot drift from the
component. Two new fields: **Loop** (a toggle; cloning the slides is opt-in now, and `autoplay`
implies it) and **Slide aspect ratio** (default `16 / 9`, which is what keeps slide heights equal
whatever each image's proportions are). Existing carousel blocks keep working; they simply stop
looping unless you tick Loop.

**The `@getvitops/astro` peer range is now `>=6.0.0`**, because `Carousel.astro` does not exist
before it. Upgrade the whole toolchain together — it ships as one version.

### Patch Changes

- @getvitops/utils@6.0.0

## 0.3.5

### Patch Changes

- Updated dependencies
  - @getvitops/utils@5.0.0

## 0.3.4

### Patch Changes

- Updated dependencies [2c890c0]
  - @getvitops/utils@4.1.0

## 0.3.3

### Patch Changes

- Updated dependencies [c6b99e7]
- Updated dependencies [f7bc0a0]
- Updated dependencies [ceed51f]
  - @getvitops/utils@4.0.0

## 0.3.2

### Patch Changes

- Updated dependencies [6e68ace]
  - @getvitops/utils@3.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/utils@2.1.0

## 0.3.0

### Minor Changes

- 04a51d8: New `vitops.actionLink` block: a link or button with optional icons at either end.

  Editors get a label, URL, style (link / button / call-to-action), colour role, new-tab toggle, and
  searchable pickers for a start and end icon. Icons render from the generated SVG sprite, so the
  block needs no JavaScript, and they use the sprite's set-independent aliases — content authored in
  the CMS survives the site changing icon sets.

  Fields are flattened (`label`, `href`, … as siblings rather than a nested object) because Block Kit
  has no object-group element. The icon pickers are comboboxes over the semantic name list for the
  same reason: Block Kit's element union is closed, so a richer icon picker isn't mountable inside a
  block modal today.

- bf453b0: **Breaking:** this package now depends on the toolchain instead of pretending it doesn't.

  It shipped with no `@getvitops/*` dependency at all, on the reasoning that the independence let it
  version separately from the fixed toolchain group. That reasoning stopped being true when the blocks
  started rendering from the generated SVG sprite: `vitops.actionLink` emits
  `<use href="/vitops/icons.svg#icon-menu">`, and those ids only exist if the site's toolchain built
  the sprite with the matching semantic vocabulary. Installed against an older toolchain the block
  rendered an **empty box** — no install-time error, no console warning, nothing to grep for.

  Two changes make the coupling real:
  - **`@getvitops/utils` is a hard dependency**, and `SEMANTIC_ICON_OPTIONS` is now derived from its
    `iconMap` rather than generated into `src/icon-options.ts` by a script. The editor's icon list and
    the sprite's aliases are one source, so they cannot drift. `pnpm gen:icons` is gone; there is
    nothing left to regenerate.
  - **`@getvitops/astro` is a peer** (`>=2.0.0`). It is the integration that emits the sprite into
    `public/`, and it belongs to the site — a hard dependency would let a version mismatch install two
    copies of an Astro integration rather than telling you about it.

  **Migration:** install or upgrade `@getvitops/astro` (and the rest of the toolchain, which moves in
  lockstep) to `2.x` alongside this release. If your package manager reports an unmet peer on
  `@getvitops/astro`, that is this change working — it is the error that replaced the empty box.

### Patch Changes

- Updated dependencies [4756788]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [04a51d8]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [feae1a3]
- Updated dependencies [bf453b0]
  - @getvitops/astro@2.0.0
  - @getvitops/utils@2.0.0

## 0.2.3

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

## 0.2.2

### Patch Changes

- 3b37caa: Fix the plugin descriptor reporting a stale version.

  `@getvitops/emdash@0.2.1` shipped a descriptor whose `version` read `0.2.0`. The value was a
  hand-maintained literal carrying a "keep in sync with package.json" comment; `changeset version`
  bumps package.json and leaves such a literal alone, so the two drifted at release time. A test
  asserts they match, but the release chain built and published without running tests, so nothing
  caught it.

  It's now derived from package.json, which removes the failure mode rather than relying on
  remembering, and the `release` task runs the test suite before publishing.

## 0.2.1

### Patch Changes

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

## 0.2.0

### Minor Changes

- New `vitopsHosting()` export — the hosting seam for EmDash sites. Resolves
  the Astro adapter + EmDash database/storage for a target: `cloudflare`
  (default — `@astrojs/cloudflare`, D1 `DB`, R2 `MEDIA`) or `node`
  (`@astrojs/node` standalone, SQLite file, local uploads). Target precedence
  `HOSTING` env > `options.target` > cloudflare; adapter packages resolve
  lazily (install per target, missing ones fail with install instructions);
  `options.node.database/storage` accept full descriptors (postgres/s3) for
  production Node hosts.
