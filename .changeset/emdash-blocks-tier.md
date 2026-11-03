---
'@getvitops/emdash': minor
'@getvitops/generator': minor
'@getvitops/create': patch
---

**EmDash blocks are now a tier of the component manifest, and there are four more of them.**

`@getvitops/emdash` adds `vitops.gallery`, `vitops.cards`, `vitops.accordion` and `vitops.marquee`
(each a thin adapter over the matching `@getvitops/astro` component), and `vitops.carousel` now edits
its slides as a **Slides repeater** instead of two newline-separated fields. Blocks saved before this
keep rendering: with no `slides`, the carousel still reads `images`/`alts`, and both legacy fields stay
in the editor, labelled as legacy. The editor's field type now admits `repeater` and `media_picker`.

- **New `blocks` plugin option** — `vitopsEmdash({ blocks: { include, exclude, extra } })`. `include` is
  an allowlist, `exclude` drops blocks, `extra` adds the site's own **editor** definitions (the site
  supplies their renderers via `<PortableText components={{ type }}>`, the same route that overrides a
  `vitops.*` renderer). An unknown name or a colliding `type` throws at plugin construction.
- Link and image URLs in blocks with a scheme other than `http`, `https`, `mailto` or `tel` are
  dropped (see the security entry).

`@getvitops/generator`: `TierEntry` gains an optional `emdash: string[]` (block `_type`s) and `Tier`
gains `'emdash'`, so `tierPatterns('emdash')` projects it. **Breaking only for code that exhaustively
switches on `Tier` or builds a `Record<Tier, …>`** — add an `emdash` case. The agent doc
`vitops docs components` gains an "EmDash blocks" table and the docsite a `components/emdash` page. The
guard that every block and every `emdash` entry agree lives in `@getvitops/emdash`'s `blocks.test.ts`,
because the generator cannot import the plugin.

`@getvitops/create`: the EmDash template's agent guidance explains the blocks, their limits (a block
cannot contain blocks; `vitops.*` blocks do not render inside EmDash's built-in `columns`) and the
`blocks` option.

Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing change
in this package.
