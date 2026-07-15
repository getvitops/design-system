/**
 * Custom-element registration entry (docs + theme).
 *
 * Each import is side-effectful: the module runs its `customElements.define(...)`
 * at load, upgrading any matching light-DOM markup. Bundled to `dist/elements.js`
 * via `vp pack` (see vite.config.ts `pack.entry`) and loaded as an ES module.
 *
 * Colour/icon pickers + typography editor (WCColorWheel, WCOklchColorPicker,
 * WCIconPicker, WCTypography) are intentionally NOT registered here yet — they
 * belong to the editor-v2 track. Combobox is still a CSS shell (see forms.css);
 * its Lit component is a TODO.
 */
import '../web-components/WCSplitPanel.js';
import '../web-components/WCImageCompare.js';
import '../web-components/WCDismissable.js';
import '../web-components/WCCopy.js';
import '../web-components/WCCarousel.js';
import '../web-components/WCEntries.js';
import '../web-components/WCColorSchemeToggle.js';
import '../web-components/WCMultiField.js';
