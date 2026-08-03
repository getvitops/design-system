---
'@getvitops/generator': patch
'@getvitops/core': patch
---

Make `text-wrap` a stated decision on every type role, emit the `typography.headings` bindings in the tailwind format, and add the four `text-{wrap,nowrap,balance,pretty}` utilities.

`text-wrap: balance` for headings and `pretty` for copy belong to the **type role**, not to a
reset — the role already owns the property (`--<role>-tw`, editable in the live theme editor),
and `typography.headings` projects it onto bare `h1`/`body` so unclassed markup gets it with no
class at all. Three things stopped that working end to end.

**Omitting `text-wrap` was never "inherit".** Like `style`, `text-transform` and
`text-decoration`, it is emitted on every role at its identity value so that applying one role
class over another fully resets it. So a role that left it out emitted `text-wrap: wrap` and
**cancelled** the `pretty` it would otherwise inherit from a `body`-mapped role — captions and
footnotes quietly opted out of the thing they most benefit from. The behaviour is unchanged
(the reset is what makes role classes composable); what changed is that the schema description
now says so, and the shipped configs state the value on every role rather than leaving it to
the identity.

`vitops init` now scaffolds `balance` on `display`/`heading` and `pretty` on `body`. If you
already have a `design-system.json`, add `text-wrap` to each role deliberately — `balance` for
heading-like roles, `pretty` for copy, `wrap` for short single-line labels.

**The tailwind format dropped `typography.headings` entirely.** It emitted the
`@utility font-<role>` half of the typography layer and none of the bare-element bindings, so a
Tailwind consumer's `<h1>` and `<body>` carried no role styling at all — no family, no size, no
`text-wrap` — while the css and bricks formats styled them. They are now emitted into Tailwind's
`base` layer, which keeps `font-<role>` and the patterns able to override them.

**This visibly changes existing tailwind sites.** Elements named in your `typography.headings`
map start picking up their role's typography, which for most projects is the styling they were
missing — but if you have been compensating with your own `h1`/`body` rules, they now stack.
Your own unlayered CSS still wins; utilities layered by Tailwind will not. Either drop the
compensating rules or remove the entry from `typography.headings`.

**New utilities** `text-wrap`, `text-nowrap`, `text-balance`, `text-pretty` (css/bricks only —
Tailwind ships these natively, so they are in `TW_CLASH` and the tailwind bundle drops our
copies). They are the per-element escape hatch for markup that carries no role class, such as a
Bricks-authored heading.
