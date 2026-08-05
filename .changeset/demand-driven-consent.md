---
'@getvitops/core': major
'@getvitops/astro': major
'@getvitops/generator': minor
---

Consent is now demand-driven: the banner appears when something actually needs permission, not on every first visit.

Previously, enabling the gate showed a banner to every new visitor regardless of what the site did — including sites whose only analytics provider was cookieless, where there was nothing to consent to. The build decided whether the machinery shipped and the runtime showed the banner because no cookie existed yet.

Now those are two separate facts. The build decides what the banner _can_ ask (rows in the markup); the runtime decides what it _does_ ask. A gated tag registers its demand when it reaches its loading strategy, and `<color-scheme-toggle>` registers `preferences` when a visitor picks a scheme. A site that gates nothing never interrupts anyone.

**Breaking — consent cookie schema (v1 → v2).** Consent is now recorded per category as granted / declined / **not yet asked**. The third state is what lets a later demand ask about a category an earlier prompt didn't cover: accepting an analytics banner no longer silently declines preferences. Every stored v1 choice is invalid and re-prompts once — a v1 cookie asserted a definite answer for categories the visitor was never shown.

**Breaking — `ConsentApi`.**

- `needed()` now means "something demanded a category the visitor hasn't answered", not "no cookie yet". A custom banner calling it will now stay hidden until something asks.
- `ConsentState.decided` (a single boolean) is gone. Use `decidedFor(state, category)`, or `undecidedCategories(state)`.
- New: `require(category)` registers a demand and reports whether it is granted; `request(category)` resolves once the visitor answers it; `demanded()` lists what has asked so far.
- `acceptAll()` / `rejectAll()` still mean every optional category. The banner no longer routes its buttons through them — "Accept" applies to the categories on screen.

**Breaking — `<color-scheme-toggle>` persistence.** The chosen scheme still applies immediately, but writing it to `localStorage` now waits on the `preferences` category **when the site has a consent gate**. Sites without `consent` enabled are unaffected and keep storing as before. If your site enables consent and offers a theme toggle, make sure `preferences` is among the offered categories (it is by default).

**Changed — offered categories.** `consent.categories` defaults to `['analytics', 'preferences']` (plus `marketing` when a configured tag needs it) rather than only what analytics detection could see. An unused row is hidden markup, so offering broadly costs nothing and covers `data-consent` markup no build-time scan can find. Pass `categories` explicitly to narrow it.

**Added — `<Head />` emits a small inline consent stub** when the gate is on. `consent.js` and `elements.js` are both deferred with no ordering between them, so without it a theme toggle could be clicked before the gate existed, read "no gate", and store. The stub answers `false` and queues, and the runtime replays the queue on load.

**Fixed — the generated cookie notice** now discloses the stored display preference when `preferences` is offered, and no longer promises a banner "shown when you first visit", which is no longer how the banner works.
