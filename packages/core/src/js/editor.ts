/**
 * Live theme-editor entry — bundled to `dist/editor.js`, exported as
 * `@getvitops/core/editor`, loaded as an ES module.
 *
 * Deliberately separate from `elements.js`. The editor is *tooling*, not a page
 * pattern: it has no accessible no-JS fallback to progressively enhance, so it
 * fails the tier-2 bar every element in `elements.js` meets. Keeping it in its own
 * entry means a consumer opts into it explicitly (`getvitops({ editor: true })`)
 * and no production page pays for it.
 */
import '../web-components/WCThemeEditor.js';
