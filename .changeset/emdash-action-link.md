---
'@getvitops/emdash': minor
---

New `vitops.actionLink` block: a link or button with optional icons at either end.

Editors get a label, URL, style (link / button / call-to-action), colour role, new-tab toggle, and
searchable pickers for a start and end icon. Icons render from the generated SVG sprite, so the
block needs no JavaScript, and they use the sprite's set-independent aliases — content authored in
the CMS survives the site changing icon sets.

Fields are flattened (`label`, `href`, … as siblings rather than a nested object) because Block Kit
has no object-group element. The icon pickers are comboboxes over the semantic name list for the
same reason: Block Kit's element union is closed, so a richer icon picker isn't mountable inside a
block modal today.
