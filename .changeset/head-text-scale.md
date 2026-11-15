---
'@getvitops/astro': minor
---

**`<Head textScale />` opts a page into the operating system's text-size setting.** It emits `<meta name="text-scale" content="scale">`, which asks supporting mobile browsers to scale `1rem` to match Dynamic Type or Android's font size instead of ignoring it. Off by default, because it changes the rendered size of every rem-based length for visitors with a large OS setting; the framework's type and space scales are rem-based and follow it cleanly, but a site with fixed-pixel layout should test a large setting first. Browsers without support ignore the tag. No markup change unless the prop is set. Other fixed-group packages: no consumer-facing change.
