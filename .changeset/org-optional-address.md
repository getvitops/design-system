---
'@getvitops/generator': minor
---

`organization.address.streetAddress` is now optional (a home-based or service-area business with no public street address), and `organization.description` is a new optional, localisable field. The generated legal documents omit an absent street line; JSON-LD builders already skipped absent address fields. Non-breaking; no CSS change.
