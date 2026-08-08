---
name: vitops-design-system
description: >-
  Work with this project's Vitops design system and site toolchain. Use when
  styling or authoring pages or components (choosing utility/pattern classes,
  colours, spacing, typography), when editing design-system.json (tokens,
  palette, patterns, scales, animations), when generating output (vitops
  generate --format tailwind|css|bricks), when asking what the design system
  provides on a given platform (Tailwind vs Bricks vs standalone CSS), and when
  touching the site subsystems it generates or gates: the cookie-consent banner
  and gating third-party tags, ad-click attribution and conversion
  notifications, the generated privacy policy / terms / cookie notice, and
  Google Search Console onboarding or post-deploy indexing.
---

# Vitops design system

This project is styled with the Vitops design system (`@getvitops/*`): a variable-driven
CSS framework generated from `design-system.json` (the single source of truth — semantic
colour roles, fluid type/space scales, component patterns, animation effects).

**Core rule:** prefer the framework's utility + component classes over hand-written CSS or
ad-hoc values — they encode the tokens, respond to dark mode, and update with the system.

## Layout foundations — apply these before fetching anything

Six classes carry the structure of nearly every page. They are stated here rather than
left to `vitops docs classes` because the failure mode is not disagreement, it is **not
knowing there was a decision to make** — writing a container by hand looks like ordinary
CSS competence, so nothing prompts you to go look. Every row below has been found in real
downstream sites.

| About to write…                                         | Write this instead                              |
| ------------------------------------------------------- | ----------------------------------------------- |
| a `wrap` / `wrapper` / `container` / `inner` class      | **`centered`** — never invent a container class |
| `max-width` + `margin-inline: auto`                     | **`centered`**                                  |
| `padding-block` on a section to separate it             | **`region`**                                    |
| margins between headings, paragraphs, lists             | **`rhythm`** on the container                   |
| `display: grid` + `grid-template-columns: repeat(n, …)` | **`subgrid`**                                   |
| `repeat(auto-fit, minmax(…))`                           | **`grid-auto`** (or `subgrid`, below)           |
| `display: flex` + `gap` for a row of buttons/badges     | **`cluster`**                                   |

**`centered` is not a max-width box, which is why hand-rolling it never quite works.** It is
a grid of _named tracks_, so a child widens itself (`breakout`, `spotlight`, `fullbleed`)
without the parent knowing. A bespoke `.wrap` renders identically until the first full-bleed
image, and then the only way out is more hand-written CSS. There is no case where inventing a
container class is correct.

**More than one card means `subgrid`.** This is the most under-used class in the framework,
and the reason it gets skipped is that a plain `grid` _looks_ right — it aligns the outer
boxes. It cannot align the tranches **inside** them, so across three cards the headings sit
at three heights, the bodies start at three points, and the CTAs float wherever the copy
ended. `subgrid` re-declares the parent's row tracks on each item so head / body / footer
share row lines regardless of content length. Write
`<ul class="subgrid subgrid-cols-3" role="list">` with `<li class="card subgrid-card">` items —
a set of cards is a list — and set `--subgrid-row-span` (or `subgrid-rows-<n>`) to the number of
row bands each card holds. In Astro use `<Subgrid />`, which renders the slot verbatim: **author
the `<li>` items yourself.**

**`role="list"` is not optional on a hand-written one.** `subgrid` is markerless on `ul`/`ol`,
and Safari + VoiceOver stop announcing a marker-less `<ul>` as a list — so the marker reset
silently costs the semantics the `<ul>` was chosen for. `<Subgrid />` adds it for you.

**When the whole card is a link, the card is still the grid item** — and there are two ways to
do it, both keeping the accessible name on real text rather than on a whole card of it:

| Want                                 | Use                                        |
| ------------------------------------ | ------------------------------------------ |
| no JS at all                         | `stretched-link` — **text not selectable** |
| selectable text and a clickable card | `<Cards>` / `<wc-cards>` — needs JS        |

- `stretched-link` goes on a link **inside** the card (usually the heading); its `::after`
  covers it. `subgrid-card` already carries the required `position: relative`; on a bare `card`
  add `relative`. Anything else interactive in the card needs **`raised`** — `relative` alone
  does not work, because a positioned element at `z-index: auto` cannot rise above an explicit
  one. The cost is inherent to the technique: the overlay takes the pointer-drag, so the card's
  text can no longer be selected.
- `<Cards>` wraps the list in `<wc-cards>`, which adds no overlay and instead distinguishes a
  click from the end of a drag. Text stays selectable; with no JS the card's own link still
  works, and the pointer cursor appears only once the element upgrades. It emits its own
  `<wc-cards>` — do not add your own wrapper.
- **Never layer the two.** The overlay wins, so you lose selection _and_ the JS never runs.
  `vitops lint` reports the combination.

`<li><a class="card">` is the wrong shape and **it renders fine**, which is why it keeps being
written: the `<li>` is the grid item, so the anchor is an ordinary block inside it and the
tranches within the anchor never reach the parent's shared row lines — the alignment is
silently absent, and the anchor does not fill the cell either. Putting the anchor in the
grid's place (`<ul><a></ul>`) is invalid HTML. `vitops lint` reports this shape.

The one honest alternative is **`grid-auto`** — an auto-fit track (`--grid-min`, `--grid-gap`)
for items with **no internal tranches to align**: a gallery, a logo wall, a row of icons. Never
hand-write `repeat(auto-fit, minmax(…))`; that is `grid-auto`. The moment an item has an
eyebrow and a heading and a footer, `subgrid` is the one that lines them up.

**`vitops lint` reports all six of these**, in CSS, in `<style>` blocks and in markup — a
hand-rolled container, a repeated-item grid, and a loop that renders cards outside a
`subgrid`. They report as `suggestion`, so they do not fail the build unless `--strict`.
Run it before considering a page done; if it names one of these, the fix is the class, not a
justification for the CSS.

## Getting the current reference docs

Run **`vitops docs <topic>`** — it prints the reference as markdown to stdout, generated
live from this project's `design-system.json` and the installed package version, so it is
never stale and always names the project's actual tokens. (If `vitops` isn't on PATH, use
`pnpm exec vitops docs <topic>` or `npx vitops docs <topic>`.)

| Run                      | When you need                                                          |
| ------------------------ | ---------------------------------------------------------------------- |
| `vitops docs classes`    | which class to apply — the full class vocabulary as naming rules       |
| `vitops docs authoring`  | what a `design-system.json` field means / what's valid                 |
| `vitops docs config`     | the three-section config: `designSystem` / `organization` / `site`     |
| `vitops docs formats`    | tailwind vs css vs bricks output — incl. which utilities Tailwind owns |
| `vitops docs color`      | how the colour system works (seeded OKLCH scales, roles, dark mode)    |
| `vitops docs scales`     | how the fluid type/space scales work                                   |
| `vitops docs patterns`   | how pattern CSS is assembled (token cascade, override hooks, states)   |
| `vitops docs components` | which tier provides a pattern (classes / `wc-*` / Astro / Bricks)      |
| `vitops docs icons`      | semantic icon names across sets, bundle derivation, sprite delivery    |
| `vitops docs consent`    | the consent gate — gating a tag, demand-driven prompting, the API      |
| `vitops docs tracking`   | ad-click attribution, the `_ac` cookie, conversion notifications       |
| `vitops docs search`     | what search engines accept, Search Console onboarding + notification   |
| `vitops docs legal`      | how the policy / terms / cookie notice derive from config facts        |
| `vitops docs elements`   | the custom Bricks Builder elements and their controls                  |

`vitops docs` (no topic) lists the topics; `vitops docs --all` prints everything.

## Other commands

- `vitops generate --format <tailwind|css|bricks>` — generate the platform output.
- `vitops generate --format design --out .` — write `DESIGN.md`, the agent-facing brief
  (google-labs-code/design.md format: YAML token front matter + prose rationale). It
  emits no CSS, so it composes: `--format css,design`. The live reference above is
  richer; DESIGN.md is for handing the identity to a tool that doesn't have this skill.
- `vitops init` / `vitops validate` — scaffold / check a config. `validate` routes on the
  file's shape, so it checks a site config as a site config. It also resolves every
  `var(--…)` the config authors against the tokens it emits, so a reference to a token
  that does not exist is a build failure rather than a declaration that silently does
  nothing.
- `vitops lint [--src <dir>] [--fix]` — **run this after a major bump.** It finds
  framework classes and design-system tokens in your source that resolve to nothing, and
  it is the migration tool for anything the changelog says was renamed. `--fix` rewrites
  pre-1.0 colour-grammar token references in one pass (several of those renames rotate, so
  applying them one at a time compounds them); everything else it reports needs a decision
  and is left alone.
- Every subcommand takes `-h` / `--help`.

**The config may be a `design-system.json` or the site config that embeds one.** Every
`--input` (and the Vite plugin / Astro integration equivalent) accepts either; a site
config holds the design system at `designSystem.themes.<name>`, selected with `--theme`.
If this project keeps its tokens inside a `company.json` / `site.json`, point `--input`
there — do not create a second file for the tooling's sake.

## Which tier provides a pattern

A pattern (tree, carousel, dialog, card, …) may be provided by up to **three tiers**, and they
**compose** rather than compete: (1) CSS framework classes, (2) a `<wc-*>` web component,
(3) a platform wrapper that generates the markup — an Astro component or a Bricks element.
**Run `vitops docs components`** for the full table — which tiers each pattern has, and the
exact call to write.

**Astro and Bricks are the same tier, not tiers 3 and 4.** Both are HTML generators built on
the classes and elements of tiers 1 and 2 — siblings chosen by which platform you are on. No
project uses both, and neither outranks the other.

Three things to know before you write markup:

- **Prefer the highest tier your stack has, and write only its call.** In Astro that is the
  Astro component; in Bricks the element; anywhere else the classes plus the `<wc-*>` tag if
  one exists. Hand-writing markup a component already emits is the common miss.
- **Do not compose two tiers yourself.** Where an Astro component wraps a web component it
  emits that tag _with the accessible fallback inside_, so `<wc-tree><Tree /></wc-tree>`
  nests two elements on one tree. The doc records which components wrap a tag.
- **A `<wc-*>` element enhances markup you supply; it never renders from empty.** The slotted
  HTML is the no-JS fallback and must be semantic and usable on its own. If you find yourself
  wanting a component that renders from nothing, that pattern is in the wrong tier.

## Astro rendering mode

Nothing vitops emits needs a server — the CSS, favicons and web-component bundles are
build-time artifacts, and the components progressively enhance markup that is already
complete in the HTML. So the default is static, and the rule differs by project kind:

- **A plain Astro site:** keep `output: 'static'` and add `export const prerender = false`
  only on the individual routes that genuinely need per-request work (a form `POST` handler,
  an auth-gated page, per-visitor content). Don't switch the whole site to `output: 'server'`
  for a couple of dynamic routes.
- **An EmDash site:** `output: 'server'` is required (the admin, media/API routes, preview
  and scheduled publishing all need a server), so prerendering is opt-in per route. Put
  `export const prerender = true` on every page that doesn't need per-request data, and give
  dynamic routes (`[slug].astro`, `[...slug].astro`) a `getStaticPaths()` that queries the
  collection at build time. A route with no `prerender` export is re-rendered on every
  request.

  A prerendered page reflects the database as of the last build, so publishing from the admin
  needs a redeploy to appear. Leave a route server-rendered only where that is unacceptable —
  the preview route, anything personalised, anything that must go live within seconds.

Note `@astrojs/sitemap` lists prerendered routes only, so an unmarked route on a server site
is also missing from the sitemap. (EmDash serves its own sitemap from the database.)

## Fonts: vitops names them, it does not load them

`design-system.json`'s `fonts` block holds **stacks only** — each entry emits a
`--font-<name>` token and nothing else: no `@font-face`, no preload, no metrics-matched
fallback. Loading is the host framework's job.

On Astro, load with the **Fonts API** and point the token at the family's `cssVariable`:

```js
// astro.config.mjs
fonts: [
  {
    provider: fontProviders.fontsource(),
    name: 'League Spartan',
    cssVariable: '--font-league-spartan',
    weights: ['100 900'],
    subsets: ['latin'],
  },
];
```

```jsonc
// design-system.json
"fonts": { "display": "var(--font-league-spartan), sans-serif" }
```

Installing `@fontsource*` and importing its CSS in a layout also renders, so it looks
correct — but it gives up subsetting control, preload, and the `size-adjust` /
`ascent-override` fallback metrics, which is a real CLS regression. Reach for it only
where no provider covers the family.

- `vitops legal` — render the site's privacy policy, terms of service and cookie notice
  from a **site config** (not a `design-system.json`). `--format md|html|portable-text`
  covers Astro content collections, WordPress/Bricks fragments and EmDash respectively;
  `--out <dir>` writes files, otherwise it prints to stdout.
  The documents are **derived from the config**: the analytics provider it names is the
  one whose ID is set, the personal information it lists is what the configured forms
  collect, the countries it names come from the providers in use. So the fix for a wrong
  policy is a corrected config, never hand-editing the output — the next build overwrites
  it. Declare processors the config cannot imply (payment, CRM, mail) under
  `legal.privacyPolicy.processors`. On each one, **where it stores data and whose law reaches
  it are separate facts**: `storage: [{ country, scope? }]` is residency, `operatorCountry` is
  the jurisdiction that can compel access, and `country` is shorthand for both — so a Canadian
  region run by a US company is `storage: [{ country: "Canada" }]` with
  `operatorCountry: "the United States"`, not one string. Combining `country` with either is
  rejected.
  Generated from config, not legal advice — always tell the user to have it reviewed
  before publishing.
- `vitops search notify` — tell search engines a deploy happened, from a **site config**'s
  `seo.indexing` block. Run `--dry` first: it prints the full plan and makes no requests.
  **Be accurate about what this does, because the obvious assumption is wrong.** Google
  has no API that requests indexing — the Search Console button is not exposed anywhere,
  URL Inspection is read-only, and the sitemap ping endpoint was removed in 2023. So:
  it resubmits the sitemap through the Search Console API, pings **IndexNow**
  (Bing, Yandex, Naver, Seznam, Yep — _not_ Google), and `--check` verifies afterwards
  whether Google actually indexed `seo.indexing.priorityUrls`, exiting non-zero if not.
  Never tell a user this makes Google re-index faster; it automates the sanctioned steps
  and makes the result visible.
  Two things decide whether it works at all: the sitemap needs real per-page `<lastmod>`
  (wire `gitLastmod()` from `@getvitops/astro` into the `sitemap` option — without it
  only added/removed pages are detectable, never an edit), and `.vitops/` must persist
  between runs or every run submits everything. Google's **Indexing API is deliberately
  not wired**: it is scoped to `JobPosting`/`BroadcastEvent`, and using it for ordinary
  pages violates its terms — don't suggest it as a workaround.
- `vitops search setup` — onboard the domains in a **site config**'s `site.searchConsole`
  block into Google Search Console as domain properties. For each domain it ensures the
  apex verification TXT in Cloudflare, verifies ownership (DNS_TXT, retried with backoff
  while DNS propagates — a still-unverified domain is reported PENDING, not failed), adds
  the `sc-domain:` property, and adds any `delegatedOwners` to the web resource. Idempotent:
  a re-run of an onboarded domain is a no-op, and `--check` reports drift without mutating.
  DNS is only ever created, never edited or deleted. Credentials come from the environment
  (`CLOUDFLARE_API_TOKEN`, and `VITOPS_GOOGLE_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN`),
  never the config. Granting a Google Group **Full-User** access has no API — it is surfaced
  as a reminder, not automated; don't tell a user the tool did it.
- `vitops agents` — (re-)link this skill into `.agents/skills/` + `.claude/skills/` and
  refresh the AGENTS.md pointer block. The links point into the installed package and
  survive version bumps; re-run only if they were deleted.

## Consent and third-party tags

If the site has a consent gate, **every** non-essential third party goes through it. Run
`vitops docs consent` before wiring one up — the failure modes here are silent and legal.
The four that bite:

- **A gated tag must render inert.** `type="text/plain"` + `data-consent="<category>"` +
  the URL on `data-src` (never `src`), plus `data-consent-cookies` naming what it sets so
  a revoke can clear them. Given a live `src` the browser fetches the library immediately
  and the gate is decorative — an undecided visitor's page must issue **no** third-party
  request.
- **Use `require()`, not `granted()`, when you want permission.** `granted()` is passive:
  it never raises the banner, so on a site where nothing else demands that category it is a
  **permanent silent no-op** and your write never happens. `require()` registers the demand,
  which is what makes the banner appear. `request()` is the promise form.
- **No `window.vitopsConsent` means the site has no gate — store freely.** It does not mean
  denied. (A synchronous stub in `<head>` covers the window before the runtime loads, so
  absence is reliable. Listen for the `vitops:consent` event rather than calling
  `subscribe()`, which the stub lacks.)
- **Patch exactly the categories you put on screen.** `acceptAll()` / `rejectAll()` mean
  literally every optional category — using one to answer a single-category prompt records
  consent nobody gave. "Not asked" is a third value (`null`), distinct from declined, and
  only it can be re-prompted.

The banner is **demand-driven**: it appears when something actually asks, not on first visit.
A site whose only analytics provider is cookieless never interrupts anyone. Don't "fix" a
missing banner by forcing it to show — find out what should have demanded a category.

Whatever loads must match what the **generated cookie notice** discloses; the Astro
integration warns when they disagree, and that is a compliance defect, not a doc nit.

## Conversion tracking

`vitops docs tracking`. `site.tracking.enabled` captures ad click IDs and UTMs from the
landing URL into the first-party `_ac` cookie; a conversion route reads it back and notifies
via `site.notifications`. Points worth holding:

- `_ac` is a 90-day identifier, so it waits on `marketing` (or `site.tracking.category`) and
  the capture **`require()`s** it — see above.
- Only an arrival actually carrying a click ID or UTM asks; organic visitors are never
  interrupted.
- The read is synchronous and the _write_ is what waits — the click ID exists only in the
  landing URL, so it cannot be deferred.
- Only the `email` channel (Cloudflare Email Sending) is implemented. Its sending domain must
  be onboarded with `wrangler email sending enable <domain>` or every send fails; the tool
  surfaces that error verbatim rather than as "send failed".
- `--dry`-style planning is pure and reports **why** anything was skipped. A silently unsent
  notification is indistinguishable from no conversion, so never leave one unexplained.
