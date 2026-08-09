# @getvitops/cli

## 6.0.0

**No consumer-facing change in this package.** The major is the toolchain's shared version, bumped
in lockstep for the carousel rework in `@getvitops/core` / `generator` / `astro`. Every command
behaves as it did in 5.0.0; `vitops docs components` and `vitops docs css` will report the new
carousel vocabulary, because they render live from the generator.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@6.0.0
  - @getvitops/utils@6.0.0

## 5.0.0

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

- **The framework now says out loud which patterns are foundational, and reports it when you
  reach past them.** From repeated downstream reports: sites were inventing a `.wrap` class and
  using it everywhere instead of `.centered`, and `.subgrid` — the class for any set of cards —
  was going essentially unused. Neither failure is visible in a build: every class involved is
  real, nothing errors, and the page renders.

  **`.subgrid` was missing from the generated class reference entirely.** So was `.cluster`, and
  so was `.region`. `vitops docs classes` is the doc an agent is told to fetch for "which class
  do I apply", and the framework's answer for a set of cards was not in it — which is most of why
  it never got used. All three are now documented, along with `grid-auto`, and the reference opens
  with a **Foundations** section that states the six substitutions as
  _temptation → what to write instead_ rather than as a vocabulary list. The same table is now in
  the shipped agent skill and in the `@getvitops/create` template's `AGENTS.md`, because a pointer
  to a doc only helps someone who already suspects there is something to look up. (`css`/`bricks`
  and `tailwind` alike — this is documentation and the `TIERS` manifest, not emitted CSS.)

  **`vitops lint` gained three reuse rules and a markup pass.** The existing `.centered` rule only
  fired when the hand-written CSS already referenced `--width-measure`, which is precisely the
  author who was never going to hand-roll a container. It now also catches a page-scale
  `max-width` (≥ 48rem, or a `ch` reading measure) with auto margins, and a
  container-shaped class name — `wrap`, `wrapper`, `container`, `inner`, `shell`, … — carrying any
  width cap at all. Reading the cap out of `min()` / `clamp()` too. New rules report a
  hand-written `repeat()` grid as `.subgrid` (or `.grid-auto`), and a new **markup** pass reports a
  repeated card set laid out without either — a loop that renders a card, or three or more cards
  written out. That last one is the only check that can see this drift at all, since a card list
  built from utility classes contains no bad class and no hand-written CSS.

  All of these are `suggestion` severity, so they do not fail your build unless you pass
  `--strict`. They found five real instances in this repo's own docs site.

  **`vitops lint [files...]`** now takes explicit paths instead of scanning `--src`, so it can be
  wired into a pre-commit hook — `vp`'s `staged` key appends the staged files to whatever it runs,
  and a command that refused positionals could not be put in the one place the feedback lands at
  the moment the code is written. Unreadable and non-source paths are skipped rather than fatal. The
  `@getvitops/create` emdash template wires it up with `--strict` and adds a `lint:design` script.

  **Two answers for "the whole card is a link", because one cannot exist.** Reported downstream:
  agents dislike the `<li>` wrapper when a card is a link and write `<li><a class="card">` instead.
  That shape is **wrong in a way that renders fine**, which is why it survives review — the `<li>`
  is the grid item, so the anchor is an ordinary block inside it and the tranches within the anchor
  never reach the parent's shared row lines. The alignment `.subgrid` exists for silently does not
  happen, and the anchor does not fill the cell either. Putting the anchor in the grid's place
  (`<ul><a></ul>`) is invalid HTML, so there was genuinely no correct shape to reach for.

  There are now two, and they trade against each other because **no CSS-only technique can make a
  whole card clickable and leave its text selectable** — a transparent overlay necessarily receives
  the pointer-drag:

  | Want                                     | Use                                         |
  | ---------------------------------------- | ------------------------------------------- |
  | zero JS, whole card clickable            | `.stretched-link` — **text not selectable** |
  | selectable text **and** a clickable card | `<Cards>` / `<wc-cards>` — needs JS         |

  `.stretched-link` goes on a link inside the card; its `::after` covers the card.
  **`<wc-cards>` is a new tier-2 element** that adds no overlay and instead tells a click apart from
  the end of a drag, so text selection survives. Its fallback is the card's own link, fully usable
  with no JS, and the pointer cursor is applied by the element — so the affordance never appears
  without the behaviour. `<Cards>` emits it for you. They are alternatives, never layered: with an
  overlay present the JS has nothing to do, and `vitops lint` reports the combination. (All formats
  — pattern partials, deliberately not `utilities.css`, which the tailwind format skips on the
  invariant that everything left in it is a name Tailwind ships itself.)

  ### Breaking
  - **`<Subgrid />` renders its slot verbatim — author the `<li>` items yourself.**

    ```diff
      <Subgrid>
    -   <article class="card">…</article>
    +   <li class="card subgrid-card">…</li>
      </Subgrid>
    ```

    It used to parse the slotted HTML and rebuild each child as an `<li>`, carrying over only
    `class` and `style`. That existed solely because a `<ul>` may contain nothing else, and it cost
    more than it bought: the child's tag was discarded, `id`/`data-*`/`aria-*` were silently
    dropped, and `href` could not survive at all. Nothing is copied now, so nothing is lost. `as`
    picks the container (`ul` by default, `ol`, `div`), and all other props are forwarded — they
    were previously discarded, including `role`.

  - **`<Subgrid />` and `<Tree />` now emit `role="list"`,** as does the Bricks `sitenav` element.
    `list-style: none` stops Safari + VoiceOver announcing a `<ul>` as a list, so every marker-less
    framework list was silently losing the semantics its `<ul>` was chosen for. If you hand-write
    `.subgrid`, `.list`, `.facet-list`, `.nav-items`, `.collapse-menu` or `.tree` markup, add
    `role="list"` yourself — the framework cannot add it to markup it does not render, and each
    partial now says so at the `list-style` reset.
  - **`<Cards />` no longer adds `class="card"` to slotted children,** because it no longer parses
    them. Write the class on the item. It now emits `<wc-cards>` around a `<Subgrid>`, which is what
    makes the whole card clickable — and like `<Tree />`, **it emits its own element, so do not wrap
    it in `<wc-cards>` yourself.** It also previously passed a `role="list"` that `<Subgrid>` silently
    discarded, so that never took effect.
  - **`.subgrid-card` now sets `position: relative`**, so `stretched-link` inside it needs no extra
    class. If you were absolutely positioning a descendant of a `.subgrid-card` against an ancestor
    _outside_ that card, it will now resolve against the card. Move the positioning context
    explicitly. (`css`/`bricks`/`tailwind` — the pattern partial is inlined into all three.) Not
    reachable by `vitops lint --fix`: the fix depends on which ancestor you meant, which the
    linter cannot know.

  ### Fixed
  - **`packages/generator/src/docs.ts` contained a literal NUL byte** (`CODE_SLOT`, written as the
    raw character rather than an escape). libmagic classified the file as `data` rather than text, so
    grep and ripgrep treated the largest doc emitter in the repo as **binary and silently skipped
    it** — every search for a string in it returned nothing, with no error. It is now written as the `\u0000` escape.
    Behaviour is identical; the file is searchable.
  - **`.grid-auto` is documented.** It was a real framework class for auto-fit card grids with no
    entry in the class reference, so the honest alternative to `subgrid` was as invisible as
    `subgrid` itself.
  - **`.raised` replaces the advice to use `.relative` above a `stretched-link` overlay**, which
    could not work: a positioned element at `z-index: auto` does not rise above an explicit
    `z-index` regardless of DOM order, so a second link or button in the card stayed underneath and
    unclickable. `.raised` sets both, against the same `--z-tier-raised` token the overlay now uses
    instead of a hard-coded `1`.

### Patch Changes

- **Astro and Bricks are documented as the same tier, because they are.** Both are platform
  wrappers that generate HTML from the classes and elements of tiers 1 and 2 — siblings chosen by
  which platform you are on, not steps in a ladder. No project uses both, and neither outranks the
  other.

  They were published as tier 3 and **tier 4**, in `vitops docs components`, the shipped agent
  skill and the docs site. The cause was a projection axis being read as a hierarchy: `Tier` has
  four keys (`css` `wc` `astro` `bricks`) because there are four tables to render, and the tier
  number was being derived from that key order — so the last key became "tier 4". The advice next
  to it inherited the error, telling readers to "use the highest-**numbered** tier your stack has",
  which reads as Bricks outranking Astro.

  Nothing about which patterns each tier provides has changed; this is the numbering and the prose
  around it. `Tier` keeps its four keys — that part was never wrong — and now says in its own type
  docs why four keys are three levels, so the next renderer cannot repeat the derivation.

- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@5.0.0
  - @getvitops/utils@5.0.0

## 4.1.0

### Minor Changes

- 2c890c0: Link a site to its ad properties: `site.ads`, `vitops ads`, and `<Ads />`.

  `vitops search` covers the whole Search Console relationship. Nothing covered the equivalent one
  with ad platforms, and a site's ad accounts had nowhere to live — so a Meta pixel pasted into a
  template was invisible to the rest of the toolchain. It set `_fbp` on a site whose generated cookie
  notice never mentioned it, whose consent gate never cleared it on revoke, and — for LinkedIn and
  Pinterest — whose attribution never captured the click ID at all, so every conversion from those
  platforms arrived indistinguishable from organic traffic.

  **New `site.ads` block**, keyed by platform (`google`, `meta`, `linkedin`, `reddit`, `tiktok`,
  `microsoft`, `pinterest`, `snapchat`):

  ```jsonc
  {
    "site": {
      "ads": {
        "meta": { "pixelId": "123456789", "domainVerification": "abc123" },
        "google": {
          "accountId": "123-456-7890",
          "pixelId": "AW-987654321",
          "conversionLabel": "xyz",
        },
      },
    },
  }
  ```

  **`vitops ads setup`** ensures each platform's domain-verification DNS record. Only four platforms
  verify a domain at all — Meta, TikTok, Pinterest and Snapchat, by apex DNS TXT — and that record is
  the one thing created for you (in Cloudflare, via `CLOUDFLARE_API_TOKEN`; created only, never edited
  or deleted). Google Ads, LinkedIn, Reddit and Microsoft Ads have no domain verification: linking
  there is the tag and the account id, and the run says so rather than skipping in silence. No
  platform Marketing API is called — Meta's needs a system-user token and Google's an approved
  developer token with your own account on the line — so the final "Verify" click is surfaced as a
  reminder. `--dry` prints the plan, `--check` reports drift and exits non-zero.

  **It asks for what the config is missing.** A verification token does not exist until someone
  fetches it from the platform UI, so a first run prompts for it, naming the exact UI path, folds the
  answer into the plan and writes it to your config. The token is not a secret — it is published in
  DNS, and the platform fetching it back is the ownership proof, exactly like the IndexNow key.
  Prompting requires a TTY: with `--dry`, `--check`, `--no-prompt`, or in CI, you get a named error
  instead and the run never hangs. `--no-write` keeps the answer out of the config.

  **`vitops ads tags`** prints each pixel as an inert, consent-gated `<script>` — `type="text/plain"`
  with the library URL on `data-src`, so an undecided visitor's page issues no third-party request.
  For Bricks, WordPress, Eleventy: any stack without the Astro integration.

  **`vitops ads lint`** reports the gaps that are invisible at runtime: a click ID the platform stamps
  that attribution does not capture, a pixel while `site.tracking` is off, a property with no tag id.

  **`<Ads />` in `@getvitops/astro`**, a sibling of `<Analytics />` rather than part of it — ad
  properties come from the site config, state their own consent category (`marketing` by default,
  rather than being derived), and switch per environment on their own
  (`environments.<env>.ads`, defaulting to `analytics`, then true, so a preview deployment can send
  pageviews without firing conversion pixels). Both components now render through one `<GatedTags />`,
  so the inert markup has a single implementation.

  **Your cookie notice now discloses every configured pixel** — name, cookies and opt-out — from the
  same table that writes `data-consent-cookies`, so the notice and the revoke cannot disagree. If you
  add `site.ads` to a config whose privacy policy or cookie notice you have already published,
  re-generate and re-read them.

  `li_fat_id` (LinkedIn) and `epik` (Pinterest) join the click-ID capture vocabulary; a site running
  either platform starts attributing conversions it previously recorded as organic.

- e764090: Separate where a processor stores information from whose law can reach it.

  A processor carried one optional `country`, and the privacy policy flat-deduped it into a single
  sentence. That conflated two facts a disclosure has to keep apart — **where the data rests** and
  **which jurisdiction can compel access** — and privacy law turns on the second: the OPC's concern
  is foreign _access_, not merely foreign storage.

  Ordinary arrangements were inexpressible. Azure is data-resident in Canada and US-controlled;
  Zoho can serve mail from a Canadian datacentre and telemetry from the US while being headquartered
  in India; a Microsoft 365 tenant can be Canadian with its identity data in the US. For all of
  them every available option was wrong: `country: "Canada"` rendered the incoherent _"outside of
  Canada, including Canada"_, naming the operator's country asserted storage that wasn't happening,
  and omitting it dropped the processor from the disclosure **silently**.

  **New on a processor:**

  ```jsonc
  {
    "name": "Zoho",
    "purpose": "receiving and storing email sent to us",
    "storage": [
      { "country": "Canada", "scope": "mail and productivity data" },
      { "country": "the United States", "scope": "analytics and telemetry" },
    ],
    "operatorCountry": "India",
  }
  ```

  - `storage[]` — where information rests, each entry optionally `scope`d to a category. The scope
    is what makes "Canadian tenant, identity data in the US" sayable.
  - `operatorCountry` — the jurisdiction that can compel the provider to produce it. Gets its own
    sentence: _"…established in, or controlled from, jurisdictions outside of Canada, including
    India. Personal information those providers handle on our behalf may be subject to the laws of
    those jurisdictions even when it is stored in Canada."_
  - `country` still works, as shorthand asserting **both** facts — which is what it always
    asserted, since the sentence it fed claimed storage and legal reach in one breath.

  **Combining `country` with either explicit field is rejected** by `vitops validate`. Whether the
  shorthand narrows the explicit fact or adds to it are two readings that make contradictory legal
  claims, so neither is guessed.

  A country in the policy's own jurisdiction is no longer treated as a transfer, which is the
  `country: "Canada"` fix. Comparison ignores case and a leading "the".

  ### This changes text you have already published

  **Cloudflare, Cloudflare Turnstile, Vercel and Netlify now assert operator jurisdiction and no
  storage.** They previously claimed `the United States` into a sentence saying "stored or processed
  in" — a claim about the wrong fact. Cloudflare is anycast: a request from Toronto is answered from
  a Toronto PoP, and Workers/R2 have residency controls the config cannot see.

  So a site whose only foreign element is its host or Turnstile **stops claiming foreign storage**
  and instead discloses foreign legal reach. That is a retraction in the direction of accuracy, and
  it deserves a re-read. **If you pin a US region, say so** — declare a processor with
  `storage: [{ country: "the United States" }]`. This generalises the rule the provider table
  already applied to Matomo: "we don't know" is a fact.

  **Everything else renders identically.** Google Analytics, Tag Manager, Clarity, Plausible,
  Matomo Cloud and any processor you declared with `country` produce the same words as before,
  because the shorthand expands to both facts and the operator sentence is suppressed when it would
  only restate a country already disclosed as storage. The one cosmetic change: the closing
  "subject to access requests…" sentence is now its own paragraph, since it is shared by both
  clauses.

  **A processor with no location at all is now reported** on stderr by `vitops legal`, naming the
  document it will be missing from. It cannot appear in a transfer disclosure — there is nothing
  true to say — but it used to vanish in silence, which is the failure that looks tidy. It is not a
  validation error: a bare `{ name, purpose }` is still valid.

  New exports from `@getvitops/generator`: `processorsMissingLocation`, `JURISDICTION_COUNTRIES`,
  and the `ProcessorStorage` type. `PolicyVars` gains `jurisdictionCountry`, `storageCountries`,
  `scopedStorage` and `operatorCountries`; `countries` is **deprecated but retained**, and still
  names every country it ever named, so a custom template keeps rendering what it rendered.

### Patch Changes

- Updated dependencies [2c890c0]
- Updated dependencies [e764090]
  - @getvitops/generator@4.1.0
  - @getvitops/utils@4.1.0

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
