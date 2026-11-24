---
'@getvitops/core': minor
'@getvitops/generator': patch
---

**Accessibility fixes from a web-standards audit, batch B: component lifecycle.** Each was checked in a real browser (the `a11y` Playwright project), including moving the element in the DOM, which disconnects and reconnects it without re-rendering.

**Fixed**

- **`<wc-entries>` has its enhanced-state stylesheet back.** `patterns/entries.css` was lost in the move to `@getvitops/core` (it lived in `old-css-lib/`), so an upgraded element showed the stacked pairs _and_ the generated table at every width and the breakpoint did nothing. Restored and modernised: the `<dl>` is visually hidden (never `display: none`, so it stays in the accessibility tree) while the table is on screen, the column buttons are a real touch target, and the old `@apply sr-only` (which only ever worked under Tailwind) is plain declarations. All formats. The copies of each `<dd>` in the table now drop their `id`s and take any link or control out of the tab order, because the table is `aria-hidden` and focus on something a screen reader cannot announce is a trap.
- **`<wc-carousel>` Pause now sticks.** Hover, focus and the Pause button shared one flag, so pressing Pause while the pointer was over the carousel was undone the moment it left. The visitor's choice is now separate from transient holds, which are keyboard focus (not a mouse click's), pointer, being scrolled out of view, and a hidden tab. Holds no longer flip the button's label under the pointer, and the button no longer sets `aria-pressed` on top of a label that already changes between "Pause" and "Play" (which announced a pressed "Play").
- **Elements broke after a DOM move** (a view-transition swap, a client router, a reorder): `<wc-image-compare>` and `<wc-split-panel>` handles stopped responding to pointer and keyboard (`DragController` kept a stale handle reference), `<wc-marquee>` lost its Pause button and its resize observer (WCAG 2.2.2), `<wc-format>` stopped refreshing relative times, and `<wc-tree>` left nodes hidden behind a filter field that had been rebuilt empty.
- **`<wc-turnstile>` no longer traps the form when its script is blocked** (an ad blocker, a CSP, no network). It used to cancel every submit for ever, so a visitor with JavaScript could not send the form at all while one without could. A failed check now says so, releases a submit it was holding, and lets the form post token-less exactly as it does with no JS; `createConversionRoute`'s `turnstile.required` decides what that means. Its status line is a live region that exists, empty, from upgrade, instead of one un-hidden as its text is set.

Docs site: `.docs-prose table { display: block }` is now `table:not([class])`, because that unlayered rule was beating the framework's layered `display: none` on the entries table.

Affects all formats (CSS in css, bricks and tailwind alike; the web-component bundle in all formats). **Migration:** none. A consumer that styled `wc-entries` themselves should check it against the restored `patterns/entries.css`. Other fixed-group packages: no consumer-facing change.
