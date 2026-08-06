---
type: "Design Concept"
title: "Vitops consent — a demand-driven permission gate"
description: "How the consent gate works: inert `type=\"text/plain\"` tags, demand-driven prompting, three-valued choices, and the invariants that make the gate real rather than a promise."
resource: "site.json"
tags: [consent, cookies, privacy, gdpr, analytics]
generator: "@getvitops/generator"
---

# The consent gate

`@getvitops/core/consent` is a **general permission gate, not an analytics feature**. Anything
marked `data-consent="<category>"` waits on one visitor choice — a third-party tag, an A/B
assignment, a personalisation cookie, an embedded map. It carries no Lit and is a separate
bundle from `elements.js`, because consent is a legal requirement: a site that needs it must
not be made to download a rendering framework first.

Categories are `necessary`, `analytics`, `marketing`, `preferences`.

## Gating something

A gated script renders **inert**, with its URL parked on `data-src`:

```html
<script
  type="text/plain"
  data-vitops-tag
  data-consent="analytics"
  data-consent-cookies="_ga,_ga_*"
  data-src="https://example.com/analytics.js"
></script>
```

⚠️ **`type="text/plain"` is what makes the gate real. Never give a gated tag a live `src`.**
The browser neither parses the body nor fetches the library, so an undecided visitor's page
issues **no third-party request at all**. A gate that instead loads a script and politely asks
it not to track is a promise, not a gate.

`data-consent-cookies` is written by whoever emitted the tag, because that is who knows what
the provider sets. It is what a revoke clears.

## Demand-driven: two different ideas

**Offered** categories are a build-time fact — which rows `<CookieConsent />` renders. The
default is deliberately generous; a hidden row costs nothing.

**Demanded** categories are a runtime fact — what something has actually asked for and the
visitor hasn't answered. The banner appears only when a demand is outstanding, so **a site
whose only provider is cookieless never interrupts anyone.**

Demand is registered by:

- a gated element **reaching its loading strategy** — so an `idle` tag asks after `load`, off
  the LCP path, and an `interaction` tag asks only once the visitor acts; or
- an explicit `require()` / `request()`.

## The runtime API

`window.vitopsConsent`, plus a `vitops:consent` `CustomEvent` on `document`.

| Call | Does |
| --- | --- |
| `granted(cat)` | Is it granted? **Passive — does not prompt.** |
| `require(cat)` | Declare a need *now* and report whether it's granted. **This is what raises the banner.** Synchronous. |
| `request(cat)` | `require()`, but resolves once the visitor answers *this* category. |
| `needed()` | Is a prompt warranted? True only if something demanded an unanswered category. |
| `demanded()` | What has asked, this page view. |
| `set(patch)` | Record a decision for exactly these categories. |
| `open()` | Re-show the banner without discarding the current choice. |
| `reset()` | Forget the choice and re-prompt. |

⚠️ If you want a side effect to be *possible*, you must `require()` it. Calling `granted()`
and doing nothing else is a **permanent no-op** on any site where nothing else demands that
category: it is never offered, never granted, and your write never happens — silently.

## An absent gate means "store freely"

`consent.js` and `elements.js` are both deferred with no ordering between them, so a component
can upgrade and be clicked before the gate exists. `<Head />` therefore emits a synchronous
inline **stub** that answers `false` and queues; the runtime replays the queue on load.

That makes the absence of `window.vitopsConsent` meaningful: it reliably means **this site has
no gate**. Read it as *store freely* — never as *denied*.

Because the stub is not the full API, listen for the `vitops:consent` event rather than calling
`subscribe()`, which the stub does not have.

## Three-valued, and why it matters

The cookie (`vitops_consent`, v2) records each category as `true` / `false` / **`null`**.
"Not asked" is a third value, not a synonym for "declined" — and only `null` can be
re-prompted. That is what lets a `preferences` demand arrive *after* an `analytics` prompt was
already answered.

Three consequences:

- **Nothing is stored until the visitor chooses.** Absence of the cookie is *undecided*, and
  undecided denies everything but `necessary`. If merely showing the banner wrote state, the
  banner would be the thing it asks permission for.
- **A corrupt or wrong-version cookie re-prompts.** It does not read as "decided, all denied" —
  that safe-looking read strands a visitor who wants to opt in with no way to say so.
- **A patch must cover exactly the categories a showing put on screen.** `<wc-consent>` builds
  its own patch rather than calling `acceptAll()`, because "Accept" on a preferences-only
  prompt that also granted analytics would be consent nobody gave. `acceptAll()` /
  `rejectAll()` mean *literally every* optional category — widening a patch to "all" is the
  easy version of this bug.

## Revoking reloads

An already-executing tracker cannot be unloaded. Clearing its cookies only stops it identifying
the visitor *next* time, while the running instance keeps reporting until the document goes
away — so a revoke clears the named cookies and **reloads**. (`reloadOnRevoke = false` defers
that to the next navigation.)

## The notice must match what loads

The same config facts drive the **generated cookie notice** — see
[legal.md](legal.md). `site.analytics.clarityId` is what makes the notice name Clarity; the
same provider in `vitops({ analytics })` is what makes the tag load. The Astro integration
**warns when the two disagree**, because a site running a tag its own notice omits is a
compliance defect, not a documentation gap.

## Reference consumer

`<wc-color-scheme-toggle>` applies the chosen scheme **immediately** and gates only the
`localStorage` write. Nothing about honouring a visitor's click needs permission; remembering
it does.
