---
'@getvitops/emdash': minor
---

`vitops_cards` panels gain a **Tags** field (one per line, rendered as `.tag` badges) and render the checklist as a ticked `list list--divided list--check`. Cards and hero option cards now emit `subgrid-responsive`, so rows collapse to two then one column on narrow screens. Existing content is unchanged apart from the checklist markup (`<li>` becomes `<li class="list__item">`) and the responsive collapse. Needs `@getvitops/core` with `.list--check`. Cards also size their row tracks to their busiest card (`--subgrid-card-rows`), so an image, tags and a checklist no longer overflow into the button row.
