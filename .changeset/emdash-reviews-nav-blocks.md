---
'@getvitops/emdash': minor
'@getvitops/astro': minor
'@getvitops/utils': minor
'@getvitops/core': minor
'@getvitops/generator': minor
---

**Added: `vitops_reviews` and `vitops_nav` EmDash blocks.** Non-breaking.

- **`vitops_reviews`** renders Google reviews from the committed `.vitops/reviews.json` cache (`vitops reviews`) as a grid, carousel or marquee of `<ReviewCard>`. Fields: location key, layout, columns, limit, lowest rating, order, featured ids, reviewer photos (off by default), tone/colour. Which reviews show is `selectReviews()`, the one shared decision. Review JSON-LD is not offered (Google treats self-marked-up reviews as ineligible for rich results). A new review reaches the page after `vitops reviews` is re-run, committed and the site rebuilt, not when an editor saves; with no cache file the block renders nothing (a note in `astro dev`).
- **`vitops_nav`** renders a named EmDash menu inside page content (site map, section links, footer-style columns), never the header. Fields: menu (picked from the site's menus via a new `menus/list` plugin route, with `footer-sitemap`/`footer-legal`/`primary` as the static fallback), accessible name, visible heading and level, layout `list | inline | columns | sitenav`, depth 1-3, tone/colour. It is a `<nav>` with a name that is never `Primary`, `Site map` or `Legal` (the layout's landmarks), `aria-current="page"`, no runtime JS; a missing or empty menu renders nothing.
- `@getvitops/astro`: **`virtual:getvitops/reviews`**, served by `vitops()`, is `.vitops/reviews.json` as a build-time import (an empty cache when absent or unreadable), because a Worker cannot read the file. `<ReviewCard>` now renders the review's source link (`.review__source`, `rel="nofollow noopener noreferrer"`), which the pattern already styled. **Fix:** `src/json-ld.ts` was missing from the published `files`, so any consumer importing `<ReviewCard>` (which composes `schemas/Review.astro`) failed to build with an unresolved import. `@getvitops/emdash` now needs this version of `@getvitops/astro` for the `vitops_reviews` block.
- `@getvitops/utils`: new Worker-safe subpath **`@getvitops/utils/reviews/select`** (`selectReviews` and the review types, no `node:fs`). `selectReviews` now takes only the display fields (`featured`, `minRating`, `limit`, `sort`), so a caller with no configured `locationId` can use it; existing calls are unchanged.
- `@getvitops/core`: new `.navlist` pattern in `patterns/sitenav.css` (`.navlist`, `__item`, `__link`, `__label`, `__sub`, `--inline`, `--columns`). **All formats** (css, bricks, tailwind). No existing class changes.
- `@getvitops/generator`: `TIERS.review` lists `vitops_reviews` and `TIERS.sitenav` lists `vitops_nav` (and `.navlist`), so `vitops docs components` and the docsite show them.
