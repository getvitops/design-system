---
type: "Design Concept"
title: "Vitops legal documents — generated policy, terms and cookie notice"
description: "How the privacy policy, terms of service and cookie notice are derived from config facts, why the provider table exists, and the four delivery paths."
resource: "site.json"
tags: [legal, privacy, cookies, pipeda, compliance]
generator: "@getvitops/generator"
---

# Legal documents

A privacy policy, terms of service and cookie notice, rendered from a full config: the company
from `organization`, what the site actually *does* from `site`.

It is a **sibling of the docs generator, not a `generate()` format** — structurally, not
stylistically. `generate()` is keyed to a design system, so a "legal format" would be a format
that ignores its own input.

## The governing rule

**The config records facts; the template owns prose.**

Nothing in the derivation writes a sentence a lawyer would review, and no template invents a
fact. That is what lets wording be corrected without touching your config, and your provider
change land without touching prose.

⚠️ It also means **the fix for a wrong policy is a corrected config.** Hand-editing the output
is overwritten by the next build.

## What derives from what

- **The provider table is what makes derivation possible.** A policy naming Plausible while the
  site runs GA is a compliance defect, not a typo — so the provider comes from *which analytics
  ID is set*, whether `site.security.turnstile.siteKey` exists, and what
  `site.deployment.platform` says. Never from a hand-maintained string.

  It covers only what the schema can imply. Everything else — payment, CRM, mail — is declared
  in `site.legal.privacyPolicy.processors` and flows through the same pipeline.

- **`cookies: []` is meaningfully different from `undefined`.** It *asserts* a provider is
  cookieless (Plausible), which the cookie notice states **positively** rather than omitting.

- **Form templates are the PII inventory.** `site.templates` entries of type `form` are the
  only place the config says what personal information the site actually collects, so the
  disclosed list derives from their fields. `hidden` fields and honeypots are **excluded** —
  neither is visitor-supplied, and describing them as collected would be untrue.

- **First-party cookies are declared, not detected.** The attribution cookie `_ac` is disclosed
  this way; see [tracking.md](tracking.md).

## The markdown subset is closed

We author every template, so the renderer is exactly as capable as they are: `#`/`##`/`###`,
`- ` bullets, `> ` quote, `**strong**`, `\`code\``. **An unsupported construct is an error,
not a silent degrade** — that is what stops a literal `| --- |` reaching a published page.

Portable Text maps the `> ` quote to a banner block and **drops the `# ` heading**, which is
EmDash's own title field.

## Jurisdictions

Adding one is: author three templates, add one enum member, add one registry key. The two are
checked against each other at compile time, so skipping either **fails to compile** rather than
rendering against the wrong body of law.

⚠️ Only **`ca` (PIPEDA)** ships. Its prose names the Office of the Privacy Commissioner of
Canada and frames transfers as "outside of Canada" — **do not reuse it for another
jurisdiction.**

## Delivery: one renderer, four consumers

| Consumer | How |
| --- | --- |
| **any stack** | `vitops legal [--doc <name>] [--format md\|html\|portable-text] [--out <dir>]` — stdout without `--out`. Hugo, Eleventy or a hand-built WordPress theme need no integration code. |
| **WordPress** | `generate({ site })` also emits `dist/legal/*.html`; `[vitops_legal doc="privacy"]` renders one. `doc` is matched against a fixed allowlist, because it lands in a filesystem read. |
| **Astro** | `vitops({ legal: { input, out } })` — a sibling of `css`, not a widening of it. Regenerates on config change; writes markdown to a content collection. No route injection. |
| **EmDash** | `--format portable-text`, pasted into the admin. |

The CLI is the load-bearing one: it is the surface every consumer has regardless of stack.

## The review banner

Every document opens with a **non-optional** review banner. These are rendered from a template
by a build tool; the one failure mode with real consequences is a consumer publishing one as-is.
