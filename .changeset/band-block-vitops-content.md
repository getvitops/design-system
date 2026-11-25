---
'@getvitops/emdash': minor
'@getvitops/generator': minor
'@getvitops/create': minor
---

Add the `vitops_band` block and `<VitopsContent>`, so a Portable Text page can have full-width tinted sections.

`vitops_section` only works in a `blocks` field, because a Portable Text block cannot hold other blocks. `vitops_band` is a marker instead: it opens a section (kicker, heading, lead-in, buttons, layout, width, tone or theme) and every block after it, up to the next band, goes inside. Render the field with `<VitopsContent value={content} />` from `@getvitops/emdash/astro` where you used `<PortableText>`; content with no band renders exactly as before, and without `<VitopsContent>` a marker renders only its own heading. Both scaffolded pages now use it. The generator's `section` pattern lists the new block. Reaches the EmDash renderer only; no CSS change.
