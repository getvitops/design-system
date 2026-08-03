---
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/vite': minor
'@getvitops/cli': minor
---

Maskable favicons are now opaque, so they stop rendering as a logo in a black box.

`icon-mask.png` is declared `purpose: "maskable"` and `apple-touch-icon.png` is linked on every
page. Both sit a deliberately-inset logo on a larger canvas — that inset **is** the maskable safe
zone and was always correct — but the canvas was filled with `alpha: 0`. From any transparent
source that left 36% of `icon-mask.png` and 40% of `apple-touch-icon.png` transparent, on two files
whose entire contract is full bleed: the OS crops them to its own shape and composites the rest onto
whatever it likes, usually black. iOS discards alpha on the apple-touch-icon outright.

`backgroundColor` was already the obvious input for this and already plumbed — as far as the web
manifest, and no further. So the raster and the manifest disagreed about the very colour meant to
sit behind the icon.

Now:

- those two outputs are composited onto `backgroundColor`, defaulting to `#ffffff` — the same
  default the manifest's `background_color` already used;
- `favicon.svg`, `icon-{16,32,192,512}.png` and `favicon.ico` keep the source's transparency, since
  none of them is maskable;
- a transparent source with no `backgroundColor` set now warns, rather than silently inheriting
  white — a dark logo would lose against it;
- `icon-192`/`icon-512` declare `purpose: "any"` explicitly. Omitting it was legal (unset means
  "any"), but with a maskable present and nothing claiming "any", some launchers picked the maskable
  — the one with the safe-zone inset — for slots that wanted a plain icon.

`vitops favicon` gained `--background <hex>`; it previously had no way to set this at all.
`getvitops({ favicon })` and the Vite plugin now forward the option they were already accepting.
