---
'@getvitops/core': major
'@getvitops/generator': major
---

`<wc-tree>` gains WAI-ARIA tree semantics and roving-tabindex keyboard navigation, and the
keyboard-navigation code behind it lands as shared utilities the next roving-tabindex component
(Dropdown, Tabs, Combobox) can reuse.

**Breaking — `wc` (`@getvitops/core`).** On upgrade, `<wc-tree>` now unwraps every branch's
`<details>`/`<summary>` into a plain, JS-owned structure (`role="tree"` on the root,
`role="treeitem"` on every item, `role="group"` on every nested list, a roving `tabindex`, and
`aria-expanded` mirroring expand state). This is a deliberate, named exception to the framework's
normal "parse the fallback and augment it in place" rule — the alternative, an ARIA-attribute
overlay left on top of the native `<details>`/`<summary>` structure, was tried first and rejected
because `<summary>` stays focusable regardless, which leaves a permanent duplicate `role="button"`
node inside every branch. The no-JS fallback is completely unaffected: it is still native nested
`<details>`, exactly as `<Tree />` has always rendered it, and `enhance={false}` still gets the
bare fragment with no `<wc-tree>` at all.

Two concrete things break for a consumer that reached into the enhanced DOM directly:

- A script holding a reference to the original `<details>`/`<summary>` nodes — including one
  captured via `getElementById` before upgrade, since the flat markup shape's `<details>` carries
  the item's `id` — loses that reference once JS runs. `tree-toggle` (mirroring the existing
  `tree-filter` custom event) is the replacement surface for reacting to expand/collapse.
- `<wc-tree>` becomes a single tab stop. Tabbing through every row in a large tree no longer
  works; arrow keys replace it (Up/Down between visible nodes, Right/Left to open/close a branch or
  step in/out, Home/End, type-ahead), matching the WAI-ARIA tree pattern. Left/Right flip under
  `direction: rtl`.

**Fixed — `wc` (`@getvitops/core`).** `<wc-carousel>`'s dot-nav arrow keys now follow writing
direction. In an RTL document, `ArrowLeft` moves the roving tabindex to the visually-left dot and
`ArrowRight` to the visually-right one — previously both were index-based and moved the focus ring
against the direction the dots are actually drawn in. `ArrowUp`/`ArrowDown` are unchanged and never
flip (`direction` is a horizontal-axis property). The prev/next buttons are unchanged too — they
still step to the previous/next slide in both directions, and only their glyph flips. Also fixed:
two arrow presses faster than the dot nav's smooth scroll can settle now reliably advance two dots
instead of sometimes landing on the same one twice.

**Changed — `css`/`bricks`/`tailwind` (all formats).** `patterns/tree.css` gains a `.tree__summary`
row class (the enhanced-state replacement for `<summary>`), a hand-rolled expand/collapse animation
replacing the native `<details>` one that no longer applies post-upgrade, and a focus ring scoped to
the row rather than the whole item (the roving tabindex now lands on `.tree__item`, whose box wraps
its entire subtree once expanded). Visually equivalent to before; no consumer class rename needed.

**Added — `wc` (`@getvitops/core`, internal).** `web-components/utils/keynav.ts` (generic
key-decoding + type-ahead primitives) and `utils/tree-nav.ts` (tree-specific navigation decisions)
are new pure modules, and `utils/RovingTabindex.ts` is a new shared `ReactiveController` — modelled
on the existing `DragController` — that owns roving-tabindex bookkeeping for any keyboard-navigable
group. `<wc-carousel>`'s dot nav now runs on it too, and `<wc-gallery>` reuses `keynav.ts`'s
`stepIndex`. None of the three are in `@getvitops/core`'s public `exports` map. Only
`RovingTabindex` is re-exported from `web-components/index.ts`, the same way `DragController`
already is, not as new published API; `keynav.ts` and `tree-nav.ts` stay internal modules imported
directly by path (as `RovingTabindex.ts` and `gallery.ts` already do) since neither is consumed
outside the components that already import them directly.

**This changeset makes no consumer-facing change in `@getvitops/generator` beyond documentation
output.** `tiers.ts`'s `tree` entry gains `tree__summary` to its class list and describes the new
keyboard navigation and ARIA semantics — this changes what `vitops docs components` /
`concepts/components.md` render for the `tree` pattern, nothing else. `generator`'s real change in
this release is unrelated to `wc-tree` — see `localbusiness-schema.md`.
