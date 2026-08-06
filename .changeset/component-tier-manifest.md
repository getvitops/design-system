---
'@getvitops/generator': minor
'@getvitops/cli': minor
---

Document which tier provides each pattern — `vitops docs components`.

The toolkit ships four tiers that compose: CSS framework classes, `<wc-*>` web components, Astro
components, Bricks elements. Nothing said so. The class reference listed pattern names, the
elements reference listed Bricks controls, and the fact that `tree` is _also_ a web component
_and_ an Astro component existed only in the source layout. The cost is silent: you hand-write
the markup a component already emits, or you wrap a component that already emits its own tag.

`TIERS` in `@getvitops/generator` is the new manifest — per pattern, its CSS partial and
representative classes, its `wc-*` tag and which bundle that ships in, its Astro component(s),
its Bricks element, and one line saying what to actually write. `tierPatterns(tier)` projects one
tier. `vitops docs components` renders all four in one document, and the reference sections it
feeds render the same data per tier.

It is **authored rather than derived, and drift-guarded** instead. Naming convention carries most
of it and breaks exactly where it matters — `splitter.css` hosts two components, `tag.css` serves
three config patterns, `anchor-link.css` provides `.link`, `layout.css` provides `.split` and
`.centered` — so a derivation would need an exceptions table longer than the rule, and a rename
would silently drop a link. Instead, tests fail the build when a hand-written CSS partial, a
`customElements.define`, an exported Astro component or a Bricks element isn't accounted for.

Four things the manifest records that cannot be inferred, each a real failure mode:

- **Whether an Astro component wraps a web component.** `Tree` and `CookieConsent` emit the
  `<wc-*>` tag with the fallback inside; `Details`, `Drawer`, `Popover`, `NavShell` and `Subgrid`
  emit tier-1 markup with no web component at all. Reading the first group as the second gives
  `<wc-tree><Tree /></wc-tree>` — two elements on one tree, which renders and misbehaves.
- **Where each element ships.** `elements.js` for the registered set, its own bundle for
  `<wc-consent>` and `<wc-theme-editor>`, and **no bundle at all** for the four editor-v2 tags —
  which are registered, importable-looking and inert in a consumer project. The guard checks this
  against what `js/elements.ts` imports, so it can't claim an element ships when it doesn't.
- **Whether a pattern is config-authored.** `patterns.items` patterns get the token cascade,
  states, role variants and override hooks; a structural partial gets none of them. The docs also
  now say when a config-authored pattern is **absent from your config**, because naming its
  classes while your build emits none of them is worse than omitting it.
- **The import specifier, verbatim.** These are published as the line to copy, so they are checked
  against `@getvitops/astro`'s `exports`. That guard immediately caught
  `@getvitops/astro/components/../CookieConsent.astro` — plausible-looking, right basename, not an
  importable path (`CookieConsent.astro` ships from the package root).
