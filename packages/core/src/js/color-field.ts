/**
 * Colour-field entry — bundled to `dist/color-field.js`, exported as `@getvitops/core/color-field`,
 * loaded as an ES module.
 *
 * `<wc-color-field>` offers the OKLCH picker the theme editor uses beside a colour text input. Its
 * own entry because the picker is a Lit element with a canvas: a config form with no colour field
 * should not download either. Lit comes from a chunk shared with `elements.js`, so a page loading
 * both fetches it once.
 */
import '../web-components/WCColorField.js';
