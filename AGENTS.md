This repo is responsible for generating design systems for use in websites (primarily EmDash CMS and WordPress with Bricks Builder).

It is composed of:

- TS-based utilities
- Variable-based lightweight CSS Framework for high level design patterns and common utilities (e.g. track-based centering of content, vertical rhythm, UI patterns)
- Lit-based Web Components for patterns that benefit from progressive enhancement (they are styled via the CSS Framework, and are fully operable, although degraded, in non-JS environments)
- Wrappers for the Web Components and additional components for each platform (e.g. EmDash Blocks/Widgets, Astro components, PHP fragments, ...)

**This file is the _why_.** For the structural map — package matrix, key files, the `vp` task graph,
the asset snapshot chain, what's generated vs hand-written — see [ARCHITECTURE.md](ARCHITECTURE.md).
It's tables and diagrams, and it links back here for the reasoning behind each one.

Prefer using modern CSS/HTML features (e.g. CSS Anchor Positioning API, Dialog, Invoker Commands API, Scroll Timelines, etc.) over JavaScript.

**Browser support policy.** Depend on a platform feature only when it is Baseline widely available
**and** real-world usage is high enough that a visitor on an engine without it is rare (about 95% of
global usage). A feature that is Baseline-new, below that line even with a polyfill, or Chromium-only
(`interestfor`, `popover="hint"`, `focusgroup`, `sibling-count()`, `sibling-index()`, `appearance:
base-select`) gets a working fallback instead, feature-detected (`@supports`, a `test()` in
`polyfills.ts`) so an engine without it is degraded rather than broken, and a `TODO(support):`
comment naming the feature and what would let us revisit it. `grep -rn "TODO(support)"` lists every
deferred upgrade. A polyfill does not change this: it makes a feature reachable, not safe to depend
on. This is the rule behind the deliberate choices the `modern-web-guidance` skill's guides would
otherwise flag. **The carousel** keeps its cloned-slide loop and its `@supports`-gated
`::scroll-marker` / `::scroll-button()` branch instead of the guide's HTML-buttons-only,
`order`-parking loop, because that loop needs `sibling-count()` and `sibling-index()`, which reached
Baseline on 2026-08-18. **Tooltips** are a `popover="manual"` driven by a small hover/focus/Escape
handler (`js/tooltip.ts`) rather than `interestfor`; a `.tooltip--toggle` toggletip (`<Tooltip toggle>`) is a `popover="auto"` that a click pins open and that reports `aria-expanded`. **`interpolate-size`** is set once on `:root`
(`animation.css`) with no fallback, because without it an `auto` height simply resizes instantly,
which is a correct degrade. A guide that says "do not use X for now" is a reason to check this rule,
not to skip it.

## Component architecture

1. **CSS** (`@getvitops/core` `css/`): every pattern expressible in HTML/CSS. Reach for it first.
2. **Web components** (`<wc-*>`, Lit or plain `HTMLElement`): only for progressive enhancement, and they must SSR. The slotted light-DOM markup is the accessible no-JS fallback; the element parses and augments it. Every element states `@fallback full|partial|none` in its docblock (`tiers.test.ts` enforces it). A new element declares its `display` in its pattern partial, and joins the shadow-root list only if it renders all of its own UI.
3. **Platform wrappers** (`@getvitops/astro` components, EmDash blocks, Bricks PHP): thin authoring conveniences that render the right markup and need no runtime JS. A wrapper that needs JS is the wrong tier: build a web component and have the wrapper emit its tag.

`TIERS` (`packages/generator/src/tiers.ts`) is the single manifest of which tier provides each pattern, drift-guarded by `tiers.test.ts`. Agents get one doc with every tier (`vitops docs components`); humans get four pages, one per surface.
`<wc-theme-editor>` is the one deliberate tooling exception: quarantined in its own bundle, opt-in, never in `elements.js`. Not a precedent.

Detail and rationale: [internals/components.md](internals/components.md).

## The consent gate

`@getvitops/core/consent` is a general permission gate: anything marked `data-consent="<category>"` waits on one choice (`window.vitopsConsent`, `vitops:consent`). Categories: `necessary`, `analytics`, `marketing`, `preferences`.
Non-negotiables: a gated tag is inert (`type="text/plain"`, URL on `data-src`), never a live `src`; nothing is stored until the visitor chooses; "not asked" (`null`) is distinct from declined; revoking clears cookies and reloads; the banner is demand-driven; keep decisions in the pure `consent/store.ts`.

Detail and rationale: [internals/consent.md](internals/consent.md).

## The live theme editor

`<wc-theme-editor>` layers runtime `:root` overrides over the token layer and reads its surface from `design-manifest.json`. A role is not a ramp alias, a role carries its `kind`, palette hexes are scheme-global, and the save patch is design-system-relative. Read the file before touching the editor or the manifest.

Detail and rationale: [internals/theme-editor.md](internals/theme-editor.md).

## Published toolchain: `@getvitops/*`

Published as a **reusable toolchain** (like Tailwind/shadcn): every client runs it against their own
consumer-editable `design-system.json` — there is no shared/canonical token set to ship. Workspace
packages under `packages/` (a pnpm workspace), by layer:

- **`@getvitops/core`** — the design-system **framework** (the runtime everything builds on): the
  variable-driven **CSS partials** (`css/`), the Lit **web components**, and the feature-detected
  browser **polyfills**. Subpath exports: `./css/*`, `./elements`, `./polyfills`, `./deferred`,
  `./consent`, `./editor`. Inert on its own — the CSS resolves against the token layer the generator
  emits.
- **`@getvitops/generator`** — the **generator** as a library + the JSON Schema. Public API:
  `generate({ input, format, outDir })`, `generateDocs()`, `validate()`, `defaultConfig()`,
  `DesignSystemSchema`, `jsonSchema`. The `zod/mini` schema in `packages/generator/src/schema.ts` is
  the **single source of truth** (the `DesignSystem` type via `z.infer`, the published JSON Schema via
  `toJSONSchema` → `schema.json`, and runtime validation all derive from it). It sources the framework
  CSS partials + prebuilt JS bundles from `@getvitops/core` and ships the Bricks PHP + `load.php`; it
  also carries the project-config schema (`config.ts` → `config.schema.json`).

  **`input` takes either config kind.** A bare `design-system.json`, or the `Config` that
  embeds one — `resolveInput` discriminates on the presence of a `designSystem` key and resolves
  `themes[theme]` through its `extends` chain. The discriminator is **total, not a heuristic**, and
  both halves are load-bearing: a `Config` requires `designSystem`, and `DesignSystemSchema` is
  strict, so a design system carrying that key is an `unrecognized_keys` error. Keyed to shape
  rather than filename, because consumers name the file whatever they like.

  A full-config `input` also **supplies `site`**, so `defaultColorScheme`, the legal documents and
  the icon sprite don't need the same path declared again. That is safe to do implicitly because
  each of those outputs is already gated on a field in that config (`site.legal.*.enabled`,
  `site.icons.sprite`) — the config asks for what it gets. An explicit `site` still wins.

  **`Config` is three sections: `designSystem`, `organization`, `site`.** `designSystem` is the
  token set, `organization` is the company (name, contact, locations, services, links) and `site`
  is one published presentation of it (locales, domains, environments, SEO, analytics, legal,
  icons, favicon, deployment). Three named sections beat the flat `SiteConfig` they replaced for
  two reasons: no single noun described a document holding the company _and_ the deployment as
  peers, and several sites can now `extends` one file and override only `site`. `designSystem`
  stayed at the root deliberately — it is the discriminator, and moving it would have made
  `isConfig` a heuristic. `validateConfig` detects the old flat shape and **names every move**
  (`MOVED_KEYS` in `config.ts`), short-circuiting before zod would report a dozen
  `unrecognized_keys`; that error is the migration.

- **`@getvitops/config`** — the **site-config provider blocks** as zod schemas and inferred types:
  `site.crm`, `site.ads`, `site.reviews`, `site.seo.indexing`, `site.searchConsole`,
  `site.notifications`, `site.tracking`, `site.security`, `site.deployment`. A **leaf** — it imports
  `@zod/mini` and nothing else in the workspace — which is the whole point: `@getvitops/utils` (the
  provider code) can import its own configuration types instead of keeping a hand-copied mirror beside
  each module, so the type an executor accepts and the document `validateConfig` accepts cannot drift.
  Two entries, and the split is load-bearing: `.` carries the schemas (zod), `./providers` carries the
  closed lists (`AD_PROVIDERS`, `CRM_PROVIDERS`, `BIGIN_DATA_CENTERS`) as bare literals, because Worker
  code needs them as runtime values and must not pull zod along — `worker-safe.test.ts` fails a Worker
  subpath that takes a value from the root. **The umbrella `Config` is NOT here**: it embeds the
  design-system schema, whose `tokenRefIssues` calls the token engine, so moving it would have dragged
  most of the generator down. `generator` re-exports the moved names, so no import path changed. Declare
  `zod` here too: leaving `@zod/mini`'s peer to auto-install gave this package zod 4.6.7 beside the
  generator's 4.6.5, and the two copies made the generator's declaration emit fail with TS2883.
- **`@getvitops/utils`** — shared build-time utilities (favicon generation via `sharp` +
  `png-to-ico`, loaded lazily; `oxipng` crush optional). Consumed by cli/vite/astro.
- **`@getvitops/cli`** — `vitops generate|init|validate|favicon|agents|docs|lint|legal|robots|reviews|
  icons|search|ads|crm|campaigns|email|emdash|setup|media` (bin `vitops`), a thin wrapper over the generator + utils.
  `legal`/`search`/`ads`/`crm`/`email`
  are covered in their own sections below; `robots` (`vitops robots [--input <site.json>]
  [--site-env <name>] [--out <dir>]`) is `legal`'s sibling — same `Config`-anchoring, same
  stdout-or-`--out` shape — rendering `robots.txt` from the resolved environment's robots
  directive (falling back to `site.seo.robots`), the same fact `search notify`'s `noindex` gate
  already reads; `media` (`vitops media [--raw <dir>] [--out <dir>]`) encodes raw video into WebM
  - MP4 + poster via `ffmpeg`, caching runs on source content + encode settings in
    `.vitops/media-manifest.json` (`@getvitops/utils/media`'s `processMedia()`; `@getvitops/vite`
    has a matching `media` option). The package **ships a static `vitops-design-system` agent
    skill** (`skill/SKILL.md`, in `files`); `agents` symlinks it into a consumer's
    `.agents/skills/` + `.claude/skills/` (logical `node_modules/@getvitops/cli/skill` target — never
    a pnpm realpath — so links survive version bumps) and writes a managed pointer block into their
    `AGENTS.md`. `docs <topic>` prints a reference doc to stdout, rendered live from the consumer's
    config (`--docs-dir` on `agents` keeps the legacy emit-files layout).

  `lint` (`src/lint.ts`) scans consumer source for framework classes that resolve to nothing —
  the failure mode where an unknown utility is indistinguishable from a working one. It is
  **format-aware** (`md-flex-row` is real in css/bricks and inert in tailwind) and deliberately
  judges **only classes anchored to the consumer's own config** — a palette hue, a role, a type
  role, a shadow. It never tries to enumerate "all valid classes", because under the tailwind
  format that would mean knowing Tailwind's whole vocabulary and every unknown would be a false
  positive. It asks `roleColorUtilities()` what the generator emits rather than re-deriving it.

  `legal` renders the site's privacy policy, terms of service and cookie notice — see the
  Legal documents section below. It is one of the commands anchored to a `Config`
  rather than a `design-system.json` (with `icons` and `search`), because what it renders
  describes a site rather than a token set.

  `search` groups the two Search Console commands, both anchored to a `Config`. `search notify`
  tells search engines a deploy happened, from `site.seo.indexing` (this was the top-level
  `indexing` command, renamed with no alias) — see the Search-engine indexing section below.
  `search setup` onboards `site.searchConsole` domains as Search Console domain properties —
  see the Search Console onboarding section below.

- **`@getvitops/vite`** — a Vite plugin (Astro/EmDash) that runs the generator on build/dev (+
  optional favicon generation) and hot-regenerates when the config changes.
- **`@getvitops/astro`** — the **Astro integration**: a default `vitops()` integration
  (favicons/PWA + web-component bundles copied to `public/` + the design-system CSS generated and
  auto-injected) plus a `<Head />` component and HTML/type authoring helpers. Wraps generator + utils
  - vite + core.
- **`@getvitops/create`** — **`vp create` org templates** (no build step; published as-is). Its
  `package.json` carries a `createConfig.templates` manifest over bundled `templates/*` directories,
  so `vp create @getvitops` opens a picker and `vp create @getvitops:emdash` scaffolds an EmDash CMS
  website on Cloudflare Workers (D1 + R2) with `@getvitops/{astro,emdash,cli}` pre-wired.

  **Every template dep must be resolvable by a bare `npm install` in an empty directory** —
  `workspace:*` and `catalog:` are pnpm protocols that mean nothing outside this repo, and the
  publish-time rewrite that handles them for a package's own dependencies does **not** reach inside
  `templates/**`, which ships as verbatim data. **`@getvitops/*` deps use `latest`, not a `^` pin:**
  a pin is a version that was current the day it was typed and silently isn't afterwards — the
  emdash template sat on `@getvitops/astro: ^0.7.0` through the entire 1.0 release, scaffolding
  projects a major behind. `latest` is right here specifically because the toolchain packages are
  `fixed`, so it resolves to a set that was released together. `templates.test.ts` enforces both
  rules over every template. Third-party deps keep ordinary `^` ranges. `templates/**` is excluded
  from the root lint (imports resolve only in a scaffolded project). Ship `_gitignore` (renamed to
  `.gitignore` on scaffold).

  Shared template content (e.g. placeholder wireframe images for pre-imagery layout work) lives in
  `packages/create/assets/`, mirrored by hand into each template's `src/assets/placeholder/` and
  drift-guarded by `templates.test.ts` — `vp create` copies only the one directory a template names,
  so nothing can copy a sibling `assets/` for it at scaffold time.

- **`@getvitops/skills`** — agent skills as data (`skills/<name>/SKILL.md`, no build), for knowledge about the toolkit that must update after a site is scaffolded. A site depends on it and runs `skills experimental_sync` (the `skills` CLI's preview command; pin its version) from `prepare`, which links each skill into `.agents/skills/` and `.claude/skills/` and relinks on every run. The sync never replaces a directory it did not create, so a site overrides a skill by name. Skills tied to a site's own files (`promote`, `setup`) stay in the template; `vitops-design-system` still ships in `@getvitops/cli`. Independent version, like `emdash` and `create`.

Dependency versions are centralized in `pnpm-workspace.yaml`'s `catalog:` (referenced via the
`catalog:` protocol); internal deps use `workspace:*`. Both are rewritten to concrete versions on
publish.

Per-format output (into `outDir`): `tailwind` → self-contained `tailwind.css` + `tokens.json`;
`css` → bundled standalone `styles.css` + `tokens.json` + `design-manifest.json`; `bricks` → the
full deployable payload (`styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`,
`tokens.json`, JS bundles, `bricks/` PHP, `docs/`); `design` → `DESIGN.md` and nothing else. The
generator is **pure** — it mutates no shared state; the css/bricks bundle is assembled in memory and
minified with lightningcss.

`--format` takes a **comma-separated list** (`--format css,design`), so the brief composes with a
stylesheet. `Format` is the full union; **`StylesheetFormat` = `Exclude<Format, 'design'>`** is what
anything expecting a stylesheet types against (the Astro integration's `css.format`, `vitops lint`) —
`design` emits no CSS, so admitting it there would fail late with an unresolvable import.

**This repo dogfoods the tool:** the framework source lives in `@getvitops/core`
(`packages/core/{css,src}`); root `src/` holds only the example `design-system.json` — the live theme
editor that used to sit beside it is now `@getvitops/core/editor` (see below).
`packages/generator/scripts/prepare.mjs` snapshots core's CSS + built JS bundles (and
the repo's `bricks/` PHP) into `packages/generator/assets/` and emits `schema.json` /
`config.schema.json` — all gitignored build inputs, like `dist/`. The root `build` runs the toolchain
(`build:bricks` → `build:theme` → `lib/build-theme.ts` → the generator; no lightningcss CLI) — see
the Build system section.

Build/publish: `vp run build:packages` (core → generator → utils → cli → vite → astro; each task
`dependsOn` the packages it imports) and `vp run release` (`build:packages && changeset publish`).
Versioning is via Changesets (`.changeset/config.json`): `config`/`core`/`generator`/`utils`/`cli`/`vite`/`astro`
are **fixed** together — one version for the whole toolchain; `@getvitops/emdash` and
`@getvitops/create` version independently; the root and `site/` stay private/ignored.

Independent versioning does **not** mean unconstrained. `@getvitops/emdash` depends on
`@getvitops/utils` (a hard dep — `SEMANTIC_ICON_OPTIONS` is derived from its `iconMap`) and peers on
`@getvitops/astro` `>=6.0.0`. Both exist because its blocks render from the generated SVG sprite:
`<use href="…/icons.svg#icon-menu">` resolves to nothing if the site's toolchain built a different
icon vocabulary, and an **empty box is the entire failure** — no error, nothing to grep. Depending
on one member of a `fixed` group pins the whole generation, which is why one peer suffices. The
astro edge is a peer rather than a dep on purpose: a mismatch must be an install-time error, not two
copies of an Astro integration.

The lockstep is **load-bearing, not cosmetic**: `packages/generator/scripts/prepare.mjs` snapshots
core's CSS + built JS bundles into `packages/generator/assets/`, so generator@X ships a frozen copy
of core@X — while `@getvitops/astro` resolves `@getvitops/core/package.json` at _runtime_ and copies
the _installed_ core's bundles into the consumer's `public/`. A consumer's page thus gets its CSS
from generator@X and its web components from core@Y; `fixed` is what guarantees X == Y. Don't split
the group without solving that skew.

**Release runbook:**

1. `npx changeset` — describe the change in consumer-facing terms (this text becomes the published
   changelog; name breaking changes and their migration explicitly).
2. `vp run release:version` — `changeset version`: bumps every package and writes the
   per-package `CHANGELOG.md` files.
3. **Write the matching entry in the root `CHANGELOG.md`** — the curated, toolchain-level notes
   (Breaking / Added / Fixed + migrations). Summarise what step 2 generated; don't transcribe
   dependency bumps. Every package ships its own `CHANGELOG.md` in its tarball via `files`, so both
   layers reach consumers.
4. `vp run release` — `build:packages && changeset publish`.

**Two rules for what those entries must say**, both from downstream reports of time lost
reading changelogs that were accurate and still unanswerable:

- **A package bumped only by the `fixed` group says so explicitly.** `@getvitops/astro`
  shipped 1.0.0 and 2.0.0 with no Major Changes at all, and in 4.1.0 core/vite/emdash carried
  only "Updated dependencies" — so establishing that 4.0 → 4.1 changed no CSS and needed no
  code edits meant reading seven changelogs to conclude nothing. Write **"No consumer-facing
  change in this package"** rather than leaving the absence to be inferred; a lockstep major
  is otherwise indistinguishable from one whose notes were forgotten.
- **Every pattern-CSS entry names the formats it reaches** — `css/bricks only`, `tailwind
  only`, `all formats`. The `.rhythm` heading-spacing change was written as a plain breaking
  change and never reached the tailwind output; a consumer diffed builds to establish that.
  One clause settles it.

Anything renamed must be reachable by `vitops lint --fix` (see `lint-tokens.ts`) or the
entry must say why it isn't — the migration table in prose is the fallback, not the plan.

## Legal documents

`generateLegal(site, …)` renders privacy, terms, cookie notice and accessibility statement from a `Config`. The config records facts; the template owns prose. Providers derive from config, never a hand-kept string; every document opens with a review banner.

Detail and rationale: [internals/legal.md](internals/legal.md).

## Conversion tracking and notifications

`<Tracking />` captures click IDs into the first-party `_ac` cookie (after `marketing` consent); `createConversionRoute()` reads it back and notifies via `site.notifications`. The plan is pure and says why anything is skipped. The Worker-side `utils` subpaths (`tracking`, `notify`, `security`) may not use Node builtins.

Detail and rationale: [internals/conversion-tracking.md](internals/conversion-tracking.md).

## Search-engine indexing

`vitops search notify` resubmits the sitemap, pings IndexNow and verifies with `--check`. Google has no request-indexing API: never wire the Indexing API, never describe this as making Google re-index faster. The `noindex` gate reads the environment; the snapshot is written last, only on success.

Detail and rationale: [internals/indexing.md](internals/indexing.md).

## Issue reporting and triage

`vitops report` drafts a redacted issue for the public tracker; the person confirms. `FORM_FIELDS` mirrors the issue forms (drift-tested). The triage bot classifies and comments only, and runs only for trusted authors.

Detail and rationale: [internals/issue-reporting.md](internals/issue-reporting.md).

## Search Console onboarding

`vitops search setup` ensures the verification TXT, verifies ownership, adds the `sc-domain:` property. Pure planner, DNS only ever created, verification retries then reports PENDING, Google user OAuth (no `googleapis`).

Detail and rationale: [internals/search-console.md](internals/search-console.md).

## Ad-platform linking

`site.ads` records each platform as facts; `vitops ads setup|tags|lint` and `<Ads />` derive from it. No platform Marketing API is called. A missing config value is `blocked` with the field in `needs`. `AD_PLATFORMS` is the single source for cookies, click IDs and tags.

Detail and rationale: [internals/ads.md](internals/ads.md).

## Sender-domain onboarding (`vitops email`)

`vitops email setup|check` onboards a sending domain on Cloudflare Email Sending and guards deploys. The onboarded entity is an exact name, usually `send.<domain>`, never the apex a `from` names.

Detail and rationale: [internals/email.md](internals/email.md).

## CRM submissions

`site.crm` (HubSpot, Zoho Bigin, Jobber) is written server-side from `createConversionRoute()`, CRM before notify. A failed CRM write never fails the request; consent gates `_ac`, never the write; credentials are a function of `locals`. Jobber answers 200 for failures, so classify on the body. Wait for real issues before changing it.

Detail and rationale: [internals/crm.md](internals/crm.md).

## Client onboarding

`SETUP.html` is the checklist and `vitops setup` runs most of it (repo, hosting, domain; forwards to `search setup` and `ads setup`). Never destructive; `CLOUDFLARE_API_TOKEN` is always `blocked`; `setup domain` plans and checks but never performs the cutover.

Detail and rationale: [internals/client-onboarding.md](internals/client-onboarding.md).

## Site chrome: the masthead and nav behaviour

`site.chrome` states how the top bar looks and how navigation behaves; `<Masthead>`/`<SiteNav>` read it through `resolveMasthead()`/`resolveNavOptions()`. Scroll behaviour is `states`: partial overrides over a settled base, so a browser without `scroll-state()` keeps a readable bar. Heights and insets are a closed grammar (`isSafeLength`).

Detail and rationale: [internals/chrome.md](internals/chrome.md).

## Google reviews

`vitops reviews` fetches Business Profile reviews (legacy v4 API, user OAuth) into a committed `.vitops/reviews.json`; `selectReviews()` is the one place that decides what a site shows. Review JSON-LD is opt-in. Also holds the block escape hatches (`rootAttrs()`: `anchor`, `className`, `style`, `theme`) and widget areas.

Detail and rationale: [internals/reviews.md](internals/reviews.md).

## Development

The build system uses `vite-plus` (`vp`), which is a wrapper for common tools for SDLC tasks. **Vite+ must be installed globally** (a toolkit requirement, for this repo and every scaffolded site): invoke it as plain `vp`, never `npx vp` — npm rejects a `devEngines.packageManager` that names pnpm (`EBADDEVENGINES`), and `vp` uses the project-installed version when there is one and the global one otherwise. Node and pnpm are pinned by `engines.node` / `devEngines` / `packageManager` in `package.json`, not by `.nvmrc` / `.node-version`:

- `vite-task` (`vp run ...`) - task orchestration with caching, even across monorepo packages
- `oxfmt` (`vp fmt`) - formatting md/css/js/ts/html
- `oxlint` (`vp lint`) - linting js/ts
- `vitest` (`vp test`) - unit/integration testing
- `vite` (`vp build`) - libraries/application build meta-tool for web runtimes
- `tsdown` (`vp pack`) - libraries/applications build meta-tool for server runtimes

It also supports:

- running pre-commit hooks on staged files using the `staged` key in `vite.config.ts`

They are all configured with their respective keys in `vite.config.ts`

Other tools used:

- `lightningcss` - css minification/bundling
- `playwright` - e2e testing. Two narrow suites exist (`vp run docs:e2e`, both `*.e2e.ts` —
  not `*.spec.ts` — as two Playwright projects against `site/`):
  `site/e2e/no-js-fallback.e2e.ts` (real Chromium with `javaScriptEnabled: false`, proving the
  tier-2 no-JS-fallback promise above rather than assuming it — the promise `*.dom.test.ts` files
  (happy-dom) never check, since those test JS-ON enhancement) and
  `site/e2e/forced-colors.e2e.ts` (real forced-colors emulation, proving a keyboard focus ring
  survives Windows High Contrast Mode — a real computed style, not a guess about the cascade).
  Runs on a dedicated port (`playwright.config.ts` explains why 4321, Astro's default, is the
  wrong one); wired into CI as its own `e2e` job, separate from `test`, because it needs a
  browser binary the unit-test job has no other reason to carry.
- `vp run verify:e2e` — the whole-toolchain end-to-end (`scripts/e2e-audit.mjs`): scaffolds the
  emdash template against THIS checkout's packages (shared Verdaccio plumbing in
  `scripts/lib/scaffold.mjs`, same as `verify:scaffold`), lays the **test-only** overlay from
  `packages/create/e2e/` over the scaffold's copy (a `/blocks` page with every plugin block, a
  `/landings/showcase` page of `vitops_section` block types — fixtures keyed by block type,
  `fixtures.test.ts` fails until a new block in `BLOCKS` has one), builds, serves `dist/client`
  with `public/_headers` applied and runs `vitops audit`. The overlay must never reach
  `templates/**` or the package's `files` (`templates.test.ts` guards it). The report lands in
  `.vitops/e2e-audit/` (`report.md`, `report.json`); extra flags go after `--`: `--warn` (report
  without failing — CI's current mode, see the `e2e-audit` job), `--out`, `--pages`, `--keep`.
  **`--pause`** (or `VITOPS_E2E_PAUSE=1`) runs the audit, prints the results, then keeps the
  server up and waits for Ctrl+C so you can browse the site and the report; it keeps the temp
  scaffold unless `--no-keep`, and is **refused when `CI` is set**. `--serve-only` skips the audit
  and pauses. A seed's sample content is only applied by EmDash's setup wizard, never by a build,
  and the template's `runtime: 'check'` prerenders a pending-migrations page against an
  unmigrated database — so the script seeds the local D1 through the dev-bypass setup endpoint
  before building.

### Seeing rendered pages

**`playwright-cli` is the one sanctioned way for an agent to look at a rendered page** — not the
Claude-in-Chrome extension, not Playwright MCP or any other browser MCP server
(`.claude/settings.json` denies `mcp__claude-in-chrome__*` and `mcp__playwright__*`). Three reasons:
a CLI + skill keeps the model's context free of tool schemas and full accessibility trees (output
goes to files under `.playwright-cli/`, gitignored); it is reproducible, since it is the `playwright`
this repo already pins in the catalog and `vitops audit`/`site/e2e` already use (the standalone
`@playwright/cli` package pins its own alpha `playwright` and a second browser download, so we don't
install it); and it needs no user-level browser or extension setup.

- Invoke as `pnpm exec playwright cli …` (`npx --no-install playwright cli …` also works). `prepare`
  runs `playwright cli install --skills`, writing the upstream command reference to
  `.claude/skills/playwright-cli/` (gitignored — regenerated from the pinned version). Defaults live
  in the committed `.playwright/cli.config.json` (headless Chromium).
- Serve first, then look: `docs:dev` (4321) for `site/`, `verify:e2e --pause` for the scaffolded
  EmDash site, or open `index.html` as a `file://` page only with `PLAYWRIGHT_MCP_ALLOW_UNRESTRICTED_FILE_ACCESS=1`.
  Remember a running `docs:dev` serves stale framework CSS (see Build system) — check the served
  file before blaming the CSS.
- `snapshot` before `screenshot`: the snapshot is text and cheap; screenshot only when the question
  is visual (layout, colour, dark mode via `data-theme="dark"`). One named session per task
  (`-s=<task>`), `close` when done.
- Tier-2 no-JS fallbacks: prove them with a config setting `javaScriptEnabled: false`
  (`open --config=…`), the same promise `site/e2e/no-js-fallback.e2e.ts` asserts.

### Task Notes

- `.astro` formatting is Oxfmt's, and is **opt-in twice**: `fmt.astro: true` in `vite.config.ts` _and_
  `@astrojs/compiler-rs` declared as a devDependency (catalog here; plain range in templates). Without
  either, `.astro` files are skipped silently — a transitive copy via `astro` is not a contract.
  `templates.test.ts` guards both for the scaffolds. `site/` is formatted too, minus its generated paths.

- there is no format-on-edit hook: formatting and mechanical lint fixes run in the pre-commit hook (`vp check --fix`). Run `vp check` yourself once a change is complete, and read its output.
- if `vp check` passes locally but CI's `vp check` reports formatting issues, suspect a stale hoisted `node_modules/oxfmt`
  (or `oxlint`/`vite`) left by an old `npm install`: `vp` resolves the formatter from the project root, so it shadows
  the version pnpm pinned. `ls node_modules/oxfmt` should not exist — `node_modules` is pnpm-owned; reinstall with
  `pnpm install --frozen-lockfile`.
- `index.html` is the evergreen docsite that should dogfood the output of the build. Make sure it's kept up to date

## Output

- Bricks Builder supports some design system features out of the box (e.g. Font, Spacing, Typography, and Color Managers), so when targeting it some parts that would be in the CSS output are instead output as JSON so they can be imported into Bricks for use in the UI and which outputs the CSS itself.

## Design Guidelines

- Set of CSS properties for colors, spacing, typography (fonts, scale, roles: display|title|heading|body|quote|caption|eyebrow|code|lead|footnote|tag (each with font, size, decoration, transform, tracking, etc.)), animations (kinds, curves, durations), pattern primitives (border, drop-shadow, padding)
- General layout utilities (.centered, .flex*, .split*, .rhythm)
- Color utilities (.bg*, .text*)
- Spacing utilties (.space\*)
- Typographic utilities (.font-display, .font-title, ...)
- Animation utilities (see @src/css/animations.css)
- Patterns (link, cta, btn, card, badge, etc.)

## Codegen flow

The generator reads a config and assembles colour, shadows, patterns and animation layers in memory. Every ramp shares one lightness ladder; tokens are `--color-<target>-<role>[-<variant>]`; contrast is enforced at build time. The bundle is layered (`vitops.base|components|utilities`); `LAYER_CONTRACT` pins one classification across css and tailwind. Format modes: `tailwind` (default), `css`, `bricks` (not actively maintained), `design`. Icons are named by meaning and resolved per set. Read the file before changing a generator emitter, a layer or an icon.

Detail and rationale: [internals/codegen.md](internals/codegen.md).

## Build system

Everything goes through `vp run <name>`; the root build dogfoods `@getvitops/generator`; `docs/**` and `DESIGN.md` are generated, never hand-edited. A running `docs:dev` does not pick up edits to `packages/core/css/**` or a rebuilt generator: check the served file before blaming the CSS.

Detail and rationale: [internals/build-system.md](internals/build-system.md).

## CI/CD

`dev` is the integration branch and auto-deploys the `-dev` worker; `main` is protected and its prod deploy waits on an admin approval. Client repos call reusable `site-*.yml` workflows pinned to `@v1`, a moving tag moved deliberately by `release-workflows.yml`. Code truth flows `dev → main`; EmDash content truth is production. Never reset a database that is not named `*-dev` or `*-rehearse-<digits>`.

Detail and rationale: [internals/ci-cd.md](internals/ci-cd.md).

## Deploy

`lib/deploy.ts` has two modes, switched on env vars:

- **Remote (default):** rsync over SSH using `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` (+ optional `DEPLOY_PORT`, `DEPLOY_KEY`). `--dry` previews via `rsync -n`.
- **Local symlink:** set `DEPLOY_LOCAL_PATH` to a theme `dist/` directory (e.g. a WPLocal site) and the script idempotently symlinks it to this repo's `dist/`. One-time setup; subsequent builds are "auto-deployed" because the symlink follows them. The script refuses to clobber a non-symlink, so it's safe to point at an existing path.

`vp run deploy` chains `build` first, so it always ships a fresh `dist/`.

This deploy has nothing to do with the client-site CI/CD model above — it ships this
repo's own Bricks theme output, not a scaffolded site.

## Note on README.md

`README.md` is a one-line stub (`# Vitops Design System Generator`) — it says nothing, rather than saying something stale as it used to. The authoritative descriptions are this file for rationale and [ARCHITECTURE.md](ARCHITECTURE.md) for structure. Expanding the README is still open; if you touch user-facing docs, write it as a short landing page pointing at those two plus <https://docs.vitops.ca>, not as a third copy of either.
