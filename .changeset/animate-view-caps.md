---
'@getvitops/core': patch
'@getvitops/generator': patch
---

`.animate-view` no longer leaves a tall element partly faded on the first screen (all formats).

The default window is timed off the element's midpoint, so the taller the element, the later it finished. A 534px card row at the top of a 1280×720 page sat at 68% opacity until the page was scrolled, and axe reported its text at 2.9:1 (the scaffolded site's `/landings/showcase` failed its audit for this). The window's start and end are now capped at 30vh and 45vh from the element's leading edge (`--anim-start-cap`, `--anim-end-cap` to change them), so a tall element completes once a reasonable slice of it is on screen. An element shorter than about 40vh never reaches a cap and keeps its timing, so small cards and tiles are unchanged. Composed journeys (`*-journey`) keep the midpoint start.
