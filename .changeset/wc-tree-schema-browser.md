---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
---

Add `<wc-tree>`, and a schema walker that feeds it.

`<wc-tree>` is progressive enhancement for the existing `.tree` pattern: given a nested
`<details>` disclosure tree it adds a filter, expand-all / collapse-all, and hash deep-linking.
It ships in `elements.js`.

`@getvitops/astro` gains `./components/Tree.astro` and `./components/tree.ts` (its `TreeItem`
type) to build that markup from data. As with every wrapper over a web component, `<Tree />`
emits the `<wc-tree>` tag itself with the accessible fallback inside — so `<Tree items={…} />`
is the whole call, and wrapping it in your own `<wc-tree>` nests two elements on one tree.

The slotted markup is the whole content and works without it — every node readable, expandable
and linkable — so the element only adds what CSS cannot do. Four things worth knowing:

- **The toolbar is generated, never authored.** A search field that does nothing is worse than
  no search field, so the controls exist only once the element upgrades.
- **Deep-linking is the non-obvious one.** A node inside a closed `<details>` has no layout box,
  so the browser's own fragment navigation finds nothing and silently stays at the top of the
  page. `<wc-tree>` opens the target's ancestors — and the target's own disclosure — then scrolls.
- **Filtering matches a node's own label and description, never its subtree's text.** The obvious
  `textContent` implementation makes every ancestor of a hit match, so the root matches any query
  and the filter narrows nothing. That decision lives in a pure, tested module (`matchTree`)
  rather than in the DOM wiring.
- **It initialises even when upgraded mid-insertion.** An element connected during an
  `innerHTML` write — a view-transition swap, a client-side navigation — has no children yet
  (measured: zero). Setup retries once the insertion completes, because the failure mode was
  silent: no toolbar, no filter, no deep link, no error.

`patterns/tree.css` now supports two markup shapes: the item may be the `<details>` (the
pattern's original contract) or an `<li class="tree__item">` wrapping one, which is what gives
assistive tech list position and depth.

**`.tree` indent is fixed and now fluid**, which matters for any deep tree. Three separate leaks
compounded, each invisible in the CSS and each charging roughly one extra indent per level:

- the rule set both `margin-inline-start` and `padding-inline-start` to `--tree-indent`;
- `.tree { padding: var(--_p) }` applied to every nested `.tree`, not just the outermost — on all
  four sides, so it narrowed from the end as well;
- `patterns/details.css` gives every non-summary child of a `<details>`
  `margin-inline: var(--_content-margin)`, and its `details, .details` selector takes `:is()`
  specificity under CSS nesting (**0-1-1**), so `.tree { margin: 0 }` at 0-1-0 _loses_ to it. A
  nested tree is exactly such a child.

Measured in a browser: **41px per level against a 24px design**, so a 9-deep tree spent 382px on
indent and left its deepest label 162px wide. Now 24px per level, 198px total, and 653px of label.
The nested rule resets both box axes before applying the one indent it owes, and the default is
`clamp(0.75rem, 2.5vw, 1.5rem)` — 12px on a phone, 24px on a desktop — because a tree's depth is a
property of the data and cannot be known when the pattern is written. `--tree-indent` still
overrides it, and the `--lines` elbow derives from the same resolved value so the two cannot
disagree.

**Leaf rows now align with their branch siblings.** A branch spends a toggle column on its chevron
before its label; a leaf has none, so every leaf label sat one full column (24px, measured) to the
inline-start of its siblings and nothing at a given depth lined up. `.tree` exposes
`--_node-indent` (the toggle column) and `--_leaf-indent` (what a row without a toggle owes to
reach the same label column); `.tree__content` and `.tree__desc` both read the latter rather than
re-deriving the sum.

`<wc-tree>` also wraps its generated filter in `.input-group`, because `forms.css` styles text
controls as `.form-group > input` / `.input-group > input` — a bare `<input>` rendered with the
browser's 2px inset border and square corners next to the framework's own rounded controls.

`schemaTreeNodes(schema, { idPrefix, maxDepth, prune })` is new in `@getvitops/generator`: it walks
a JSON Schema — the same walk behind the `authoring.md` / `config.md` references — and returns tree
**data**, not markup, so each medium renders it (markdown for agents, an accessible `<details>`
tree for a site). Field ids are dotted config paths (`site.analytics.clarityId`), so any field can
be linked to directly.

`prune` exists for a specific hazard. The project config declares `designSystem.themes` as a
looser shape than `DesignSystemSchema`, because the full one is applied separately by
`resolveTheme` — so its embedded copy is an **approximation**, and measurably missing the
descriptions for `colors`, `colors.palette`, `colors.roles` and `colors.utilities`. Anything
rendering that copy as the token reference would silently document the colour system less well
than the toolchain already does; `prune` lets a caller stop at the wrapper and render `jsonSchema`
alongside instead.

`renderInlineMarkdown()` is exported for schema description text. It **lifts code spans out before
applying emphasis**, and that ordering is load-bearing rather than tidy: `colors.utilities`
describes its families as `` `bg-*` ``, `` `text-*` ``, `` `border-*` `` — literal asterisk
_wildcards_. Run emphasis over the raw string and the `*` closing `bg-*` pairs with the one
closing `text-*`, italicising the text between two unrelated utilities and eating both asterisks,
leaving prose that names families which don't exist. It also now renders single-asterisk emphasis,
which the schema does use (`*presentation*`, `*domain properties*`) and which previously printed
the asterisks literally.

Also fixed: `config.md` claimed "Only the wrapper is listed here" under `designSystem` and then
emitted the entire token schema anyway — `themes.<name>` _is_ a design system, so the walk
descended into it. It now stops at the wrapper and delegates to `authoring.md` as it always said
it did.
