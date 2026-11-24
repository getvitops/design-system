---
'@getvitops/config': patch
'@getvitops/utils': patch
'@getvitops/astro': patch
---

Docs only: the `site.ads.google.conversionLabel` field descriptions and `vitops ads` now state which Google Ads category each conversion action needs (`call` → Phone call lead, `email` → Contact, `form` → Submit lead form). The category is set on the action in Google Ads, not by the tag, so a wrong one reports under the wrong goal with no code-side signal. `vitopsFormConversion()`'s docblock also warns against firing a form conversion from a success-page query parameter. No behaviour change.
