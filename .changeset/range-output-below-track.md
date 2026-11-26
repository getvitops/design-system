---
'@getvitops/core': patch
'@getvitops/generator': patch
---

**`<wc-range>`: the `<output>` no longer overlaps the dual-thumb track.** `.range--dual` is now a grid: the track and both inputs share the first row and the `<output>` sits in the row beneath, instead of being clipped inside a fixed-height box with absolutely positioned inputs. Markup and JS unchanged. CSS change, all formats. No consumer action needed.
