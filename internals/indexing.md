# Search-engine indexing

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`vitops search notify` (`packages/cli` → `@getvitops/utils/indexing`) replaces the manual "open
Search Console and resubmit" step at the end of a deploy. It reads a **`Config`**'s
`site.seo.indexing` block. (It was the top-level `vitops indexing`, renamed with no alias — the
`search` command groups it with `search setup`, the onboarding command below.)

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

Six things are load-bearing:

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

  **On an EmDash site `gitLastmod()` is not the lever, and the answer is two sitemaps.** EmDash
  serves `/sitemap.xml` (an index of `/sitemap-<collection>.xml`) from its database and dates every
  entry from the row's `updated_at`, so CMS content needs nothing from us. It has **no extension
  point** for anything else — no option for extra URLs, no merge with `@astrojs/sitemap` — so
  plain `src/pages/*.astro` routes are simply absent, and the only documented escape (a user
  `src/pages/sitemap.xml.ts`) _replaces the whole index_, discarding its dates and paging. Never
  override it. `vitops({ sitemap })` therefore does something different when `emdash()` is
  registered: a build writes `public/pages-sitemap.xml` for exactly the `src/pages` routes
  (`packages/astro/src/pages-sitemap.ts`), dated by `gitLastmod()`, and **writes nothing when there
  are none** — an empty second sitemap in Search Console is noise, so a CMS-only site (and a fresh
  scaffold, whose `sitemap: { exclude: ['/'] }` drops the `index.astro` that only renders the
  `home` entry) has no pages sitemap. Three rules: the name must not match `sitemap-*.xml`
  (EmDash's route claims it, and a file there silently loses to the CMS's document); only a file
  carrying the marker comment is ever replaced or removed, so a hand-written one is left alone;
  and the git history must be full (`fetch-depth: 0`), or every date is missing. `search notify`
  **discovers** rather than lists when `sitemapUrl` is unset — `sitemap-index.xml` (Astro),
  `sitemap.xml` (EmDash), `pages-sitemap.xml` — and uses whichever exist with at least one
  `<url>`; an explicit `sitemapUrl` (a string or a list) turns discovery off. It prints each
  sitemap it will submit with a reason (the pages one reads "required for non-EmDash content"), so
  a second sitemap in Search Console is never a surprise, and names up to three undated URLs.

- **The `noindex` gate reads the environment, so the URLs must too.** `plan()` refuses the whole
  run when the resolved environment's `robots` contains `noindex` — submitting a staging host to
  IndexNow publishes it to several engines and invites them to crawl it, which a later directive
  does not undo. This is why `toIndexingConfig` derives the origin from `site.environments[env].url`
  **before** `domains.canonical`: the canonical is the _production_ origin, so deriving from it
  while notifying staging would submit production URLs that the gate — reading the environment —
  would not catch.
- **The same fact drives `robots.txt`, not just the notify gate.** `vitops robots`
  (`packages/generator/src/robots.ts`) reads the identical directive — the resolved environment's
  `robots`, falling back to `site.seo.robots` — and disallows every user agent when it contains
  `noindex`, exactly `plan()`'s own check. Before this existed, a staging environment got a
  `<meta name="robots">` tag and a blocked `search notify` run, but a crawler reading
  `/robots.txt` directly saw nothing and was free to index it anyway — the gate caught the one
  channel it could see and missed the one crawlers actually ask for first. An allowed environment
  gets a `Sitemap:` line at the same URL `search notify` would submit (`resolveSitemapUrl`,
  reused from `@getvitops/utils/indexing` rather than re-derived); a blocked one gets none, since
  publishing a sitemap for a site asking not to be indexed hands a crawler every URL it is then
  blocked from — the more damaging way to get this wrong. The Astro integration writes
  `public/robots.txt` the first time one doesn't exist, but never overwrites a file already
  there — unlike the IndexNow key file it sits beside in the same hook: today's `RobotsSchema` is
  one directive string, with no way to express `Disallow: /admin`-style path rules, so a
  hand-authored file may already carry more than the config can, and clobbering it every build
  would be the destructive-by-default failure this toolchain otherwise avoids (see onboarding's
  "never removes a record"). `vitops robots` covers every other stack, the same anchoring `legal`
  uses.
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
should not grow one. **There is one token exchange, `google/token.ts`, and two grants** — same
endpoint, same response, same error rule, so only the form body ever differed. It is minted with
~30 lines of `node:crypto`; **do not add `googleapis`**, an enormous dependency for a handful of
endpoints in a CLI that installs into every consumer project.

The two grants are not accidental duplication — they track _where each command runs_:

- **service account** (RS256 JWT bearer), from `VITOPS_GSC_SERVICE_ACCOUNT` (inline JSON) or
  `GOOGLE_APPLICATION_CREDENTIALS` (a path). It never expires, which is what `search notify`
  needs — it fires on every deploy, in CI.
- **user OAuth** (refresh-token grant), from `VITOPS_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` /
  `_REFRESH_TOKEN`. `search setup` requires it, because verifying a site makes the caller an
  **owner** of the property and that should be a person, not a project robot. A refresh token
  can be revoked, and for an OAuth client still in _Testing_ publishing status Google expires it
  after 7 days — fine for a one-time human setup, bad for a deploy step.

**`search notify` accepts either**, preferring the service account when both are set. Search
Console does not care which, and a consumer who ran `search setup` already holds a Google
credential — making them provision a second, unrelated one for the other half of the same command
bought nothing. `search setup` is the only thing that genuinely requires a specific grant.

`IndexingConfig` is the inferred type of `@getvitops/config`'s `IndexingSchema`, so the type the
executor accepts and the document `validateConfig` accepts cannot drift. `site.seo` is the single source
of site-level SEO defaults (ADR-0002): `SeoSchema` lives in `@getvitops/config`, and `@getvitops/astro`'s
`resolveSeoDefaults()` resolves it (with `organization.name` as the site name) into the `GetvitopsSeoOptions`
shape `<Seo />` reads; `vitops({ seo })` is only an override merged over that. `seo-defaults.test.ts` fails
when a `site.seo` field is added and not read, which is how four fields once sat in the schema doing nothing.
