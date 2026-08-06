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
  file's shape, so it checks a site config as a site config.

**The config may be a `design-system.json` or the site config that embeds one.** Every
`--input` (and the Vite plugin / Astro integration equivalent) accepts either; a site
config holds the design system at `designSystem.themes.<name>`, selected with `--theme`.
If this project keeps its tokens inside a `company.json` / `site.json`, point `--input`
there — do not create a second file for the tooling's sake.

## Which tier provides a pattern

A pattern (tree, carousel, dialog, card, …) may be provided by up to four tiers, and they
**compose** rather than compete: CSS framework classes, a `<wc-*>` web component, an Astro
component, a Bricks element. **Run `vitops docs components`** for the full table — which
tiers each pattern has, and the exact call to write.

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
