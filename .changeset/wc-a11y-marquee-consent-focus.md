---
'@getvitops/core': patch
'@getvitops/astro': patch
---

`<wc-marquee>` adds a "Pause animation" button beside the track (WCAG 2.2.2), and the marquee also pauses while focus is inside it (`data-paused` and `:focus-within`). Pattern CSS: all formats. `<wc-consent>` moves focus into the banner when a visitor opens it from a settings control and returns it on close; an unprompted banner still doesn't take focus. `<wc-image-compare>`'s before/after panes are `role="group"` so their labels are announced. The conversion route format-checks `phone`/`email` beacon payloads and imports the Worker-safe `@getvitops/utils/content` instead of the utils root barrel.
