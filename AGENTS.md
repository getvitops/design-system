This repo is responsible for generating design systems for use in websites (primarily Astro and WordPress with Bricks Builder).

It is composed of:

- TS-based utilities
- Variable-based lightweight CSS Framework for high level design patterns and common utilities (e.g. track-based centering of content, vertical rhythm, UI patterns)
- Lit-based Web Components for patterns that benefit from progressive enhancement (they are styled via the CSS Framework, and are fully operable, although degraded, in non-JS environments)

Prefer using modern CSS/HTML features (e.g. CSS Anchor Positioning API, Dialog, Invoker Commands API, Scroll Timelines, etc.) over JavaScript.

## Component architecture

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

3. **Platform wrappers** (`@getvitops/astro` components; future `@getvitops/bricks`) — thin
   **authoring conveniences (DX)** for the pure-HTML/CSS patterns: they render the correct
   markup/classes so authors don't hand-write boilerplate, and they **must not require runtime JS**.
   - e.g. `Subgrid.astro` just emits `<ul class="grid"><li class="grid-rows-subgrid">…</li></ul>` from
     slotted children; `Popover.astro` uses the native Popover API + Anchor Positioning;
     `Nav`/`Details`/`Drawer` compose `<details>` + Invoker Commands (`command`/`commandfor`) — all
     no-JS. Renderers like `NodeRenderer`/`FormRenderer` turn a data model into that markup at
     SSR time.
   - **The rule:** if a wrapper would need runtime JS, it's the wrong tier — build a **web component**
     (tier 2) instead, and have the wrapper emit its `<wc-*>` tag with the accessible fallback inside.
     A feature-detected polyfill for a native CSS/HTML feature is fine; application/behaviour JS is not.

**The one deliberate exception: `<wc-theme-editor>`** (`@getvitops/core/editor`). It is _tooling_, not
a page pattern — a live editor has no accessible no-JS fallback to enhance, so it fails the tier-2 bar
on purpose. It is quarantined instead of excused: its own bundle entry (`src/js/editor.ts` →
`dist/editor.js`), never registered in `elements.js`, opt-in per consumer
(`vitops({ editor: true })`), and carrying no Lit, so a production page that doesn't ask for it
pays nothing. Don't use it as precedent for putting behaviour JS in a `<wc-*>` element.

## The consent gate

`@getvitops/core/consent` (`src/js/consent.ts` → `dist/consent.js`, ~2.8 KB gzipped, no Lit) is a
**general** permission gate, not an analytics feature. Anything marked `data-consent="<category>"` —
a third-party tag, an A/B assignment, a personalisation cookie, an embedded map — waits on one
choice, exposed as `window.vitopsConsent` plus a `vitops:consent` event on `document`. Categories are
`necessary` / `analytics` / `marketing` / `preferences`, defined once in `consent/store.ts` and
mirrored (not imported) by `@getvitops/astro`'s `analytics.ts`.

**The banner is demand-driven, and that splits one idea into two.** _Offered_ categories are a
build-time fact — which rows `<CookieConsent />` renders — and the default is deliberately generous,
because a hidden row costs nothing. _Demanded_ categories are a runtime fact: what something has
actually asked for and the visitor hasn't answered. `needed()` is a question about the demand
register, never about the mere absence of a cookie, so a site whose only provider is cookieless
never interrupts anyone. Demand is registered by a gated element **reaching its loading strategy**
(so an `idle` tag asks after `load`, off the LCP path, and an `interaction` tag asks only once the
visitor acts) or by an explicit `require()` / `request()`. `<color-scheme-toggle>` is the reference
consumer: it applies the scheme immediately and gates only the `localStorage` write.

Six things are load-bearing:

- **`type="text/plain"` is what makes the gate real.** A gated tag renders inert with its URL on
  `data-src`; the browser neither parses the body nor fetches the library, so an undecided visitor's
  page issues no third-party request. A gate that instead _asks_ a loaded third-party script not to
  track is a promise. Never give a gated tag a live `src`.
- **Nothing is stored until the visitor chooses.** Absence of the cookie is undecided, and undecided
  denies everything but `necessary`. If the banner wrote state just by appearing, it would be the
  thing it asks permission for. Equally, a corrupt or wrong-version cookie **re-prompts** rather than
  reading as "decided, all denied" — the safe-looking read strands a visitor who wants to opt in with
  no way to say so.
- **"Not asked" is a third value, not a synonym for "declined".** The cookie (v2) records each
  category as `true` / `false` / `null`, and only `null` can be re-prompted. This is what lets a
  preferences demand arrive after an analytics prompt was already answered. It also means a patch
  must cover **exactly** the categories a showing put on screen: `<wc-consent>` builds its own patch
  rather than calling `acceptAll()`, because "Accept" on a preferences-only prompt that granted
  analytics would be consent nobody gave. Widening a patch to "all categories" is the easy version
  of this bug.
- **Revoking clears cookies and reloads.** An already-executing tracker cannot be unloaded any other
  way; clearing alone only stops it identifying the visitor _next_ time. Cookie names ride on
  `data-consent-cookies`, written by whoever emitted the tag — a provider table in core would be a
  second copy to keep in step with the generator's processor table.
- **The store is pure and the DOM wiring is not tested.** `@getvitops/core` has no DOM test
  environment, so everything legally decidable (what an absent cookie means, what a corrupt one
  means, what a revoke covers, **whether a prompt is warranted** — `needed(state, demanded)`) lives
  in `consent/store.ts` as functions over a cookie string and is asserted in `store.test.ts`. Keep
  new decisions on that side of the line.
- **`<Head />` emits an inline stub, and its absence is meaningful.** `consent.js` and `elements.js`
  are both deferred with no ordering between them, so a toggle can upgrade and be clicked before the
  gate exists. The stub makes the gate's _existence_ known synchronously in `<head>`; it answers
  `false` and queues, and the runtime replays the queue. So an absent `window.vitopsConsent` reliably
  means **this site has no gate** — read it as "store freely", never as "denied". Callers in
  `elements.js` must not import anything from `consent/` as a value: doing so made `store.ts` a
  shared chunk and cost every page with a theme toggle an extra 688-byte request for one string.
  `WCColorSchemeToggle` mirrors `CONSENT_EVENT` and `store.test.ts` pins the two spellings.

The facts that drive the gate must also drive the **generated cookie notice** — see the Legal
documents section. `site.analytics.clarityId` in a config is what makes the notice name Clarity; the
same provider in `vitops({ analytics })` is what makes the tag load. The Astro integration warns
when the two disagree, because a site running a tag its own notice omits is a compliance defect
rather than a documentation gap.

## The live theme editor

`<wc-theme-editor>` layers runtime `:root` overrides over the generated token layer via one injected
`<style id="ds-overrides">`, so the whole design system is tunable in the browser with no rebuild. It
reads its editable surface from `design-manifest.json` (a `css`-format output) and exports edits back
as CSS or as a `design-system.json` patch; on a dev server running `@getvitops/vite`, **Save to
source** POSTs that patch to `/__vitops/design-system` and the plugin merges → validates → writes →
regenerates. On any static build the probe fails and the button isn't rendered.

These are load-bearing and easy to break:

- **A role is not a ramp alias.** `--color-<role>-<step>` is never emitted — a role resolves to
  target-prefixed tokens (`--color-bg-<role>`, `--color-bg-<role>-solid`, `--color-text-<role>`, …).
  `text-on-<role>` can't be derived in the browser (it's a computed contrast literal), which is why
  the manifest ships **`colors.roleTokens`** precomputed per hue, in `chromatic` and `surface`
  variants × light/dark. A remap copies that set; it does not rewrite a ramp reference. The previous
  editor got this wrong and wrote 11 dead declarations per role.
- **The role's `kind` travels with it** in `manifest.colors.roles`, and the editor must read it from
  there rather than inferring `role === 'surface'` — the two kinds emit _different token sets_, so
  inferring silently gave the wrong set to `neutral` and to any consumer-named surface role.
  `buildPatch` writes `colors.roles.<role>` as the **object** form for the same reason: a bare hue
  string means chromatic, so patching one over a surface role would demote it on the next build.
- **Palette hexes are scheme-global.** The dark block re-points which step each token reads; it never
  redefines `--color-<hue>-<step>`. Hue edits therefore belong in `:root` only.
- **A step maps to `colors.palette.<hue>.anchors.<n>`, not `.seed`.** The seed regenerates the whole
  ramp, and mapping all 11 steps to one path silently loses every edit but the last.
- **The patch is always design-system-relative; the file it lands in may not be.** The editor only
  knows about a design system, so when the plugin's `input` is a site config the server merges into
  — and validates — the design-system _subtree_ (`designSystemPath()` in `@getvitops/vite`), writing
  only the surrounding file whole. It reads that path off the **raw** on-disk object, not the
  resolved one: `resolveConfig` normalises the two `designSystem` shorthands in memory, so a
  writer assuming the canonical shape would grow a `themes` key beside the author's bare map and
  silently edit a copy nothing builds from. Merging at the root instead is the louder version of the
  same bug — a `colors` key beside `organization`, and `validate` rejecting the site config
  wholesale so every save fails with errors about the wrong document.

Consumers point the element at its manifest with the `manifest` attribute; the Astro integration's
`editor: true` mirrors the file to `/vitops/design-manifest.json` (the default) _inside the generate
pass_, so it can't race a cold start or go stale after a config edit.

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

- **`@getvitops/utils`** — shared build-time utilities (favicon generation via `sharp` +
  `png-to-ico`, loaded lazily; `oxipng` crush optional). Consumed by cli/vite/astro.
- **`@getvitops/cli`** — `vitops generate|init|validate|favicon|agents|docs|lint` (bin `vitops`), a
  thin wrapper over the generator + utils. The package **ships a static `vitops-design-system` agent
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
  Legal documents section below. It is one of the three commands anchored to a `Config`
  rather than a `design-system.json` (with `icons` and `indexing`), because what it renders
  describes a site rather than a token set.

  `indexing` tells search engines a deploy happened, from `site.seo.indexing` — see the
  Search-engine indexing section below.

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

Build/publish: `npx vp run build:packages` (core → generator → utils → cli → vite → astro; each task
`dependsOn` the packages it imports) and `npx vp run release` (`build:packages && changeset publish`).
Versioning is via Changesets (`.changeset/config.json`): `core`/`generator`/`utils`/`cli`/`vite`/`astro`
are **fixed** together — one version for the whole toolchain; `@getvitops/emdash` and
`@getvitops/create` version independently; the root and `apps/*` stay private/ignored.

Independent versioning does **not** mean unconstrained. `@getvitops/emdash` depends on
`@getvitops/utils` (a hard dep — `SEMANTIC_ICON_OPTIONS` is derived from its `iconMap`) and peers on
`@getvitops/astro` `>=2.0.0`. Both exist because its blocks render from the generated SVG sprite:
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
2. `npx vp run release:version` — `changeset version`: bumps every package and writes the
   per-package `CHANGELOG.md` files.
3. **Write the matching entry in the root `CHANGELOG.md`** — the curated, toolchain-level notes
   (Breaking / Added / Fixed + migrations). Summarise what step 2 generated; don't transcribe
   dependency bumps. Every package ships its own `CHANGELOG.md` in its tarball via `files`, so both
   layers reach consumers.
4. `npx vp run release` — `build:packages && changeset publish`.

## Legal documents

`generateLegal(site, { docs, output })` (`packages/generator/src/legal/`) renders a privacy
policy, terms of service and cookie notice from a **`Config`**. It reads facts from two of its
sections — the company from `organization`, what the site actually does from `site` — which is
the split the documents already assumed. It is a sibling of
`generateDocs`, **not** a `generate()` format, and that is structural rather than stylistic:
`generate()` is keyed to a `DesignSystem`, so a legal format would be a format that ignores
its own input. It returns a `{ filename: content }` map and lets each caller write it.

The governing rule is **the config records facts; the template owns prose.** Nothing in
`derive.ts` writes a sentence a lawyer would review, and no template invents a fact. That is
what lets wording be corrected without touching a consumer's config, and a consumer's
provider change without touching prose. It also means **the fix for a wrong policy is a
corrected config** — hand-editing the output is overwritten by the next build.

Four things here are load-bearing:

- **The provider table (`providers.ts`) is what makes derivation possible.** A policy naming
  Plausible while the site runs GA is a compliance defect, not a typo, so the provider comes
  from which analytics ID is set, whether `site.security.turnstile.siteKey` exists, and what
  `site.deployment.platform` says — never from a hand-maintained string. It covers only what the
  schema can imply; everything else (payment, CRM, mail) is declared in
  `site.legal.privacyPolicy.processors` and flows through the same pipeline. `cookies: []` is
  **meaningfully different from `undefined`**: it asserts a provider is cookieless (Plausible),
  which the cookie notice states positively rather than omitting.
- **Form templates are the PII inventory.** `site.templates` entries of type `form` are the only
  place the config says what personal information the site actually collects, so
  `piiCollected` derives from their `FormFieldSchema` fields. `hidden` fields and honeypots are
  excluded — neither is visitor-supplied, and describing them as collected would be untrue.
- **The markdown subset is closed and the renderer throws outside it.** We author every
  template, so `render.ts` is exactly as capable as they are: `#`/`##`/`###`, `- ` bullets,
  `> ` quote, `**strong**`, `` `code` ``. An unsupported construct is an error, not a silent
  degrade — that is what stops a literal `| --- |` reaching a published page. HTML goes through
  `nodesToHtml` from `@getvitops/utils` (escaping already solved); Portable Text maps the `> `
  quote to `vitops.banner` and **drops the `# ` heading**, which is EmDash's `data.title` field.
- **`JURISDICTIONS` in `config.ts` and `TEMPLATES` in `legal/templates/index.ts` are checked
  against each other** by `satisfies`. Adding a jurisdiction is: author three templates, add
  one enum member, add one registry key — skip either and it fails to compile rather than
  rendering against the wrong body of law. Only `ca` (PIPEDA) ships; its prose names the
  Office of the Privacy Commissioner of Canada and frames transfers as "outside of Canada",
  so do not reuse it elsewhere.

Delivery is one renderer, four consumers — the CLI is the load-bearing one, because it is the
surface every consumer has regardless of stack:

| Consumer      | How                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **any stack** | `vitops legal [--doc <name>] [--format md\|html\|portable-text] [--out <dir>]` — stdout without `--out`. Hugo, Eleventy, a hand-built WP theme need no integration code.                                                                                            |
| **WordPress** | `generate({ site })` also emits `dist/legal/*.html`; `bricks/load.php` registers `[vitops_legal doc="privacy"]`, whose `doc` is matched against a fixed allowlist (it lands in a filesystem read). `legal.test.ts` drift-guards that allowlist against `DOC_SLUGS`. |
| **Astro**     | `vitops({ legal: { input, out } })` — a sibling of `css`, not a widening of it. Runs inside `@getvitops/vite`'s `run()` so it regenerates on config change; writes markdown to a content collection. No route injection (nothing in the repo does that).            |
| **EmDash**    | `--format portable-text`, pasted into the admin. The scaffolded seed keeps its short, obviously-unfinished placeholders on purpose — a full generated policy for a fictional business is likelier to ship unread.                                                   |

Every document opens with a non-optional review banner. These are rendered from a template by
a build tool; the one failure mode with real consequences is a consumer publishing one as-is.

## Conversion tracking and notifications

A visitor arrives on an ad with a click ID in the URL; `<Tracking />`
(`@getvitops/astro`) captures it into the first-party **`_ac`** cookie; when they later
submit a form or tap a `tel:` link, `createConversionRoute()` reads the cookie back and
notifies whoever the config names. Three packages, split along the seams the rest of the
toolchain already uses:

| Layer                                         | Where                       | Why there                                                |
| --------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Attribution vocabulary + cookie               | `@getvitops/utils/tracking` | Framework-agnostic, needed on **both** sides of the wire |
| Plan / render / send                          | `@getvitops/utils/notify`   | Pure planner, I/O sender — `indexing/`'s split exactly   |
| Capture script, `<Tracking />`, route factory | `@getvitops/astro`          | Beside `analytics.ts` + `<Analytics />`                  |

Both `utils` entries are separate subpaths because they are the only modules that run in a
**Worker** rather than at build time — keeping them off `src/index.ts` is what stops a
conversion endpoint pulling `sharp` into its bundle. Neither may use a Node builtin.
`TrackingConfig`/`NotificationsConfig` mirror the `site.*` blocks structurally, since utils
cannot import from the generator — the same arrangement as `IndexingConfig`.

Six things are load-bearing:

- **The capture demands consent; it does not merely read it.** `_ac` is a 90-day identifier
  tying a visitor to an ad, so it waits on `marketing` (configurable — `site.tracking.category`).
  The script calls `require()`, which is what _raises the banner_. It previously called
  `granted()` passively, and that is a permanent no-op: nothing else on a page demands
  `marketing`, so it was never offered, never granted, and `_ac` was never written — silently,
  on every gated site. The integration adds `marketing` to the offered categories when tracking
  is on, so there is a row for the category the script will ask about.
- **Only an arrival that carried something asks.** The demand is guarded on the URL actually
  holding a click ID or UTM. An organic visitor has nothing to attribute and is never
  interrupted — demand-driven consent applied to attribution.
- **The capture is synchronous; only the write waits.** Reading the query string is not storage
  and needs no permission; keeping it does. The click ID is in the URL only on the landing page,
  so deferring the _read_ would lose it. The script also listens for `vitops:consent` rather than
  calling `subscribe()`: `window.vitopsConsent` may still be the inline stub (which has no
  `subscribe`), and a grant can arrive later in the same page view.
- **The marker carries `data-consent` but NOT `data-vitops-tag`.** So `scan()` never tries to
  activate the script — it is ungated by design — while `clearCookies()`, which queries
  `[data-consent="…"]`, finds it and clears `_ac` on revoke.
- **`ConversionEvent` is the abstraction.** The event is the _fact_; how it reads belongs to the
  channel. That is what lets an SMS channel render 160 characters from the same event an email
  renders in full — the rule the legal templates already follow, applied here.
- **The plan is pure and says why anything is skipped.** `planNotifications` touches no network
  and no binding, so a misconfigured site can be told exactly why no notification will arrive.
  A silently unsent conversion notification is indistinguishable from no conversion.

The `email` channel uses Cloudflare Email Sending's **current** binding — structured
`env.EMAIL.send({ to, from, subject, html, text })`, not the legacy `EmailMessage` + hand-built
MIME. The binding is **passed in, never imported**, so utils takes no Cloudflare dependency.
Only transient codes are retried; `E_SENDER_NOT_VERIFIED` and friends are surfaced verbatim,
because nothing here can check whether the sending domain was onboarded
(`wrangler email sending enable <domain>`) and "send failed" would hide the one thing worth
knowing.

**TODO — `sms` and `persist` channels**, and the generic content+provider helpers behind them.
The seam is `NotificationsConfig` plus a sender with `sendEmail`'s signature; adding one should
mean a new file, a branch in `planNotifications` and a schema variant, touching neither
`ConversionEvent` nor the recipient cascade. Only `email` is implemented — one channel is not
enough to know what the abstraction should be.

`_ac` is disclosed by the generated cookie notice via `firstPartyCookies` in `legal/derive.ts`.
It is first-party, so no provider table would ever name it, and a site running attribution
alongside a cookieless analytics provider would otherwise be described as setting no cookies.

## Search-engine indexing

`vitops indexing` (`packages/cli` → `@getvitops/utils/indexing`) replaces the manual "open Search
Console and resubmit" step at the end of a deploy. It reads a **`Config`**'s `site.seo.indexing`
block.

**Start from what search engines actually accept, because the obvious assumption is wrong and
every design decision here follows from it:**

- **Google exposes no "request indexing" API.** The button in the Search Console UI is not in
  the Search Console API or anywhere else, and the **URL Inspection API is read-only**.
- **The sitemap ping endpoint was removed in June 2023.** `google.com/ping?sitemap=` is a no-op.
- **The Indexing API is scoped to `JobPosting`/`BroadcastEvent`.** It accepts other URLs and
  discards them; general use violates its terms, with the consumer's own GCP project on the
  line. **Deliberately not wired** — shipping a documented path to that in a toolchain other
  people install is handing them the violation. Don't add it.
- **Google does not participate in IndexNow.** Bing, Yandex, Naver, Seznam and Yep do.

So the command does every sanctioned thing and then **verifies**: resubmit the sitemap
(`sitemaps.submit`), ping IndexNow, and `--check` inspects `priorityUrls` and exits non-zero on
one Google hasn't indexed. That last part is what actually replaces the manual visit. Never
describe this as making Google re-index faster.

Five things are load-bearing:

- **The pure/I-O split is the same one the consent store makes.** `indexing/plan.ts` decides
  everything — which URLs, which channels, why each was skipped — and touches no network, no
  filesystem, no clock; `indexnow.ts` and `gsc.ts` execute a plan and decide nothing. That is
  what makes `--dry` a _complete_ account of a run rather than an approximation, and what lets
  `plan.test.ts` assert the consequential cases without a network.
- **`lastmod` is not a nice-to-have, it is the mechanism.** The changed-URL diff compares each
  entry's `<lastmod>` against `.vitops/sitemap-snapshot.json`. With no lastmod the diff can see
  pages appear and disappear but never see one _change_ — so an edited page is never
  resubmitted, and the command looks healthy while doing less than it appears to. `plan()`
  therefore counts lastmod-less entries and says so every run. `gitLastmod()` in
  `@getvitops/astro` derives real dates from `git log`; it is an exported helper rather than a
  `sitemap` option because it shells out to git and returns **nothing** from a shallow CI clone
  (`fetch-depth: 1`), a caveat that belongs at the call site. It leaves an unmatched URL alone
  rather than stamping the build time: Google weighs lastmod only while it stays consistent with
  what changed, so a site that stamps every page every deploy teaches it to distrust the field
  site-wide.
- **The `noindex` gate reads the environment, so the URLs must too.** `plan()` refuses the whole
  run when the resolved environment's `robots` contains `noindex` — submitting a staging host to
  IndexNow publishes it to several engines and invites them to crawl it, which a later directive
  does not undo. This is why `toIndexingConfig` derives the origin from `site.environments[env].url`
  **before** `domains.canonical`: the canonical is the _production_ origin, so deriving from it
  while notifying staging would submit production URLs that the gate — reading the environment —
  would not catch.
- **Verify the IndexNow key file before submitting.** A submission whose key file is unreachable
  returns `403`, but one whose key file is _reachable and stale_ is accepted with `202` and then
  silently discarded. Only a prior GET distinguishes "submitted" from "submitted and ignored",
  which is the exact failure this command exists to remove. The key is **not a secret** — the
  engine fetching it back is the ownership proof — so it lives in the config, and the Astro
  integration writes `public/<key>.txt` from it.
- **Write the snapshot last, and only on success.** Writing it eagerly records URLs as notified
  that never were, and because the next run diffs against it, one transient 503 would drop those
  pages from every future run — silently and permanently. Equally, a corrupt or absent
  snapshot reads as "submit everything, and say so", never as "nothing changed".

Credentials follow `lib/deploy.ts`'s env-var pattern; the toolchain has no secret store and
should not grow one. The Search Console service account comes from
`VITOPS_GSC_SERVICE_ACCOUNT` (inline JSON) or `GOOGLE_APPLICATION_CREDENTIALS` (a path), and the
OAuth token is minted with ~30 lines of `node:crypto` — **do not add `googleapis`**, an enormous
dependency for two endpoints in a CLI that installs into every consumer project.

`@getvitops/utils` cannot import from `@getvitops/generator` (the generator already depends on
it), so `IndexingConfig` mirrors the `site.seo.indexing` block structurally and the CLI adapts — the
same arrangement, for the same reason, as `GetvitopsSeoOptions` in `@getvitops/astro`.

## Development

The build system uses `vite-plus` (`vp`), which is a wrapper for common tools for SDLC tasks:

- `vite-task` (`npx vp run ...`) - task orchestration with caching, even across monorepo packages
- `oxfmt` (`npx vp fmt`) - formatting md/css/js/ts/html
- `oxlint` (`npx vp lint`) - linting js/ts
- `vitest` (`npx vp test`) - unit/integration testing
- `vite` (`npx vp build`) - libraries/application build meta-tool for web runtimes
- `tsdown` (`npx vp pack`) - libraries/applications build meta-tool for server runtimes

It also supports:

- running pre-commit hooks on staged files using the `staged` key in `vite.config.ts`

They are all configured with their respective keys in `vite.config.ts`

Other tools used:

- `lightningcss` - css minification/bundling
- `playwright` - e2e testing

### Task Notes

- do not run format or lint as verifications, these are done automatically on save and PostToolUse hooks.
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

`src/design-system.json` is this repo's dev/example config (each consumer brings their own). The generator (`packages/generator/src/generate.ts`) reads it and emits these output layers — assembled **in memory** and bundled by the css/bricks formats (no longer written as standalone `src/css/generated/**` files); the labels below name the layers:

- **colour** (`color.css`) — Each `colors.palette` hue is an **11-step numeric OKLCH scale** (`--color-<hue>-50…950`) generated from a `seed` (+ optional `anchors`) or a fixed `tones` brand kit.

  **Every ramp shares one fixed lightness ladder** (`LIGHTNESS_LADDER`, 50 → L 0.98 … 950 → L 0.21); only chroma and hue vary. That is what makes a step mean the same lightness in every hue, so one contrast table can serve all of them. Authored colours (the seed, `anchors`, `tones`) are pinned **verbatim** at their nearest step and are the _only_ steps allowed off the ladder — a bounded, local deviation the generator warns about past ~0.03 L. The previous engine transposed the curve onto each seed, which let luminance at step 300 range from 0.253 to 0.384 across the shipped palette.

  `colors.roles` maps each semantic role to a hue **and a kind**: `"danger": "rust"` (shorthand for chromatic) or `{ "hue": "navy", "kind": "surface" }`. Tokens are named **`--color-<target>-<role>[-<variant>]`**, target ∈ `bg` `text` `icon` `border`, and **the utility class name is the token name minus `--color-`**. Variants are ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and the tables are sparse.

  The kind decides the shape: a **surface** role has a bare `bg-<role>` (the card), `bg-<role>-muted` (the page), `bg-<role>-x-muted` (a well), the full text scale and `border-<role>-bold` as the guaranteed boundary. A **chromatic** role splits backgrounds into tints (`bg-<role>-x-muted`/`-muted`) and solids (`bg-<role>-solid[-bold|-x-bold]`) with **no bare `bg-<role>`**, plus `text-on-<role>` as the computed foreground. Also `--surface-glass`, `--overlay` and `--color-border-focus`.

  Dark mode re-points which step each token reads under `DARK_SEL` (`shared.ts`) — `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, Bricks' attribute plus the one `<color-scheme-toggle>` writes. The solid family and `text-on-<role>` stay mode-stable so a filled button keeps its identity. Raw hue steps never re-point. Contrast (text ≥ APCA Lc 75, secondary ≥ 60, icons/boundaries ≥ 45, both appearances) is enforced **at build time** — a violation throws out of `generate`. There is no per-appearance scheme grammar and no named steps.

- **shadows** (`shadows.css`) — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted for the `css`/`bricks` formats.
- **patterns** (`patterns.css`) — component CSS for entries under `patterns` in the JSON (cta, btn, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.

  **Geometry must resolve through the group alias layer — never hard-code the group token.** For
  every grouped pattern the generator emits `--<prop>-<name>-group` aliases (`--br-btn-group:
var(--br-control)`), and `overrides` replace an alias with a literal. So a pattern's `base` writes
  `"border-radius": "var(--br-btn-group)"`, **not** `"var(--br-control, 0.25rem)"`. Both render the
  same, but only the first keeps the pattern → group mapping in CSS, where it is inspectable and
  editable in devtools; a hard-coded fallback bakes it into the rule and is unreachable. The full
  chain is `--p-btn` (consumer hook, from `BASE_HOOK`) → `--p-btn-group` (pattern/`overrides`) →
  `--p-control` (group) → `--p-default`. State the tier's _deviations_ in `overrides` and let
  everything else inherit. (Watch for a hard-coded fallback that is also dead: `--br-control` is
  always defined, so the `0.25rem` in `var(--br-control, 0.25rem)` never applied.)

  **Small-label patterns split by behaviour:** `badge` is a **static** label (status, count,
  category); `tag` is an **editable and/or dismissable** one (`.tag__remove`, `.tag__icon`, and the
  `.tag-list` field). "chip" is retired as vocabulary. Their shared group is named **`label`** —
  deliberately _not_ `tag`, because a pattern whose key equals its group name collides in the token
  namespace (`--br-tag` would be both the group token and the `tag` pattern's override hook, making
  the pattern's `-group` alias unreachable). Keep group names distinct from pattern names.

  **Two button tiers, by intent.** `.cta` is _persuasion_ — filled, bolder, larger padding, lift on hover; it's a class, so it works on any element (`<a class="cta">` is the common case, since CTAs usually navigate). `btn` is _affordance_ — it only signals "this is interactive", and pairs `element: "button"` with `class: "btn"` so it emits one `:where(button, .btn)` rule: a bare `<button>` gets it with no class, `.btn` carries it to other tags, and because the rule sits at zero specificity **any** explicit class overrides it (`.cta`, or a component's own `.dialog__close`). A pattern that sets both `element` and `class` is the general mechanism here; `link` does the same to emit `:where(a, .link)`. Use `fill: true|false` to state whether states/roles drive `background-color` (+ `on-solid` text) or `color` — `btn` must set `fill: false` because its `background: transparent` would otherwise be inferred as a fill.

  **A state pseudo goes INSIDE the `:where()`, not after it.** `:where()` zeroes the element, but a
  pseudo-class appended outside it still carries weight — so `:where(a, .link):hover` is **0-1-0**, not
  0-0-0, and the zero-specificity promise silently held for a pattern's base rule while breaking for
  every one of its state rules. That tied `link`'s hover colour with `.cta` / `.cta-<role>` (both
  0-1-0) and won on source order, because `link` is emitted after `cta` — so every `<a class="cta">`
  flipped to dark link-coloured text on its filled background mid-hover. `:where(a:hover, .link:hover)`
  is a true 0-0-0. This is why `stateRules` takes a selector **builder** keyed on the pseudo rather
  than a finished selector string; a role class (`extra`) still sits outside the wrapper, since a
  variant is meant to carry a class's weight.

- **animation-effects** (`animation-effects.css`) — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `@getvitops/core`'s `css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

The framework CSS lives in **`@getvitops/core`**: `packages/core/css/index.css` is the bundle entry; core primitives (`global.css`, `animation.css`, `layout.css`, `layout-utilities.css`, `utilities.css`) at `packages/core/css/` root; each UI pattern its own partial under `packages/core/css/patterns/` (one file per pattern — `dialog.css`, `table.css`, `cluster.css`, `overlay.css`, …). The generator produces the token layers above and bundles them with these partials (via lightningcss, in memory). Keep that split when adding files, and wire any new partial into `index.css`.

**The bundle is layered.** `bundleCss()` wraps every chunk via the `CHUNK_LAYER` map and emits
`@layer vitops.base, vitops.components, vitops.utilities;`. That is what lets a utility override
a pattern (`class="card bg-danger-muted"`) — it previously depended on source order and so
silently did nothing here while working in tailwind. **A new partial defaults to
`vitops.components`**; add it to `CHUNK_LAYER` only if it emits single-purpose utilities. Order
within a layer still matters, layer membership matters more.

Three consequences worth holding:

- **Unlayered CSS beats every layer**, so a consumer's stylesheet, an Astro scoped `<style>` or
  a Bricks-authored class wins over the framework with no `!important`. Deliberate. But a
  _reset_ must be layered and ordered first, and the order statement must be declared **before**
  the stylesheet loads — otherwise the new layer name sorts last and the reset wins. `index.html`
  demonstrates the migration.
- **lightningcss drops the standalone `@layer a, b, c;` statement** after physically reordering
  the blocks to match it. Verified: given a statement that contradicts first-appearance order, it
  reorders rather than mis-cascades. So the declaration is honoured, just normalised away — don't
  assert on its presence, assert on block order (`bundle-layers.test.ts`).
- **The tailwind format is layered too, just by Tailwind.** Its utilities are `@utility`
  definitions, which Tailwind places in its own `utilities` layer _and_ which are what make
  variants (`hover:`, `@md:`) work; its patterns go in explicit `@layer components` blocks the
  emitter writes. So the classification is the same in both — only the mechanism differs.

**One class, one classification, enforced across formats.** A pattern is `vitops.components` /
`@layer components`; a single-purpose utility is `vitops.utilities` / `@utility`. `LAYER_CONTRACT`
(`packages/generator/src/layer-contract.ts`) names a representative sample and is asserted twice —
the css half in `bundle-layers.test.ts`, the tailwind half in `format-parity.test.ts` — so the two
can't drift. Three consequences that bite when adding CSS:

- **Classify by RULE, not by file.** `layout.css` was ~75% utilities and unmapped, so its whole
  utility half lost to every pattern; `utilities.css` held the `.reveal` component family and so
  beat every pattern. Both are now split (`layout-utilities.css`, `patterns/reveal.css`). If a new
  partial mixes the two, split it rather than picking the lesser evil.
- **A utilities partial must also be in `TAILWIND_SKIP`.** Otherwise it is inlined into tailwind's
  `@layer components` — the exact inversion — and it fails _silently_, because every class in it
  already exists as an `@utility` that wins on layer anyway. `format-parity.test.ts` asserts the
  implication structurally.
- **`@utility` cannot live in a layer.** Measured: it throws `` `@utility` cannot be nested ``
  inside `@layer`, and also inside a file pulled in with `@import … layer(…)` — the layer clause is
  itself a nesting context. A `@custom-variant` is no escape hatch either; a variant applied to a
  components-layer class emits nothing, because variants attach to utility candidates only. So a
  pattern cannot be responsive-by-variant in tailwind, which is why `.split` has no `@md:split` and
  `md-flex-row` carries that job instead.
- **Never contract on Tailwind's order _within_ its utilities layer.** It is property-based and
  flips when a declaration is added: `@utility split-1-2 { flex-direction: row }` sorts after
  `flex-col`, and adding `--_split-a: 1` sorts it before. The one stable rule is that a variant
  sorts after the un-varianted utility, which is what `class="split flex-col md-split-1-2"` relies
  on. If two of our own utilities must be ordered, put both in the same css partial and say so.

Known gap: `generated/typography.css` is mapped to `vitops.utilities` but emits the
`typography.headings` bare-element bindings (`h1`, `h2`, `body`) alongside `.font-<role>` — so those
tag rules beat every component pattern. `<h2 class="pull-quote">` loses its font-size in css/bricks
and keeps it in tailwind, which puts the bindings in `@layer base`. Same shape of fix as the
`layout.css` split: emit the role utilities and the element bindings as separate chunks and map the
bindings to `vitops.base`.

### `--format` mode

The generator takes `--format <css|bricks|tailwind|design>` (default `bricks`; `--bricks` is a back-compat alias for `--format=bricks`).

- **`bricks`** — `color.css` and `type-tokens.css` are one-line stubs; Bricks provides the colour `:root` tokens, dark overrides, utility classes, fonts, and type/space scales live from the imported palette + Variables JSONs. `patterns.css`, `shadows.css`, `tokens.css`, `typography.css`, `animation-effects.css`, and the Bricks JSONs emit. Pattern `states` reference shadows via `"shadow": "<name>"`, compiled to `filter: drop-shadow(var(--shadow-<name>))`.
- **`css`** — same set, but `color.css`/`type-tokens.css` emit the full standalone colour + font/scale layer (self-contained; used by the docs build and non-Bricks consumers).
- **`tailwind`** — bypasses all the per-file outputs and emits **one** self-contained `dist/tailwind.css` for Tailwind v4 (Astro): `@import "tailwindcss"` + `@theme` tokens (colours, `--font-*`, `--text-*`, `--spacing-*`, `--shadow-*`, `--container-{sm,md,lg,xl}`), a dark block, `@custom-variant is-active`, and `@utility` for the bespoke families (type roles, animation effects + `flip-<fx>`, split ratios, track placement) with the animation engine + structural CSS + patterns inlined. Tailwind's own engine expands `@md:`/`hover:`/… on demand, so no pre-expanded per-breakpoint/pseudo classes are emitted; native families (`flex`/`items`/`justify`/`text`/`bg`/`p`/`gap`) come from Tailwind + `@theme`. Run via `npx vp run build:tailwind` (standalone; not in the default `build` chain, not piped through lightningcss).
- **`design`** — emits **one** file, `DESIGN.md`, and no CSS: the agent-facing brief in [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format (YAML token front matter — `colors`/`typography`/`rounded`/`spacing`/`components` with `{group.token}` refs — then a prose body). Emitter: `packages/generator/src/design-md.ts`. Meant to be run with `--out .`, since DESIGN.md conventionally sits at a repo root beside `AGENTS.md`; run via `npx vp run build:design`, which writes the **tracked root `DESIGN.md`** (the one `build:*` target that doesn't write to `dist/`).

  Three things the spec can't hold, resolved the same way every time and **stated in the emitted prose** so the file is self-describing: fluid `clamp()` sizes → the **max** value (a `Dimension` is a bare number + px/em/rem); the automatic dark flip → **light values only**, with the flip explained (an agent that flattens role tokens to hexes breaks dark mode, which is the whole hazard); a `50%` radius → dropped from `rounded` and named in the Shapes prose rather than emitted as an invalid `Dimension`. Role tokens are `{colors.<hue>-<step>}` **references** into the raw ramps, not flattened hexes, so the role → ramp lineage survives — `on-solid` excepted, being a computed contrast literal. `meta.name`/`meta.description` (optional, in `design-system.json`) supply the brand name + Overview paragraph; everything else derives from the config. `design.md lint` reports zero errors on the emitted file; its ~190 `orphaned-tokens` warnings are inherent (our tokens are consumed by utility classes, not by the `components` block) and the file says so.

### Icons

Icons are named by **meaning** and resolved per configured set — `menu` becomes `fa7-solid:bars`,
`lucide:menu` or `ph:list` — so swapping sets is a config edit, not a find-and-replace. **A name
containing `:` passes through untouched**, which is the escape hatch for a set-specific glyph. The
map lives in `packages/utils/src/icons.ts` (`iconMap`, `resolveIcon`, `generateIconInclude`); the
declaration lives in the **site config**'s `icons` block, not `design-system.json`, because it
describes what a site uses rather than what the system defines.

**Weight is per-set-shape, not universal.** Phosphor keeps every weight in one collection and varies
the NAME (`list`, `list-bold`), so `ph` takes `weight`; Font Awesome splits weights across
collections (`fa7-solid` / `fa7-regular`), so there it's part of the prefix. `WEIGHTED_SETS` records
which is which, and an unknown weight throws rather than silently resolving to the regular glyph.

**The `include` map exists for one reason: SSR bundle size.** astro-icon is zero-config on a static
build but bundles _every icon in a set_ under `output: 'server'`. The `icons` option on
`vitops()` derives the list by scanning source during `astro:config:setup` — awaited **before**
the `updateConfig` that appends the icon integration, because an appended integration's own
`config:setup` runs after this hook returns, and the Vite plugin's `buildStart` is far too late. On
a static build **no `include` is passed at all**. Declared names that don't resolve throw; scanned
ones only warn (a bare unmapped name is usually a local `src/icons/*.svg`); runtime-computed names
are reported with file and line, never guessed.

Three delivery paths: `astro-icon` / `astro-iconset` for Astro, and a **build-time SVG sprite**
(`icons.svg`, opt-in via `site.icons.sprite`) for Bricks, EmDash renderers and plain HTML —
`<use href="…#ph--list">`, no JS and no icon-API call, which is what keeps it a tier-1 pattern.
Sprite ids are the qualified name with `:` → `--`, plus a set-independent `icon-<name>` alias per
semantic name so sprite markup survives a set swap. `spriteId()` in the generator and `Icon.astro`
must agree; `icon.test.ts` guards it, since a drift renders an empty box rather than erroring.
Note external-file `<use>` is **same-origin only**.

Markup is always `<span class="icon">…</span>`. `.icon` sizes in `em` via `--icon-size` and sets
`fill: currentColor`; because `.cta` and `:where(button, .btn)` are already `inline-flex` with a
`gap`, **a start/end icon is child order, not a modifier class**. Don't confuse `.icon` with
`.icon-mask`, the CSS-only adornment path behind `.link--icon::before`.

### Utility variant naming (Tailwind-aligned)

Responsive/state utilities follow Tailwind's left-to-right order in every format; CSS/Bricks swap `:` for `-`, Tailwind keeps `:` (and `@` for container queries):

| Intent           | CSS / Bricks               | Tailwind                                |
| ---------------- | -------------------------- | --------------------------------------- |
| responsive split | `md-split-1-2`             | `@md:split-1-2`                         |
| responsive align | `md-items-center`          | `@md:items-center`                      |
| hover effect     | `transition hover-fade-in` | `transition fade-in hover:flip-fade-in` |

Container breakpoints are bare prefixes (`sm-`/`md-`/`lg-`/`xl-` = 30/48/64/80rem). Base utility names mirror Tailwind (`items-*` not `align-*`), so one vocabulary spans all three formats.

## Build system

All tasks go through `npx vp run <name>` (see [vite.config.ts](vite.config.ts)). `build` delegates to `build:bricks` (the default target); format-specific full builds are separate `build:<type>` tasks rather than a `--format` flag on `build` (vp appends forwarded args to the command tail, which would corrupt the last sub-task, and it only resolves `vp run <task>` in-process when that appears literally in the command).

**The root build dogfoods `@getvitops/generator`.** `build:bricks` runs `build:theme`, which invokes `lib/build-theme.ts` → `generate({ format: 'bricks', outDir: 'dist' })` (from `@getvitops/generator`). The generator owns the lightningcss _library_ and does the CSS bundling in-process, so the root no longer shells out to the lightningcss CLI (removed from deps). `build:theme` `dependsOn build:generator` (which `dependsOn build:core`), so the framework JS bundles are built in `@getvitops/core` and snapshotted into the generator's package assets before `generate` copies them (plus the Bricks PHP + `docs/`) into `dist/`. `build:docs` and `build:tailwind` likewise call `lib/build-theme.ts --format css|tailwind`. The single-file emit contract per format is unchanged.

`build:theme` emits the deployable Bricks payload into `dist/`: `styles.min.css`, the Bricks import JSON, `tokens.json`, the JS bundles, the repo-owned Bricks sources (`bricks/elements/*.php`, `bricks/load.php`) under `dist/bricks/`, and the generated `docs/` tree under `dist/docs/` — an LLM-oriented context bundle in **Open Knowledge Format** (OKF; served at `<theme>/dist/docs/`) so an AI has documentation matching what deploys. (Generated by the generator's `docs.ts`; the legacy `lib/generate-design-system.ts` / `lib/generate-docs.ts` have been removed.) OKF rules the generator follows: reserved `index.md` files carry **no frontmatter** and are directory listings (`* [Title](path) - desc`); every other `.md` is a "concept" doc that **must** begin with a YAML frontmatter block with a non-empty `type` (plus `title`/`description`/`resource`/`tags`/`generator`). The tree:

- `docs/index.md` — bundle index → `authoring.md`, `config.md`, `formats.md`, `concepts/`, `css/`, `bricks/`.
- `docs/authoring.md` — concept: every `design-system.json` field, **rendered by walking the published JSON Schema's `description` metadata** (authored once in `packages/generator/src/schema.ts` via the `desc()` helper — the same descriptions editors show as hovers), so it cannot drift from validation.
- `docs/config.md` — concept: every field of the three-section config (`designSystem` /
  `organization` / `site`), walked from `config.schema.json` by the **same** `schemaSections()`
  helper `authoring.md` uses — one walker, two schemas, so the two references cannot drift in
  presentation. Its `designSystem` section lists only the wrapper (`themes`/`defaultTheme`/
  `defaultColorScheme`) and links to `authoring.md` for the token fields, rather than shipping a
  second copy of the whole design-system schema.
- `docs/formats.md` — concept: tailwind vs css vs bricks output differences, including the interpolated `TW_CLASH` list (from `packages/generator/src/shared.ts`) of framework utilities the tailwind format strips in favour of Tailwind's own.
- `docs/concepts/{index.md,color.md,scales.md,patterns.md,icons.md}` — concept docs for the colour system (seeded OKLCH scales on a shared lightness ladder, target-prefixed tokens, automatic dark flip), the fluid modular scales, and the pattern CSS chain (token cascade, `BASE_HOOK` override vars, state shortcuts, role variants).
- `docs/css/index.md` — listing → `classes.md`.
- `docs/css/classes.md` — concept: the CSS framework class vocabulary **summarized by naming rule** (not enumerated), pulled live from `src/design-system.json` (colours, type roles, space/type scales, shadows, animation effects, component patterns) plus static structural utilities and the responsive/state variant grammar.
- `docs/bricks/index.md` — listing + the "prefer framework CSS classes over hand-tuning Bricks UI properties" guidance; links `elements.md` + `../css/classes.md`.
- `docs/bricks/elements.md` — concept: per-element control reference, parsed from each element's docblock, class metadata, `get_label`/`get_keywords`/`get_nestable_children`, and a small PHP-array-literal parse of `set_controls()`.

The agent-facing skill is **not** generated: it's the static `packages/cli/skill/SKILL.md` shipped inside `@getvitops/cli`, which teaches agents to fetch these docs live via `vitops docs <topic>` (topic → bundle-path map in `packages/cli/src/agents.ts`, drift-guarded by `agents.test.ts`). Drift-prone data (`TW_CLASH`, `BASE_HOOK`, `DARK_SEL`, `REQUIRED_ROLES`, `ROLE_TOKEN_KEYS`) lives in `packages/generator/src/shared.ts` — shared by `generate.ts` and `docs.ts` (a direct import between them would be a cycle) and re-exported from the package index.

**One emitter, one axis.** `roleColorUtilities()` (`generate.ts`) returns every role utility
as data — `{ cls, prop, value }` — and both the css/bricks and tailwind paths render from it.
There is now a **single axis**: because the target lives inside the token name,
`bg-danger-muted` and `text-danger-muted` are different tokens and cannot collide, so no
precedence rule is needed and every class is emitted exactly once by construction.

That replaced a genuinely broken arrangement worth remembering. Two axes used to share the
`<family>-<role>-<modifier>` namespace — functional _planes_ (`--<role>-bg-muted`) and
appearance-relative _stops_ (`--color-<role>-muted`) — with "plane wins" as the tiebreak. The
result was non-monotonic in every family and had duplicate rungs: `bg-<role>-x-muted` and
`bg-<role>-muted` both resolved to step 100, `bg-<role>` was _lighter_ than both, and
`--color-<role>-muted` was unreachable through any `bg-` class. Earlier still, the css path
emitted stops then planes and relied on the minifier dropping the shadowed rule while the
tailwind path ran only the plane half, so **87 role classes existed in css/bricks and not in
tailwind**. `format-parity.test.ts` holds the three formats to the same vocabulary, allowing
exactly four documented differences (Bricks' own palette-import utilities, `TW_CLASH` drops,
variant spelling, and `@theme` auto-generation).

`outline`/`fill`/`stroke` have no tokens of their own — they alias the `border` and `icon`
tiers respectively (`UTILITY_SOURCE`), because an SVG fill wants the icon tier and minting
separate tokens for them would be three more things to hold in contrast.

**Role tokens must stay out of Tailwind's `@theme`.** Measured against tailwindcss@4.3.3: when a
token is in `@theme` _and_ an `@utility` of the derived name exists, Tailwind merges both into
one rule with the `@theme` declaration **last**, regardless of source order. Only palette hues
belong there, where nothing competes for the name. Target-prefixed token names make an accidental
collision much harder — a `@theme` `--color-bg-danger-muted` derives `bg-` + `bg-danger-muted`,
not `bg-danger-muted` — but role tokens still don't belong in `@theme`, and `format-parity.test.ts`
derives the guard from the emitted token names so it can't go vacuous when the grammar moves again.

`docs/**` and the root `DESIGN.md` are generated artifacts — don't hand-edit them (they're in `fmt.ignorePatterns` to avoid churn); change the PHP / `design-system.json` / the generator's static strings and regenerate. Frontmatter deliberately omits `timestamp` (an OKF-recommended field) to keep output deterministic and diffs clean. If the generator gains a new source, extend the relevant `build:*` task's `input` list (e.g. `build:generator`). `index.html` stays a human/local-dev docsite (dogfoods the build); it is **not** the AI context vehicle — the `docs/` bundle is.

**Four docs surfaces, don't confuse them:**

| Surface                             | Audience                                         | Authored how                |
| ----------------------------------- | ------------------------------------------------ | --------------------------- |
| `docs/` + `dist/docs/` (OKF bundle) | agents **with** the toolchain, via `vitops docs` | generated by `docs.ts`      |
| `DESIGN.md` (repo root)             | agents/tools **without** it — one portable file  | generated by `design-md.ts` |
| `index.html`                        | human/local dev, dogfoods the built CSS          | hand-written                |
| `apps/docs` (plain Astro)           | public docs site                                 | hybrid — see below          |

`docs/` and `DESIGN.md` are not redundant: the OKF bundle is the richer, cross-linked reference a
consumer fetches live per topic; `DESIGN.md` is the single self-contained artifact you hand to
something that has never heard of `vitops`. Both are generated from the same config, so neither can
drift from what the stylesheet formats build.

`apps/docs` is private and **isolated from the release DAG** (not in `build`, `build:packages` or `deploy`). It is now the only app in `apps/` — `apps/portal` was the dogfood target before this site existed and has been extracted to its own repo, since `apps/docs` covers that job and covers it better (it exercises the `css` format through the Astro integration rather than a hand-maintained wireframe).

It is published to GitHub Pages at <https://docs.vitops.ca> by `.github/workflows/docs.yml` — a static build uploaded as a Pages artifact, so `apps/docs/dist/` stays gitignored. The custom domain is load-bearing: served from the apex, the site needs no Astro `base`, and the absolute paths `@getvitops/astro` emits (`/vitops/icons.svg`, `/vitops/design-manifest.json`) resolve as-is. A project-pages URL would require making the integration base-aware first. The domain lives in `apps/docs/public/CNAME`, which Astro copies to `dist/CNAME` verbatim.

**It is deliberately a plain Astro site, not a docs framework.** Starlight was tried and removed: a themed docs framework ships its own CSS layer and component library, which hides the very thing under test. The whole site — layout, nav, type, colour, controls — is built from the framework's own vocabulary (`.rhythm`, `.centered`, `.split-*`, `.font-<role>`, `.link`, `.card`, `.details`, `.btn`) via the `vitops()` integration at `css.format: 'css'`, plus the `color-scheme-toggle` web component. **If you find yourself adding hand-written CSS to `src/layouts/Docs.astro`, that's a signal the framework is missing a pattern — add it to `@getvitops/core` instead.** The `<style>` block there is meant to stay short; it's the site's honest scorecard. (Root `index.html` also exercises the css format, but as a static page — `apps/docs` is the only thing covering that format _through the Astro integration_.)

Its _Reference_ section is not written by hand: `apps/docs/scripts/sync-reference.mjs` calls the generator's `generateDocs()` and emits pages into `src/content/docs/reference/` (gitignored), so the site can't describe output the toolchain doesn't produce. The script flattens the OKF tree (`concepts/patterns.md` → `concepts-patterns`), drops the frontmatter-less `index.md` listings (the site builds nav from the collection), rewrites the bundle's relative `.md` cross-links to site slugs, and sets `generated: true` so the layout renders a "don't edit this" banner. Guides, package pages and the landing page **are** hand-written. Tasks: `docs:sync` (dependsOn `build:generator`), `docs:dev`, `docs:build`, `docs:preview`.

Note the app tasks shell out via `pnpm --filter <app> exec …`: vp resolves binaries itself and doesn't put `apps/*/node_modules/.bin` on `PATH`, so a bare `cd apps/docs && astro build` fails with "cannot find binary path".

Two non-obvious caching/ordering gotchas:

- **`build:theme`'s `input` is declared explicitly.** vp's auto file-tracker only sees files the task itself reads. `node lib/build-theme.ts` reads its script + `design-system.json` and imports the built generator _inside_ the spawned Node process, so without an explicit `input` list (covering `packages/generator/dist/**` + `packages/generator/assets/**` + the config), source edits hit the cache and the dist files appear "stuck" on stale content.

- **A running `docs:dev` does NOT pick up edits to `packages/core/css/**`.** `@getvitops/vite` watches only the config files (`input`/`site.input`/`legal.input`— see`watched()`in`packages/vite/src/index.ts`), which is right for a consumer, where core arrives via `node_modules`and changes only on install. But this repo dogfoods: core's partials reach the generator through the`packages/generator/assets/`snapshot that`prepare.mjs`writes, so a framework CSS edit needs`build:generator`**and** a fresh`generate()`before the docs site sees it. A dev server started earlier will keep serving`apps/docs/src/styles/styles.css`from whenever it last ran, with no error and no reload — the change looks like it silently didn't work. Restart`docs:dev`, or regenerate that artifact directly:

  ```
  node -e "import('./packages/generator/dist/index.mjs').then(m => m.generate({ input: 'src/design-system.json', format: 'css', outDir: 'apps/docs/src/styles' }))"
  ```

  Check the served file before concluding a CSS change didn't land: `curl -s localhost:<port>/src/styles/styles.css`.

Lint, format and typecheck run automatically on save and via a `PostToolUse` hook on `Edit|Write` (`.claude/settings.json`) — don't invoke `vp check` / `vp fmt` / `vp lint` manually as a verification step. The `staged` key wires `vp check --fix` into the pre-commit hook.

## Deploy

`lib/deploy.ts` has two modes, switched on env vars:

- **Remote (default):** rsync over SSH using `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` (+ optional `DEPLOY_PORT`, `DEPLOY_KEY`). `--dry` previews via `rsync -n`.
- **Local symlink:** set `DEPLOY_LOCAL_PATH` to a theme `dist/` directory (e.g. a WPLocal site) and the script idempotently symlinks it to this repo's `dist/`. One-time setup; subsequent builds are "auto-deployed" because the symlink follows them. The script refuses to clobber a non-symlink, so it's safe to point at an existing path.

`npx vp run deploy` chains `build` first, so it always ships a fresh `dist/`.

## Note on README.md

The `README.md` predates the current layout — it refers to `colors.json`, `src/color.css`, and `build.mjs`. Use this file and `AGENTS.md` as the authoritative description; update README if you touch user-facing docs.
