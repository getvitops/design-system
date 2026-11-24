---
'@getvitops/utils': patch
'@getvitops/core': patch
'@getvitops/create': patch
---

- **`vitops audit` lets the page settle before axe reads colours.** At `load` Chromium can still be running the CSS transitions every pattern declares, so axe measured a filled button mid-way from its unstyled colour and reported ten `color-contrast` failures no visitor sees. The audit now waits (up to 2 s) for CSS transitions to finish first.
- `.carousel__hint` reads `text-surface-muted` instead of `x-muted` (the placeholder tier the contrast contract exempts), and its scroll-driven fade ends hidden instead of at 0.2 opacity (`--carousel-hint-dimmed` now defaults to 0): a hint parked at 20% was still text to an audit (1.34:1). all formats.
- The templates' `button` pattern becomes the toolkit's `btn` affordance (`fill: false`, transparent, text colour inherited), as `defaultSiteConfig()` already shipped: the old filled entry lost its white text to the new `link` pattern on `<a class="btn">` (dark green on green, 1.36:1). A filled call to action is `.cta`.
- The templates move the `info` and `danger` solids to step 700. Their step-600 solids (sky, rose) clear the generator's APCA bar for `text-on-<role>` (Lc 60) but not WCAG AA's 4.5:1 that axe and Lighthouse apply (4.2:1 and 4.4:1), so a `.cta-info` or a CTA inside an `info` callout failed the audit. Step 700 reads at 6.4:1 and 6.8:1 with the recomputed text. The APCA/WCAG gap in the contract itself is logged in TODO.md.
