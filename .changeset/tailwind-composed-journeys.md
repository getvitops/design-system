---
'@getvitops/generator': patch
---

**Fixed: composed animation journeys are now emitted by the `tailwind` format.** `animations.journeys.compose` entries such as `fade-slide-journey` were emitted as `.fade-slide-journey` by `css`/`bricks` but never by `tailwind`, so `class="fade-slide-journey animate-view"` did nothing on a Tailwind site. Each composed journey is now an `@utility` with the same declarations as the css rule (both formats read one `journeyRules()` source, and a parity test guards it). **`tailwind` only**; `css` and `bricks` output is unchanged. No migration needed.

Not changed: the `hover-`/`focus-`/`active-`/`open-<effect>` state classes remain css/bricks-only by design (Tailwind uses `hover:flip-<effect>`).
