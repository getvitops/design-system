/**
 * Config-preview entry — bundled to `dist/config-preview.js`, exported as
 * `@getvitops/core/config-preview`, loaded as an ES module.
 *
 * `<wc-config-preview>` writes the CSS a config edit would produce into the page it is made on. Lit-free,
 * and its own entry: it is tooling for a config form, which most pages do not have. It carries no
 * generator; the host injects one (`<ConfigPreview>` does, with a dynamic import).
 */
import '../web-components/WCConfigPreview.js';
