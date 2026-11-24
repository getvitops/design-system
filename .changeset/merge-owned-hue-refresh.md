---
'@getvitops/config': minor
'@getvitops/core': minor
'@getvitops/utils': patch
'@getvitops/astro': minor
---

Two fixes to the config form. **Saving no longer resurrects or loses fields.** `mergeOwned` (the portal's merge) moves into `@getvitops/config/forms`, with `ownedFromProjections`: a submission replaces only the paths its projections own, a value the form dropped (cleared, or a row removed) is removed from the result, and fields a projection never shows (a palette hue's `anchors`, a role's `solid`) are kept. `<wc-config-form>` gains `merged(base)` and an `owned` attribute (or `ownedItems` property), and `<ConfigForm projections={[…]}>` wires them. `/configure` used a plain deep merge, which could not delete anything. **A select built from another map's keys stays current.** A colour role's hue select is re-read from the palette as hues are added or removed (`data-options-from` on the select, `optionsFrom` on the descriptor), keeping the current choice. Affects the web-component bundle in all formats; no CSS or markup class changes. Other fixed-group packages: no consumer-facing change.
