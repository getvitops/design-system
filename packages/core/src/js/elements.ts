/**
 * Custom-element registration entry (docs + theme).
 *
 * Each import is side-effectful: the module runs its `customElements.define(...)`
 * at load, upgrading any matching light-DOM markup. Bundled to `dist/elements.js`
 * via `vp pack` (see vite.config.ts `pack.entry`) and loaded as an ES module.
 *
 * Every tag here is `wc-*` prefixed, and that is a rule rather than a convention:
 * `tiers.test.ts` asserts the prefix over every `customElements.define` in
 * `src/web-components/`. `color-scheme-toggle` and `wc-multifield` were the two
 * that drifted, renamed in 4.0.
 *
 * Colour/icon pickers + typography editor (WCColorWheel, WCOklchColorPicker,
 * WCIconPicker, WCTypography) are intentionally NOT registered here yet — they
 * belong to the editor-v2 track.
 *
 * TODO — foundational components not built yet:
 *   - **Combobox** — CSS shell only (`patterns/combobox.css`); the Lit component
 *     that makes it interactive doesn't exist.
 *   - **Dropdown / dropdown-item** — `.dropdown` (`patterns/dropdown.css`) is
 *     CSS/Popover-only, hover-or-click; a menu with roving-tabindex arrow keys,
 *     type-ahead and Escape-returns-focus (the ARIA `menu`/`menuitem` pattern)
 *     needs a component over it.
 *   - **Tabs / tab / tab-panel** — `tabs` is a generated pattern with no
 *     structural partial and no component (see `tiers.ts`); needs the WAI-ARIA
 *     tabs pattern (roving tabindex, arrow keys, `aria-selected`,
 *     `aria-controls`).
 *   - **Breadcrumbs** — no pattern at all yet. (`schemas/Breadcrumb.astro` is
 *     unrelated — Schema.org JSON-LD, not visual nav.) Likely CSS/astro only,
 *     no JS: a breadcrumb trail is `<nav aria-label="Breadcrumb"><ol>…` and
 *     needs nothing dynamic.
 *   - **Markdown** — render/enhance markdown content client-side. Library
 *     unchosen.
 *   - **OTP** — segmented one-time-passcode input: auto-advance between digits,
 *     paste-splitting a full code across them. Fallback is a plain `<input>`.
 *   - **QR** — QR code generation/display.
 *   - **Slider** — a range control, distinct from `<wc-split-panel>`'s drag
 *     divider (that resizes two panes; this picks a value).
 *   - **Format** — reads a machine value and renders a presentation of it, e.g.
 *     a relative date over `<time datetime>` (`"5 minutes ago"`), re-rendering
 *     as it goes stale. Fallback is the value already in the markup.
 *
 * KNOWN GAP — element display. An unregistered custom element is `display: inline`,
 * and most of these wrap block content, so before upgrade (or with `elements.js`
 * absent entirely) the tag forms an inline box around a block child. Only
 * `wc-tree` (`patterns/tree.css`), `wc-cards` (`patterns/card.css`),
 * `wc-carousel` (`patterns/carousel.css`), `wc-gallery` (`patterns/gallery.css`)
 * and `wc-theme-editor` (`patterns/theme-editor.css`) currently declare `display`;
 * `wc-color-scheme-toggle` and `wc-consent` manage their own visibility, so the
 * remaining seven are unaddressed. Fixing them means checking each pattern's
 * intended flow rather than blanket-setting `display: block`, since an element used
 * inline would regress — match the declaration to the content the element wraps.
 */
import '../web-components/WCSplitPanel.js';
import '../web-components/WCImageCompare.js';
import '../web-components/WCDismissable.js';
import '../web-components/WCCopy.js';
import '../web-components/WCCarousel.js';
import '../web-components/WCEntries.js';
import '../web-components/WCColorSchemeToggle.js';
import '../web-components/WCMultiField.js';
import '../web-components/WCMarquee.js';
import '../web-components/WCTree.js';
import '../web-components/WCCards.js';
import '../web-components/WCGallery.js';
