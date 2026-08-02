---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/core': minor
---

Add `<Analytics />` and a general-purpose consent gate.

`getvitops({ analytics })` configures Google Analytics 4, Microsoft Clarity, Matomo and Plausible;
`<Analytics />` emits their tags. Nothing touches the critical path — `strategy` defaults to `'idle'`,
which loads every tag after `load` on an idle callback (`'async'` and `'interaction'` are the other
options), and no `preconnect` is emitted, since warming a third-party connection during parse is the
cost `idle` exists to avoid.

`getvitops({ consent })` adds the gate: `@getvitops/core/consent`, a 2.3 KB gzipped Lit-free bundle,
plus `<CookieConsent />`.

```js
vitops({
  analytics: { googleAnalytics: 'G-XXXXXXXXXX', plausible: 'acme.com' },
  consent: { policyUrl: '/legal/cookies' },
});
```

**Consent is not an analytics feature.** The gate is general — mark anything
`data-consent="<category>"` and it waits on the same choice, so A/B assignment, personalisation and
third-party embeds use it too, and a site can enable the banner with no analytics at all. Categories
are `necessary` / `analytics` / `marketing` / `preferences`, and `window.vitopsConsent` plus a
`vitops:consent` event on `document` are how your own code reads the answer.

**Which category a provider needs is derived, not declared.** It follows from whether that provider
sets cookies, which follows from its own config: Matomo runs cookieless by default (`disableCookies`)
and so needs no banner; `cookies: true` opts in and moves it behind `analytics`. You can't mark
Google Analytics `necessary` to skip the banner — but you can pick a genuinely cookieless provider.

Gated tags render as `<script type="text/plain">` with the URL on `data-src`, so an undecided or
declining visitor's page issues **no third-party request at all**. For Google Analytics that is basic
consent mode rather than Consent Mode v2 advanced: nothing reaches Google until the visitor accepts.
Clarity additionally receives `clarity('consentv2', …)`, because Microsoft enforces the signal
separately for EEA/UK/CH traffic. Nothing is stored until a choice is made — the banner can't be the
thing that needs consent — and revoking clears the provider's cookies and reloads, because an
already-executing tracker can't be unloaded any other way.

The banner is shown in the top layer via `popover="manual"`, like `.tooltip`: a plain fixed banner
resolves against the nearest containing block, and `body { container-type: inline-size }` — ordinary
in a framework whose breakpoints are container queries — would otherwise trap it mid-page.

**The site config gained `analytics.clarityId` and `analytics.matomo`**, so `vitops legal` discloses
them. Clarity and Matomo join the processor table with their real cookie names, cookieless Matomo
asserts positively that it sets none, and a Clarity site's privacy policy now describes session
replay rather than filing it under page-view analytics. Configure `legal` alongside `analytics` and
the Astro integration cross-checks the two, naming any provider you'd otherwise run without
disclosing; it also warns when a cookie-setting provider has no `consent` gate.

Existing configs are unaffected — both options are off unless provided. One behaviour change if you
use the ad-conversion tracking script: `packages/astro/src/scripts/tracking.ts` now waits for
`marketing` consent before writing its 90-day `_ac` click-ID cookie, when the gate is present. With
no gate on the page it behaves exactly as before.
