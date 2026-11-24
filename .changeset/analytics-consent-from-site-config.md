---
'@getvitops/astro': minor
'@getvitops/skills': patch
---

**`vitops({ analytics })` and the consent categories now default from the site config, so they are no longer copied by hand.**

- **`analytics`:** the providers in `site.analytics` (`googleAnalyticsId`, `clarityId`, `plausibleDomain`, `matomo`) are the tags `<Analytics />` loads. The cookie notice already disclosed providers from that block; the tag now comes from the same place, so the two cannot drift. The option still adds a provider, overrides one, or sets `strategy`, and wins per provider; a provider given only in the option still warns that the notice will not disclose it. `googleTagManagerId` has no `<Analytics />` provider and is unchanged.
- **`consent`:** an object option used to replace `site.legal.cookieConsent.categories` outright, so `consent: { policyUrl }` silently dropped the categories the notice named and the banner fell back to a default that always offers `preferences` (vitops-website's config carries a paragraph warning about exactly this). The option's `categories`, when given, still wins; anything else in the object now leaves the config's list in place.

**Behaviour change:** a site whose `site.analytics` names a provider but whose `vitops()` call omitted `analytics` now loads that tag (before, the notice named a provider nothing loaded). A cookie-setting provider with the consent gate off warns, as before. To keep a provider out of the page, remove it from `site.analytics`. **Migration:** a site that copied the provider out of its config (`analytics: { clarity: config.site.analytics.clarityId }`) can delete the option; one that passed `consent: { categories }` only to dodge the replacement can drop it. Other fixed-group packages: no consumer-facing change.
