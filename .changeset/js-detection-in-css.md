---
'@getvitops/core': minor
'@getvitops/astro': minor
---

Detect JavaScript and scroll-driven timelines in CSS, so no-JS visitors stop getting invisible
content.

`animation.css` gated two rules on classes that had to be put on `<html>`: `no-js`, which the
framework expected an author to write into their own markup, and `.no-scroll-timeline`, which an
inline `<head>` snippet was supposed to set. **That snippet never shipped.** Three source comments
described it and nothing implemented it, so on every Astro and Bricks site the `:root:not(.no-js)`
gate matched unconditionally and `.animate-trigger` stayed `animation-play-state: paused` with no
`IntersectionObserver` coming to release it. An entrance animation that never runs is `opacity: 0`.

Both gates are now platform queries:

```css
@media (scripting: enabled) {
  .animate-trigger {
    animation-play-state: paused;
  }
  /* …released by .is-active */
}

@supports not (animation-timeline: view()) {
  :where(.animate-view, .animate-scroll) {
    animation: none;
  }
}
```

Nothing to install, nothing to remember, and correct for consumers the old approach could not reach —
a Bricks site, or anyone rendering their own `<head>`. It also fails the right way round: an engine
that doesn't know either feature drops the block and the animation simply runs, costing an
enhancement rather than hiding the page.

**Nothing to do to adopt this.** Drop `class="no-js"` from your `<html>` and any script that removes
it if you like — both are inert now, not harmful. `<Head />` no longer emits a class-flipping script.

Support is baseline: `scripting` shipped in Firefox 113, Safari 17 and Chrome 120, all in 2023.
