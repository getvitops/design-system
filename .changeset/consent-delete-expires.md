---
'@getvitops/core': patch
---

**Consent revoke deletes cookies with an `expires` date as well as `max-age=0`.** Browsers treat the two the same, so there is no behaviour change on a real page. A DOM implementation that reads an expiry of "now" as not yet expired (happy-dom, which the `*.dom.test.ts` suites run on) kept a `_ga` cookie after a revoke on some runs, which made `WCConsent.dom.test.ts` fail intermittently. All formats (the consent bundle is the same in each). Other fixed-group packages: no consumer-facing change.
