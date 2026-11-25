---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/emdash': minor
'@getvitops/create': minor
---

`vitops_section` and `vitops_band` take a backdrop image: a decorative photo behind the whole band.

The image sits behind the heading and content (`.section--backdrop` with a `.section__backdrop` image) and is darkened by the tone's solid colour at `--section-scrim-strength` (default 60%; black with no tone). The text uses that solid's computed foreground (white with no tone), so readable contrast comes from the tone and not from the photo. The image is always decorative (empty `alt`); an image that carries meaning belongs in the band's body. CSS: all formats (css, bricks and tailwind). The section block type moves to version 2 to add the field; version 1 is kept as shipped, so existing databases stay valid, and the scaffolded seed carries both versions.
