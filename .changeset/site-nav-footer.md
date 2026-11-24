---
'@getvitops/astro': minor
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/create': minor
---

**Added: `<SiteNav>` and `<SiteFooter>` for Astro/EmDash sites.** Both are tier-1 markup over the existing `sitenav` pattern (no runtime JS: `<details>` accordions + Popover API drawer). Non-breaking.

- `<SiteNav {...await loadNavMenus(getMenu)} />` renders EmDash menu `primary` (the default: depth 3, dropdowns from the `md` container width, drawer below). If a `primary-mobile` menu exists it replaces the nav below `md` (depth 1); if `primary-mega` exists it replaces it from `xl` (mega panels). Adding the menu in the admin is the whole change. Only one tier is in the accessibility tree at a time. An item's `titleAttr` is its description (EmDash has no description field yet).
- `<SiteFooter sitemap legal name>` renders `footer-sitemap` + `footer-legal` + a copyright line.
- `@getvitops/astro/components/sitenav.ts` exports the pure helpers (`loadNavMenus`, `selectTiers`, ...).
- CSS (`patterns/sitenav.css`, **all formats**): tier visibility classes (`.sitenav-tier--below-*`/`--from-*`), `.sitenav--mega`, `.sitenav__desc`, `.sitefooter*`, `aria-current` styling, reduced-motion and forced-colors handling. Existing `.sitenav` rules are unchanged, so the Bricks element is unaffected.
- `@getvitops/create` (emdash template): the layout now renders header and footer through these components, with the colour-scheme toggle in the header. It reads menus `primary`, `footer-sitemap` and `footer-legal`; a template whose seed still has the old `footer` menu renders no footer links until the seed is updated.
- `@getvitops/generator`: `TIERS.sitenav` now lists the two Astro components.
