---
'@getvitops/config': minor
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
---

Scroll-aware chrome (new CSS: all formats).

- **Masthead `behavior: 'reveal-on-scroll'`** keeps the bar off-screen while the page is at the top, so a hero fills the viewport, and slides it in on first scroll. It implies `position: fixed`, never hides while focused or a menu is open, and stays visible on a page too short to scroll. Firefox (no `scroll-state()`) shows it always.
- **`<BackToTop>`, `site.chrome.backToTop`** (rendered by `<SiteFooter config={site}>`) and **`<ScrollCue>`** (`.back-to-top`, `.scroll-cue`, new `scroll-button.css`). Plain `#anchor` links; hidden by `scroll-state()` queries, always shown where unsupported.
- **`<Toc headings>`** and a scrollspy fallback: `polyfills.js` now loads a small IntersectionObserver (`scroll-target-group` polyfill) that sets `.is-current` and `aria-current="location"` where `:target-current` is missing. New polyfill name `scroll-target-group` is valid in `vitops({ polyfills: { disable } })`.
- **`vitops_hero`** gains `scrollCue` and `scrollCueLabel` fields.
