---
'@getvitops/core': patch
---

A `.cta` inside a solid tone (`.tone--solid`) is no longer painted in the band's own colour. It used to take `--tone-solid` as its fill, so a button on a dark band nearly vanished (a "Get a Quote" on a brown band). It now inverts: `--tone-on-solid` as the fill and `--tone-solid` as the label, with a hover that mixes the two. Both are the tone's own computed pair, so the contrast guarantee holds. On a tint (`.tone--tint`) the button keeps `--tone-solid` / `--tone-on-solid`. Reaches all formats.
