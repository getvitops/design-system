---
'@getvitops/emdash': minor
'@getvitops/core': minor
---

`vitops_hero` (split layout) gains **Text alignment** (centered or left), **Width** (edge to edge, or page width with a rounded image) and **Second button style** (text link or outlined button). Defaults reproduce the previous look. The text column and image no longer carry inline styles: `.hero__text` and `.hero__media` (with `--hero-justify`, `--hero-text-align`, `--hero-media-h`, `--hero-media-radius`) in `section.css`, so a site can restyle them without `!important`. CSS: **all formats**.
