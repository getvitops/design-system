---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/emdash': minor
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/config': patch
'@getvitops/create': patch
---

**Added: tabs, breadcrumbs, combobox, format and range.** Each is tier 1 or a tier-2 element whose fallback is real and complete, and each has an Astro wrapper.

- **`<Breadcrumbs>`** (CSS + Astro, no JS): `<nav aria-label="Breadcrumb" class="breadcrumbs"><ol>`, the last item `aria-current="page"` and never a link, and the `BreadcrumbList` JSON-LD from the same items (`schema={false}` to omit). CSS: **all formats**.
- **`<Tabs>` / `<wc-tabs>`**: headed `<section>`s that are all readable with no JS; with it, a WAI-ARIA tablist (arrows on the axis `orientation` names, Home/End, automatic activation, wrapping), URL-fragment deep links including to something inside a panel, `hash` to write the fragment, `tabs-change`. The heading it turns into a tab label is hidden so the name isn't announced twice. EmDash: new `vitops_tabs` block. CSS: **all formats**. This replaces the "generated pattern only" `tabs` entry: the `tabs` config pattern still supplies the `panel` group tokens, now consumed by `patterns/tabs.css`.
- **`<Combobox>` / `<wc-combobox>`**: `<input list>` + `<datalist>` with no JS; with it, an ARIA 1.2 combobox (`aria-activedescendant`, Down/Up wrap, Enter chooses without submitting, Escape closes then clears, a live result count). A value that matches no option is kept: it suggests, it does not constrain. Replaces the CSS-only shell; `combobox.css` now opens on `:not([hidden])` so Escape can close it. CSS: **all formats**.
- **`<Format>` / `<wc-format>`**: a real `<time datetime>` / `<data value>` with the text already in it; with JS, a locale-aware relative time, date, number, percentage or currency read from the machine value, kept current at the next minute/hour boundary and paused while the tab is hidden. Anything it can't format is left as written. No CSS.
- **`<Range>` / `<wc-range>`**: one or two native range inputs (two submit as two fields) with no JS; with it, one track, thumbs that can't cross, the filled span and an `<output>`. A single slider needs no element: `forms.css` already themes `input[type='range']`. CSS: **all formats**.

`elements.js` grows from 28.1 KB to 31.8 KB gzipped for these four elements; the size budget moves to 33 KB.

**Fixed:** `<wc-image-compare position="25">` was ignored on first render (see the earlier entry).

**Not built:** dialog and a `role="menu"` dropdown. A dropdown is the native Popover API plus anchor positioning (`.dropdown--show-on-hover` for hover), which is how it is built today, so nothing was added.

`@getvitops/utils`, `cli`, `vite`, `config` and `create` — no consumer-facing change in these packages.
