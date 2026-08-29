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
 * What isn't registered here yet — the editor-v2 pickers, the unbuilt components,
 * the element-display gap — is tracked in AGENTS.md's "Component architecture"
 * section, not here.
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
import '../web-components/WCCounter.js';
