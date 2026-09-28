---
'@getvitops/astro': minor
---

The Astro integration now warns when `site.locales`/`site.defaultLocale` disagree with
`astro.config.mjs`'s own `i18n` block — naming which locale codes are missing from each side, and
when the two `defaultLocale`s differ. EmDash reads its locale list straight from `i18n`, while our
own SEO/legal code reads `site.locales`, so the two had no way to notice they'd drifted apart. A
warning, not a build error — like the existing ads/analytics/consent consistency checks, either
side can legitimately be configured without the other, so only a genuine disagreement is flagged.
