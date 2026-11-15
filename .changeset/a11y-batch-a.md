---
'@getvitops/core': minor
'@getvitops/astro': minor
---

**Accessibility fixes from a web-standards audit, batch A: overlays, form feedback, nav, icons, tabs.** Each was checked in a real browser (the new `a11y` Playwright project) as well as in happy-dom.

**Breaking**

- **`<Drawer>` always renders a close button, and the dialog is now named.** A modal with no visible close control strands a touch user on an engine without `closedby` (no Esc key, no light dismiss), and an unnamed dialog is announced as just "dialog". New props: `label` (the dialog's accessible name, defaulting to the trigger's label), `closeLabel` (default "Close") and `closeButton` (default `true`). **Migration:** a drawer whose slotted content already has its own `<button command="close" commandfor="…">` passes `closeButton={false}` to avoid two; every other drawer gains the button with no change. `.drawer__close` is new CSS (css/bricks/tailwind: all formats).
- **Form errors are announced through one page-level region, not per-field live regions.** `<wc-field>` no longer puts `aria-live` on its error node (a server-rendered one is removed on upgrade); an error that appears when the visitor leaves a field is spoken once, 500 ms later, through a single polite region shared by the page. **Migration:** CSS or tests that targeted `.field__error[aria-live]` should not; assistive-tech behaviour is otherwise a strict improvement. `aria-invalid` is now `"false"` until an error shows, instead of absent.
- **`<SiteNav>` desktop submenus no longer open on `:focus-within`.** Tabbing past a top-level link used to pop its submenu open and put every submenu link in the Tab order. The caret disclosure (Enter or Space) is the keyboard path; hover still previews. All formats (the tailwind format inlines the same partial).

**Fixed**

- `<wc-field>` and `<wc-config-form>` reported an error for a required field the visitor only tabbed past, re-announced the same message on every keystroke (the field cleared it and the host re-set it within one event), and announced every invalid field at once after a failed submit. They now wait for an edit, leave an unchanged message untouched, and the host asks the field to announce on blur. `setError` ignores a message it already has. New `WCField.announceError()`.
- `<wc-stepper>`: Enter that confirms an IME composition (Japanese, Chinese, Korean) no longer advances a step. A step's "complete" / "needs attention" state is real text (`.stepper__state`, with `complete-label` / `invalid-label` and `<StepperNav completeLabel invalidLabel>`), not only a CSS glyph.
- `<wc-tabs>`: the tablist takes a name (`label`, `aria-label` or `aria-labelledby` on the element, or `<Tabs label>`), and inactive panels are `hidden="until-found"` so find-in-page reaches them and brings the matching tab forward.
- Mask icons (`.icon-mask`, link and external-link icons, the multifield delete button, the `<wc-copy>` icon) are painted with `forced-color-adjust: none` under forced-colors; they were Canvas on Canvas, so icon-only controls vanished in Windows High Contrast.
- `scroll-padding-block-start` and `scrollbar-gutter` no longer sit inside `prefers-reduced-motion: no-preference`, so visitors who ask for less motion no longer land under a sticky masthead. Smooth scrolling still waits for `no-preference`.
- Informational dimming below `opacity: 0.7` (the site nav empty state, carousel markers, dialog, notification and combobox close icons) is raised to 0.7, the measured floor for 4.5:1 text contrast on the shipped palette. A test (`css-opacity-floor.test.ts`) keeps it there, with a named exemption list for disabled, decorative and transient states.

Affects all formats (CSS in css, bricks and tailwind alike; the web-component bundle in all formats). Other fixed-group packages: no consumer-facing change.
