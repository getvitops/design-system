---
'@getvitops/core': patch
'@getvitops/generator': patch
---

Delete the unregistered, unshipped `WCColorWheel`, `WCIconPicker` and `WCTypography` (`<wc-color-wheel>`, `<wc-icon-picker>`, `<wc-typography-config>`) and their `TIERS` entries. None was in any bundle, so no consumer could have used them. Not CSS; no format affected. Other fixed-group packages: no consumer-facing change.
