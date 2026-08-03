---
'@getvitops/core': major
'@getvitops/generator': major
---

Utilities now beat patterns, in every format. Cascade layers are assigned by what a rule **is**,
not by which file it happens to live in.

`vitops.base → vitops.components → vitops.utilities` has existed for a while, and its whole purpose
is to let `class="card bg-danger-muted"` work without `!important`. But the layer was chosen per
**partial**, and `layout.css` was one file holding both the structural patterns (`.rhythm`,
`.centered`, `.split`) and roughly three quarters of the framework's utilities (`.m-*`, `.flex-*`,
`.items-*`, `.justify-*`, `.text-*`, `.split-<a>-<b>`, track placement). Unmapped, it defaulted to
`vitops.components` — so all of those utilities were shelved _below_ the patterns they are meant to
override, and quietly did nothing. `utilities.css` had the mirror-image problem: it held the
`.reveal` component family, which therefore outranked every pattern _and_ the display utilities.

Both are now split — `layout.css` / `layout-utilities.css`, and `patterns/reveal.css` — and the
classification is asserted across formats by a shared `LAYER_CONTRACT`, so the two halves cannot
drift apart again.

**What visibly changes.** Each of these was silent before and now takes effect. That is the point,
but if you wrote one of these combinations and never noticed it did nothing, you will see a change:

| markup                                   | before                                     | after                  |
| ---------------------------------------- | ------------------------------------------ | ---------------------- |
| `class="table text-center"`              | `.table { text-align: start }` won         | `.text-center` wins    |
| `class="banner items-start"`             | `.banner`'s centring won                   | the utility wins       |
| `class="cluster-between justify-center"` | `.cluster-between` won                     | `.justify-center` wins |
| `class="icon justify-start"`             | `.icon { justify-content: center }` won    | `.justify-start` wins  |
| `class="combobox flex-row"`              | `.combobox { flex-direction: column }` won | `.flex-row` wins       |
| `class="media items-center"`             | `.media { align-items: flex-start }` won   | `.items-center` wins   |
| `<details>` first content child + `m-0`  | `details.css`'s `> summary + *` margin won | `.m-0` wins            |
| `class="split flex-col"`                 | worked, but on source order                | works by layer         |

The reveal family moves the other way, having been mis-shelved as a utility: `class="reveal hidden"`
and `class="reveal-fade block"` used to keep the reveal's own `display` and now lose to the display
utility. The duplicate `details::details-content` rules in `utilities.css` are deleted —
`patterns/details.css` was always the owner, and its selector is a superset — so the collapsed
content box is now `overflow: hidden` rather than `clip`.

**Removed: the bare `<bp>-split` classes** (`sm-split`, `md-split`, `lg-split`, `xl-split`).
`.split` is a pattern now, and `@utility` cannot live in a cascade layer — measured against
tailwindcss@4.3.3, it throws inside `@layer` _and_ inside a file imported with `layer(…)`, and a
`@custom-variant` can't reach a components-layer class either — so `@md:split` became impossible and
the css/bricks counterpart had to go with it. Use `md-flex-row` for "become a row at md"; it says
the same thing in every format. The one thing lost is resetting a bare ratio back to equal at a
breakpoint, which had no usages; apply the ratio at the breakpoint instead.

**Also fixed, in the tailwind format only** — three divergences found while auditing the layers:

- `body` was emitted with `container-type` but not `container-name: body`, so the
  `@container body (…)` queries in the scroll/TOC patterns never matched: `.toc-layout` and
  `.toc-sidebar` were stuck in their narrow layout.
- `grid-auto` was missing the `:is(ul, ol) > li + li` margin reset, so a `<ul class="grid-auto">`
  inside `.rhythm` got a stray top margin on every item but the first.
- **`.sticky` was being deleted outright.** `sticky` is a Tailwind utility name, and the strip that
  defers those to Tailwind matched a rule's leading class — taking `patterns/sticky.css` with it,
  including `--sticky-offset`, the z-index wiring and every `.sticky--bottom` / `--inline-start` /
  `--inline-end` variant. Components whose names collide with Tailwind utilities are now allowlisted.

**Migration.** If a layout utility on a patterned element now "suddenly works" and you preferred the
old result, remove the utility — it was never doing anything. To keep a pattern winning over the
framework's utilities, write the declaration in your own stylesheet: unlayered CSS still beats all
three framework layers.
