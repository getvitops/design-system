# @getvitops/skills

## 0.1.0-alpha.6

### Patch Changes

- 20662f7: **Breaking: the default config file is now `vitops.json`, not `site.json`** (`@getvitops/generator`, `@getvitops/cli`, `@getvitops/emdash`, `@getvitops/create`, `@getvitops/skills`). The file holds the design system and the organization as well as the site, and the first two serve more than websites, so it is named for the toolchain. Nothing about its shape changed, and it is still recognised by shape (a top-level `designSystem` key), so a file you named something else keeps working. There is no fallback to the old name.

  Migration: `git mv site.json vitops.json`, then update every import or `input` that names `./site.json` (`astro.config.mjs`, `vite.config.ts`, `package.json` scripts, `wrangler.jsonc` comments). A command that cannot find the config now says this when it sees a `site.json` that is a config and no `vitops.json`: the CLI commands, `vitops emdash` and the site deploy workflow all print the `git mv` line. `vitops lint --fix` does not rename files, so that message is the migration path. A client repo on the reusable `site-deploy-emdash.yml` should rename the file in the same commit that picks up this release.

  - `@getvitops/generator`: exports `CONFIG_FILENAME` (`'vitops.json'`, Worker-safe, from `@getvitops/generator/config`) and `legacyConfigHint()` (Node-only). `vitops docs` and the generated reference name `vitops.json`.
  - `@getvitops/cli`: `-i/--input` defaults, `init --site`, the `--site` flag of `emdash form-template`/`check-prerender`, `report`, `audit` and `setup` all use `vitops.json`; config discovery no longer lists `site.json`; help text updated.
  - `@getvitops/emdash`: the design-system editor's git sync commits to `vitops.json`.
  - `@getvitops/create`: both templates ship `vitops.json` and import it by that name. Existing sites are unchanged until they rename.
  - `@getvitops/skills`: the agent skills name `vitops.json` and say older sites used `site.json`.
  - No consumer-facing change in `@getvitops/core`, `@getvitops/utils`, `@getvitops/vite` or `@getvitops/astro` beyond comments and the `fixed` bump. No CSS change in any format.

## 0.1.0-alpha.5

### Patch Changes

- fcc4a30: **`<main>` is a landmark, not a layout: remove `centered` from it.** With `<main class="centered">` every section, band and hero inside is a grid item in the reading-width track, so a tone or backdrop stops at the text column and each block had to opt out. Bands now own their width.

  **Breaking, with a migration (`@getvitops/cli`).** `vitops lint` reports `<main class="centered …">` as an error in any `.astro`/`.html`/`.tsx`/`.vue`/`.svelte` file, and `vitops lint --fix` removes the `centered` token (other classes stay). Then wrap hand-written page content in `<div class="centered">`; the fix cannot do that for you, because it is a per-page decision. Content rendered through `<VitopsContent>` needs nothing.

  - `@getvitops/emdash`: `<VitopsContent>` wraps each run of plain blocks (before, between or after bands) in `<div class="centered rhythm">`. A split hero in such a run still goes edge to edge.
  - `@getvitops/create`: both templates' layouts render `<main id="main">`; their pages put `centered` on the page content instead. Existing sites keep their layout until `vitops lint --fix` is run.
  - `@getvitops/core` (all formats): the `.centered > .section { grid-column: fullbleed }` rule added in alpha.10 is removed. It only compensated for a `.centered` `<main>`, which is now the thing `vitops lint --fix` removes. A layout that still has `<main class="centered">` holds its sections to the reading width again until migrated.
  - `@getvitops/skills`: `emdash-building-pages` explains the rule.

## 0.1.0-alpha.4

### Minor Changes

- c66ac13: **Downstream agents can report toolchain issues, and a bot triages them.**

  - **`@getvitops/cli`: new `vitops report`** drafts an issue against the toolchain's public tracker. It adds the installed `@getvitops/*` versions and detected platform, redacts the site config's organization name, domains, environment URLs and contact details plus generic secrets (tokens, emails, home paths, IPs), and prints the draft, what it redacted and a prefilled new-issue URL. It files nothing by default; `--submit` files it after a TTY confirmation (`--yes` skips that and is for an agent whose user has approved the draft), and `--search` lists possible duplicates first. Needs `gh` only for `--search` and `--submit`.
  - **`@getvitops/skills`: new `vitops-report-issue` skill** says when to report, when not to, and the draft → show the person → file-on-yes sequence. Existing sites: `vp install` links it; nothing to change.

  No consumer-facing change in the other packages of the fixed group. Repo-side (not shipped): issue forms under `.github/ISSUE_TEMPLATE/` and a read-only triage workflow, `.github/workflows/issue-triage.yml`.

### Patch Changes

- fcbef9e: **`vitops({ analytics })` and the consent categories now default from the site config, so they are no longer copied by hand.**

  - **`analytics`:** the providers in `site.analytics` (`googleAnalyticsId`, `clarityId`, `plausibleDomain`, `matomo`) are the tags `<Analytics />` loads. The cookie notice already disclosed providers from that block; the tag now comes from the same place, so the two cannot drift. The option still adds a provider, overrides one, or sets `strategy`, and wins per provider; a provider given only in the option still warns that the notice will not disclose it. `googleTagManagerId` has no `<Analytics />` provider and is unchanged.
  - **`consent`:** an object option used to replace `site.legal.cookieConsent.categories` outright, so `consent: { policyUrl }` silently dropped the categories the notice named and the banner fell back to a default that always offers `preferences` (vitops-website's config carries a paragraph warning about exactly this). The option's `categories`, when given, still wins; anything else in the object now leaves the config's list in place.

  **Behaviour change:** a site whose `site.analytics` names a provider but whose `vitops()` call omitted `analytics` now loads that tag (before, the notice named a provider nothing loaded). A cookie-setting provider with the consent gate off warns, as before. To keep a provider out of the page, remove it from `site.analytics`. **Migration:** a site that copied the provider out of its config (`analytics: { clarity: config.site.analytics.clarityId }`) can delete the option; one that passed `consent: { categories }` only to dodge the replacement can drop it. Other fixed-group packages: no consumer-facing change.

- 29f5aca: **New: `<ContactForm />`**, a contact / enquiry form for a page written in code. `<ContactForm />` renders name, email, phone and message; `fields={[{ label, type, required, name, options }]}` replaces them. It is a real `<form method="post">` that works with no JavaScript and posts to `createConversionRoute()` (`/api/track`), with the honeypot the route recognises, the `_next` return path, both result notices (revealed by the URL fragment after a no-JS submit) and `<wc-turnstile>` when `site.security.turnstile.siteKey` is set (`turnstileSiteKey` overrides it, `null` turns it off). A slot takes a heading and intro.

  Use it instead of a hand-written form. The route reserves four names, and a form that trips one fails silently: an input named `phone` is dropped (it is the `tel:` click payload), so the number never reaches the notification or CRM; a filled `website` / `honeypot` / `_honeypot` makes the route answer success and deliver nothing. `<ContactForm />` submits a phone as `tel` and keeps every field clear of the reserved names. It is also what the `vitops_form` block renders, so a form in code and one in the CMS cannot differ.

  **Migration:** none required. A site with its own `api/contact.ts` and `<form>` (jblsigns, vitops-website) can replace both with `<ContactForm />` and `createConversionRoute()`; the `emdash-contact-form` skill and the `forms` entry of the components reference say how. Affects the Astro component and the generated components reference; no CSS changes in any format. Other fixed-group packages: no consumer-facing change.

- 283cab8: `emdash-building-pages` now says how to choose a section's width and layout: `measure` and `stack` suit running text and are the defaults, and a top-level section of a marketing page often reads better wider or with a layout such as `split` or `center`, so consider that first.

## 0.1.0-alpha.3

### Minor Changes

- 8b823d5: Added `vitops-compliance` (intake and routing), `vitops-accessibility` (everyday practice plus AODA, federal, Quebec, other-province and EU topic files) and `vitops-privacy` (CASL, PIPEDA, Quebec Law 25, other provinces, GDPR). Law topic files carry `verified:` and `sources:` frontmatter and the skills tell an agent to re-check the primary source before relying on a legal fact (always when over 180 days old). They inform and never enforce: a lower target a client accepts is recorded in `site.accessibility`.

### Patch Changes

- b0bf72e: `vitops-accessibility` and `vitops-compliance` guidance only; no generator or CSS change. Adds how AODA counts employees (contract workers count, independent contractors do not), what 20 and 50 Ontario employees each trigger (compliance report every three years, with the current deadline of 2026-12-31; WCAG 2.0 AA for public websites at 50), and a high-contrast section (`prefers-contrast`, `forced-colors`, the G174 toggle). WCAG 2 AA ratios are stated as the standard, with APCA described as no longer on the W3C standards track. The skills say plainly that the generator still checks APCA and has no `prefers-contrast` layer or contrast toggle yet.
- 19f9a53: **Added a generated accessibility statement, the fourth legal document.** `vitops legal --doc accessibility` (and `generateLegal`, `dist/legal/accessibility-statement.html`, `[vitops_legal doc="accessibility"]`) renders it from `site.legal.accessibilityStatement` plus `site.accessibility` (standard, level, `contrastToggle`). It replaces filling in the agency's AODA template by hand.

  - **It asserts only what the config declares.** No conformance sentence without `conformance` **and** `testedOn`; `conformance: "full"` cannot sit beside `limitations` (a `validateConfig` error); AODA wording needs `law: "aoda"`; the "tested with" lists appear only when `testedWith` is set (otherwise the text says what the site is built for, never what was tested); `site.accessibility.acceptedRisk` is internal and is never printed. Statute thresholds are not encoded: the headcount tiers are the facts `mandatory`, `policies` and `policiesOnRequest`, mapped in the new `accessibility-statement.md` skill topic.
  - **Fields:** `enabled`, `url`, `lastUpdated`, `law`, `mandatory`, `conformance`, `testedOn`, `testing`, `auditor`, `limitations`, `testedWith`, `formats`, `supports`, `inPerson`, `responseDays`, `contact` (an `organization.locations` key or an inline contact, falling back to the organization), `feedbackUrl`, `feedbackOwner`, `policies`, `policiesOnRequest`, `reviewCadence`. `validateConfig` also requires a reachable contact, rejects a generic policy title ("click here"), and requires `level` of at least AA when `mandatory`; `vitops legal` warns when email is the only contact channel.
  - **Written to the WCAG 2.1 Level AAA content criteria** (plain language at grade 9 or below, abbreviations and unusual words explained where first used, link text that names its destination, one `h1` and ordered `h2` sections, no tables). `accessibility-statement.content.test.ts` enforces that over every combination of optional sections, and a new `accessibility-statement` e2e project renders it through the docs site's CSS and runs axe including the AAA tag in the high-contrast appearance, plus line length, line height, 200% text, reflow and target size. Paint and layout are the site's: the skill lists what the page must do (footer link, `<ContrastToggle />`, `lang`, a 44px target for a stand-alone link).
  - **The legal markdown subset gained `[text](url)` links**, made safe at the output (`safeHref`; Portable Text gets a link annotation). Images and tables are still rejected.

  **Migration:** none for existing sites. `TEMPLATES[jurisdiction]` gains an `accessibility` entry and `LegalDoc`/`DOC_ORDER`/`DOC_SLUGS` gain `accessibility`, so code that exhaustively handles `LegalDoc` needs the new member. English only: French for all four documents is a TODO (`TODO.md`, with the Paraglide assessment), so a `qc` site gets an English statement until then.

  Affects all formats equally (no CSS or token change). No consumer-facing change in `@getvitops/config`, `@getvitops/core`, `@getvitops/utils`, `@getvitops/vite` or `@getvitops/astro`.

- 6763587: **EmDash environments: promotion rehearses on a throwaway copy of production, and syncing prod into dev no longer wipes dev.** Dev is a long-lived staging site (collections and fields are developed there, and content is edited there), but the old `refresh-dev` dropped every table in it, weekly if scheduled, and a promote and a staging session could overwrite each other. Three databases now have one job each: prod (content truth), dev (staging, never wiped blind) and `<db>-rehearse-<run id>` (a copy of prod, one promote run).

  ### Added
  - **`vitops emdash db copy|snapshot|guard-dev|mark-synced|rehearsal|rewrite-config`** (`@getvitops/cli`, over `@getvitops/utils/hosting`). The copy is a four-file dump, so it works on a database with a search index (the old `wrangler d1 export` failed on any FTS5 table), and it stops before the first write if D1 would reject a statement as too big. A target must be named `*-dev` or `*-rehearse-<digits>` and may never be production's id.
  - **`vitops emdash schema diff|apply|export`** (`@getvitops/utils/emdash-schema`). Replays one instance's collections and fields onto another over the REST API with the full field definition (options, validation, widget), additions only. A field defined differently, a target-only item and a block type are reported, never changed. `diff --check` exits 1 on drift. Tokens: `EMDASH_TOKEN_FROM`, `EMDASH_TOKEN_TO`, `EMDASH_TOKEN`.
  - **`site-sync-dev.yml`** (reusable): refuses when dev content changed since the last sync (`force` discards it; the first run needs it), snapshots dev to an artifact, captures dev's schema, resets dev from prod, redeploys so core migrations run, replays dev's schema, and stamps a sync marker. `mode: report` only reports drift.
  - **`site-promote.yml` `rehearse: true`**: builds dev's code, copies prod into a throwaway database, runs `emdash migrate` against it, puts a dev-vs-prod schema diff in the PR body, and deletes the database. It never touches the dev site.
  - **`site-deploy-emdash.yml` `schema-from-url` / `schema-to-url`** (production only, off by default): applies the additive schema diff after the migrations and before the deploy, behind the `production` approval.

  ### Breaking
  - **`@getvitops/create`: the emdash template's `refresh-dev.yml` and `scripts/refresh-dev.mjs` are replaced by `sync-dev.yml`.** The weekly run now only _reports_ drift and never resets dev. `promote.yml` rehearses by default (`rehearse` input, opt out per run). Existing sites keep their own workflow files. Migration: bump `@getvitops/cli` first (the workflows call `vitops emdash db|schema`), copy `sync-dev.yml` and `promote.yml` from the template, delete `refresh-dev.yml` and `scripts/refresh-dev.mjs`, and add the repo secrets `EMDASH_TOKEN_DEV` and `EMDASH_TOKEN_PROD` (admin → Settings → API Tokens) and the dev and production URLs in those two files. Without the tokens a sync resets dev without replaying its schema (`skip-schema: true` says so) and promote shows no schema diff.
  - **`site-refresh-dev.yml` is now a deprecated alias** for the guarded sync (`skip-schema: true`). Its first run refuses until `force: true`, because a dev site with no sync marker can't be told from work in progress.

  Not built: deploying a Worker Preview during rehearsal and replaying the schema there (it needs per-site preview infrastructure the templates don't carry), replaying block types, and a content merge. Untested here: the GitHub Actions workflows themselves (no `actionlint` or runner available; YAML parses and the planners, executors and template wiring are unit-tested), and `emdash migrate --status` output parsing for the fingerprint. Verify with the checklist in AGENTS.md's CI/CD section before moving the `v1` tag.

  Formats: no CSS changed, so none are affected. `@getvitops/core`, `generator`, `vite`, `astro`, `config` and `skills` — no consumer-facing change in these packages.

- e12086a: **Added a high-contrast layer and a toggle for it.** WCAG 2 AA is the floor; this is the route above it, and the G174 route for a brand palette that cannot reach it.

  - **A third appearance axis (css and tailwind formats; Bricks supplies its own colour tokens, so there is nothing to re-point there).** `generate()` now emits a layer that answers `@media (prefers-contrast: more)`, `:root[data-contrast="more"]` and the `.contrast-toggle` checkbox. It is not a `themes` entry: like dark mode it re-points the role tokens, so it composes with light, dark and the OS-preference block. Text walks to 7:1, borders collapse onto the icon token, solids walk until `text-on-<role>` clears 7:1, and `--surface-glass` becomes opaque. `data-contrast="standard"` opts a visitor out of the media query. The layer itself must clear the baseline bars (4.5:1 text, 3:1 non-text) or `generate` fails; missing 7:1 only warns.
  - **`site.accessibility.contrastToggle: true`** declares that the site ships the toggle. A baseline contrast miss then **warns instead of failing**, but only for a role whose high-contrast layer conforms. Default `false`.
  - **`<ContrastToggle />`** (`@getvitops/astro/components/ContrastToggle.astro`) emits `<wc-contrast-toggle>` around a plain `<label class="contrast-toggle"><input type="checkbox">`. The checkbox works with no JavaScript; the element adds starting checked under `prefers-contrast: more` and remembering the choice behind the `preferences` consent category. `core/css/global.css` also gives the layer a 3px outline and drops `backdrop-filter`.
  - **`<Head contrast />`** restores a remembered choice before first paint. Opt-in, and a separate inline script from the colour-scheme one on purpose: changing that script would change its hash and break the dark-mode bootstrap on every site that pins it in a CSP. A site with a hash-pinned policy adds `inline: { contrast: true }` to `contentSecurityPolicy()`.

  - **`vitops audit` runs a second axe pass when `contrastToggle` is set** (`@getvitops/utils/audit`, the CLI): with `data-contrast="more"` on `<html>`. A contrast violation that clears is reported as "conforming only with the high-contrast layer on" and does not fail the page; a page with **no `.contrast-toggle`** fails (`toggle-missing`), and a contrast violation that survives the layer fails, because the layer is then not a conforming alternative.
  - **Two pattern fixes the audit found.** `code` filled itself with a _border_ token (`border-neutral`), which the high-contrast layer turned dark under dark text (2.07:1); it now uses `bg-neutral-x-muted` (a slightly lighter chip in every format). `.comment__date` faded its text with `opacity: 0.7` (3.9:1); it now uses `text-neutral-muted`. **All formats.**
  - **Forced-colors sweep.** Floating surfaces (`dialog.dialog`, `.drawer`, `.tooltip`, `.notification`, `.consent`, `.combobox__listbox`, any open `[popover]`) get a 1px system-colour `outline` under `forced-colors: active`, so one that rests on a `box-shadow` (a consumer's `b: none`, or a bare popover) no longer vanishes. The `.switch` track and thumb get system colours, since the muted track and white thumb flattened to the same canvas and the thumb's shadow was dropped. **All formats.**

  Pattern CSS (`contrast-toggle.css`) reaches **all formats**; the token layer it switches reaches **css and tailwind only**, so the toggle is inert under `bricks`.

  No consumer-facing change in `@getvitops/vite`.

- 2cee5c3: **Agents in scaffolded sites now run playwright-cli as `vp exec playwright cli <cmd>`.** The upstream playwright-cli skill writes `playwright-cli <cmd>` (a global binary that is not installed) and the `see-the-page` skill said `pnpm exec`, which the scaffold's own AGENTS.md bans, so agents concluded Playwright was missing and reached for `vp dlx`, which fetches a second unpinned Playwright. `see-the-page` now states the invocation explicitly, and gains a "Comparing against a mockup" section: mockups are built without the toolkit, so compare them with matched screenshots rather than snapshots (snapshot stays for text parity and for pages of the same site).

  Existing sites: in `.claude/settings.json`, replace the `Bash(pnpm exec playwright cli:*)` and `Bash(npx --no-install playwright cli:*)` allow entries with `Bash(vp exec playwright cli:*)`.

- 94752ba: Fix `vitops-compliance`'s frontmatter: an unquoted `: ` in its description was invalid YAML, so `skills experimental_sync` skipped the skill with only a warning. Not CSS; no format affected.
- 1f1a3dd: **The generator's contrast contract is now the WCAG 2 contrast ratio and nothing else. APCA is removed.** APCA is perceptually better but is no longer on the W3C standards track, so no law (AODA is WCAG 2.0 AA) or conformance claim is tested with it. Two things were wrong with the old arrangement: a palette could pass APCA and miss 4.5:1, and the ratio only failed the build when `site.accessibility.level` was `AA` or `AAA`.

  **Breaking:**

  - **Bars.** Text, including `text-<role>-muted` on every plane of its role, must reach **4.5:1**; icons and a surface role's `border-<role>-bold` **3:1**; `text-on-<role>` **4.5:1** on its solid. There is no separate "secondary text" tier any more.
  - **Unset is AA.** A site with no `site.accessibility` (or no `level`) now **fails the build** on a ratio miss. Only an explicit `level: 'A'` or `'none'` downgrades it to a warning. **Migration:** fix the palette, or set `level` and record why in `acceptedRisk`.
  - **`colors.roles.<role>.acknowledgeContrast` is now in ratio points, not Lc.** `1` used to mean one Lc point; it now means 1.0 of ratio (e.g. `0.1` excuses 4.4:1 against 4.5:1). `vitops lint --fix` cannot convert it, because the two scales have no fixed mapping: re-measure the pairing and set a new value.
  - **`contrastLc()` is removed from `@getvitops/utils/color`.** Use `contrastRatio()`. `pickOn()` now picks the near-white or near-black with the higher ratio, so a mid-tone solid can choose a different `text-on-<role>` than before.
  - **Token changes that follow from the ratio.** Surface roles' light `text-muted` moved from step 700 to 800 (it sat at about 4.4:1 on the `bg-x-muted` well in some hues). The starter config from `defaultConfig()`/`vitops init` sets `solid: 700` on `info` and `danger` (their step 600 was 4.35:1 and 4.40:1 under white text), and this repo's example `neutral` role does the same. A config that pins a role's solid at a step under 4.5:1 will now fail `generate`.
  - `validateColorContract()` (the EmDash editor's save gate) now honours each role's `solid` option and judges the same ratio contract as a build.

  **Affects all formats** (css, bricks, tailwind): the step changes alter emitted token values; the layers and class vocabulary are unchanged.

  No consumer-facing change in `@getvitops/cli`, `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`. `@getvitops/config` only updates the `site.accessibility.level` description. `@getvitops/skills` updates `vitops-accessibility` to describe the new behaviour.

## 0.1.0-alpha.2

### Minor Changes

- 6b5ea17: **Leaner scaffolded `AGENTS.md`, and skills named by scope.** The EmDash template's `AGENTS.md` went from 212 to about 70 lines and the static one from 141 to about 50: only always-true rules stay (source of truth, generated CSS, branches, `vp`/`vpr`, where to look), and task-specific guidance moved into skills loaded when the task matches.

  - **Breaking, `@getvitops/skills`: skills are renamed by scope.** `custom-blocks` → `emdash-custom-blocks`, `content-and-deploys` → `emdash-content-and-deploys`, `contact-form` → `emdash-contact-form`, `csp` → `vitops-csp`, `see-the-page` → `vitops-see-the-page`, `ads` → `vitops-ads`. `emdash-*` skills only apply to an EmDash site; `vitops-*` apply anywhere, and both prefixes are reserved for toolkit skills. New: `emdash-building-pages` (blocks, nesting, page opener, widget areas, escape hatches, layout primitives, `site.chrome`) and `vitops-consent` (split out of `vitops-design-system`, whose description and body now cover styling and tokens only). Existing sites: run `vp install` so `skills experimental_sync` relinks, and replace the per-skill `.agents/skills/<name>` / `.claude/skills/<name>` lines in `.gitignore` with `.agents/skills/vitops-*`, `.agents/skills/emdash-*` and the same two under `.claude/skills/`. A site's own skill must not use those prefixes.
  - **`vitops agents sync`:** the block lists only skills that apply (a project without `emdash` in its dependencies gets no `emdash-*` ones, and they are not linked), summaries are cut at a clause rather than with an ellipsis, the pointer says `vp exec vitops docs`, and the version stamp is gone so the file no longer changes on every CLI bump.
  - **`@getvitops/create`:** both templates ship the trimmed `AGENTS.md`; the project-naming steps moved into the `setup` skill and EmDash 1.x behaviours, legal-page replacement and the audit prerequisites into `emdash-content-and-deploys`. Existing sites: nothing to change beyond the skill rename; delete the sections you no longer need.

- bb61a35: **Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

  - **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
  - **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
  - The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
  - `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
  - `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
  - `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

  `@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.

- 7069f93: **Agents now look at rendered pages with `playwright-cli`.** Both templates add `playwright` as a devDependency, run `playwright cli install --skills` from `prepare` (writing the upstream command reference to `.claude/skills/playwright-cli/`), ship `.playwright/cli.config.json`, allow `pnpm exec playwright cli`, and deny `mcp__claude-in-chrome__*` and `mcp__playwright__*` in `.claude/settings.json`. `@getvitops/skills` adds a short `see-the-page` skill (serve first, snapshot before screenshot, dark mode, mobile, no-JS) that defers to the upstream one. Existing sites: add `playwright` as a devDependency, extend `prepare`, and copy the settings. `vitops audit` now needs only `@axe-core/playwright lighthouse` added.

## 0.1.0-alpha.1

### Patch Changes

- 322dd6a: Tooling fixes from the vitops.ca build (findings 14, 23, 24, 25).

  - **`vitops emdash form-template --from <seed.json | export.json> [--name contact] [--site site.json] [--dry]`** copies a `vitops_form` block into `site.templates` with the renderer's own field resolver, so the generated privacy policy and `check-prerender` know what the form collects. A re-run is a no-op, and the result is validated before it is written.
  - `site.templates` form fields accept `checkboxes` (the block's spelling), and the template union now discriminates on `type`, so a bad entry is reported at its path instead of as a bare "Invalid input".
  - **`prepare-db` fails fast and says why.** It validates `site.json` before starting the dev server, writes the server's output to `.vitops/prepare-db.log`, stops waiting as soon as the log shows an error, and prints the log's tail on failure, instead of waiting out a five-minute timeout with nothing to read.
  - **`check-prerender`** skips the toolkit's own assets under `vitops/` (no more "0 h1" for the theme-editor page) and warns when the sitemap lists URLs the build produced no page for (a collection with no `urlPattern` is listed as `/<collection>/<slug>` while the site serves `/<slug>`).
  - The emdash template ignores the duplicate `pnpm-@getvitops+skills-*` links `skills experimental_sync` leaves beside each skill; the `content-and-deploys` skill explains the sitemap warning.

## 0.1.0-alpha.0

### Minor Changes

- 0a47856: New package `@getvitops/skills`: agent skills for sites built with the toolchain (`custom-blocks`, `content-and-deploys`, `contact-form`, `csp`). The emdash template depends on it and runs `skills experimental_sync` on `prepare`, which links them into `.agents/skills/` and `.claude/skills/`, so they update with `vp update` instead of being copied at scaffold time. Existing sites: `vp add @getvitops/skills && vp add -D skills`, set `prepare` to `vp config && skills experimental_sync -y -a claude-code --no-frozen-lockfile`, gitignore the four linked names, and delete the site's own copies of those four skills (the sync never replaces a directory it did not create).

  The emdash template's `AGENTS.md` is shortened to the always-relevant rules. Deploy and content mechanics (where each kind of data is the truth, prerendering, publish-triggered rebuilds, refreshing dev), the contact form, and the CSP move into those skills. Corrects the nesting guidance: a block type with a `portableText` field (such as `vitops_section`) holds other blocks, while `vitops_*` Portable Text blocks do not. Adds guidance for agents to record reusable toolkit gaps in `UPSTREAM.md`. The generated stylesheet is no longer described as always `tailwind.css`.
