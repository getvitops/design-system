---
'@getvitops/generator': major
'@getvitops/utils': major
'@getvitops/config': minor
'@getvitops/cli': patch
'@getvitops/core': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
'@getvitops/skills': patch
---

**The generator's contrast contract is now the WCAG 2 contrast ratio and nothing else. APCA is removed.** APCA is perceptually better but is no longer on the W3C standards track, so no law (AODA is WCAG 2.0 AA) or conformance claim is tested with it. Two things were wrong with the old arrangement: a palette could pass APCA and miss 4.5:1, and the ratio only failed the build when `site.accessibility.level` was `AA` or `AAA`.

**Breaking:**

- **Bars.** Text, including `text-<role>-muted` on every plane of its role, must reach **4.5:1**; icons and a surface role's `border-<role>-bold` **3:1**; `text-on-<role>` **4.5:1** on its solid. There is no separate "secondary text" tier any more.
- **Unset is AA.** A site with no `site.accessibility` (or no `level`) now **fails the build** on a ratio miss. Only an explicit `level: 'A'` or `'none'` downgrades it to a warning. **Migration:** fix the palette, or set `level` and record why in `acceptedRisk`.
- **`colors.roles.<role>.acknowledgeContrast` is now in ratio points, not Lc.** `1` used to mean one Lc point; it now means 1.0 of ratio (e.g. `0.1` excuses 4.4:1 against 4.5:1). `vitops lint --fix` cannot convert it, because the two scales have no fixed mapping: re-measure the pairing and set a new value.
- **`contrastLc()` is removed from `@getvitops/utils/color`.** Use `contrastRatio()`. `pickOn()` now picks the near-white or near-black with the higher ratio, so a mid-tone solid can choose a different `text-on-<role>` than before.
- **Token changes that follow from the ratio.** Surface roles' light `text-muted` moved from step 700 to 800 (it sat at about 4.4:1 on the `bg-x-muted` well in some hues). The starter config from `defaultConfig()`/`vitops init` sets `solid: 700` on `info` and `danger` (their step 600 was 4.35:1 and 4.40:1 under white text), and this repo's example `neutral` role does the same. A config that pins a role's solid at a step under 4.5:1 will now fail `generate`.
- `validateColorContract()` (the EmDash editor's save gate) now honours each role's `solid` option and judges the same ratio contract as a build.

**Affects all formats** (css, bricks, tailwind): the step changes alter emitted token values; the layers and class vocabulary are unchanged.

No consumer-facing change in `@getvitops/cli`, `@getvitops/core`, `@getvitops/vite` or `@getvitops/astro`. `@getvitops/config` only updates the `site.accessibility.level` description. `@getvitops/skills` updates `vitops-accessibility` to describe the new behaviour.
