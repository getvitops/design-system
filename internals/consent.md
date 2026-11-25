# The consent gate

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

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
visitor acts) or by an explicit `require()` / `request()`. `<wc-color-scheme-toggle>` is the reference
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
- **The store is pure, and consent's DOM wiring is still untested.** Everything legally decidable
  (what an absent cookie means, what a corrupt one means, what a revoke covers, **whether a prompt
  is warranted** — `needed(state, demanded)`) lives in `consent/store.ts` as functions over a cookie
  string and is asserted in `store.test.ts`. Keep new decisions on that side of the line. Note the
  reason is no longer "core has no DOM environment" — it has one: `happy-dom` is a devDependency,
  opted into **per file** with a `/** @vitest-environment happy-dom */` pragma and a `*.dom.test.ts`
  name, because a global DOM would make ~830 pure tests pay for what a handful need. So the split is
  a rule about where a decision belongs, not a limitation: pure decision in a pure module
  (`consent/store.ts`,
  `web-components/utils/{tree-filter,tree-nav,keynav,card-click,carousel,counter,gallery}.ts`), DOM test
  for the wiring that is genuinely about the DOM (`WCTree.dom.test.ts`, `WCCards.dom.test.ts`,
  `upgrade.dom.test.ts`). There is simply no `WCConsent.dom.test.ts` yet.
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
