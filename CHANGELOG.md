# Vitops toolchain changelog

Release notes for the `@getvitops/*` packages — what changed, what broke, and how to migrate.

`@getvitops/core`, `generator`, `utils`, `cli`, `vite` and `astro` share **one version**: they are
released together and are only supported in matching versions (the generator embeds a snapshot of
core's CSS and web-component bundles, and the Astro integration copies the _installed_ core's
bundles into your `public/` — mixing versions can leave the CSS and the components disagreeing).
`@getvitops/emdash` and `@getvitops/create` version independently.

Per-package detail — including every release before 0.7.0 — ships with each package:
`node_modules/@getvitops/<pkg>/CHANGELOG.md`.

## 5.0.0 — 2026-08-08

Two themes. **Dangling token references and contradictory config are now build failures** rather
than things that resolve to nothing in the browser. And **the framework states which layout
patterns are foundational, and reports it when you reach past them** — from repeated downstream
reports that sites were inventing a `.wrap` class instead of using `.centered`, and that
`.subgrid` was going essentially unused.

Read the Breaking section if you have a config with hand-written `var(--…)` references, or CSS
that absolutely positions inside a `.subgrid-card`.

### Breaking

- **`validate()` resolves every `var(--…)` a config authors** — in `patterns.defaults` / `radii` /
  `groups` / `items.*.{base,overrides,states}`, `typography.roles` and `shadows` — against the
  tokens that config actually emits, and a reference to a token that does not exist now fails the
  build. One downstream config shipped a `.cta` whose `color` fell back to `inherit` on a brand
  fill (unreadable text on every filled button), and two of its four dead references had been dead
  for several releases with nothing reporting them. Anchored to the namespaces the generator owns
  (`--color-*`, `--shadow-*`, `--z-tier-*`, `--surface-glass`, `--overlay`); a reference carrying a
  fallback is never flagged. **`vitops lint --fix` is the migration** — it rewrites pre-1.0
  colour-grammar references in a single pass, because several of those renames rotate and applying
  them sequentially compounds them.
- **A genuine contradiction between `site.*` config and `vitops({ … })` options fails the build**,
  naming both sides. These were two hand-synced declarations of the same fact with nothing
  comparing them, so a site could ship a cookie notice naming categories its banner never offered.
  An absent option is not a contradiction — it takes the config's value.
- **A surface-shaped role declared chromatic now warns**, and `--surface-glass` / `--overlay` /
  `.glass` are no longer emitted when `surface` is chromatic (they read `--color-bg-surface`, which
  a chromatic role does not emit, so they pointed at nothing). _(css/bricks; the tailwind format
  emits its own equivalents from `@theme`.)_
- **`.subgrid-card` now sets `position: relative`**, so a `stretched-link` inside it needs no extra
  class. If you were absolutely positioning a descendant of a `.subgrid-card` against an ancestor
  _outside_ the card, it now resolves against the card — move the positioning context explicitly.
  _(all formats.)_ Not reachable by `vitops lint --fix`: which ancestor you meant is not something
  the linter can know.
- **`<Subgrid />` renders its slot verbatim — author the `<li>` items yourself.**

  ```diff
    <Subgrid>
  -   <article class="card">…</article>
  +   <li class="card subgrid-card">…</li>
    </Subgrid>
  ```

  It used to parse the slotted HTML and rebuild each child as an `<li>`, carrying over only `class`
  and `style`. That existed solely because a `<ul>` may contain nothing else, and it cost more than
  it bought: the child's tag was discarded, `id`/`data-*`/`aria-*` were silently dropped, and `href`
  could not survive at all. Nothing is copied now, so nothing is lost. `as` picks the container
  (`ul` by default, `ol`, `div`) and all other props are forwarded — they were previously discarded,
  `role` included.

- **`<Cards />` no longer adds `class="card"` to slotted children**, since it no longer parses them —
  write the class on the item. It now emits `<wc-cards>` around a `<Subgrid>`, and like `<Tree />`
  **it emits its own element, so do not wrap it in `<wc-cards>` yourself.** Its previous
  `role="list"` was passed to `<Subgrid>` and silently discarded, so it never took effect.
- **`<Subgrid />` and `<Tree />` emit `role="list"`,** as does the Bricks `sitenav` element.
  `list-style: none` stops Safari + VoiceOver announcing a `<ul>` as a list, so every marker-less
  framework list was quietly losing the semantics its `<ul>` was chosen for. If you hand-write
  `.subgrid`, `.list`, `.facet-list`, `.nav-items`, `.collapse-menu` or `.tree` markup, add
  `role="list"` yourself — the framework cannot add it to markup it does not render, and each
  partial now says so at the `list-style` reset. _(Markup only; no CSS change.)_

### Added

- **A Foundations section at the top of the class reference**, stating six substitutions as
  _temptation → what to write instead_ (`wrap`/`max-width`+`auto` → `centered`; section padding →
  `region`; prose margins → `rhythm`; `repeat(n, …)` → `subgrid`; `repeat(auto-fit, …)` →
  `grid-auto`; `flex`+`gap` → `cluster`). **`.subgrid`, `.cluster`, `.region` and `.grid-auto` were
  absent from that reference entirely** — `vitops docs classes` is the doc an agent fetches to
  decide which class to apply, and the framework's answer for a set of cards was not in it, which
  is most of why it went unused. The same table now ships in the agent skill and in the
  `@getvitops/create` template's `AGENTS.md`, since a pointer to a doc only helps someone who
  already suspects there is something to look up. _(Documentation; no CSS change.)_
- **Two answers for "the whole card is a link", because one cannot exist.** `<li><a class="card">`
  is the shape that gets reached for, and it is wrong in a way that **renders fine** — the `<li>` is
  the grid item, so the anchor is an ordinary block inside it and the tranches within it never reach
  the parent's shared row lines, so the alignment `.subgrid` exists for silently does not happen.
  Putting the anchor in the grid's place (`<ul><a></ul>`) is invalid HTML, so there had been no
  correct shape to reach for.

  There are now two, and they trade against each other, because **no CSS-only technique can make a
  whole card clickable and leave its text selectable** — a transparent overlay necessarily receives
  the pointer-drag:

  | Want                                     | Use                                         |
  | ---------------------------------------- | ------------------------------------------- |
  | zero JS, whole card clickable            | `.stretched-link` — **text not selectable** |
  | selectable text **and** a clickable card | `<Cards>` / `<wc-cards>` — needs JS         |

  `.stretched-link` goes on a link inside the card; its `::after` covers the card. Ships with
  `.relative` for the bare-`.card` case and `.raised` for anything that must sit above the overlay.
  Never layer the two — the overlay wins, so selection is lost and the JS never runs; `vitops lint`
  reports the combination. _(all formats.)_

- **`<wc-cards>` — a new tier-2 element** (in `elements.js`, emitted by `<Cards>`). It adds no
  overlay and instead distinguishes a click from the end of a drag, so the card's text stays
  selectable. Its fallback is the card's own link, fully usable with no JS; it adds no `tabindex`
  and no `role`, so keyboard order and list semantics are untouched; and the pointer cursor is
  applied by the element, so the affordance never appears without the behaviour. It takes no `href`
  — it forwards to the card's real link, which also inherits `target`, `rel`, `download` and
  modifier-key handling rather than reimplementing them.
- **Three new `vitops lint` reuse rules and a markup pass.** The `.centered` rule previously fired
  only when the hand-written CSS already referenced `--width-measure` — precisely the author who was
  never going to hand-roll a container. It now also catches a page-scale `max-width` (≥ 48rem, or a
  `ch` reading measure) with auto margins, and a container-shaped class name (`wrap`, `wrapper`,
  `container`, `inner`, `shell`, …) with any width cap, reading the cap out of `min()` / `clamp()`.
  New rules report a hand-written `repeat()` grid as `.subgrid` / `.grid-auto`, a repeated card set
  laid out without either (a loop rendering a card, or three or more cards written out), the broken
  `<li><a class="card">` shape, and `.stretched-link` layered inside `<wc-cards>`. The markup pass is
  the only check that can see this drift at all — a card list built from utility classes contains no
  bad class and no hand-written CSS. All are `suggestion` severity and do not fail a build without
  `--strict`. They found five real instances in this repo's own docs site.
- **`vitops lint [files...]`** takes explicit paths instead of scanning `--src`, so it can be wired
  into a pre-commit hook — `vp`'s `staged` key appends the staged files to whatever it runs.
  Unreadable and non-source paths are skipped rather than fatal. The `@getvitops/create` emdash
  template now wires it with `--strict` and adds a `lint:design` script.
- **`--help` works on every subcommand.** `vitops lint --help` used to exit non-zero with
  `Unknown option '--help'`; it is now answered before dispatch, and a drift guard fails the build
  if a command has no documented options.
- **`@getvitops/astro/tracking`** re-exports `@getvitops/utils/tracking` (plus `TRACKING_ENDPOINT`),
  so the documented conversion flow works with one install — under strict pnpm, app code cannot
  resolve a transitive dependency, and the obvious workaround drags the integration's Node builtins
  toward a Worker bundle.
- **`sendEmail` takes `timeoutMs` (default 10s).** `binding.send()` had no deadline, so one hung
  attempt hung the request indefinitely. A timeout is retried like any other transient failure.

### Fixed

- **`packages/generator/src/docs.ts` contained a literal NUL byte** (`CODE_SLOT` written as the raw
  character rather than an escape), so libmagic classified it as `data` and grep/ripgrep treated the
  largest doc emitter in the repo as **binary and silently skipped it** — every search for a string
  in it returned nothing, with no error and nothing to notice.
- **`.raised` replaces the advice to use `.relative` above a `stretched-link` overlay**, which could
  not work: a positioned element at `z-index: auto` does not rise above an explicit `z-index`
  regardless of DOM order, so a second link or button in the card stayed underneath and unclickable.
  `.raised` sets both, against the same `--z-tier-raised` token the overlay now uses in place of a
  hard-coded `1`. _(all formats.)_
- **`createConversionRoute`'s example was broken on every supported Astro** — it read the binding off
  `locals.runtime.env`, removed in Astro v6, while the package peers on `>= 7`, and called a helper
  that does not exist. Now uses `import { env } from 'cloudflare:workers'`.
- **`/api/track` is exported as `TRACKING_ENDPOINT`**, and the build warns when tracking is on and
  no route answers it. It was a bare literal inside the inlined capture script: name the route
  anything else and every `tel:` beacon 404s with nothing erroring.
- **`require()` warns when the page has no `<wc-consent>`** — the demand can never be granted, so
  whatever waited on it never ran, silently.
- **`describeEvent` no longer reports "from Unknown"** for forms with no field literally named
  `name`; it falls back through `first_name`/`last_name`, `full_name`, then the email address.
- **`vitops search notify` warns when the sitemap's URLs aren't on the configured origin.** A route
  collision served a valid sitemap listing another site's pages and the run reported a healthy
  submission.
- **`vitops agents` no longer writes a path it guessed** — it finds the config by shape and
  interpolates the resolved path into every emitted command, rather than writing
  "tokens live in `design-system.json`" into a project whose tokens are in `company.json`.
- **`vitops search setup --dry` and `vitops ads setup --dry` run without credentials.** Both also
  now mention that the Cloudflare token needs `Zone:Read` alongside `Zone:DNS:Edit`.
- **`vitops legal` names the files it wrote and flags new ones**, and prints the review reminder on
  the stdout path, where it was missing entirely.
- **`vitops init` writes a versioned `$schema`** (`./node_modules/@getvitops/generator/schema.json`)
  instead of an unpinned unpkg URL that resolved to whatever was newest.
- **`favicon.backgroundColor` and `favicon.name` are described accurately**, and the
  missing-background warning now fires for a dark opaque mark, not only a transparent source.

### No consumer-facing change in this package

- **`@getvitops/vite`** — **no source changes at all** in 5.0.0; it is majored only because the
  toolchain shares one version. No code edit of yours is required. The generator changes it runs do
  still apply, so a config with a dangling `var(--…)` now fails your build through this plugin.
- **`@getvitops/utils`** — bumped by the `fixed` group, but not empty: it carries the `sendEmail`
  timeout and the indexing-origin warning above. No CSS moved and no code edit is required.
- **`@getvitops/emdash` 0.3.5** — a dependency bump to `@getvitops/utils@5.0.0` and nothing else.

### Also

- **Astro and Bricks are documented as the same tier**, having been published as tier 3 and
  **tier 4** in `vitops docs components`, the shipped agent skill and the docs site. Both are
  platform wrappers generating HTML from the classes and elements of tiers 1 and 2 — siblings
  chosen by platform, neither above the other, and no project uses both. The cause was a projection
  axis read as a hierarchy: `Tier` has four keys because there are four tables to render, and the
  number was derived from that key order, so the last key became "tier 4". The advice beside it
  inherited the error, saying to use "the highest-**numbered** tier your stack has". Which patterns
  each tier provides is unchanged. _(Documentation only.)_

## 4.1.0 — 2026-08-06

Ad platforms become something the toolchain can see: a `site.ads` block, a `vitops ads` command that
verifies your domains and emits the pixels, an `<Ads />` component, and a cookie notice that
discloses them. Plus a privacy-policy correction that separates **where** a provider stores
information from **whose law** can reach it — read that section if you have already published a
policy.

### Added

- **`site.ads` — the ad properties a site is linked to**, keyed by platform (`google`, `meta`,
  `linkedin`, `reddit`, `tiktok`, `microsoft`, `pinterest`, `snapchat`). Account id, tag id,
  domain-verification token, consent category. This is the gap the rest of the feature exists to
  close: a pixel pasted into a template was invisible to the toolchain — it set `_fbp` on a site
  whose generated cookie notice never mentioned it, whose consent gate never cleared it on revoke,
  and whose attribution (for LinkedIn and Pinterest) never captured the click ID at all.

  ```jsonc
  {
    "site": {
      "ads": {
        "meta": { "pixelId": "123456789", "domainVerification": "abc123" },
        "google": { "accountId": "123-456-7890", "pixelId": "AW-987654321" },
      },
    },
  }
  ```

- **`vitops ads setup`** ensures each platform's domain-verification DNS record, in Cloudflare via
  `CLOUDFLARE_API_TOKEN` — created only, never edited or deleted. Idempotent: a re-run of a linked
  property is all skips. `--dry` prints the plan; `--check` reports drift and exits non-zero.

  Only four platforms verify a domain at all — Meta, TikTok, Pinterest and Snapchat, by apex DNS
  TXT. **Google Ads, LinkedIn, Reddit and Microsoft Ads have none**: linking there is the tag and
  the account id, and the run says so rather than skipping in silence. No platform Marketing API is
  called — Meta's needs a system-user token, Google's an approved developer token with your own
  account on the line — so the final "Verify" click is surfaced as a reminder.

- **It prompts for the verification token.** The token does not exist until someone opens the
  platform UI, so the first run asks for it, naming the exact UI path, and writes it to your config.
  It is not a secret: it is published in DNS, and the platform fetching it back is the ownership
  proof — the same reasoning that puts the IndexNow key in the config. Prompting needs a TTY; with
  `--dry`, `--check`, `--no-prompt` or in CI you get a named error instead and the run never hangs.
  `--no-write` keeps the answer out of the file.

- **`vitops ads tags`** prints each pixel as an inert, consent-gated `<script>` — `type="text/plain"`
  with the library URL on `data-src`, so an undecided visitor's page issues no third-party request.
  For Bricks, WordPress, Eleventy: any stack without the Astro integration.

- **`vitops ads lint`** reports what is invisible at runtime: a click ID the platform stamps that
  attribution does not capture, a pixel while `site.tracking` is off, a property with no tag id.

- **`<Ads />` in `@getvitops/astro`**, plus `environments.<env>.ads` (defaults to `analytics`, then
  true). A sibling of `<Analytics />` rather than part of it: ad properties come from the site
  config, state their own consent category (`marketing` unless said otherwise) rather than having
  one derived, and switch per environment separately — a preview deployment sending pageviews is
  survivable, one firing conversion pixels is not. Both components now render through a shared
  `<GatedTags />`, so the inert markup has one implementation.

- **`li_fat_id` (LinkedIn) and `epik` (Pinterest)** join the click-ID capture vocabulary.

### Fixed

- **A privacy policy no longer conflates storage with legal reach.** A processor carried one
  `country`, flat-deduped into a single sentence claiming both — and privacy law turns on the
  second: the OPC's concern is foreign _access_, not merely foreign storage. New `storage[]` (each
  entry optionally `scope`d) and `operatorCountry`; `country` still works as shorthand asserting
  both. Combining the shorthand with either explicit field is now rejected, because whether it
  narrows or adds are two readings making contradictory legal claims. A country in the policy's own
  jurisdiction is no longer a "transfer" — that is the incoherent _"outside of Canada, including
  Canada"_ fix. A processor with no location at all is now reported on stderr instead of vanishing
  from the disclosure in silence.

### Changes to text you may have already published

- **Adding `site.ads` changes your cookie notice.** Each configured pixel is now named with its
  cookies and its opt-out, derived from the same table that writes `data-consent-cookies` — so the
  notice and the revoke cannot disagree. Re-generate and re-read.
- **Cloudflare, Cloudflare Turnstile, Vercel and Netlify now assert operator jurisdiction and no
  storage.** They previously claimed "stored or processed in the United States", which is a claim
  about the wrong fact — Cloudflare is anycast, and Workers/R2 have residency controls the config
  cannot see. A site whose only foreign element is its host or Turnstile stops claiming foreign
  storage and discloses foreign legal reach instead. **If you pin a US region, say so**: declare a
  processor with `storage: [{ "country": "the United States" }]`.
- **A site running LinkedIn or Pinterest ads starts attributing conversions** it previously recorded
  as organic, because the click ID is captured now.
- Everything else renders identically. Google Analytics, Tag Manager, Clarity, Plausible, Matomo
  Cloud and any processor declared with `country` produce the same words as before.

### Migration

None required — `site.ads` is optional and `<Ads />` is opt-in. To adopt:

1. Add your ad accounts under `site.ads`.
2. `CLOUDFLARE_API_TOKEN=… npx vitops ads setup --dry`, then without `--dry` to create the records
   (it will prompt for any verification token you have not fetched yet).
3. Add `<Ads />` beside `<Analytics />` in your layout's `<head>`, or paste
   `npx vitops ads tags` into your template.
4. Re-generate your legal documents and re-read the cookie notice.

New exports: `AD_PROVIDERS` + the `SiteAdProperty`/`AdProvider` types from `@getvitops/generator`,
the whole `@getvitops/utils/ads` subpath, and `resolveAds` + the `GatedTag` type from
`@getvitops/astro`.

## 4.0.0 — 2026-08-05

Consent that only interrupts a visitor when something actually needs permission, Search Console
onboarding, a documented account of which tier provides each component, and a fix to three web
components that silently never enhanced on a client-side navigation. Read the **Breaking** list:
two element renames touch existing markup, the consent cookie is re-prompted once, and
`vitops indexing` is now `vitops search notify` with no alias.

### Breaking

- **Consent is now demand-driven.** The banner appears when something actually needs permission,
  not on every first visit. Enabling the gate used to interrupt every new visitor regardless of
  what the site did — including sites whose only analytics provider was cookieless, where there was
  genuinely nothing to consent to.

  Those are now two separate facts: the build decides what the banner _can_ ask (which rows the
  markup carries), the runtime decides what it _does_ ask. A gated tag registers its demand when it
  reaches its loading strategy, so an `idle` tag asks after `load` and an `interaction` tag asks
  only once the visitor acts.
  - **The cookie schema is v1 → v2.** A choice is now recorded per category as granted / declined /
    **not yet asked**. That third state is what lets a later demand ask about a category an earlier
    prompt never showed — accepting an analytics banner no longer silently declines preferences.
    Every stored v1 choice re-prompts once, because a v1 cookie asserted a definite answer for
    categories the visitor was never asked about.
  - **`ConsentApi`:** `needed()` now means "something demanded a category the visitor hasn't
    answered", not "there is no cookie yet" — a custom banner calling it stays hidden until
    something asks. `ConsentState.decided` is gone; use `decidedFor(state, category)` or
    `undecidedCategories(state)`. New: `require()`, `request()`, `demanded()`.
  - **If you gate anything yourself, call `require()`, not `granted()`.** `granted()` is a passive
    read: on a site where nothing else demands that category, it is never offered, never granted,
    and your write never happens — silently, forever. `require()` is what raises the banner.
  - **Theme-toggle persistence waits on `preferences`** when the site has a consent gate. The
    scheme still applies immediately; only the `localStorage` write waits. Sites without consent
    enabled are unaffected.

- **Every custom element now carries the `wc-` prefix**, and two renames affect existing markup:
  `<color-scheme-toggle>` → **`<wc-color-scheme-toggle>`**, and `<wc-multifield>` →
  **`<wc-multi-field>`** (3.0 shipped that inconsistency by accident). Update your templates.

  An unknown element name is not an error — the browser treats it as an inert
  `HTMLUnknownElement` — so a missed rename is a control that renders and never works, with
  nothing in the console. The Bricks element keys, custom properties and events are unchanged, so
  elements already placed on a Bricks page keep working.

- **`vitops indexing` → `vitops search notify`.** No alias; same flags, same behaviour. Update any
  CI or deploy scripts. It is grouped under `search` with the new `search setup`.

- **Two renamed exports in `@getvitops/utils`.** Both did the same job under the same name from
  different subpaths, which forced an alias at every call site: `indexing`'s `getAccessToken` →
  **`serviceAccountToken`**, `onboarding`'s → **`refreshTokenGrant`**. New
  `googleAccessToken(credential)` accepts either identity.

### Added

- **`vitops search setup`** onboards domains into Google Search Console as domain properties —
  otherwise a manual DNS-paste / wait / verify / add-property dance. Per domain in the new
  `site.searchConsole` block it ensures the apex verification TXT in Cloudflare, verifies ownership
  (DNS_TXT, retried with backoff while DNS propagates — still-unverified is reported **PENDING**,
  not failed), adds the `sc-domain:` property, and adds any `delegatedOwners`. Idempotent, with
  `--check` and `--dry`. DNS records are only ever created, never edited or deleted.

- **`vitops search notify` accepts either Google credential**, preferring the service account when
  both are set. The two halves of `vitops search` previously demanded two unrelated Google setups —
  five environment variables — when Search Console does not care which identity calls it.

- **`vitops docs components`** — which of the four tiers provides each pattern, and the call to
  write. The class reference listed pattern names and the elements reference listed Bricks
  controls, but nothing said that `tree` is also a web component _and_ an Astro component. The cost
  is silent: you hand-write markup a component already emits, or you wrap a component that already
  emits its own tag. The docs site projects the same manifest as four per-tier pages under
  **/components**.

- **`<wc-tree>`** — filter, expand/collapse all and hash deep-linking over a nested `<details>`
  tree. Deep-linking is the part worth knowing: a node inside a closed `<details>` has no layout
  box, so the browser's own fragment navigation finds nothing and silently stays at the top of the
  page; the element opens the target's ancestors first. `<Tree items={…} />` and its `TreeItem`
  type are new in `@getvitops/astro`, and emit the tag themselves — don't add your own wrapper.

- **`schemaTreeNodes()`** walks a JSON Schema into tree _data_, so agents get markdown and a site
  gets an accessible disclosure tree from one walk. The config reference is now one filterable page
  instead of two overlapping markdown ones.

- **Concept docs for four subsystems** — `vitops docs consent | tracking | search | legal`. Each
  documents rules that fail silently when broken: a gated tag given a live `src` fetches the third
  party anyway; a sitemap with no `<lastmod>` makes edited pages undetectable, so `search notify`
  looks healthy while resubmitting nothing; a stale IndexNow key file returns `202` and is then
  discarded.

### Fixed

- **`<wc-entries>`, `<wc-carousel>` and `<wc-marquee>` silently never enhanced when inserted
  dynamically.** All three parsed their slotted markup in `connectedCallback` and returned early
  when they found nothing — but an element upgraded _during_ insertion is connected **before its
  children exist** (measured: zero children on an `innerHTML` write). So on an Astro
  view-transition swap, a client-side navigation or a cloned template, the carousel never cloned
  its slides, the entries never built their table, and the marquee never took over from the
  CSS-only path. Nothing errored; the un-enhanced fallback just stayed on screen, which is why it
  went unnoticed. Initialisation now retries once the insertion completes, guarded so a retry
  can't double-apply.

- **`.tree` indent was 41px per level against a 24px design**, measured in a browser — three
  compounding leaks, each invisible in the CSS. A 9-deep tree spent 382px on indent and left its
  deepest label 162px wide; now 24px per level and 653px of label. The subtlest cause:
  `details.css` gives every non-summary child of a `<details>` an inline margin, and its selector
  takes `:is()` specificity under CSS nesting (**0-1-1**), so `.tree { margin: 0 }` at 0-1-0
  _lost_ to it. The indent is also fluid now, since a tree's depth is a property of the data.

- **Leaf rows now align with their branch siblings.** A branch spends a toggle column on its
  chevron before its label; a leaf has none, so every leaf label sat one full column (24px) inside
  its siblings and nothing at a given depth lined up.

- **Schema descriptions no longer eat their own wildcards.** `renderInlineMarkdown()` lifts code
  spans out before applying emphasis, which is load-bearing rather than tidy: `colors.utilities`
  describes its families as `` `bg-*` ``, `` `text-*` ``, `` `border-*` `` — literal asterisk
  wildcards. Run emphasis over the raw string and the `*` closing `bg-*` pairs with the one closing
  `text-*`, italicising the text between two unrelated utilities and eating both asterisks, leaving
  prose that names families which don't exist.

- **`config.md` claimed "only the wrapper is listed here" under `designSystem` and then emitted the
  entire token schema anyway** — `themes.<name>` _is_ a design system, so the walk descended into
  it. It now stops at the wrapper and delegates to the authoring reference as it always said it did.

- **`<wc-consent>` builds its own consent patch** rather than calling `acceptAll()`, so "Accept" on
  a preferences-only prompt no longer grants analytics the visitor was never shown.

## 3.0.0 — 2026-08-04

Navigation shells, a top-layer animation driver, and a run of fixes to things that had never
worked. Read the **Breaking** list before upgrading: two custom elements are renamed, and two
spacing/animation changes are visible on every existing site.

### Breaking

- **The site config is now a three-section `Config`: `designSystem`, `organization`, `site`.** The
  flat shape held the company and the deployment as peers, so no single noun described it and a
  second site sharing the same company had no way to say so. Now several sites can carry one
  `organization` and differ only in `site`.

  `designSystem` stays at the root — it is what tells a config apart from a bare
  `design-system.json`, so moving it would have turned a total discriminator into a guess. The
  fields already under `organization` stay put. Everything else moves:
  - → `site`: `defaultLocale`, `locales`, `domains`, `dns`, `cloudflare`, `environments`,
    `abTesting`, `fonts`, `tags`, `postTypes`, `galleries`, `testimonials`, `templates`,
    `navigation`, `seo`, `analytics`, `notifications`, `tracking`, `security`, `legal`, `icons`,
    `favicon`, `deployment`
  - → `organization`: `contact`, `primaryLocation`, `locations`, `services`, `links`

  **You don't have to apply that list by hand.** `vitops validate` recognises a pre-3.0 flat
  config and names every move; it short-circuits before the schema would bury you in a dozen
  `unrecognized_keys` errors, because a failure that says "unknown key: analytics" teaches nobody
  where it went.

  Renamed exports from `@getvitops/generator`: `SiteConfigSchema` → `ConfigSchema`, `SiteConfig` →
  `Config`, `validateSite` → `validateConfig`, `resolveSiteConfig` → `resolveConfig`,
  `isSiteConfig` → `isConfig`, `siteJsonSchema` → `configJsonSchema`, `SITE_SCHEMA_URL` →
  `CONFIG_SCHEMA_URL`, `SiteValidationResult` → `ConfigValidationResult`; `ResolvedInput.site` is
  now `ResolvedInput.config`. Added: `OrganizationConfig`, `SiteSection`.

  The published schema moves with them: `@getvitops/generator/site.schema.json` →
  `@getvitops/generator/config.schema.json`. Update the `$schema` key in your config.

  Option names are unchanged. `vitops({ site: { input } })`, the Vite plugin's `site` and
  `generate({ site })` all still point at the config file.

- **The Astro integration is now `vitops()`, not `getvitops()`.** It is a default export, so the
  name is yours to choose and nothing breaks on upgrade — but every example now reads
  `import vitops from '@getvitops/astro'`, matching the Vite plugin, which has always been `vitops`.
  The package scope (`@getvitops/*`) and the internal `virtual:getvitops/*` module ids are
  unchanged; neither is an import name.

  ```js
  import vitops from '@getvitops/astro';
  export default defineConfig({ integrations: [vitops({ css: { input: 'site.json' } })] });
  ```

- **`<copy-button>` → `<wc-copy>`, `<multi-field>` → `<wc-multifield>`.** Update your markup.
  Unchanged: the Bricks element keys (`vitops-copy-button`, `vitops-multi-field`), so elements
  already placed on a Bricks page keep working; the `--multi-field-*` custom properties; and the
  `multi-field-*` events.

- **`.rhythm` now gives every non-heading block heading-spacing before a heading.** The pairs used
  to enumerate the _other_ side (`p`, later `p, pre, blockquote, table, dl, ul, ol`), so a heading
  after anything not on that list fell through to paragraph-to-paragraph spacing. They are now
  defined by what a heading **is** — `h1`–`h6` plus the `font-display` / `font-title` /
  `font-heading` type roles — and inverted to `:not(<heading>) + <heading>`.

  This is the change most likely to be visible on an existing site: expect a little more space
  above headings that follow a code block, table, figure-like `<div>` or component. To keep the old
  spacing somewhere specific, set `--rhythm-p-h` on that container.

- **`<details>` animates open and closed** where `prefers-reduced-motion` allows. It was previously
  instant on purpose — the transition used to deadlock the disclosure _shut_, which is a content-loss
  bug rather than a missing animation. Re-verified on Chrome 149 with a real click. If you extend
  this pattern, keep **both** `block-size` and `content-visibility` in the transition list; dropping
  the latter reproduces the deadlock.

- **Drawers and dialogs animate on close.** Both drove their entry with `animation:` on `[open]`,
  which by construction plays once, so the close was instant. Both now use the top-layer driver.
  `nav.css`'s `.drawer-menu` timing moves from a hand-set 0.4s/0.7s to `--animation-duration` /
  `--custom-ease-out`.

- **`popover.css` no longer pins `[popover]:popover-open { opacity: 1 }`.** It never animated
  anything on its own, but at (0,1,0) and imported after `animation.css` it outranked
  `.transition`'s opacity and made every top-layer fade impossible. Removing it is what lets the
  driver work — do not re-add it.

### Fixed

- **`.sitenav--bp-sm` dropdowns could never open.** Its desktop block had drifted onto an older
  markup shape, selecting `.sitenav__disclosure > .sitenav__submenu` where the submenu is the
  disclosure's _sibling_. `md`/`lg`/`xl` were byte-identical and only `sm` had rotted — exactly the
  drift four hand-maintained parallel blocks invite. Now one shared block behind a style query,
  583 → 361 lines.

- **Hover dropdowns rendered off-screen.** A closed popover is not in the top layer but keeps the
  UA's `position: fixed`, and `.dropdown--show-on-hover` reset only `inset` — so the panel faded in
  around 3300px from its trigger, which reads as "hover does nothing". Now anchored to the trigger,
  and it follows on scroll. Same fix for `.split-link--show-on-hover`.

- **Horizontal overflow on narrow screens.** `.centered > *` floors at `min-inline-size: 0`; `body`
  gets `overflow-wrap: break-word`; `patterns/code.css` gains the `pre` rules it never had
  (`max-inline-size: 100%`, `overflow-x: auto`, `overscroll-behavior-x: contain`) and gives inline
  `<code>` `overflow-wrap: anywhere`.

  Worth knowing if you hit this class of bug: a scroll container does **not** zero its min-content
  contribution in Chrome. A single `<pre>` reported 797px of min-content inside a 390px viewport, and
  any ancestor sized under `fit-content` resolved to _that_ rather than the available width.

- **`.split-<a>-<b>` publishes `--_flex-direction: row`.** Only the `.flex-*` utilities did, so
  `class="split flex-col md-split-1-2"` left the variable reading `column` at every width — and
  `patterns/grouped.css` resolves its collapsed-border axis from a style query on it, so a nested
  `.grouped` collapsed on the wrong axis with nothing to indicate why.

- **`.toc-layout`** uses `minmax(0, 1fr)` rather than a bare `1fr`, whose automatic minimum is
  min-content.

### Added

- **A generated config authoring reference.** `vitops docs config` prints it; it ships as
  `config.md` in the OKF bundle and as _Config reference_ on the docs site. Every field of all three
  sections is rendered by walking the published JSON Schema — the same helper that renders the
  `design-system.json` reference — so it cannot document a field validation does not accept, and
  the two references cannot drift apart in presentation. Its `designSystem` section lists only the
  wrapper and links to the design-system reference rather than duplicating it.

  The docs site also picks up the icons concept doc, which the bundle has had but the site's page
  list never included.

- **`navshell` — a nav aside beside content, collapsing to a toggle and drawer.** Available as the
  `navshell` pattern and as `<NavShell>` / `<NavShellToggle>` from `@getvitops/astro`.

  It **nests**, which is the point: a site nav wrapping an on-this-page nav, each promoting at its
  own breakpoint. That works through a style query on an inherited flag rather than one copied block
  per breakpoint, and its content column is a container, so an inner shell measures the space it
  actually has instead of the viewport. The toggle can live outside the shell — in a site header,
  say — with `toggle="external"`.

- **`navbar`** — extracted from `nav.css`, where `.navbar` existed only as half of that file's
  drawer⇄navbar pair, plus `--start` / `--center` / `--end`, `__spacer` and `--sticky`
  (`.navbar-sticky` is aliased).

- **A top-layer animation driver.** `animation.css` gains the fourth driver alongside
  `animate-view` / `animate-scroll` / `animate-trigger` / `transition`, and every effect gains an
  `open-<fx>` state variant in all three formats. Overlays now state _where they start_ rather than
  owning a keyframe, so effects compose: `class="drawer drawer--right open-fade-in"` slides and
  fades. Applied at zero specificity with identity defaults, so a popover that sets no effect vars
  is unchanged.

- **One scrim.** `--scrim` / `--scrim-filter` and `.no-scrim` in `popover.css`, replacing 18
  `::backdrop` blocks across seven partials. `.drawer--modeless` is aliased to `.no-scrim`.

- **`<wc-marquee>`** — clones the content enough times to cover the track, so every gap matches
  including the seam. CSS alone cannot do this: it has to pad each copy to the track width, which
  puts the slack at the end of every copy. The CSS-only `.marquee` is unchanged and still works
  without the element; `--marquee-gap` is new.

- **`--width-nav`** joins `--width-measure` / `--width-breakout` / `--width-spotlight`.

- **`.skip-link`** in `patterns/anchor-link.css`, using a clip rather than the `-100vw` idiom,
  which overflows in RTL and ignores the scrollbar gutter.

### Notes

- **`patterns/nav.css` is legacy.** Its header promised a Lit nav component that was never written
  and is not planned — the house pattern is native (`popovertarget` + `[popover]`, `<details>`).
  Use `navbar`, `sitenav` or `navshell`. Removal is a later change.
- **`scroll-target.css`'s `.is-current` no longer claims to be a JS scroll-spy fallback.** There is
  no such code. `:target-current` is the only working highlight, which today means Chrome; set
  `.is-current` yourself if you need it sooner.
- `elements.js` gains one element (`wc-marquee`), so the shared bundle is slightly larger for every
  consumer. Shipping only the components a page uses is tracked in `TODO.md`.
- If you register a custom property, its `initial-value` must be computationally independent —
  `16rem` is not, so `@property` drops the whole rule silently. `navshell` uses an inline fallback.

## 2.1.0 — 2026-08-04

_Also: `@getvitops/emdash` 0.3.1._

Two new commands for the parts of shipping a site that were still hand-rolled per project: encoding
video, and telling search engines a deploy happened. Nothing breaks — both are additive, and neither
runs unless you configure it.

### Added

- **`vitops media` — raw video in, web-ready assets out.** Each source in a `raw/` directory becomes
  a **VP9/WebM**, an **H.264/MP4** fallback and a **JPG poster**, with the directory structure
  preserved so you can import them like any other asset and let your bundler content-hash them.

  ```sh
  vitops media --raw raw --out src/assets/processed
  ```

  Also an Astro integration option (`media: { raw, out }`, running in the same pass as your CSS), a
  Vite plugin option, and `processMedia()` from `@getvitops/utils/media`.

  **Runs are cached** on source content plus encode settings, in `.vitops/media-manifest.json` — a
  24 MB clip that took 88 seconds the first time takes 0.14 seconds the second. **Commit the outputs
  and the manifest:** a fresh CI clone has neither and would re-encode from scratch, and ffmpeg
  output isn't byte-reproducible across versions, so a CI re-encode would rewrite every video on any
  toolchain bump.

  `ffmpeg` is an external tool, not an npm dependency — install it yourself. The command fails
  without it rather than skipping, because a page referencing a video that was never encoded is
  broken, not degraded.

- **`vitops indexing` — the end-of-deploy Search Console visit, automated.** Reads `seo.indexing`
  from your site config, diffs your sitemap against the previous run, pings **IndexNow** with what
  changed, and re-submits your sitemap through the **Search Console API**. `--check` then inspects
  your `priorityUrls` and exits non-zero on a page Google hasn't indexed, so a scheduled CI job
  catches a page that quietly falls out of the index.

  ```sh
  vitops indexing --dry     # print the plan, make no requests
  vitops indexing           # submit
  vitops indexing --check   # a day or two later: did Google actually index them?
  ```

  **Know the ceiling.** Google exposes no API that requests indexing — the button in Search Console
  isn't available anywhere, URL Inspection is read-only, and the sitemap ping endpoint was removed
  in 2023. IndexNow reaches Bing, Yandex, Naver, Seznam and Yep; Google doesn't participate. So this
  automates every sanctioned step and then _verifies_ the outcome; it does not make Google re-index
  on demand, and nothing can. Google's Indexing API is deliberately not wired — it's scoped to job
  postings and livestreams, and using it for ordinary pages violates its terms.

  An environment whose `robots` policy says `noindex` is refused outright, so pointing this at
  staging can't publish it to a search engine. Persist `.vitops/` between runs (a CI cache), or
  every run submits everything.

- **`gitLastmod()` for real sitemap dates** (`@getvitops/astro`). `@astrojs/sitemap` emits no
  `<lastmod>`, which means a crawler is told your pages exist but never that one changed — and it's
  what lets `vitops indexing` submit a handful of URLs instead of all of them.

  ```js
  import vitops, { gitLastmod } from '@getvitops/astro';
  vitops({ sitemap: { serialize: await gitLastmod() } });
  ```

  It derives each date from the source file's last commit and leaves a page alone rather than
  guessing (dynamic routes, ambiguous slugs, shallow clones): an inaccurate `lastmod` is worse than
  none, because Google stops trusting the field site-wide. Needs `fetch-depth: 0` in CI.

- **New `@getvitops/utils` subpaths:** `./media` and `./indexing`. Separate entry points so
  importing the content helpers doesn't drag in an encoder or a network client.

### Fixed

- **Releases were broken since `apps/portal` was extracted.** The changesets `ignore` list still
  named `portal`, and changesets _errors_ rather than warning on an entry it can't resolve — so
  `changeset status`, `version` and `publish` all exited non-zero.

- **A peer-dependent no longer takes a spurious major bump.** `@getvitops/emdash` peers on
  `@getvitops/astro >=2.0.0`, and changesets bumps peer-dependents as major regardless of whether
  the new version actually leaves that range. An astro 2.0.0 → 2.1.0 minor was queuing emdash
  0.3.0 → **1.0.0**, announcing a breaking change that didn't exist. It now takes a major only when
  astro genuinely exits `>=2.0.0`, which is what the peer range was written to express.

## 2.0.0 — 2026-08-03

_Also: `@getvitops/emdash` 0.3.0, `@getvitops/create` 0.4.0._

**Three things that were quietly not working now work, and each one needed a breaking change to
fix.** Utilities never actually beat patterns; the framework assumed a border-box reset it didn't
ship; and the site config had nowhere to put a system-wide fact. Alongside them: an icon system with
one semantic vocabulary across icon sets, webfont loading through Astro's Fonts API, analytics with
a consent gate, and every config-taking surface now accepting the larger site config that embeds a
design system.

If you are upgrading a real site, read **Breaking** in full — two of the three change how existing
markup renders, and neither announces itself.

### Breaking

- **Cascade layers are assigned by what a rule _is_, not which file it lives in.** The three-layer
  order (`vitops.base → components → utilities`) has existed for a while and its entire purpose is
  to let `class="card bg-danger-muted"` work without `!important`. But layers were chosen per
  _partial_, and `layout.css` held both structural patterns and roughly three quarters of the
  framework's utilities — so `.m-*`, `.flex-*`, `.items-*`, `.justify-*`, `.text-*` and the split
  ratios were shelved _below_ the patterns they exist to override and silently did nothing.
  `utilities.css` had the mirror-image problem, holding the `.reveal` component family.

  Both are split, and a shared `LAYER_CONTRACT` asserts the classification across formats so the
  halves cannot drift. **Migration:** combinations like `class="table text-center"`,
  `class="banner items-start"` and `class="media items-center"` now take effect. If you wrote one,
  never noticed it did nothing, and preferred the old result — remove the utility. To keep a pattern
  winning, write the rule in your own stylesheet: unlayered CSS still beats all three layers.

  **Removed: the bare `<bp>-split` classes** (`sm-split` … `xl-split`). `@utility` cannot live in a
  cascade layer, so `@md:split` was impossible and the css/bricks counterpart went with it. Use
  `md-flex-row`, which says the same thing in every format.

- **The framework ships a border-box reset.** In `vitops.base`, so unlayered consumer CSS still
  wins, and the opt-out is one rule: `*, *::before, *::after { box-sizing: content-box }`. The
  `tailwind` format is unaffected — preflight already did this. The reason it stopped being
  optional: `.split`'s ratio is a flex basis, which sizes the border box, so under content-box a
  padded column came out wider than its sibling by exactly its padding. Stating the assumption once
  beats every pattern re-asserting it and the ones that forget being quietly wrong.

- **`designSystem` in a site config is now an object.** The map moves under `themes`, and
  `defaultTheme` + `defaultColorScheme` move inside it; `respectSystemPreference` is gone, since
  `defaultColorScheme: "system"` says the same thing and the incoherent combination is no longer
  expressible. Migration is automatic at runtime — all three spellings are accepted — but
  `site.schema.json` is published to a stable URL, so an editor pinned to `$schema` will flag the
  old shape.

  This is what made `<color-scheme-toggle>`'s **System** position work. It had always shipped three
  segments and one did nothing: it removes the theme attribute, and with no `prefers-color-scheme`
  block in the emitted CSS the page fell through to light on every machine. Opt in with
  `defaultColorScheme: "system"` (+303 B gzipped); it is opt-in because switching it on visibly
  flips an existing site dark for dark-OS visitors.

- **`@getvitops/emdash` now depends on the toolchain.** Its blocks render from the generated SVG
  sprite, so against an older toolchain `vitops.actionLink` rendered an **empty box** — no error,
  nothing to grep. It hard-depends on `@getvitops/utils` (the editor's icon list is now derived from
  `iconMap`, not copied) and peers on `@getvitops/astro` `>=2.0.0`. An unmet-peer warning on upgrade
  is this change working.

### Added

- **An icon system.** Icons are named by meaning and resolved per configured set — `menu` becomes
  `fa7-solid:bars`, `lucide:menu` or `ph:list` — so swapping sets is a config edit. A name
  containing `:` passes through untouched. Three delivery paths: `astro-icon`, `astro-iconset`, and
  a build-time **SVG sprite** (`icons.sprite`) for Bricks, EmDash and plain HTML — `<use href>`, no
  JS, no icon-API call. The `include` map that keeps an SSR bundle from shipping an entire icon set
  is derived by scanning your source, not hand-maintained.
- **`getvitops({ fonts })`** loads webfonts through Astro's Fonts API instead of hand-rolled tags,
  and `fonts` in `design-system.json` is now documented as what it always was: stacks only, loading
  nothing.
- **`<Analytics />` and a general-purpose consent gate.** GA4, Clarity, Matomo and Plausible, every
  tag off the critical path (`strategy` defaults to `'idle'`) and, when it sets cookies, only after
  consent. The gate is a sibling of analytics, not part of it — anything marked
  `data-consent="<category>"` waits on the same choice.
- **Any config-taking surface accepts a site config.** `generate()`, the Vite plugin, the Astro
  integration and every CLI command take a `design-system.json` **or** the larger `company.json`
  that embeds one, told apart by shape rather than filename. A site config also supplies the
  site-level facts — colour scheme, legal documents, icon sprite, fonts — so the path is declared
  once. New `theme` / `siteEnv` options select a theme and apply an A/B variant.
- **`vitops lint` catches reinvention**, not just typos: hand-written CSS that re-implements a
  framework primitive. Findings gained a severity, so an advisory rule can't break your CI on first
  run.
- `gap-*` utilities over the fluid space scale, `text-{wrap,nowrap,balance,pretty}`, `.split`
  stacking + `.split-reverse`, and `text-wrap` as a stated decision on every type role.

### Fixed

- **A filled CTA's text turned dark on hover.** `:where()` zeroes the element, but a pseudo appended
  outside it does not — so `:where(a, .link):hover` was 0-1-0, tied with `.cta-<role>`, and won on
  source order. Every `<a class="cta">` flipped to the link colour mid-hover.
- **JS and scroll-timeline detection moved into CSS**, so no-JS visitors stop getting invisible
  content, and animation families that never animated now do.
- **`validate()` rejects what the published JSON Schema already rejected** — it was lenient where
  the schema was strict, so a config could pass `vitops validate` and fail in an editor. `vitops
validate` also routes on the file's shape: pointed at a site config it used to report one
  `unrecognized_keys` and nothing about the file's real contents.
- **A chroma-0 seed produces an actual neutral** instead of a pink one, and non-monotonic ramps are
  now rejected rather than silently producing a scale that doesn't darken.
- **Maskable favicons are composited opaque**, so they stop rendering as a logo in a black box.
- Three tailwind-only divergences: `container-name: body` was missing (so the TOC patterns were
  stuck narrow), `grid-auto` lost its list-margin reset, and **`.sticky` was being deleted outright**
  because its name collides with a Tailwind utility.
- **`@getvitops/create` templates track `latest`.** They pinned `@getvitops/astro: ^0.7.0` and
  scaffolded projects a full major behind through the whole 1.0 release; `vite`/`vite-plus` were
  `catalog:`, which cannot resolve outside this monorepo at all, so the scaffold succeeded and the
  first install in it failed.

## 1.0.0 — 2026-08-02

**The colour system is rebuilt.** Every colour token and utility class is renamed; this is the
breaking change the 1.0 is for. Alongside it: a fourth output format that emits an agent-facing
`DESIGN.md`, generated legal documents, and a base-typography binding that also fixes the theme
editor's dead Body controls.

### Breaking

- **Colour moves to a target-prefixed grammar over one shared lightness ladder.**
  `--color-<target>-<role>[-<variant>]`, target ∈ `bg` `text` `icon` `border`, and **the class
  name is the token name minus `--color-`**.

  What it replaces: two axes shared one namespace — functional _planes_ (`--<role>-bg-muted`) and
  appearance-relative _stops_ (`--color-<role>-muted`) — arbitrated by a "plane wins" rule. The
  result wasn't a scale. On the shipped palette `bg-ui-accent-x-muted` and `bg-ui-accent-muted`
  both resolved to step 100, bare `bg-ui-accent` was _lighter_ than both, and
  `--color-<role>-muted` was unreachable through any `bg-` class. With the target inside the
  token name there is nothing left to arbitrate.

  Ramps now sit on a fixed lightness ladder (50 → L 0.98 … 950 → L 0.21); only chroma and hue
  vary, so a step means the same lightness in every hue. Authored colours — a `seed`, an
  `anchors` entry, a `tones` value — are still pinned verbatim at their nearest step, the only
  steps allowed off the ladder, and warn past ~0.03 L.

  **Migration:** the full before/after table is in
  `node_modules/@getvitops/generator/CHANGELOG.md`. The two that catch people:
  `bg-<role>` on a chromatic role becomes `bg-<role>-x-muted` (a chromatic role has no bare
  background — say how loud you mean), and the **`surface` names rotate value-preservingly** —
  the page is now `bg-surface-muted`, the card is `bg-surface`. `vitops lint` reports role
  classes that no longer resolve, with suggestions derived from what the generator actually
  emits.

- **Contrast is enforced at build time, not only in tests.** Text ≥ APCA Lc 75 on its primary
  background, ≥ 60 on secondary planes, icons and surface boundaries ≥ 45, in both appearances.
  A violation now throws out of `generate` — a palette that used to build and read badly now
  fails loudly. `text-<role>-x-muted` (placeholder) and `-xx-muted` (disabled) are exempt.

- **Two `tones` claiming the same step is now an error** rather than one silently overwriting
  the other. Use the record form (`tones: { "600": "…", "700": "…" }`) to resolve it.

### Added

- **`--format design`** — a fourth format emitting one `DESIGN.md` and no CSS: the brief in
  [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format, YAML token
  front matter plus a prose body. It's what you hand a coding agent or a Figma import that has
  never heard of the toolchain; `vitops docs` stays the richer reference for those who have it.
  Run it with `--out .` — the file conventionally sits at a repo root beside `AGENTS.md`.

  Role tokens are emitted as `{colors.<hue>-<step>}` references rather than flattened hexes, so
  the role → ramp lineage survives the export; flattening them is exactly what breaks dark mode
  downstream. `StylesheetFormat` (`Exclude<Format, 'design'>`) is new on the public API, and is
  what `@getvitops/astro`'s `css.format` and `vitops lint --format` now take — passing `design`
  where a stylesheet is expected is a type error rather than a missing-file build failure.

- **`vitops legal`** — privacy policy, terms of service and cookie notice rendered from a site
  config, as markdown, an HTML fragment or EmDash Portable Text. The documents are _derived_:
  the analytics vendor they name is the one whose ID you set, the personal information they list
  is what your forms collect. A provider swap updates the policy on the next build. Delivered
  per stack — the CLI anywhere, `dist/legal/*.html` plus a `[vitops_legal]` shortcode on
  Bricks, a content collection on Astro. **It is not legal advice, and it is only as true as
  your config**; every document opens with a review banner saying so.

- **`typography.headings` can bind base page typography to a type role** — map `"body"` to your
  prose role and the generator emits `body { font-family: var(--body-ff, …); … }`, so prose
  inherits the role instead of a hand-written `body { line-height: … }` block each consumer had
  to author. If you keep such a block, drop the properties the role now owns: restating them
  shadows the role's tokens, and unlayered CSS wins.

- **`icon-<role>`** — a non-text colour tier, so a glyph can run more vivid than text. `icon`
  joins `bg`/`text`/`border` as a default utility family. Plus `--color-border-focus`, the
  focus-ring tone.

- **A pattern's fill can be undone.** `background`/`background-color` join `BASE_HOOK`, so
  `.card` emits `background: var(--bg-card, …)` and a flat border-only card is
  `style="--bg-card: transparent; --ds-card: none"` rather than an inline override. The `css`
  and `bricks` formats also gain `bg-transparent` / `bg-inherit` (Tailwind ships both itself).

- **`<Seo />`** for non-EmDash Astro sites — `<title>`, description, canonical, Open Graph,
  Twitter cards, robots, `article:*`, `hreflang`, verification tokens. Site defaults in the
  integration, per-page overrides as props. It owns `<title>` and the description meta, so
  remove yours when you adopt it. On an EmDash site use `<EmDashHead>` instead.

- **An opt-in `sitemap` option** on the Astro integration, registering `@astrojs/sitemap` (an
  optional peer) and linking the result from `<Head />`. It needs the `site` config option and
  lists prerendered routes only. On EmDash, leave it off — EmDash serves its own.

- **An optional `meta` key** (`{ name, description }`) in `design-system.json`, supplying the
  brand name and Overview paragraph to `DESIGN.md`. No other format reads it.

### Fixed

- **Theme-editor typography edits that previewed live and vanished on save.** The design
  manifest's `reverseIndex` only mapped hooks a role explicitly declared, while the editor
  renders a control for every hook — so editing `--body-ls` or `--body-tt` on a role that
  omitted it updated the page and then silently dropped out of the `design-system.json` patch.
  Every hook of every role is now indexed, and pattern backgrounds (`--bg-card`, `--bg-btn`,
  `--bg-status`) are tunable in the browser alongside their geometry.

- **`validate()` warns when a shadow value can't survive `drop-shadow()`.** A `--shadow-<name>`
  token feeds both `box-shadow` and `filter: drop-shadow(…)`. A spread radius, a second layer or
  `inset` invalidates the whole filter, so `.drop-shadow-<name>` rendered nothing while the token
  still looked correct everywhere it was authored.

- **The `virtual:getvitops/head` type declaration** was missing the `editor` field `<Head />`
  already reads — a type error in consumer projects that don't set `skipLibCheck`.

- **`validateSite` rejects a privacy policy with no contact or `domains.canonical`**, both of
  which are interpolated into sentences that would otherwise render blank.

### Docs

Every Astro example now binds the integration as `vitops` (`import vitops from
'@getvitops/astro'`). The default export is unchanged — configs binding it as `getvitops` keep
working. The generator and CLI reference pages now document the `design` format, and the
scaffolded `emdash` template moves onto the new colour tokens.

## 0.9.0 — 2026-07-31

**Format parity.** The three outputs had quietly drifted apart — the same markup meant different
things depending on which one you built. Most of this release is closing that, plus the dead
references and unrendered components the investigation turned up. Prompted by a report from a
14-page consumer site built on the `tailwind` format.

One change can surprise you: **the `css`/`bricks` bundle is now layered**, so your own CSS
overrides the framework by default. If you ship a reset, read the migration under _Changed_.

### Added

- **`vitops lint`** — reports framework classes in your source that resolve to nothing. An
  unknown utility class is indistinguishable from a working one: nothing errors, the element
  just never gets the style. Format-aware (`md-flex-row` is real in `css`/`bricks` and inert in
  `tailwind`), and it only judges classes anchored to your own config — a palette hue, a role, a
  type role, a shadow — so it stays silent on Tailwind's utilities and your own class names.

  ```
  vitops lint --format tailwind --src src
  ```

- **`validate()` warns when a required role is missing.** `colors.roles` is an open map, but the
  shipped component CSS references `brand-primary`, `danger`, `neutral`, `surface`, `ui-primary`
  and `warning` with no fallback. Omitting one leaves those components uncoloured, silently.

- **`<wc-theme-editor>` no longer dims the page it is editing**, so you can judge colour changes
  against the real design rather than through a scrim.

### Changed

- **The `css`/`bricks` bundle now ships cascade layers.** Previously every colour utility was
  emitted before every pattern and both sat at `0-1-0`, so the pattern won on source order:
  `class="card bg-danger-muted"` left the card on `--surface-bg` here while tinting it correctly
  in `tailwind`. The bundle now emits
  `@layer vitops.base, vitops.components, vitops.utilities;`, so a utility overrides a pattern in
  every format. No rule changed — 1482 rules before, 1482 after — only precedence.

  **What this changes for you:** unlayered CSS beats every cascade layer regardless of
  specificity, so your own stylesheet, an Astro scoped `<style>`, or a Bricks-authored class now
  overrides the framework with no `!important`. That is the intended override story.

  **Migration, only if you ship a reset.** An unlayered reset will now beat the framework
  component rules it used to lose to — a bare `p { margin: 0 }` defeats `.rhythm`. Put it in a
  layer and declare the order **before** the stylesheet loads:

  ```html
  <style>
    @layer my.reset, vitops.base, vitops.components, vitops.utilities;
  </style>
  <link rel="stylesheet" href="/styles.css" />
  ```

  Declaring it _after_ the link makes `my.reset` a new name introduced later — which sorts last,
  i.e. highest priority — and the reset wins anyway. This repo's `index.html` shows the change.

  The `tailwind` format is byte-identical: its utilities are `@utility` definitions, which
  Tailwind already layers correctly and which are what make `hover:`/`@md:` variants work.

  Known gap: `layout.css` mixes structural rules with utilities in one partial, so it sits in
  `vitops.components` whole and its utility half (`.m-*`, `.flex`, `.split-*`) still can't
  override a pattern.

### Fixed

- **The `tailwind` format was missing 87 role colour classes.** `bg-<role>-x-muted`,
  `bg-<role>-bold`, `bg-<role>-x-bold`, `text-<role>-bold`, `text-<role>-x-bold` and
  `border-<role>-{muted,x-muted,x-bold}` existed in the `css`/`bricks` outputs and silently did
  nothing in `tailwind`. No test built the tailwind format, so nothing caught it. All three
  formats now render from one emitter and a parity test holds them to the same vocabulary,
  permitting only four documented differences. **No class changes meaning; `css`/`bricks` output
  is unchanged.**
- **`colors.utilities` is now honoured in the `tailwind` format** (it was hardcoded to
  bg/text/border). For raw hue scales it stays a floor rather than a ceiling — those are
  `@theme` colours and Tailwind derives every colour family from them on demand.
- **The `tailwind` format stripped component container queries.** The pass that drops the
  framework's pre-expanded `md-*` utilities matched every `@container (min-width: …)` block,
  including component behaviour — so `.sitenav--bp-{sm,md,lg,xl}` were removed and the nav
  never left its mobile layout.
- **`vitops init` and `vp create` scaffolded broken configs.** Both still referenced
  `--color-surface-xl` / `--color-surface-xxl`, aliases from the named-step scale removed in
  0.6, giving a `card` with no background and an invalid default border. The EmDash template
  also carried the `patterns.radii.card` collision that `validate()` warns about.
- **`.text-reveal` rendered invisible text.** Its gradient read two custom properties with no
  defaults; when they were unset the `var()` substitution failed, `background` became invalid at
  computed-value time, and the paired `color: transparent` left nothing to see.
- **`.bordered` silently fell back to `currentColor`** through a reference to a token the
  generator never emitted.
- **`vitops docs` / `vitops agents` now surface config warnings** (on stderr, so piping `docs`
  is unaffected). They discarded them, unlike `generate` and `validate`.
- **Contrast is checked against every background plane** a role emits (`bg`, `bg-muted`,
  `bg-bold`), not only `bg` — body text on a `card` was previously unguaranteed.
- **`Subgrid` and `Cards` rendered as unstyled lists, in every format.** They drew their geometry
  with Tailwind utilities that no framework CSS layer defines, so under `css`/`bricks` they had
  no layout at all — and under `tailwind` too, because **Tailwind v4 is JIT and does not scan
  `node_modules`**: a class only a shipped component references is never generated. Cards laid
  out at `grid-row: auto` — visually plausible, quietly wrong. Now drawn with framework CSS.
- **`<details>` disclosures never opened.** The `.details` pattern animated `block-size` from a
  collapsed state that `<details>` itself controls, so the content stayed at zero height.
- **`tailwindcss` and `@tailwindcss/vite` are optional peer dependencies of `@getvitops/astro`,
  not dependencies.** Installing the integration no longer pulls Tailwind into projects using
  the `css` or `bricks` format.

### Docs

- **Raw scale classes are frozen and do not remap in dark mode** — now stated, with a migration
  table to the role equivalents. The dark-mode guarantee only ever covered functional role
  tokens, and nothing said so; a consumer site hardcoded `data-brx-theme="dark"` and filled up
  with latent light-mode bugs.
- **Roles are extensible over a required core** — the schema description and class reference
  read as a closed enumeration, which is why that consumer forked their own colour layer instead
  of adding a role.
- **`md:` vs `@md:` vs `md-` in the tailwind format** — `@md:` uses the framework's breakpoints,
  `md:` works but uses Tailwind's (which differ: `sm:` is 40rem, `@sm:` is 30rem), `md-` is
  silently inert. Plus: registering `--container-*` also re-points Tailwind's `max-w-*` scale.
- The `css`/`bricks` bundles carry a `/*!` banner pointing at `npx vitops docs classes`. The
  previous plain comment was stripped by the minifier and never reached the file.

## 0.8.0 — 2026-07-27

One new feature — a live theme editor — plus repairs to things shipped in 0.7.0 that didn't work
outside this repo.

### Added

- **`<wc-theme-editor>` — tune the whole design system in the browser, with no rebuild.** Palette,
  semantic roles, type roles, spacing, layout, pattern geometry, radii and shadows, layered as
  `:root` custom-property overrides and exportable as CSS or as a `design-system.json` patch. On a
  dev server running `@getvitops/vite`, **Save to source** writes the patch back through
  validate → write → regenerate; on a static build the probe fails and the button isn't rendered.

  It ships as a **separate, opt-in bundle** — `@getvitops/core/editor`, ~13 kB, no Lit — and is
  never registered in `elements.js`, so a page that doesn't ask for it pays nothing. Enable with
  `getvitops({ editor: true })`.

  This is a deliberate exception to the framework's rule that web components must progressively
  enhance accessible no-JS markup: it's _tooling_, not a page pattern, and a live editor has no
  no-JS fallback to enhance. It's quarantined rather than excused — don't read it as precedent for
  behaviour JS in a `<wc-*>` element.

- **`validate()` returns `warnings: string[]`** for configs that parse and generate but won't behave
  as authored, and `vitops validate` prints them. First case: a `patterns.radii` key named after a
  pattern collides on `--br-<name>` (the example config hits this with `radii.card`).

### Breaking

- **`body { margin: 0 }` is now part of the framework.** The UA's 8px margin offset every
  full-bleed surface — sticky headers and `bg-*` bands rendered inset, with a sliver of canvas
  around them, because the framework owns page gutters through `.centered`'s `--gutter`. This is
  the _only_ UA reset the framework makes; it still deliberately ships no general reset (no global
  `box-sizing` change), which would silently reflow existing layouts. **Migration:** drop any
  `body { margin: 0 }` you added to compensate; add your own padding if you relied on the inset.

- **`.cta` defaults to the `ui-primary` role instead of `brand-primary`.** The three tiers of one
  interaction family had split colour lineage — `:where(button, .btn)` and `:where(a, .link)`
  resolved to `ui-primary` while `.cta` alone used `brand-primary`, so the focus ring changed
  colour depending on which tier you tabbed onto. **Migration:** none if the two roles share a hue
  (true of the example config). If they differ and you want the old colour, use the new
  `.cta-brand-primary` variant — `brand-primary` was added to `cta.roles`, so a brand-coloured CTA
  is reachable rather than unavailable.

### Fixed

- **Dark mode worked only under Bricks.** The dark block was emitted under
  `:root[data-brx-theme="dark"]` alone — Bricks' own attribute, which nothing else sets — while the
  shipped `<color-scheme-toggle>` writes `data-theme`. Clicking "Dark" changed an attribute no rule
  matched. Both are now matched. ("System" still resolves to light; there is deliberately no
  `prefers-color-scheme` block, since adding one would flip every existing site dark for dark-OS
  users.)
- **The colour scheme now persists across navigations**, via `localStorage`, and `<Head />` applies
  it before first paint so pages don't render light and flip. Previously the choice was per-page
  state and the toggle even cleared it on unmount.
- **`@getvitops/emdash@0.2.1` reported version `0.2.0`** from its plugin descriptor — a
  hand-maintained literal that `changeset version` doesn't touch. It's now derived from
  package.json, and `vp run release` runs the test suite that catches this before publishing.
- **`generateIconInclude()` is reachable.** The semantic icon mapping (declare names + sets, get
  the build-time `include` map) lived in a package path that was never exported, so nothing could
  call it. It moved to `@getvitops/utils`, which `@getvitops/astro` re-exports. Unresolvable
  semantic names now throw at build time naming every offender, where they were skipped silently.
- **`design-manifest.json` reverse-index paths.** Numeric colour steps mapped to the hue's `seed`
  (which regenerates the whole ramp, collapsing every step onto one path); they now map to
  `anchors.<n>`. `--br-<name>` resolved to `patterns.radii.<name>` even when a pattern owned the
  variable.
- **`@getvitops/create`'s emdash template** pinned `@getvitops/astro: ^0.4.0`, a range that stopped
  resolving when astro joined the fixed group at 0.7.0.

## 0.7.0 — 2026-07-27

### Breaking

- **A bare `<button>` is no longer a filled brand-primary button.** Actions now split into two tiers
  named by intent: **`.cta`** is _persuasion_ (filled, bolder, roomier, lifts on hover) and bare
  `<button>` / **`.btn`** is _affordance_ — it signals only that something is interactive, with no
  fill, no `font-weight: 600` and no shadow.

  **Migration:** add `class="cta"` to any button that should stay prominent — submit buttons, hero
  actions, anything driving a conversion. Dialog closes, toolbar buttons, icon buttons and toggles
  should keep the new default. To restore the old look globally, point `patterns.items.btn` in your
  `design-system.json` back at the previous filled base.

  **Why:** `<button>` the element means "interactive control", not "primary action" — and a CTA is
  usually an `<a>`, because it navigates. Making the CTA a _class_ is what finally lets it go on a
  link. The framework was also fighting its old default: fourteen component partials existed partly
  to undo the fill.

- **`chip` is retired as vocabulary.** The two small-label patterns now split by behaviour, not size:
  **`badge`** is a _static_ label (status, count, category), **`tag`** is an _editable and/or
  dismissable_ one (e.g. entries in a filter list).

  **Migration:** `.chip-list` → `.tag-list`. Its `__chip` / `__chip-remove` sub-parts are removed —
  replace `<span class="chip-list__chip">x <button class="chip-list__chip-remove">` with `<span
class="tag">x <button class="tag__remove">`, since a tag list is a list of tags. Items change
  appearance: `.tag` is outlined where the old chip was filled with `--color-surface-muted`. Tokens
  `--*-chip-list` → `--*-tag-list`; the redundant `radii.chip` primitive is gone (use `--br-tag`).

- **The small-label pattern group is renamed `tag` → `label`**, so group tokens are now
  `--{p,br,b,ds,fs}-label`. **Migration:** if you set any `--*-tag` expecting the _group_ value,
  switch to `--*-label`. **Why:** the `tag` pattern and the `tag` group compiled to the same
  variables, so the pattern's override hook shadowed the group token and its `-group` alias was
  unreachable. `--*-tag` is now free as the `tag` pattern's own hook.

- **`@getvitops/astro` jumps 0.4.2 → 0.7.0.** It now shares the toolchain version instead of tracking
  its own line. **The number changed; the package did not** — 0.7.0 is the direct successor to 0.4.2,
  with no API change implied by the jump.

  **Migration:** update the version range, nothing else. Install `@getvitops/astro` at the same
  version as your `@getvitops/cli` / `@getvitops/generator`.

  **Why:** astro depends on core, generator, utils _and_ vite, and was already being bumped on every
  single toolchain release by its dependency updates — so its separate version line cost the same
  churn while making "which astro works with cli 0.6?" a question you had to answer yourself. Now the
  versions match by construction.

### Added

- **`.cta`** — the persuasion tier, with `.cta-{success,danger,warning,info}` role variants. A class,
  so it works on any element.
- **`:where(button, .btn)`** and **`:where(a, .link)`** — a pattern may now set both `element` and
  `class`, emitting one zero-specificity rule. The element gets the styling with no class needed, the
  class carries it to any other tag, and any explicit class overrides it without `!important`.
- **`fill: true|false`** on a pattern — states whether states and role variants drive
  `background-color` (plus `on-solid` text) or `color`, instead of inferring it from the pattern's
  name and base declarations. Existing configs are unaffected; the old inference is the fallback.
- Every published package now ships its `CHANGELOG.md` in the npm tarball, so per-package history is
  readable at `node_modules/@getvitops/<pkg>/CHANGELOG.md` (and on unpkg/jsdelivr) without needing
  repository access.
- This file: curated, toolchain-level release notes covering all packages at once.

### Fixed

- Role variants on element patterns were emitted at specificity 0-1-1 (`button.danger`), outranking
  any plain class. They now emit as `:where(button, .btn).danger, .btn-danger` — both at class
  specificity, and reachable from a non-`<button>` host.
- Pattern geometry now resolves through the group alias layer (`--br-btn-group: var(--br-control)`)
  instead of hard-coding `var(--br-control, …)` into each rule, so the whole cascade — `--p-btn` →
  `--p-btn-group` → `--p-control` → `--p-default` — is live custom properties you can inspect and
  edit in the browser. Applies to `btn`, `cta`, `badge`, `tag`, `card` and `status`. Computed values
  are unchanged.
- The `link` pattern declared `default_role: "brand-primary"` while hard-coding a `ui-primary` base
  colour, so hovering shifted hue instead of intensifying. Its `default_role` is now `ui-primary`.
- `@getvitops/astro`'s `FormRenderer` defaulted its submit button to `class="btn btn-primary"` — a
  class that never existed and a role that is not emitted. It now defaults to `.cta`.
- The Tailwind bundle is no longer assembled during `css` / `bricks` builds, where it was computed
  and discarded (it also read every framework partial off disk).
