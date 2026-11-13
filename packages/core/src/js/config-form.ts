/**
 * Config-form entry — bundled to `dist/config-form.js`, exported as `@getvitops/core/config-form`,
 * loaded as an ES module.
 *
 * Its own entry rather than part of `elements.js` for the same two reasons `<wc-consent>` has one:
 * it carries no Lit (`<wc-config-form>` is a plain `HTMLElement`), and it carries the JSON Schema
 * validator and the form codec, which a page with no config form should not download. It enhances
 * `<wc-field>` (in `elements.js`) but does not import it, so the two load in either order.
 */
import '../web-components/WCConfigForm.js';
import '../web-components/WCRepeat.js';
