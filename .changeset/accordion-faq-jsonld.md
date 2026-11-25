---
'@getvitops/emdash': minor
---

`vitops_accordion` can emit `FAQPage` JSON-LD from its items, and its bodies render `[text](url)` links.

The new "Mark up as FAQ" toggle is off by default: Google shows FAQ rich results only for government and health sites, so marking up every accordion would claim something most sites cannot use. When on, each summary becomes a `Question` and the body (links flattened to text) its `Answer`. Bodies previously rendered links as literal text. Reaches the EmDash block renderer only; no CSS change.
