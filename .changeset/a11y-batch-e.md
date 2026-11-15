---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/generator': patch
'@getvitops/create': minor
---

**Right-to-left, dark-mode, tooltip and form fixes from a web-standards audit, batch E.** Checked in a real browser where the behaviour is visible (RTL slide direction, tooltip hover, focus and Escape).

**Breaking**

- **`<wc-copy>` fires `copy-success`, not `copy`.** A bubbling `CustomEvent` named `copy` ran every page-level clipboard listener with an event that has no `clipboardData`. The detail is now `{ value }` and carries the copied text even when it came from the slot rather than a `value` attribute. **Migration:** rename `addEventListener('copy', …)` on a `<wc-copy>` to `'copy-success'`. There is no `vitops lint --fix` rule, because the event name lives in consumer JavaScript, not in a class or token.
- **`<wc-combobox>` keeps an author's `autocomplete`.** It used to overwrite it with `off`. It now sets `off` only when the attribute is absent. **Migration:** none for a combobox that never set one; one that did gets what it asked for.
- **`aria-orientation` on `<wc-image-compare>` and `<wc-split-panel>` is the orientation of the separator line, not the direction it slides.** A handle that slides left and right is a vertical separator, so the default now says `vertical` (it said `horizontal`). Anything keyed on the old value, such as an e2e selector, needs the flip.
- **`@getvitops/astro`'s `<Head />` loads `deferred.js` as `type="module"`** instead of a classic `defer` script, so its top-level declarations no longer share a global scope with other scripts on the page. **Migration:** none for `<Head />` users. A hand-written `<script defer src=".../deferred.js">` should become `<script type="module" …>`.

**Added**

- **Tooltips respond to hover and keyboard focus, and Escape closes them** (WCAG 1.4.13). The comment above the pattern said `deferred.ts` did this; that code was gone, so a tooltip opened only on click. `js/tooltip.ts` (in `deferred.js`) now opens a `popover="manual"` `.tooltip` on hover and on `:focus-visible`, keeps it open while the pointer is on the tooltip itself (it no longer sets `pointer-events: none`), and gives each trigger its own anchor name plus `role="tooltip"` and `aria-describedby`. The `popovertarget` click toggle remains the no-JS fallback. `TODO(support)`: move to `interestfor` and `popover="hint"` once `interestfor` meets the support threshold in AGENTS.md (Chromium-only today). Marking the tooltip `popover="manual"` rather than a bare `popover` is the one markup change. Browser bundle, all formats; the CSS change is all formats.
- **`<wc-color-scheme-toggle>` labels are overridable** with `group-label`, `system-label`, `light-label` and `dark-label` (English defaults), for a non-English page.
- **`<Field group>`** renders a `<fieldset>` with the label as its `<legend>` for a radio or checkbox group, linked by `aria-describedby` to its help text and a server-rendered error when the field has an `id`.
- **Scaffolded layouts** (both templates) gain a skip link and an `id` on `<main>`, and take `<html lang>` from the first locale in `site.json` instead of a hard-coded `en`.
- **`<Details>`** now renders its `items` as a link list when the `content` slot is empty. It declared a required `items` prop and never used it; the prop is optional now.

**Fixed**

- **RTL slide direction.** Panels pinned to the inline end slid in from the physical right in an RTL page, because a `translate` does not flip with logical insets. `animation.css` defines `--dir-sign` (`1` or `-1`, following `dir` on any element, so a nested `dir="ltr"` island is handled) and the site nav, nav, drawer, tag and notification translates multiply by it. Progress-bar `transform-origin` is logical. css/bricks and tailwind (patterns are inlined in all formats).
- **Dialogs:** `dvh` instead of `vh` so a tall dialog is not hidden behind a phone's address bar, `overscroll-behavior: contain`, and the page behind a modal no longer scrolls. `.sticky` sidebars use `dvh` too. All formats.
- **Dark mode:** the badge indicator used the danger text colour (pale in dark mode) behind white text; it now uses the solid and its computed foreground, which the build contrast-checks in both appearances. Table stripes and hover tint the text colour instead of black, and a sticky header has an opaque background. All formats.
- **Motion:** `.status-dot--pulse` only animates under `prefers-reduced-motion: no-preference`, and so does the cross-document `@view-transition`. The `::view-transition-children(*)` rule that followed it was not a real pseudo-element and set nothing; it is removed. The scroll progress bar is hidden where `animation-timeline` is unsupported rather than stuck at zero.
- **`<wc-dismissable>`'s countdown pauses** while the pointer is over it or keyboard focus is inside, and resumes with the time that was left (WCAG 2.2.1).
- **`<wc-combobox>`'s active option** has an outline as well as a background, so it is visible in forced colors.
- **`.table--bordered` has a rounded frame and draws each seam once.** `border-radius` did nothing under `border-collapse: collapse`. The table is now `separate`, draws the outer frame itself, and each cell draws only the lines between cells, with `overflow: clip` rounding the corners without breaking `.table--sticky-header`. Checked for `colspan`, `rowspan`, a two-row header, `<colgroup>` and `<tfoot>` at three device pixel ratios. The visible change is slightly different corner rendering, and a consumer rule that borders `td`/`th` on all sides will double the lines again. All formats.
- **`<wc-range>`:** when both thumbs sit together near the end, the lower one is raised so the pair can be dragged apart again. They were stuck.

**Packages.** `@getvitops/generator` only carries the refreshed asset snapshot and the tooltip line in the component manifest. Other fixed-group packages: no consumer-facing change in this package.
