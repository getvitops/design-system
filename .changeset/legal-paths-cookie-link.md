---
'@getvitops/generator': minor
'@getvitops/astro': minor
---

**Added: a documented route for each legal document, and a default cookie-notice link on the consent banner.** The cookie notice was named `cookies` in the CLI (`vitops legal --doc cookies`) but written to `cookie-notice.*`, and nothing said which URL a site should publish it at. The convention is now explicit and exported: `LEGAL_PATHS` (`@getvitops/generator`) maps each document to its short route — `/privacy`, `/terms`, `/cookies`, `/accessibility` — beside `DOC_SLUGS`, which stays the file stem. **No output files are renamed.**

On a config-driven site (`site: { input }` or a `css` config that reads as a `Config`) with consent on, `<CookieConsent>` now links the notice at `/cookies` by default. An explicit `consent.policyUrl` (or the component's `policyUrl` prop) still wins; a site with no config gets no default link, since nothing generates the page. **Migration:** if your notice lives elsewhere and you relied on the banner having no link, set `consent: { policyUrl: '/your/path' }`. All formats: not applicable (no CSS change).

`@getvitops/emdash`, `@getvitops/utils`, `@getvitops/cli`: no consumer-facing change in these packages.
