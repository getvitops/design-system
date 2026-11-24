---
'@getvitops/config': minor
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/core': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Added `site.accessibility`: the accessibility target a site is held to.** `{ standard: 'wcag20' | 'wcag21' | 'wcag22', level: 'none' | 'A' | 'AA' | 'AAA', acceptedRisk?: string }`. It records a decision, not a conformance claim; `acceptedRisk` is free text (who accepted a lower target, when, why) printed in the audit header.

- **WCAG 2 contrast ratio is now checked beside APCA** (`contrastRatio()` in `@getvitops/utils/color`; 4.5:1 for text, 3:1 for icons and boundaries). APCA is not the legal test: AODA is WCAG 2.0 AA, which is a ratio, and a palette can pass APCA and miss 4.5:1. At `level: 'AA'` or `'AAA'` a ratio miss **fails the build**; at `A`, `none`, or with no `site.accessibility` it is a build warning. APCA failures still fail the build in every case, and `acknowledgeContrast` still applies to APCA only. **Migration:** a site that sets `AA` and has a palette under 4.5:1 will now fail `generate`; fix the palette, or record a lower `level` with `acceptedRisk`.
- **`vitops audit` reads `site.accessibility`** (`--input`, default `site.json`, optional): axe tags follow the standard and level, and `level: 'none'` reports violations without failing the run (performance budgets still apply). It now also writes `report.html`. **The report is an artifact, never site content**: it lists every violation, so keep it under `.vitops/audit/` and out of the build output.
- **New scaffolds and `vitops init --site` default to `wcag21` / `AA`.** Existing sites are unchanged until they add the field.

Affects all formats equally (no CSS change). No consumer-facing change in `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`.
