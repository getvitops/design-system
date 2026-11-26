---
name: vitops-consent
description: Use before gating, adding or changing any non-essential third-party tag, cookie, embed or `localStorage` write on a site with the consent gate (`<wc-consent>`, `data-consent`, `window.vitopsConsent`), or when a consent banner does not appear or a tag loads before consent.
---

# Consent and third-party tags

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
- **Need a gated global (`gtag`)? Listen for `vitops:tag`, don't poll.** The runtime fires it on
  `document` each time it activates a gated tag (`detail.category`). A tag's global exists only after
  that, so a script that fires an event into it (a conversion) holds the event, then re-checks on
  each `vitops:tag`; there is no timeout to outlive a visitor who accepts late. `window.vitopsConsent`
  absent means no gate, so call straight through. `window.vitopsFormConversion(form)` already does
  this for the Google Ads `form` conversion. For your own script, `await window.vitopsAds.ready`
  resolves once `gtag` exists (the same check, already wired to `vitops:tag`). It stays pending
  when the visitor never consents or no Google tag runs, so never block a redirect on it.
- **Patch exactly the categories you put on screen.** `acceptAll()` / `rejectAll()` mean
  literally every optional category — using one to answer a single-category prompt records
  consent nobody gave. "Not asked" is a third value (`null`), distinct from declined, and
  only it can be re-prompted.

The banner is **demand-driven**: it appears when something actually asks, not on first visit.
A site whose only analytics provider is cookieless never interrupts anyone. Don't "fix" a
missing banner by forcing it to show — find out what should have demanded a category.

**The site config is the default for the integration, so don't copy it into `astro.config`.**
`vitops()` reads `site.legal.cookieConsent` (`enabled`, `categories`), `site.tracking`, `site.ads`
and `site.analytics` (`googleAnalyticsId`, `clarityId`, `plausibleDomain`, `matomo`) itself; the
`analytics` and `consent` options only add to or override them. An object `consent` option that sets
just `policyUrl` keeps the config's `categories`; an explicit `categories` in it wins. A `true` /
`false` that contradicts `cookieConsent.enabled` fails the build.

Whatever loads must match what the **generated cookie notice** discloses; the Astro
integration warns when they disagree, and that is a compliance defect, not a doc nit.
