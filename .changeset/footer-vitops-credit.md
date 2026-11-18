---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/generator': patch
---

`<SiteFooter>` now renders a "Powered by Vitops" link to https://vitops.ca after the copyright line, on by default. Pass `credit={false}` to remove it; a white-label config option will drive this later. If you hand-write a footer, add the attribution yourself.

Pattern CSS (`sitenav.css`): new `.sitefooter__base` row wrapping `.sitefooter__copy` and `.sitefooter__credit`. Reaches css/bricks and tailwind formats (all formats).

`<wc-format>` / `<Format>` gain `fields` (show only `year`, `month`, `day`, `weekday`, `hour`, `minute`; replaces `date-style`/`time-style`) and `now` (format the current date instead of the `datetime`, which is updated to match). `<SiteFooter>` uses them for its copyright year, so a prerendered page shows the visitor's current year with JS and the build year without.
