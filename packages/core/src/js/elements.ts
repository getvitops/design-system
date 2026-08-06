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
 * belong to the editor-v2 track. Combobox is still a CSS shell (see forms.css);
 * its Lit component is a TODO.
 *
 * KNOWN GAP — element display. An unregistered custom element is `display: inline`,
 * and most of these wrap block content, so before upgrade (or with `elements.js`
 * absent entirely) the tag forms an inline box around a block child. Only
 * `wc-tree` (`patterns/tree.css`) and `wc-theme-editor`
 * (`patterns/theme-editor.css`) currently declare `display`; `wc-color-scheme-toggle`
 * and `wc-consent` manage their own visibility, so the remaining eight are
 * unaddressed. Fixing them means checking each pattern's intended flow rather than
 * blanket-setting `display: block`, since an element used inline would regress.
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
