---
'@getvitops/emdash': minor
---

Seven new blocks, a section block type, and a shared `tone`.

**New Portable Text blocks:** `vitops.logos` (a still grid; `marquee` only scrolls), `vitops.steps`, `vitops.stats` (each figure is a `<Counter>`; a `tiles` style adds group, change and good/bad state), `vitops.callout` (a call-to-action band, not the dismissible `banner`), `vitops.entries` (wraps `<wc-entries>`), `vitops.pricing` (aligned plan cards) and `vitops.embed` (a video or map that loads only after consent: the iframe ships with no `src`, the address rides on `data-consent-src`, and a `title` is required).

**New block TYPE `vitops_section`** (kicker, heading with a level, lead-in, tone, an optional heading-left `split` layout, and a Portable Text body that accepts every `vitops.*` block). It is a schema-level block type, not a Portable Text block, because Block Kit fields cannot hold rich text. Add `...vitopsBlockTypes()` to `seed.json`'s `blockTypes`, allow `vitops_section` on the collection's `blocks` field, and map it with `blockTypeComponents` from `@getvitops/emdash/astro` (`defineBlockComponents`).

**Extended, non-breaking:** `vitops.hero` gains accent marks (`*words*` in the heading), a heading `level`, `tone`/`color` and an optional row of cards. `vitops.cards` gains a `panel` style (tone, checklist, button), a heading `level`, `tone`/`color`, and `[text](/url)` inline links in the body. **Cards fix:** the card title is now a real heading element (default `h3`, `font-heading`) instead of `<p class="font-heading">`; saved content is unchanged, but the markup and the page outline change. Set `level` to taste.

**Shared `tone` + `color`** on every block that colours anything: a role from `site.json`, falling back through its semantic relatives to `neutral`, or a palette hue/step. Renderers emit `--tone-*` custom properties (never a class built from a value, which Tailwind cannot see). New option `vitopsEmdash({ tones })` (or the roles are read from `designSystemEditor.config`) fills each block's `tone` select with the site's own roles through a `tones/list` plugin route; with neither, the select offers the semantic names. `vitops.banner.tone` and `vitops.actionLink.role` keep their existing values.

**Render tests:** `pnpm --filter @getvitops/emdash run test:render` renders the block adapters through Astro's container API in a separate vitest config.
