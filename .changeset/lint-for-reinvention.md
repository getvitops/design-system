---
'@getvitops/cli': minor
'@getvitops/generator': patch
---

`vitops lint` now catches hand-written CSS that re-implements a framework primitive.

The existing linter finds classes that resolve to nothing — you named something and it isn't there.
This is the costlier inverse, where the code **works**: a centred container written by hand, a
two-column split behind a media query, a flex row. Nothing is broken, so nothing ever surfaces it,
and the design system quietly stops being where those decisions live.

Three rules to start, each requiring the combination that makes the intent unambiguous
(`margin-inline: auto` alone is not a centred track):

| Found                                                       | Suggested                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `max-inline-size: var(--width-*)` + `margin-inline: auto`   | `.centered`, widening a child with `breakout` / `spotlight` / `fullbleed` |
| `grid-template-columns: 1fr 2fr` inside a `min-width` query | `md-split-1-2` — or `@md:split-1-2` in the tailwind format                |
| `display: flex` + `align-items: center`                     | `flex items-center`, or `.cluster-start`                                  |

**Findings now carry a severity, and suggestions do not fail the command.** These are judgement
calls, and a reuse hint that broke CI on the day it shipped would be a worse defect than the drift it
reports. `--strict` promotes them for anyone who wants the ratchet. Everything the linter reported
before is an `error` and still exits 1.

`.css` files and `<style>` blocks are now read (the class linter only ever looked at markup). The
generated stylesheet is skipped by its `GENERATED … do not edit by hand` banner rather than by path —
the `css` format writes `styles.css` into `src/styles`, squarely inside what `--src` scans, and
linting it made the framework report `.split` as reinventing `.split`.

Two other gaps closed:

- **The format-spelling check ran in one direction only.** `md-split-1-2` in a tailwind project was
  caught; `@md:split-1-2` in a css/bricks project was not, because variant stripping removed the
  `@md:` regardless of format and left a bare class that matched nothing. The same silent no-op, in
  the other direction, unreported. Stripping is format-aware now.
- **`grid-auto` and the whole `m-*` rhythm family were missing from the tailwind format entirely** —
  not dropped via `TW_CLASH`, just never re-emitted when `layout.css` is skipped and a subset
  re-emitted in its place. Unlike the `<bp>-` classes they have no Tailwind equivalent, and unlike a
  misspelt class the linter cannot flag them, because they aren't anchored to your config. They emit
  as `@utility` definitions now, keyed to the same `--rhythm-*` variables as the css format.

Run against this repo's own docs site, the rules found one real instance on the first pass; it is
fixed in the same change.
